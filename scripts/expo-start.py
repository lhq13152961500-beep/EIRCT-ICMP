#!/usr/bin/env python3
import pty
import os
import sys
import select
import time
import subprocess
import threading


METRO_PORT = 8083

def _pids_on_port(port):
    """Return set of PIDs listening on the given TCP port via /proc/net/tcp."""
    pids = set()
    try:
        target_hex = format(port, '04X')
        for tcp_file in ("/proc/net/tcp", "/proc/net/tcp6"):
            try:
                with open(tcp_file) as f:
                    lines = f.readlines()[1:]
            except FileNotFoundError:
                continue
            inodes = set()
            for line in lines:
                parts = line.split()
                if len(parts) < 10:
                    continue
                local_addr = parts[1]
                port_hex = local_addr.split(":")[1] if ":" in local_addr else ""
                if port_hex.upper() == target_hex:
                    inodes.add(parts[9])
            for pid_dir in os.listdir("/proc"):
                if not pid_dir.isdigit():
                    continue
                fd_dir = f"/proc/{pid_dir}/fd"
                try:
                    for fd in os.listdir(fd_dir):
                        try:
                            link = os.readlink(f"{fd_dir}/{fd}")
                            if any(f"socket:[{inode}]" in link for inode in inodes):
                                pids.add(pid_dir)
                        except (PermissionError, FileNotFoundError):
                            pass
                except (PermissionError, FileNotFoundError):
                    pass
    except Exception as e:
        sys.stdout.write(f"[port scan error: {e}]\n")
    return pids


def _kill_pids(pids, label=""):
    for pid in pids:
        try:
            os.kill(int(pid), 9)
            sys.stdout.write(f"[killed PID {pid}{' ' + label if label else ''}]\n")
        except (ProcessLookupError, PermissionError):
            pass


def kill_metro_port():
    """Kill every process that could block a clean Expo/Metro start."""
    killed_any = False

    my_pid = os.getpid()

    # 1. Kill ngrok binary processes (they hold the tunnel and block reconnect)
    try:
        result = subprocess.run(["pkill", "-9", "-f", "ngrok-bin"], capture_output=True)
        if result.returncode == 0:
            sys.stdout.write("[killed ngrok-bin processes]\n")
            killed_any = True
    except FileNotFoundError:
        pass

    # Also kill by process name "ngrok"
    try:
        out = subprocess.check_output(["pgrep", "-f", "ngrok"], text=True)
        for pid_str in out.strip().splitlines():
            pid_int = int(pid_str.strip())
            if pid_int == my_pid:
                continue
            try:
                os.kill(pid_int, 9)
                sys.stdout.write(f"[killed ngrok PID {pid_int}]\n")
                killed_any = True
            except (ProcessLookupError, PermissionError):
                pass
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass

    # 2. Kill node processes running metro bundler (not this script)
    try:
        out = subprocess.check_output(["pgrep", "-f", "metro"], text=True)
        for pid_str in out.strip().splitlines():
            pid_int = int(pid_str.strip())
            if pid_int == my_pid:
                continue
            try:
                os.kill(pid_int, 9)
                sys.stdout.write(f"[killed metro PID {pid_int}]\n")
                killed_any = True
            except (ProcessLookupError, PermissionError):
                pass
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass

    # 3. Kill by port — clear any stale binding
    for port in (8081, 8082, 8083):
        try:
            result = subprocess.run(["fuser", "-k", f"{port}/tcp"], capture_output=True)
            if result.returncode == 0:
                sys.stdout.write(f"[killed process on port {port} via fuser]\n")
                killed_any = True
        except FileNotFoundError:
            pass
        pids = _pids_on_port(port)
        if pids:
            _kill_pids(pids, f"on port {port}")
            killed_any = True

    if killed_any:
        time.sleep(2.0)


