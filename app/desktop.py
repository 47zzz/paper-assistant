#!/usr/bin/env python3
"""Paper Assistant desktop window.

Starts (or reuses) the local server, then opens the UI in a native GTK3 + WebKit2GTK 4.1 window.
Falls back to a Chrome "app" window, then to the default browser, if PyGObject/WebKit is missing.

Usage: python3 app/desktop.py [--port 8765] [--browser] [--chrome] [--no-server]
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
APP_ID = "io.github._47zzz.PaperAssistant"   # == .desktop basename == Wayland app_id (see docs/ARCHITECTURE.md)
TITLE = "Paper Assistant"
STATE = os.path.join(os.environ.get("XDG_CONFIG_HOME", os.path.expanduser("~/.config")), "paper-assistant", "window.json")

# NVIDIA + Wayland mitigations must be in the environment before WebKit spawns its processes.
# Escalation (if the view is blank or the app dies with "Error 71"): set PAPER_ASSISTANT_WEBKIT_SAFE=1
# which adds WEBKIT_DISABLE_DMABUF_RENDERER=1 (slower but reliable); =2 also disables compositing.
os.environ.setdefault("__NV_DISABLE_EXPLICIT_SYNC", "1")
_safe = os.environ.get("PAPER_ASSISTANT_WEBKIT_SAFE", "")
if _safe in ("1", "2"):
    os.environ.setdefault("WEBKIT_DISABLE_DMABUF_RENDERER", "1")
if _safe == "2":
    os.environ.setdefault("WEBKIT_DISABLE_COMPOSITING_MODE", "1")


def server_alive(port: int) -> bool:
    try:
        with urllib.request.urlopen("http://127.0.0.1:%d/api/health" % port, timeout=1.5) as r:
            return json.load(r).get("ok") is True
    except Exception:
        return False


def ensure_server(port: int) -> subprocess.Popen | None:
    """Return a Popen if we had to start the server ourselves (so we can stop it on exit)."""
    if server_alive(port):
        return None
    # prefer the systemd user service if installed
    if shutil.which("systemctl"):
        r = subprocess.run(["systemctl", "--user", "start", "paper-assistant-server.service"], capture_output=True)
        if r.returncode == 0:
            for _ in range(30):
                if server_alive(port):
                    return None
                time.sleep(0.2)
    log = open(os.path.join(ROOT, ".server.log"), "ab")
    p = subprocess.Popen([sys.executable, os.path.join(HERE, "server.py"), "--port", str(port)], cwd=ROOT, stdout=log, stderr=log, start_new_session=True)
    for _ in range(40):
        if server_alive(port):
            return p
        time.sleep(0.15)
    return p


def run_chrome(url: str) -> bool:
    exe = shutil.which("google-chrome") or shutil.which("google-chrome-stable") or shutil.which("chromium") or shutil.which("chromium-browser")
    if not exe:
        return False
    profile = os.path.expanduser("~/.local/share/paper-assistant/chrome-profile")
    os.makedirs(profile, exist_ok=True)
    subprocess.Popen([exe, "--app=" + url, "--class=" + APP_ID, "--user-data-dir=" + profile, "--window-size=1280,860"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    return True


def run_webkit(url: str, port: int) -> int:
    import gi
    gi.require_version("Gtk", "3.0")
    gi.require_version("WebKit2", "4.1")
    from gi.repository import Gio, GLib, Gtk, WebKit2
    from urllib.parse import urlsplit

    GLib.set_prgname(APP_ID)  # GTK3 uses g_get_prgname() as the Wayland xdg_toplevel app_id → dock icon match
    LOCAL = {("127.0.0.1", port), ("localhost", port)}
    INTERNAL = {"about", "blob", "data", "webkit-pdfjs-viewer"}

    def is_local(uri: str) -> bool:
        p = urlsplit(uri)
        if p.scheme in INTERNAL:
            return True
        return p.scheme in ("http", "https") and (p.hostname, p.port or (443 if p.scheme == "https" else 80)) in LOCAL

    def open_external(uri: str):
        try:
            Gio.AppInfo.launch_default_for_uri(uri, None)
        except Exception:
            subprocess.Popen(["xdg-open", uri], start_new_session=True)

    class Win(Gtk.ApplicationWindow):
        def __init__(self, app):
            super().__init__(application=app, title=TITLE)
            self.set_icon_name(APP_ID)
            w, h, mx = self._load_geo()
            self.set_default_size(w, h)
            if mx:
                self.maximize()
            self.connect("delete-event", self._save_geo)
            ucm = WebKit2.UserContentManager()
            ucm.connect("script-message-received::py", self._on_js)
            ucm.register_script_message_handler("py")
            self.view = WebKit2.WebView(user_content_manager=ucm)
            s = self.view.get_settings()
            s.set_enable_developer_extras(True)
            s.set_enable_smooth_scrolling(True)
            self.view.connect("decide-policy", self._policy)
            self.view.connect("create", self._create)
            self.view.get_context().connect("download-started", self._download)
            self.view.connect("web-process-terminated", self._crashed)
            self.add(self.view)
            self.view.load_uri(url)
            self.show_all()

        def _policy(self, view, decision, dtype):
            T = WebKit2.PolicyDecisionType
            if dtype in (T.NAVIGATION_ACTION, T.NEW_WINDOW_ACTION):
                uri = decision.get_navigation_action().get_request().get_uri()
                if dtype == T.NEW_WINDOW_ACTION or not is_local(uri):
                    open_external(uri)
                    decision.ignore()
                    return True
                return False
            if dtype == T.RESPONSE:
                if not decision.is_mime_type_supported():
                    decision.download()
                    return True
                return False
            return False

        def _create(self, view, nav):
            open_external(nav.get_request().get_uri())
            return None

        def _download(self, ctx, dl):
            def dest(d, suggested):
                folder = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD) or GLib.get_home_dir()
                d.set_destination(GLib.filename_to_uri(os.path.join(folder, suggested)))
                return True
            dl.connect("decide-destination", dest)
            dl.connect("finished", lambda d: open_external(d.get_destination()))

        def _crashed(self, view, reason):
            sys.stderr.write("WebKit web process terminated: %s\nIf the window stays blank, restart with PAPER_ASSISTANT_WEBKIT_SAFE=1.\n" % reason.value_nick)
            GLib.timeout_add(800, lambda: (view.reload(), False)[1])

        def _on_js(self, ucm, res):
            try:
                v = res.get_js_value()
                msg = json.loads(v.to_json(0)) if v.is_object() else v.to_string()
            except Exception:
                return
            if isinstance(msg, dict) and msg.get("type") == "open-external" and msg.get("url"):
                open_external(str(msg["url"]))
            elif isinstance(msg, dict) and msg.get("type") == "title":
                self.set_title(str(msg.get("text") or TITLE))

        def _load_geo(self):
            try:
                d = json.load(open(STATE))
                return int(d.get("w", 1280)), int(d.get("h", 860)), bool(d.get("max"))
            except Exception:
                return 1280, 860, False

        def _save_geo(self, *_):
            try:
                os.makedirs(os.path.dirname(STATE), exist_ok=True)
                w, h = self.get_size()
                json.dump({"w": w, "h": h, "max": self.is_maximized()}, open(STATE, "w"))
            except Exception:
                pass
            return False

    class App(Gtk.Application):
        def __init__(self):
            super().__init__(application_id=APP_ID, flags=Gio.ApplicationFlags.FLAGS_NONE)
            self.win = None

        def do_startup(self):
            Gtk.Application.do_startup(self)
            acts = {
                "quit": (lambda *a: self.quit(), ["<Primary>q"]),            # not Ctrl+W: that deletes a word in the Claude console
                "reload": (lambda *a: self.win and self.win.view.reload(), ["F5"]),   # not Ctrl+R: that is history search in the console
                "inspector": (lambda *a: self.win and self.win.view.get_inspector().show(), ["<Primary><Shift>i", "F12"]),
                "zoomin": (lambda *a: self.win and self.win.view.set_zoom_level(self.win.view.get_zoom_level() + 0.1), ["<Primary>plus", "<Primary>equal"]),
                "zoomout": (lambda *a: self.win and self.win.view.set_zoom_level(self.win.view.get_zoom_level() - 0.1), ["<Primary>minus"]),
                "zoom0": (lambda *a: self.win and self.win.view.set_zoom_level(1.0), ["<Primary>0"]),
            }
            for name, (cb, accels) in acts.items():
                a = Gio.SimpleAction.new(name, None)
                a.connect("activate", cb)
                self.add_action(a)
                self.set_accels_for_action("app." + name, accels)

        def do_activate(self):
            if self.win is None:
                self.win = Win(self)
            self.win.present()

    return App().run([])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=int(os.environ.get("PAPER_ASSISTANT_PORT") or 8765))
    ap.add_argument("--browser", action="store_true", help="open in the default browser instead of a window")
    ap.add_argument("--chrome", action="store_true", help="force the Chrome app-window fallback")
    ap.add_argument("--no-server", action="store_true")
    a = ap.parse_args()
    url = "http://127.0.0.1:%d/" % a.port
    child = None if a.no_server else ensure_server(a.port)
    if not server_alive(a.port):
        sys.stderr.write("The server did not start; see %s\n" % os.path.join(ROOT, ".server.log"))
        return 1
    try:
        if a.browser:
            subprocess.Popen(["xdg-open", url], start_new_session=True)
            return 0
        if a.chrome:
            return 0 if run_chrome(url) else 1
        try:
            return run_webkit(url, a.port)
        except Exception as e:  # missing gi / WebKit → fallbacks
            sys.stderr.write("WebKit window failed (%s), falling back to the browser.\n" % e)
            if run_chrome(url):
                return 0
            subprocess.Popen(["xdg-open", url], start_new_session=True)
            return 0
    finally:
        # keep a self-started server alive only while the window lives; systemd service is untouched
        if child is not None and child.poll() is None and not (a.browser or a.chrome):
            child.terminate()


if __name__ == "__main__":
    sys.exit(main())
