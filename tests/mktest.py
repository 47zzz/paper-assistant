#!/usr/bin/env python3
"""Refresh the test copy (tests/libcopy/app) from this repository's app/ and apply test-only knobs."""
import os, shutil, sys
SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app")   # this repository's app/
DST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "libcopy", "app")
S = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.dirname(DST)                                   # tests/libcopy = the copy's library root
os.makedirs(os.path.join(DST, "ui"), exist_ok=True)
os.makedirs(os.path.join(LIB, "papers"), exist_ok=True)
for f in ("server.py", "reader.py", "desktop.py", "xp.py", "notify.py", "graph.py", "assistant_bridge.py", "migrate.py"):
    shutil.copy(os.path.join(SRC, f), os.path.join(DST, f))
for f in ("app.js", "app.css", "reader-ext.js", "reader-ext.css", "index.html"):
    shutil.copy(os.path.join(SRC, "ui", f), os.path.join(DST, "ui", f))
for d in ("vendor", "fonts"):                                # PDF.js, xterm, confetti, fonts: the server serves /app/ui/* from inside the copy
    shutil.copytree(os.path.join(SRC, "ui", d), os.path.join(DST, "ui", d), dirs_exist_ok=True)
shutil.copy(os.path.join(S, "claude-stub.sh"), os.path.join(LIB, "claude-stub.sh"))   # the claude knob below points _claude_bin() at this file
os.chmod(os.path.join(LIB, "claude-stub.sh"), 0o755)
p = os.path.join(DST, "server.py")
s = open(p, encoding="utf-8").read()
knobs = [
    ('    return shutil.which("claude") or os.path.expanduser("~/.local/bin/claude")', '    return os.path.join(ROOT, "claude-stub.sh")  # TEST COPY ONLY: prints its args, then echoes input'),
    ("    BROWSER_GRACE_FIRST = 240 ", "    BROWSER_GRACE_FIRST = 30 "),
    ("    BROWSER_GRACE = 150 ", "    BROWSER_GRACE = 25 "),
    ("            time.sleep(20)\n            try:\n                with self.lock:\n                    a = self.active", "            time.sleep(1)\n            try:\n                with self.lock:\n                    a = self.active"),
    ("TERM_IDLE_KILL = 8 * 3600 ", "TERM_IDLE_KILL = 45 "),
    ("TERM_SIZE_LEASE = 90 ", "TERM_SIZE_LEASE = 4 "),
    ("TERM_QUEUE_BYTES = 16 << 20 ", "TERM_QUEUE_BYTES = 300000 "),
    ("def launch_terminal(cmd: list[str], cwd: str, title: str = \"\") -> str:\n", "def launch_terminal(cmd: list[str], cwd: str, title: str = \"\") -> str:\n    raise OpError(\"TEST COPY: terminals disabled\")\n"),
    ("        while True:\n            time.sleep(30)\n            try:\n                with self.lock:\n                    alive = ", "        while True:\n            time.sleep(1)\n            try:\n                with self.lock:\n                    alive = "),
]
for old, new in knobs:
    if s.count(old) != 1:
        print("KNOB FAILED:", old[:80]); sys.exit(2)
    s = s.replace(old, new)
open(p, "w", encoding="utf-8").write(s)
print("test copy refreshed with %d knobs" % len(knobs))
