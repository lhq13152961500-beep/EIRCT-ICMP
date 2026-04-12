#!/usr/bin/env python3
import pty
import os
import sys
import select
import time
import subprocess
import threading


def kill_port_8081():
    """Kill any process using port 8081 via /proc/net/tcp on Linux."""
    try:
        result = subprocess.run(["fuser", "-k", "8081/tcp"], capture_output=True)
        if result.returncode == 0:
            sys.stdout.write("[killed process on port 8081 via fuser]\n")
            time.sleep(1.0)
            return
    except FileNotFoundError:
        pass

    try:
        target_hex = format(8081, '04X')
        with open("/proc/net/tcp") as f:
            lines = f.readlines()[1:]
        pids_to_kill = set()
        for line in lines:
            parts = line.split()
            if len(parts) < 4:
                continue
            local_addr = parts[1]
            port_hex = local_addr.split(":")[1] if ":" in local_addr else ""
            if port_hex.upper() == target_hex:
                inode = parts[9]
                for pid_dir in os.listdir("/proc"):
                    if not pid_dir.isdigit():
                        continue
                    fd_dir = f"/proc/{pid_dir}/fd"
                    try:
                        for fd in os.listdir(fd_dir):
                            link = os.readlink(f"{fd_dir}/{fd}")
                            if f"socket:[{inode}]" in link:
                                pids_to_kill.add(pid_dir)
                    except (PermissionError, FileNotFoundError):
                        pass
        for pid in pids_to_kill:
            try:
                os.kill(int(pid), 9)
                sys.stdout.write(f"[killed PID {pid} on port 8081]\n")
            except (ProcessLookupError, PermissionError):
                pass
        if pids_to_kill:
            time.sleep(1.0)
    except Exception as e:
        sys.stdout.write(f"[port 8081 cleanup skipped: {e}]\n")


def run_expo():
    kill_port_8081()

    env = os.environ.copy()
    env['NODE_OPTIONS'] = '--max-old-space-size=512 --expose-gc'
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
        os.execvpe('npx', ['npx', 'expo', 'start', '--go', '--tunnel', '--max-workers', '1'], env)
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
            # Exponential back-off: 3min, 6min, 12min, 15min cap
            wait = min(180 * (2 ** (ngrok_fails - 1)), 900)
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
            if since_last < 1200:  # rapid OOM (< 20 min): longer wait
                rapid_oom_count = getattr(main, '_rapid_oom', 0) + 1
                main._rapid_oom = rapid_oom_count
                # Escalating: 300s, 420s, 600s, 900s (cap)
                wait = min(300 * (1 + (rapid_oom_count - 1) * 0.5), 900)
                wait = int(wait)
            else:
                main._rapid_oom = 0
                wait = 120  # infrequent OOM: 2-min cooldown is enough
            sys.stdout.write(f'[Metro OOM #{oom_count} — waiting {wait}s before restart...]\n')
            sys.stdout.flush()
            time.sleep(wait)
            continue
        break


if __name__ == '__main__':
    main()
