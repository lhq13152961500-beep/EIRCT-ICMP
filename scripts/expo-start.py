#!/usr/bin/env python3
import pty
import os
import sys
import select
import time
import subprocess
import threading
import urllib.request

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


def prewarm_bundle():
    """Hit Metro's bundle endpoint locally to pre-build the bundle cache."""
    sys.stdout.write("[Pre-warming Metro bundle cache — this reduces OOM on first connect...]\n")
    sys.stdout.flush()
    bundle_url = (
        "http://localhost:8081/node_modules/expo-router/entry.bundle"
        "?platform=android&dev=true&minify=false&inlineSourceMap=false"
    )
    try:
        req = urllib.request.Request(bundle_url, headers={"User-Agent": "prewarm"})
        with urllib.request.urlopen(req, timeout=180) as resp:
            size = 0
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                size += len(chunk)
            sys.stdout.write(f"[Bundle pre-warm complete: {size // 1024}KB cached]\n")
            sys.stdout.flush()
    except Exception as e:
        sys.stdout.write(f"[Bundle pre-warm error (non-fatal): {e}]\n")
        sys.stdout.flush()


def run_expo():
    kill_port_8081()

    env = os.environ.copy()
    env['NODE_OPTIONS'] = '--max-old-space-size=800'
    # Disable inline source maps to reduce bundle memory footprint
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
        os.execvpe('npx', ['npx', 'expo', 'start', '--go', '--tunnel'], env)
    else:
        os.close(slave_fd)
        last_anon_answer = 0.0
        buffer = b''
        tunnel_ready = False
        prewarm_done = False

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
                            sys.stdout.write('\n[Ngrok tunnel error detected — will retry in 5s]\n')
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

                        # Detect OOM kill
                        if buf_str.strip().endswith('Killed') or '\nKilled\n' in buf_str:
                            sys.stdout.write('\n[Process OOM-killed — will retry in 5s]\n')
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

                        # Pre-warm bundle once tunnel is ready (with delay so Metro fully inits)
                        if not tunnel_ready and 'Tunnel ready' in buf_str:
                            tunnel_ready = True

                        if tunnel_ready and not prewarm_done:
                            prewarm_done = True
                            def _delayed_prewarm():
                                time.sleep(15)  # Let Metro fully initialize first
                                prewarm_bundle()
                            t = threading.Thread(target=_delayed_prewarm, daemon=True)
                            t.start()

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
    while True:
        attempt += 1
        if attempt > 1:
            sys.stdout.write(f'\n[Retrying Expo start (attempt {attempt})...]\n')
            sys.stdout.flush()
        result = run_expo()
        if result == "ngrok_error":
            time.sleep(60)
            continue
        break

if __name__ == '__main__':
    main()
