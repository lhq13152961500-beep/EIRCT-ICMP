#!/usr/bin/env python3
import pty
import os
import sys
import select
import time
import subprocess

def kill_port(port):
    try:
        result = subprocess.run(
            ["lsof", "-ti", f":{port}"],
            capture_output=True, text=True
        )
        pids = result.stdout.strip().split()
        for pid in pids:
            if pid:
                subprocess.run(["kill", "-9", pid], capture_output=True)
                sys.stdout.write(f"[killed PID {pid} using port {port}]\n")
                sys.stdout.flush()
        if pids:
            time.sleep(1.0)
    except Exception as e:
        sys.stdout.write(f"[port cleanup warning: {e}]\n")

def main():
    kill_port(8081)

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
        anon_answered = False
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

                        # Auto-answer "Proceed anonymously" prompt
                        if not anon_answered and ('Proceed anonymously' in buf_str or 'recommended to log in' in buf_str):
                            time.sleep(0.3)
                            os.write(master_fd, b'\x1b[B\r')
                            anon_answered = True
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
