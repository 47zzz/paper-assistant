#!/usr/bin/env python3
"""Paper Assistant reading window.

A minimal PDF reader (GTK3 + WebKit2GTK's built-in PDF viewer) that the server spawns for a
reading session. It opens full-screen on the chosen monitor (the secondary / portrait screen by
default) and shows a slim bar with the elapsed time and an "End session" button. The server
owns the process: when this window closes, the process exits and the server records the session.

Usage:
  reader.py --pdf FILE [--title T] [--paper ID] [--monitor auto|N] [--no-fullscreen] [--port 8765]
  reader.py --list-monitors      # JSON description of the monitors (used by the settings page)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
APP_ID = "io.github._47zzz.PaperAssistant"

os.environ.setdefault("__NV_DISABLE_EXPLICIT_SYNC", "1")
_safe = os.environ.get("PAPER_ASSISTANT_WEBKIT_SAFE", "")
if _safe in ("1", "2"):
    os.environ.setdefault("WEBKIT_DISABLE_DMABUF_RENDERER", "1")
if _safe == "2":
    os.environ.setdefault("WEBKIT_DISABLE_COMPOSITING_MODE", "1")


# ------------------------------------------------------------------------------------ monitors
def mutter_primary_xy():
    """(x, y) of the primary logical monitor according to Mutter, or None. Wayland GDK does not
    expose the primary flag, so we ask the compositor directly."""
    try:
        out = subprocess.run(["gdbus", "call", "--session", "--dest", "org.gnome.Mutter.DisplayConfig", "--object-path", "/org/gnome/Mutter/DisplayConfig",
                              "--method", "org.gnome.Mutter.DisplayConfig.GetCurrentState"], capture_output=True, text=True, timeout=3).stdout
        for m in re.finditer(r"\((-?\d+), (-?\d+), ([\d.]+), (\d+), (true|false), \[\('", out):
            if m.group(5) == "true":
                return int(m.group(1)), int(m.group(2))
    except Exception:
        pass
    return None


def list_monitors() -> list[dict]:
    import gi
    gi.require_version("Gdk", "3.0")
    from gi.repository import Gdk
    d = Gdk.Display.get_default()
    if d is None:
        return []
    prim = mutter_primary_xy()
    out = []
    for i in range(d.get_n_monitors()):
        m = d.get_monitor(i)
        g = m.get_geometry()
        is_prim = bool(m.is_primary()) or (prim is not None and (g.x, g.y) == prim)
        out.append({"index": i, "model": m.get_model() or "", "manufacturer": m.get_manufacturer() or "", "x": g.x, "y": g.y, "width": g.width, "height": g.height,
                    "scale": m.get_scale_factor(), "primary": is_prim, "portrait": g.height > g.width})
    if out and not any(x["primary"] for x in out):
        out[0]["primary"] = True
    return out


def pick_monitor(pref: str, mons: list[dict]) -> int | None:
    if not mons:
        return None
    if pref and pref.isdigit() and int(pref) < len(mons):
        return int(pref)
    others = [m for m in mons if not m["primary"]]
    if not others:
        return None  # single screen: let the compositor place it, don't steal the whole screen
    portrait = [m for m in others if m["portrait"]]
    return (portrait or others)[0]["index"]


# -------------------------------------------------------------------------------------- window
def run(a) -> int:
    import gi
    gi.require_version("Gtk", "3.0")
    gi.require_version("Gdk", "3.0")
    gi.require_version("WebKit2", "4.1")
    from gi.repository import Gdk, Gio, GLib, Gtk, WebKit2

    GLib.set_prgname(APP_ID)
    pdf = os.path.abspath(a.pdf)
    if not os.path.isfile(pdf):
        sys.stderr.write("no such file: %s\n" % pdf)
        return 2
    mons = list_monitors()
    idx = pick_monitor(a.monitor, mons)
    # Prefer the bundled PDF.js viewer (text selection → highlights); fall back to WebKit's own PDF view.
    viewer_html = os.path.join(HERE, "ui", "vendor", "pdfjs", "web", "viewer.html")
    rel = os.path.relpath(pdf, os.path.dirname(HERE))
    if os.path.isfile(viewer_html) and a.paper and not rel.startswith(".."):
        from urllib.parse import quote
        # &sse=1: this window is its own process, so it listens to the server directly (browser tabs get events relayed from the app tab)
        start_uri = "http://127.0.0.1:%d/app/ui/vendor/pdfjs/web/viewer.html?file=%s&paper=%s&sse=1%s" % (a.port, quote("/" + rel.replace(os.sep, "/"), safe=""), quote(a.paper, safe=""), ("#page=%d" % a.page) if a.page else "")
    else:
        start_uri = None
    fullscreen = not a.no_fullscreen and idx is not None
    started = time.time()
    api = "http://127.0.0.1:%d" % a.port

    def post(path, body):
        try:
            req = urllib.request.Request(api + path, data=json.dumps(body).encode("utf-8"), headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=10).read()
        except Exception as e:
            sys.stderr.write("post %s failed: %s\n" % (path, e))

    css = Gtk.CssProvider()
    css.load_from_data(b"""
      .rbar { background: #141518; color: #e6e7e9; padding: 4px 10px; border-bottom: 1px solid #2a2c31; }
      .rbar label { color: #e6e7e9; }
      .rbar .title { font-weight: 600; }
      .rbar .dim { color: #9a9ca3; }
      .rbar .clock { font-family: monospace; font-size: 15px; color: #5fcf8f; font-weight: 600; }
      .rbar button { padding: 2px 10px; min-height: 26px; border-radius: 7px; background: #23252b; color: #e6e7e9; border: 1px solid #2f3138; }
      .rbar button:hover { background: #2d3037; }
      .rbar button.end { background: #1a8f55; border-color: #1a8f55; color: white; font-weight: 600; }
      .rbar button.end:hover { background: #22a865; }
    """)
    Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

    win = Gtk.Window(title=(a.title or os.path.basename(pdf)) + " — Reading")
    win.set_icon_name(APP_ID)
    win.set_default_size(1000, 1300)

    box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
    bar = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
    bar.get_style_context().add_class("rbar")
    ttl = Gtk.Label(label=a.title or os.path.basename(pdf), xalign=0)
    ttl.set_ellipsize(3)  # Pango.EllipsizeMode.END
    ttl.get_style_context().add_class("title")
    clock = Gtk.Label(label="00:00")
    clock.get_style_context().add_class("clock")
    hint = Gtk.Label(label="Esc leaves full screen · Ctrl+W ends")
    hint.get_style_context().add_class("dim")
    b_assist = Gtk.Button(label="Assistant")
    b_assist.set_tooltip_text("Open (or re-open) the Claude terminal for this paper")
    b_fs = Gtk.Button(label="⤢")
    b_fs.set_tooltip_text("Toggle full screen (F11)")
    b_end = Gtk.Button(label="End session ✓")
    b_end.get_style_context().add_class("end")
    b_end.set_tooltip_text("Close the PDF and record the reading time (Ctrl+W)")
    bar.pack_start(ttl, True, True, 0)
    bar.pack_start(clock, False, False, 0)
    bar.pack_start(hint, False, False, 0)
    for b in (b_assist, b_fs, b_end):
        bar.pack_start(b, False, False, 0)
    box.pack_start(bar, False, False, 0)

    view = WebKit2.WebView()
    st = view.get_settings()
    st.set_enable_javascript(True)
    st.set_allow_file_access_from_file_urls(True)
    try:
        st.set_enable_write_console_messages_to_stdout(bool(os.environ.get("PAPER_ASSISTANT_READER_DEBUG")))
    except Exception:
        pass
    st.set_enable_smooth_scrolling(True)
    st.set_enable_developer_extras(False)
    box.pack_start(view, True, True, 0)
    win.add(box)

    def on_policy(v, decision, dtype):
        T = WebKit2.PolicyDecisionType
        if dtype in (T.NAVIGATION_ACTION, T.NEW_WINDOW_ACTION):
            uri = decision.get_navigation_action().get_request().get_uri()
            if uri.startswith(("http://", "https://")) and not uri.startswith("http://127.0.0.1:%d/" % a.port):
                try:
                    Gio.AppInfo.launch_default_for_uri(uri, None)
                except Exception:
                    subprocess.Popen(["xdg-open", uri], start_new_session=True)
                decision.ignore()
                return True
        return False
    view.connect("decide-policy", on_policy)
    def load_doc():
        if start_uri:
            view.load_uri(start_uri)
        else:
            view.load_uri(GLib.filename_to_uri(pdf))
    view.connect("web-process-terminated", lambda v, r: GLib.timeout_add(800, lambda: (load_doc(), False)[1]))

    state = {"fs": fullscreen}

    def toggle_fs(*_):
        if state["fs"]:
            win.unfullscreen()
        else:
            if idx is not None:
                win.fullscreen_on_monitor(win.get_screen(), idx)
            else:
                win.fullscreen()
        state["fs"] = not state["fs"]

    def on_key(w, ev):
        k = Gdk.keyval_name(ev.keyval) or ""
        ctrl = bool(ev.state & Gdk.ModifierType.CONTROL_MASK)
        if k == "F11":
            toggle_fs(); return True
        if k == "Escape" and state["fs"]:
            toggle_fs(); return True
        if ctrl and k in ("w", "q"):
            win.destroy(); return True
        if ctrl and k in ("plus", "equal"):
            view.set_zoom_level(view.get_zoom_level() + 0.1); return True
        if ctrl and k == "minus":
            view.set_zoom_level(view.get_zoom_level() - 0.1); return True
        if ctrl and k == "0":
            view.set_zoom_level(1.0); return True
        return False
    win.connect("key-press-event", on_key)
    win.connect("destroy", lambda *_: Gtk.main_quit())
    b_end.connect("clicked", lambda *_: win.destroy())
    b_fs.connect("clicked", toggle_fs)
    b_assist.connect("clicked", lambda *_: post("/api/reading/assistant", {}))

    def tick():
        el = int(time.time() - started)
        clock.set_text("%02d:%02d" % (el // 60, el % 60) if el < 3600 else "%d:%02d:%02d" % (el // 3600, el % 3600 // 60, el % 60))
        return True
    GLib.timeout_add_seconds(1, tick)

    if fullscreen:
        win.fullscreen_on_monitor(win.get_screen(), idx)
    elif idx is None:
        win.maximize()
    load_doc()
    win.show_all()
    win.present()
    Gtk.main()
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf")
    ap.add_argument("--title", default="")
    ap.add_argument("--paper", default="")
    ap.add_argument("--monitor", default="auto")
    ap.add_argument("--page", type=int, default=0)
    ap.add_argument("--no-fullscreen", action="store_true")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PAPER_ASSISTANT_PORT") or 8765))
    ap.add_argument("--list-monitors", action="store_true")
    a = ap.parse_args()
    if a.list_monitors:
        print(json.dumps(list_monitors()))
        return 0
    if not a.pdf:
        ap.error("--pdf required")
    return run(a)


if __name__ == "__main__":
    sys.exit(main())
