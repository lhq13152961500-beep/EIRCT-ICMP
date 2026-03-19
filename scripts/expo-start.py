#!/usr/bin/env python3
import pty
import os
import sys
import select
import time
import subprocess

def kill_port_8081():
    """Kill any process using port 8081 via /proc/net/tcp on Linux."""
    try:
        # Try fuser first
        result = subprocess.run(["fuser", "-k", "8081/tcp"], capture_output=True)
        if result.returncode == 0:
            sys.stdout.write("[killed process on port 8081 via fuser]\n")
            time.sleep(1.0)
            return
    except FileNotFoundError:
        pass

    try:
        # Fallback: parse /proc/net/tcp to find PID
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
                # Find PID via /proc/*/fd -> socket inode
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

def main():
    kill_port_8081()

    env = os.environ.copy()

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

        while True:
            try:
                r, _, _ = select.select([master_fd, sys.stdin.fileno()], [], [], 0.5)
                for fd in r:
                    if fd == master_fd:
                        try:
                            data = os.read(master_fd, 4096)
                        except OSError:
                            sys.exit(0)
                        if not data:
                            sys.exit(0)
                        sys.stdout.buffer.write(data)
                        sys.stdout.buffer.flush()
                        buffer += data

                        buf_str = buffer.decode('utf-8', errors='ignore')

                        # Auto-answer "Proceed anonymously" prompt (can repeat multiple times)
                        if ('Proceed anonymously' in buf_str or 'recommended to log in' in buf_str):
                            now = time.time()
                            if now - last_anon_answer > 3.0:
                                time.sleep(0.3)
                                os.write(master_fd, b'\x1b[B\r')
                                last_anon_answer = now
                                buffer = b''
                                sys.stdout.write('\n[auto-selected: Proceed anonymously]\n')
                                sys.stdout.flush()

                        # Auto-answer port-in-use prompt with Y (use next port)
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
                os.kill(pid, 15)
                sys.exit(0)
            except OSError:
                sys.exit(0)

        os.waitpid(pid, 0)

if __name__ == '__main__':
    main()
