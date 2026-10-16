#!/usr/bin/env python3
"""Desktop notifications for Paper Assistant (GNOME / any freedesktop notification daemon).

Uses `notify-send` (libnotify ≥ 0.8 supports --action). With actions, notify-send blocks until the
notification is closed and prints the chosen action name, so callers run `send()` in a thread.

CLI test:  python3 app/notify.py "Title" "Body"
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP_NAME = "Paper Assistant"
DESKTOP_ID = "io.github._47zzz.PaperAssistant"


def icon_path() -> str:
    for cand in (
        os.path.expanduser("~/.local/share/icons/hicolor/256x256/apps/io.github._47zzz.PaperAssistant.png"),
        os.path.join(HERE, "icon-256.png"),
        os.path.join(HERE, "icon.svg"),
    ):
        if os.path.exists(cand):
            return cand
    return "accessories-dictionary"


def _env() -> dict:
    env = dict(os.environ)
    # user systemd services normally have DBUS_SESSION_BUS_ADDRESS; be defensive for cron/tty use
    if "DBUS_SESSION_BUS_ADDRESS" not in env:
        uid = os.getuid()
        env["DBUS_SESSION_BUS_ADDRESS"] = "unix:path=/run/user/%d/bus" % uid
    env.setdefault("XDG_RUNTIME_DIR", "/run/user/%d" % os.getuid())
    return env


def open_app(lib_root: str | None = None, paper: str | None = None):
    """Bring up the desktop app (preferring the installed launcher)."""
    env = _env()
    if shutil.which("gtk-launch"):
        try:
            subprocess.Popen(["gtk-launch", DESKTOP_ID], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            return
        except Exception:
            pass
    subprocess.Popen([sys.executable, os.path.join(HERE, "desktop.py")], cwd=lib_root or os.path.dirname(HERE), env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)


def send(title: str, body: str = "", actions: bool = True, urgency: str = "normal", lib_root: str | None = None, paper: str | None = None, timeout_ms: int | None = None) -> str | None:
    """Show a notification. Returns the action name chosen ("open" / "later") or None.
    When `actions` is true this call BLOCKS until the user dismisses or clicks (run it in a thread)."""
    exe = shutil.which("notify-send")
    if not exe:
        sys.stderr.write("notify-send not found; %s: %s\n" % (title, body))
        return None
    cmd = [exe, "--app-name=" + APP_NAME, "--icon=" + icon_path(), "--urgency=" + urgency, "--hint=string:desktop-entry:" + DESKTOP_ID]
    if timeout_ms is not None:
        cmd.append("--expire-time=%d" % timeout_ms)
    if actions:
        cmd += ["--action=open=Open Paper Assistant", "--action=later=Remind me in 30 min"]
    cmd += [title, body]
    try:
        res = subprocess.run(cmd, env=_env(), capture_output=True, text=True, timeout=600 if actions else 15)
    except subprocess.TimeoutExpired:
        return None
    except Exception as e:
        sys.stderr.write("notify failed: %s\n" % e)
        return None
    choice = (res.stdout or "").strip().splitlines()
    choice = choice[-1] if choice else None
    if choice == "open":
        open_app(lib_root, paper)
    elif choice == "later":
        snooze(title, body, lib_root, paper)
    return choice


def snooze(title: str, body: str, lib_root: str | None, paper: str | None, minutes: int = 30):
    import threading
    threading.Timer(minutes * 60, lambda: send(title, body, True, "normal", lib_root, paper)).start()


if __name__ == "__main__":
    t = sys.argv[1] if len(sys.argv) > 1 else "Paper Assistant"
    b = sys.argv[2] if len(sys.argv) > 2 else "Notification test succeeded ✨"
    print("clicked:", send(t, b, actions="--no-actions" not in sys.argv))
