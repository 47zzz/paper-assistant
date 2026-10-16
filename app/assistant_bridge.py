#!/usr/bin/env python3
"""Run an interactive program (Claude Code) inside a pty and let the Paper Assistant server inject
prompts into it through a unix socket.

Usage: assistant_bridge.py --socket PATH -- claude [args...]

The terminal you launch this in behaves exactly like running the program directly (raw mode, resize
forwarding). Anything written to the socket as JSON lines {"text": "..."} is typed into the program as a
bracketed paste followed by Enter, which is how "Explain this" / "Ask about this" from the PDF reader
reach the running Claude session on the other screen.
"""
from __future__ import annotations

import argparse
import array
import fcntl
import json
import os
import pty
import select
import signal
import socket
import sys
import termios
import time
import tty


def set_winsize(fd: int, rows: int, cols: int):
    try:
        fcntl.ioctl(fd, termios.TIOCSWINSZ, array.array("h", [rows, cols, 0, 0]))
    except Exception:
        pass


def get_winsize(fd: int) -> tuple[int, int]:
    try:
        buf = array.array("h", [0, 0, 0, 0])
        fcntl.ioctl(fd, termios.TIOCGWINSZ, buf, True)
        return buf[0], buf[1]
    except Exception:
        return 40, 120


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--socket", required=True)
    ap.add_argument("cmd", nargs=argparse.REMAINDER)
    a = ap.parse_args()
    cmd = [c for c in a.cmd if c != "--"] if a.cmd and a.cmd[0] == "--" else a.cmd
    if not cmd:
        ap.error("command required after --")

    try:
        os.unlink(a.socket)
    except FileNotFoundError:
        pass
    os.makedirs(os.path.dirname(a.socket), exist_ok=True)
    srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    srv.bind(a.socket)
    os.chmod(a.socket, 0o600)
    srv.listen(4)
    srv.setblocking(False)

    pid, master = pty.fork()
    if pid == 0:  # child
        os.environ["PAPER_ASSISTANT_BRIDGE"] = "1"
        try:
            os.execvp(cmd[0], cmd)
        except Exception as e:
            sys.stderr.write("cannot run %s: %s\n" % (cmd[0], e))
            os._exit(127)

    stdin_fd, stdout_fd = sys.stdin.fileno(), sys.stdout.fileno()
    is_tty = os.isatty(stdin_fd)
    old_attrs = None
    for sig in (signal.SIGTERM, signal.SIGHUP):
        signal.signal(sig, lambda *_: (_ for _ in ()).throw(SystemExit(0)))
    if not is_tty:
        set_winsize(master, 40, 120)
    if is_tty:
        rows, cols = get_winsize(stdin_fd)
        set_winsize(master, rows, cols)
        old_attrs = termios.tcgetattr(stdin_fd)
        tty.setraw(stdin_fd)

    def on_winch(*_):
        if is_tty:
            r, c = get_winsize(stdin_fd)
            set_winsize(master, r, c)
            try:
                os.kill(pid, signal.SIGWINCH)
            except Exception:
                pass
    signal.signal(signal.SIGWINCH, on_winch)

    queue: list[bytes] = []   # pending injections
    next_send = 0.0
    clients: list[socket.socket] = []
    bufs: dict[int, bytes] = {}

    def inject(text: str):
        text = text.replace("\r\n", "\n").rstrip("\n")
        if not text:
            return
        queue.append(b"\x1b[200~" + text.encode("utf-8") + b"\x1b[201~")
        queue.append(b"\r")

    rc = 0
    try:
        while True:
            fds = [master, srv] + clients + ([stdin_fd] if is_tty else [])
            timeout = 0.05 if queue else 1.0
            try:
                r, _, _ = select.select(fds, [], [], timeout)
            except InterruptedError:
                continue
            if master in r:
                try:
                    data = os.read(master, 65536)
                except OSError:
                    data = b""
                if not data:
                    break
                os.write(stdout_fd, data)
            if is_tty and stdin_fd in r:
                try:
                    data = os.read(stdin_fd, 65536)
                except OSError:
                    data = b""
                if data:
                    os.write(master, data)
            if srv in r:
                try:
                    c, _ = srv.accept()
                    c.setblocking(False)
                    clients.append(c)
                    bufs[c.fileno()] = b""
                except OSError:
                    pass
            for c in list(clients):
                if c in r:
                    try:
                        chunk = c.recv(65536)
                    except OSError:
                        chunk = b""
                    if not chunk:
                        clients.remove(c)
                        bufs.pop(c.fileno(), None)
                        c.close()
                        continue
                    bufs[c.fileno()] += chunk
                    while b"\n" in bufs[c.fileno()]:
                        line, bufs[c.fileno()] = bufs[c.fileno()].split(b"\n", 1)
                        try:
                            msg = json.loads(line.decode("utf-8"))
                            if msg.get("ping"):
                                c.sendall(b'{"ok":true,"pong":true}\n')
                                continue
                            inject(str(msg.get("text") or ""))
                            c.sendall(b'{"ok":true}\n')
                        except Exception as e:
                            try:
                                c.sendall(json.dumps({"ok": False, "error": str(e)}).encode() + b"\n")
                            except OSError:
                                pass
            # drain injections with a small gap so the paste and the Enter are seen as separate events
            now = time.time()
            if queue and now >= next_send:
                chunk = queue.pop(0)
                os.write(master, chunk)
                next_send = now + (0.35 if chunk == b"\r" else 0.25)
            # child gone?
            try:
                wpid, status = os.waitpid(pid, os.WNOHANG)
            except ChildProcessError:
                wpid, status = pid, 0
            if wpid == pid:
                # flush remaining output
                try:
                    while True:
                        r2, _, _ = select.select([master], [], [], 0.05)
                        if master not in r2:
                            break
                        data = os.read(master, 65536)
                        if not data:
                            break
                        os.write(stdout_fd, data)
                except OSError:
                    pass
                rc = os.waitstatus_to_exitcode(status) if hasattr(os, "waitstatus_to_exitcode") else 0
                break
    except SystemExit:
        try:
            os.kill(pid, signal.SIGHUP)
        except Exception:
            pass
    finally:
        if old_attrs is not None:
            termios.tcsetattr(stdin_fd, termios.TCSADRAIN, old_attrs)
        for c in clients:
            c.close()
        srv.close()
        try:
            os.unlink(a.socket)
        except OSError:
            pass
    return rc if isinstance(rc, int) else 0


if __name__ == "__main__":
    sys.exit(main())