def run_expo():
    kill_metro_port()

    env = os.environ.copy()
    env['NODE_OPTIONS'] = '--max-old-space-size=1024 --expose-gc'
    env['EXPO_NO_INLINE_SOURCEMAPS'] = '1'
    env['REACT_NATIVE_PACKAGER_HOSTNAME'] = 'localhost'

    master_fd, slave_fd = pty.openpty()

    pid = os.fork()
    if pid == 0:
        os.close(master_fd)
        os.setsid()
        import fcntl, termios
        fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        if slave_fd > 2:
            os.close(slave_fd)
        os.execvpe('npx', ['npx', 'expo', 'start', '--go', '--tunnel', '--port', str(METRO_PORT), '--max-workers', '1', '--reset-cache'], env)
    else:
        os.close(slave_fd)
        last_anon_answer = 0.0
        buffer = b''

        while True:
            try:
                r, _, _ = select.select([master_fd, sys.stdin.fileno()], [], [], 0.5)
                for fd in r:
                    if fd == master_fd:
                        try:
                            data = os.read(master_fd, 4096)
                        except OSError:
                            return "ngrok_error"
                        if not data:
                            return "exit"
                        sys.stdout.buffer.write(data)
                        sys.stdout.buffer.flush()
                        buffer += data

                        buf_str = buffer.decode('utf-8', errors='ignore')

                        # Detect Ngrok tunnel error and signal retry
                        if 'CommandError' in buf_str and ('body' in buf_str or 'ngrok' in buf_str.lower() or 'Ngrok' in buf_str):
                            sys.stdout.write('\n[Ngrok rate-limited — will wait before retry]\n')
                            sys.stdout.flush()
                            try:
                                os.kill(pid, 9)
                            except OSError:
                                pass
                            try:
                                os.waitpid(pid, 0)
                            except ChildProcessError:
                                pass
                            try:
                                os.close(master_fd)
                            except OSError:
                                pass
                            return "ngrok_error"

                        # Detect V8 heap OOM (FATAL ERROR: Reached heap limit)
                        if 'FATAL ERROR' in buf_str and ('heap' in buf_str.lower() or 'out of memory' in buf_str.lower()):
                            sys.stdout.write('\n[Metro V8 OOM (FATAL ERROR) — restarting...]\n')
                            sys.stdout.flush()
                            try:
                                os.kill(pid, 9)
                            except OSError:
                                pass
                            try:
                                os.waitpid(pid, 0)
                            except ChildProcessError:
                                pass
                            try:
                                os.close(master_fd)
                            except OSError:
                                pass
                            return "oom"

                        # Detect OOM kill — Metro served the bundle and died; restart quietly
                        if buf_str.strip().endswith('Killed') or '\nKilled\n' in buf_str or 'Aborted (core dumped)' in buf_str:
                            sys.stdout.write('\n[Metro OOM after bundle served — restarting...]\n')
                            sys.stdout.flush()
                            try:
                                os.kill(pid, 9)
                            except OSError:
                                pass
                            try:
                                os.waitpid(pid, 0)
                            except ChildProcessError:
                                pass
                            try:
                                os.close(master_fd)
                            except OSError:
                                pass
                            return "oom"

                        # Auto-answer "Proceed anonymously" prompt
                        if ('Proceed anonymously' in buf_str or 'recommended to log in' in buf_str):
                            now = time.time()
                            if now - last_anon_answer > 3.0:
                                time.sleep(0.3)
                                os.write(master_fd, b'\x1b[B\r')
                                last_anon_answer = now
                                buffer = b''
                                sys.stdout.write('\n[auto-selected: Proceed anonymously]\n')
                                sys.stdout.flush()

                        # Auto-answer port-in-use prompt with Y
                        elif 'Use port' in buf_str and 'instead?' in buf_str:
                            time.sleep(0.2)
                            os.write(master_fd, b'y\r')
                            buffer = b''
                            sys.stdout.write('\n[auto-selected: Yes, use next port]\n')
                            sys.stdout.flush()

                    elif fd == sys.stdin.fileno():
                        try:
                            data = os.read(sys.stdin.fileno(), 1024)
                            if data:
                                os.write(master_fd, data)
                        except OSError:
                            pass
            except KeyboardInterrupt:
                try:
                    os.kill(pid, 15)
                except OSError:
                    pass
                sys.exit(0)
            except OSError:
                return "exit"

        os.waitpid(pid, 0)
        return "exit"


def main():
    attempt = 0
    ngrok_fails = 0
    oom_count = 0
    last_oom_time = 0.0
    while True:
        attempt += 1
        if attempt > 1:
            sys.stdout.write(f'\n[Retrying Expo start (attempt {attempt})...]\n')
            sys.stdout.flush()
        result = run_expo()
        if result == "ngrok_error":
            ngrok_fails += 1
            # Fixed 15-min wait — give Ngrok rate-limit window time to fully reset
            wait = 900
            sys.stdout.write(f'[Waiting {wait}s for Ngrok rate-limit to reset (fail #{ngrok_fails})...]\n')
            sys.stdout.flush()
            time.sleep(wait)
            continue
        if result == "oom":
            # OOM = bundle was served successfully; Metro ran out of memory.
            # Each restart opens a new Ngrok tunnel — too many rapid restarts
            # exhaust Ngrok's rate-limit window and cause cascading failures.
            # Scale wait with consecutive rapid OOMs to protect Ngrok quota.
            oom_count += 1
            now = time.time()
            since_last = now - last_oom_time
            last_oom_time = now
            ngrok_fails = 0  # successful connection, reset fail count
            if since_last < 1800:  # rapid OOM (< 30 min): longer wait
                rapid_oom_count = getattr(main, '_rapid_oom', 0) + 1
                main._rapid_oom = rapid_oom_count
                # Escalating: 600s, 720s, 900s (cap) — gives Ngrok time to breathe
                wait = min(600 + (rapid_oom_count - 1) * 120, 900)
                wait = int(wait)
            else:
                main._rapid_oom = 0
                wait = 300  # infrequent OOM: 5-min cooldown
            sys.stdout.write(f'[Metro OOM #{oom_count} — waiting {wait}s before restart...]\n')
            sys.stdout.flush()
            time.sleep(wait)
            continue
        break


if __name__ == '__main__':
    main()
