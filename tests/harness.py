#!/usr/bin/env python3
"""Test harness control: `harness.py restart-server` | `stop-all` | `start-all` | `cleanup-bridges`.
Matches processes by exact argv elements only (never by substring of a whole command line)."""
import json, os, signal, subprocess, sys, time, urllib.request
S = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, S)
from cdplib import TEST_XDG, PAPER_IDS
LIB = os.path.join(S, "libcopy")
import shutil
CHROME = os.environ.get("CHROME") or shutil.which("google-chrome") or shutil.which("google-chrome-stable") or shutil.which("chromium") or shutil.which("chromium-browser") or "/opt/google/chrome/chrome"


def procs():
    out = []
    for pid in os.listdir("/proc"):
        if not pid.isdigit():
            continue
        try:
            argv = open("/proc/%s/cmdline" % pid, "rb").read().split(b"\0")
        except Exception:
            continue
        out.append((int(pid), argv))
    return out


def find(kind):
    res = []
    for pid, argv in procs():
        a0 = os.path.basename(argv[0]) if argv and argv[0] else b""
        if kind == "server" and len(argv) >= 4 and a0.startswith(b"python") and argv[1].endswith(b"app/server.py") and b"18766" in argv:
            res.append(pid)
        elif kind == "fwd" and len(argv) >= 3 and a0.startswith(b"python") and argv[2].endswith(b"/fwd2.py"):
            res.append(pid)
        elif kind == "chrome" and b"--remote-debugging-port=9333" in argv and b"--headless=new" in argv and ("--user-data-dir=" + os.path.join(S, "chrome_cdp")).encode() in argv:   # the three argv elements start_rest() passes, whatever the binary is called
            res.append(pid)
        elif kind == "bridge" and len(argv) >= 2 and argv[1].endswith(b"libcopy/app/assistant_bridge.py"):
            res.append(pid)
    return res


def kill(pids, sig=signal.SIGTERM):
    for p in pids:
        try:
            os.kill(p, sig); print("stopped", p)
        except ProcessLookupError:
            pass


def children_of(ppid):
    out = []
    for pid, _ in procs():
        try:
            st = open("/proc/%d/stat" % pid).read()
            if int(st.split(")")[1].split()[1]) == ppid:
                out.append(pid)
        except Exception:
            pass
    return out


def start_server():
    os.makedirs(TEST_XDG, mode=0o700, exist_ok=True)
    env = dict(os.environ); env["XDG_RUNTIME_DIR"] = TEST_XDG   # the copy's own runtime dir: its bridge sockets never mix with a real instance
    subprocess.Popen([sys.executable, "app/server.py", "--port", "18766", "--no-scheduler"], cwd=LIB, env=env, stdout=open(os.path.join(S, "testsrv8.log"), "ab"), stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(40):
        time.sleep(0.5)
        try:
            h = json.load(urllib.request.urlopen("http://127.0.0.1:18766/api/health")); print("test server", h["pid"], h["version"]); return
        except Exception:
            pass
    raise SystemExit("test server did not start")


def start_rest():
    subprocess.Popen([sys.executable, "-I", os.path.join(S, "fwd2.py"), "18765", "18766", "sshd-session"], stdout=open(os.path.join(S, "fwd.log"), "ab"), stderr=subprocess.STDOUT, start_new_session=True)
    subprocess.Popen([sys.executable, "-I", os.path.join(S, "fwd2.py"), "18764", "18766"], stdout=open(os.path.join(S, "fwd_plain.log"), "ab"), stderr=subprocess.STDOUT, start_new_session=True)
    subprocess.Popen([CHROME, "--headless=new", "--no-sandbox", "--disable-gpu", "--user-data-dir=" + os.path.join(S, "chrome_cdp"), "--window-size=1400,900", "--remote-debugging-port=9333", "--noerrdialogs", "--no-first-run", "--ozone-platform=headless", "--ozone-override-screen-size=800,600", "--use-angle=swiftshader-webgl", "about:blank"], stdout=open(os.path.join(S, "cdpchrome.log"), "ab"), stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(40):
        time.sleep(0.5)
        try:
            urllib.request.urlopen("http://127.0.0.1:9333/json/version").read(); print("chrome up"); break
        except Exception:
            pass


cmd = sys.argv[1] if len(sys.argv) > 1 else ""
if cmd == "restart-server":
    kill(find("server")); time.sleep(1.5); start_server()
elif cmd == "stop-all":
    kill(find("server") + find("fwd") + find("chrome") + find("bridge"))
    time.sleep(2); print("left:", find("server") + find("fwd") + find("chrome") + find("bridge"))
elif cmd == "start-all":
    kill(find("server") + find("fwd") + find("chrome")); time.sleep(1.5); start_server(); start_rest()
elif cmd == "cleanup-bridges":
    b = find("bridge"); kids = [k for p in b for k in children_of(p)]
    kill(b + kids)
    d = os.path.join(TEST_XDG, "paper-assistant")
    for f in (os.listdir(d) if os.path.isdir(d) else []):
        if f.endswith(".sock"):
            os.unlink(os.path.join(d, f)); print("removed", f)
else:
    print("usage: harness.py restart-server|stop-all|start-all|cleanup-bridges")
