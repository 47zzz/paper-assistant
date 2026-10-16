#!/usr/bin/env python3
"""Edge-case regression suite for remote mode + Yan console (test copy on 18766; 18765 = 'ssh' forwarder, 18764 = plain)."""
import json, os, re, signal, socket, subprocess, sys, threading, time, urllib.request, urllib.error, urllib.parse, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdplib import Tab, close_all, TEST_XDG, PAPER_IDS

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(HERE, "libcopy")
SSH = "http://localhost:18765"; PLAIN = "http://localhost:18764"; DIRECT = "http://127.0.0.1:18766"
CDP = 9333
RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (("  -- " + str(detail)[:300]) if detail else ""))


def req(base, path, body=None, headers=None, method=None):
    h = {"Origin": base, "Content-Type": "application/json"}
    h.update(headers or {})
    r = urllib.request.Request(base + path, json.dumps(body).encode() if body is not None else None, h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        try: return e.code, json.load(e)
        except Exception: return e.code, {"ok": False, "error": "non-json"}


def post(path, body, base=DIRECT): return req(base, path, body)
def get(path, base=DIRECT): return req(base, path)


def stop_session():
    post("/api/reading/stop", {})


def server_pids():
    out = []
    for pid in os.listdir("/proc"):
        if not pid.isdigit(): continue
        try: argv = open("/proc/%s/cmdline" % pid, "rb").read().split(b"\0")
        except Exception: continue
        if len(argv) >= 4 and os.path.basename(argv[0]).startswith(b"python") and argv[1].endswith(b"app/server.py") and b"18766" in argv:
            out.append(int(pid))
    return out


def restart_server(sig=signal.SIGKILL):
    for pid in server_pids():
        os.kill(pid, sig)
    time.sleep(1.2)
    env = dict(os.environ); env["XDG_RUNTIME_DIR"] = TEST_XDG   # same isolated runtime dir as harness.py: never probe/unlink a real instance's bridge sockets
    subprocess.Popen([sys.executable, "app/server.py", "--port", "18766", "--no-scheduler"], cwd=LIB, env=env, stdout=open(os.path.join(HERE, "testsrv6.log"), "ab"), stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(40):
        time.sleep(0.25)
        try:
            st, h = get("/api/health")
            if st == 200: return h
        except Exception: pass
    raise SystemExit("test server did not come back")


class RawClient(threading.Thread):
    """Attached console client over the stream; `stalled=True` never reads the socket."""
    def __init__(self, sid, name, stalled=False):
        super().__init__(daemon=True); self.sid, self.name, self.stalled, self.out, self.stop = sid, name, stalled, bytearray(), False; self.resp = None
    def run(self):
        self.resp = urllib.request.urlopen(DIRECT + "/api/term/stream?id=%s&client=%s" % (self.sid, self.name))
        if self.stalled:
            while not self.stop: time.sleep(0.2)
            return
        while not self.stop:
            line = self.resp.readline()
            if not line: break
            if line.startswith(b"data:"):
                d = json.loads(line[5:])
                if "b64" in d: self.out += base64.b64decode(d["b64"])
    def close(self):
        self.stop = True
        try: self.resp.fp.raw._sock.shutdown(2)
        except Exception: pass
        try: self.resp.close()
        except Exception: pass
    def screen(self):
        t = self.out.decode("utf-8", "replace")
        t = re.sub(r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\\\)", "", t)   # OSC (shell integration marks)
        return re.sub(r"\x1b\[[0-9;?]*[A-Za-z]", "", t)


def pty_size(sid, client):
    post("/api/term/input", {"id": sid, "data": "stty size\n"}); time.sleep(0.8)
    m = re.findall(r"(\d+ \d+)\r?\n", client.screen())
    return m[-1] if m else None


PDF1, PDF2, PDF3 = PAPER_IDS[:3]
PDF2_FILE = next((p.get("pdf") for p in get("/api/library")[1]["papers"] if p.get("id") == PDF2), "") or ("papers/%s.pdf" % PDF2)   # the copy's file for PDF2

# ============================================================ server-side
print("\n== S1 token-gated heartbeat")
stop_session()
st, r = post("/api/reading/start", {"id": PDF1, "viewer": "browser"})
url = r["reading"]["url"]; tok = re.search(r"sess=([0-9a-f]+)", url).group(1)
check("S1a browser session url carries a session token", st == 200 and tok and r["reading"].get("token") == tok, url)
check("S1b ping with the right token -> ok", post("/api/reading/ping", {"id": PDF1, "sess": tok})[1].get("state") == "ok")
_, pr = post("/api/reading/ping", {"id": PDF1, "sess": "deadbeef0000"}); check("S1c ping with a stale token -> other_session, not active", pr.get("state") == "other_session" and pr.get("active") is False, pr)
check("S1d ping for another paper -> other_paper", post("/api/reading/ping", {"id": PDF2, "sess": tok})[1].get("state") == "other_paper")
_, s = get("/api/reading"); check("S1e stale pings did not refresh last_seen", s["reading"].get("pinged") is True and s["reading"]["token"] == tok)
stop_session()
check("S1f ping after stop -> no_session", post("/api/reading/ping", {"id": PDF1, "sess": tok})[1].get("state") == "no_session")

print("\n== S2 both computers press Read at the same moment")
res = []
def starter(pid): res.append(post("/api/reading/start", {"id": pid, "viewer": "browser"}))
ts = [threading.Thread(target=starter, args=(p,)) for p in (PDF1, PDF2)]
[t.start() for t in ts]; [t.join() for t in ts]
oks = [x for x in res if x[0] == 200]; errs = [x for x in res if x[0] != 200]
check("S2 exactly one start wins, the other gets a clear error", len(oks) == 1 and len(errs) == 1 and "already running" in errs[0][1].get("error", ""), [x[1].get("error") or x[1]["reading"]["paper"] for x in res])
_, s = get("/api/reading"); check("S2b the surviving session is the winner's", s["reading"] and s["reading"]["paper"] == oks[0][1]["reading"]["paper"])
stop_session()

print("\n== S3 Explain / Ask / assistant / notes refused for a browser session")
post("/api/reading/start", {"id": PDF1, "viewer": "browser"})
st, r = post("/api/reading/ask", {"id": PDF1, "mode": "explain", "text": "some passage", "page": 2})
check("S3a /api/reading/ask for a browser session -> answered in a console", st == 200 and r.get("delivered") == "console" and r.get("console"), r)
post("/api/term/kill", {"id": r.get("console")})
st, r = post("/api/reading/assistant", {}); check("S3b /api/reading/assistant refused", st == 400 and "library computer" in r.get("error", ""))
st, r = post("/api/reading/notes", {}); check("S3c /api/reading/notes refused", st == 400)
stop_session()

print("\n== S4 /api/term/list refuses a foreign Host header")
check("S4 Host: evil.example -> 403", req(DIRECT, "/api/term/list", headers={"Host": "evil.example"})[0] == 403)

print("\n== S9 a browser session nobody heartbeats ends by itself (30 s first-grace in the test copy)")
post("/api/reading/start", {"id": PDF3, "viewer": "browser"})
_, s = get("/api/reading"); alive0 = bool(s["reading"])
time.sleep(34)
_, s = get("/api/reading")
check("S9 session gone after the grace period with no heartbeat", alive0 and s["reading"] is None, s["reading"])

print("\n== S7 console size lease: a client that stops renewing stops setting the size")
_, r = post("/api/term/start", {"kind": "claude", "cols": 100, "rows": 25}); sid = r["session"]["id"]
A = RawClient(sid, "A"); A.start(); time.sleep(0.5); post("/api/term/resize", {"id": sid, "cols": 120, "rows": 30, "client": "A"}); time.sleep(0.4)
check("S7a A alone -> 30 120", pty_size(sid, A) == "30 120", pty_size(sid, A))
B = RawClient(sid, "B"); B.start(); time.sleep(0.5); post("/api/term/resize", {"id": sid, "cols": 80, "rows": 20, "client": "B"}); time.sleep(0.4)
check("S7b A + B(80x20) -> 20 80", pty_size(sid, A) == "20 80")
# A keeps renewing every second, B never does; the test copy's lease is 4 s
for _ in range(6):
    post("/api/term/resize", {"id": sid, "cols": 120, "rows": 30, "client": "A"}); time.sleep(1)
check("S7c B's lease expired while still attached -> back to 30 120", pty_size(sid, A) == "30 120", pty_size(sid, A))
B.close(); time.sleep(0.5)

print("\n== S6 a client that stops reading is detached instead of buffering forever")
Z = RawClient(sid, "Z", stalled=True); Z.start(); time.sleep(0.6)
_, l = get("/api/term/list"); before = [t["clients"] for t in l["sessions"] if t["id"] == sid][0]
post("/api/term/input", {"id": sid, "data": "seq 1 1500000 | tr -d '\\n' | fold -w 60000; echo; echo DONE_SEQ\n"})
for _ in range(60):
    time.sleep(0.5)
    _, l = get("/api/term/list"); n = [t["clients"] for t in l["sessions"] if t["id"] == sid][0]
    if n < before: break
check("S6a stalled client detached, healthy one kept (clients %d -> %d)" % (before, n), n == 1)
time.sleep(1)
check("S6b healthy client A still receives output", "DONE_SEQ" in A.screen() or (time.sleep(3) or "DONE_SEQ" in A.screen()))
check("S6c log line", any("stopped reading" in open(os.path.join(HERE, f)).read() for f in ("testsrv4.log", "testsrv5.log", "testsrv6.log") if os.path.exists(os.path.join(HERE, f))))
Z.close(); A.close(); post("/api/term/kill", {"id": sid}); time.sleep(1)

print("\n== S8 forgotten session: recorded minutes are capped")
sys.path.insert(0, os.path.join(LIB, "app"))
import importlib
srv = importlib.import_module("server")
cap_ok = None
try:
    class FakeLib:
        def __init__(self): self.lock = threading.Lock(); self.applied = []; self.saved = []
        def apply(self, op): self.applied.append(op); return {"events": [{"xp": op["minutes"]}]}
        def save(self, *a, **k): self.saved.append(a)
        def broadcast(self, *a): pass
    fl = FakeLib()
    rm = srv.ReadingManager.__new__(srv.ReadingManager); rm.lib = fl; rm.lock = threading.Lock(); rm.proc = None; rm.last_result = None
    now = time.time(); act = {"paper": "x", "short": "X", "started": srv.dt.datetime.fromtimestamp(now - 600 * 60).isoformat(timespec="seconds"), "ts": now - 600 * 60}
    rm.active = act; rm._persist = lambda a: None; rm._forget = lambda: None
    res = rm._end(act)
    cap_ok = res["minutes"] == 240 and res["capped"] and res["raw_minutes"] == 600 and fl.applied[0]["minutes"] == 240
    check("S8a 600 min left open -> 240 recorded, capped flag", cap_ok, res)
    act2 = {"paper": "x", "short": "X", "started": srv.dt.datetime.fromtimestamp(now - 50 * 60).isoformat(timespec="seconds"), "ts": now - 50 * 60}
    rm.active = act2; res2 = rm._end(act2)
    check("S8b 50 min -> 50, not capped", res2["minutes"] == 50 and not res2["capped"], res2)
except Exception as e:
    check("S8 cap test ran", False, repr(e))

# ============================================================ browser-side
print("\n== B1 app page in remote mode (through the 'ssh' forwarder)")
close_all(CDP)
app = Tab(CDP); app.nav(SSH + "/?remote=1#today", 3.5)
v = app.eval("({ search: location.search, remote: REMOTE, desktop: IN_DESKTOP, skew: typeof S.clockSkew, loaded: !!S.L, hello: helloSeen })")
check("B1a page boots, ?remote=1 applied then stripped from the URL", v and v["search"] == "" and v["remote"] is True and v["desktop"] is False and v["loaded"] and v["skew"] == "number" and v["hello"] is True, v)
check("B1b no JS exceptions on boot", not any(x.startswith("EXCEPTION") for x in app.log), app.log[:3])

print("\n== B2 stale live card: End session after the session already ended")
stop_session()
v = app.eval("(async () => { S.R = { paper: '%s', short: 'ghost', ts: Date.now()/1000 - 60, viewer: 'browser' }; render(); await stopReading(); await new Promise(r => setTimeout(r, 800)); return { R: S.R, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ') }; })()" % PDF1)
check("B2 End session on a ghost -> card cleared, friendly toast", v and v["R"] is None and "already ended" in v["toast"], v)

print("\n== B3 stale live card does not block Read on another paper")
v = app.eval("(async () => { S.R = { paper: '%s', short: 'ghost', ts: Date.now()/1000 - 60, viewer: 'browser' }; render(); const cd = confirmDialog; window.confirmDialog = async () => true; const wo = window.open; const opened = []; window.open = (u) => { opened.push(u); return { closed: false, close() {}, location: {} }; }; try { await startReading(paperById('%s'), null); } finally { window.confirmDialog = cd; window.open = wo; } await new Promise(r => setTimeout(r, 500)); return { paper: S.R && S.R.paper, viewer: S.R && S.R.viewer, opened: opened.length }; })()" % (PDF1, PDF2))
check("B3 Read on paper B after a ghost session -> new session on B", v and v["paper"] == PDF2 and v["viewer"] == "browser" and v["opened"] >= 1, v)
_, s = get("/api/reading"); check("B3b server agrees", s["reading"] and s["reading"]["paper"] == PDF2)

print("\n== B4 reconnect resync: session ended while this browser was disconnected")
v = app.eval("(async () => { ES.close(); return { before: S.R && S.R.paper }; })()")
stop_session(); time.sleep(0.5)
v2 = app.eval("(async () => { const stale = S.R && S.R.paper; connectSSE(); await new Promise(r => setTimeout(r, 2500)); return { stale, after: S.R, offline: document.querySelector('#offline').classList.contains('show') }; })()")
check("B4 after reconnect the ghost card is gone", v and v["before"] == PDF2 and v2 and v2["stale"] == PDF2 and v2["after"] is None and not v2["offline"], (v, v2))

print("\n== B5 page shortcuts are inert while a console is open")
v = app.eval("(() => { const sr = startReading; let called = 0; window.startReading = () => { called++; }; const prevC = CONSOLE; CONSOLE = { id: 'x', close() {}, focus() {} }; document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true })); const withConsole = called; CONSOLE = prevC; const to = openTimer; window.openTimer = () => { called += 10; }; document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true })); window.startReading = sr; window.openTimer = to; return { withConsole, without: called }; })()")
check("B5 'r' ignored with a console open, 'f' works without", v and v["withConsole"] == 0 and v["without"] == 10, v)

print("\n== B6 Go to page: only drive the PDF that is on this computer")
v = app.eval("(async () => { const wo = window.open, ap = api.post; const opened = [], posted = []; window.open = u => { opened.push(u); return {}; }; api.post = async (p, b) => { posted.push(p); return { ok: true }; }; try { S.R = { paper: '%s', viewer: 'builtin', mode: 'window', ts: Date.now()/1000 }; await gotoPage(paperById('%s'), 7); S.R = { paper: '%s', viewer: 'browser', mode: 'manual', ts: Date.now()/1000 }; await gotoPage(paperById('%s'), 8); } finally { window.open = wo; api.post = ap; S.R = null; } return { opened, posted }; })()" % (PDF1, PDF1, PDF1, PDF1))
check("B6 window session on the other computer -> local viewer tab at page 7; browser session -> goto posted", v and len(v["opened"]) == 1 and "page=7" in v["opened"][0] and "sess=" not in v["opened"][0] and v["posted"] == ["/api/reading/goto"], v)

print("\n== B7 viewer tab: remote hides Explain/Ask; token heartbeat; ended -> banner -> Resume")
st, r = post("/api/reading/start", {"id": PDF1, "viewer": "browser"}); url = r["reading"]["url"]; tok1 = r["reading"]["token"]
viewer = Tab(CDP); viewer.nav(SSH + url, 5)
v = viewer.eval("({ explain: !!document.getElementById('paExplainButton'), ask: !!document.getElementById('paAskButton'), note: !!document.getElementById('paNoteModeButton'), remote: localStorage.getItem('remote'), sse: performance.getEntriesByType('resource').some(e => e.name.includes('/api/events')), pings: performance.getEntriesByType('resource').filter(e => e.name.includes('/api/reading/ping')).length })")
check("B7a remote viewer: Explain/Ask/Note present, no SSE of its own, heartbeat sent", v and v["explain"] and v["ask"] and v["note"] and v["remote"] == "true" and not v["sse"] and v["pings"] >= 1, v)
_, s = get("/api/reading"); check("B7b server saw the heartbeat (pinged)", s["reading"] and s["reading"].get("pinged") is True)
stop_session(); time.sleep(0.3)
v = viewer.eval("(async () => { document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 1200)); const b = document.querySelector('.pa-banner'); return { banner: !!b, text: b && b.textContent.slice(0, 80) }; })()")
check("B7c session ended elsewhere -> banner with Resume", v and v["banner"] and "has ended" in v["text"], v)
v = viewer.eval("(async () => { document.querySelector('.pa-banner .pa-btn.primary').click(); await new Promise(r => setTimeout(r, 1500)); return { banner: !!document.querySelector('.pa-banner'), flash: [...document.querySelectorAll('.pa-flash')].map(f => f.textContent).join('|') }; })()")
_, s = get("/api/reading")
tok2 = s["reading"] and s["reading"].get("token")
check("B7d Resume -> new session for the same paper with a new token, banner gone", v and not v["banner"] and s["reading"] and s["reading"]["paper"] == PDF1 and tok2 and tok2 != tok1, (v, tok1, tok2))
v = viewer.eval("(async () => { document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 1000)); return { banner: !!document.querySelector('.pa-banner') }; })()")
_, s = get("/api/reading")
check("B7e the tab now beats with the new token (no banner, last_seen refreshed)", v and not v["banner"] and s["reading"] and s["reading"].get("pinged") is True)
# a plain viewer tab (no token) must not beat and must not show the banner
plain = Tab(CDP); plain.nav(SSH + "/app/ui/vendor/pdfjs/web/viewer.html?file=" + urllib.parse.quote("/" + PDF2_FILE, safe="") + "&paper=" + PDF2, 4)
v = plain.eval("(async () => { document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 800)); return { pings: performance.getEntriesByType('resource').filter(e => e.name.includes('/api/reading/ping')).length, banner: !!document.querySelector('.pa-banner') }; })()")
check("B7f a plain viewer tab (opened from the paper's details) never pings and shows no banner", v and v["pings"] == 0 and not v["banner"], v)
plain.close()

print("\n== B8 Go to page reaches the viewer tab through the app tab's relay (no SSE in the viewer)")
viewer.eval("document.dispatchEvent(new Event('visibilitychange'))"); time.sleep(0.5)
app.eval("S.R = null; reload()"); time.sleep(1.5)
v = app.eval("({ R: S.R && S.R.paper, es: ES && ES.readyState })")
check("B8a app tab knows the resumed session", v and v["R"] == PDF1 and v["es"] == 1, v)
post("/api/reading/goto", {"id": PDF1, "page": 3}); time.sleep(1.5)
v = viewer.eval("({ page: window.PDFViewerApplication && window.PDFViewerApplication.page, sse: performance.getEntriesByType('resource').some(e => e.name.includes('/api/events')) })")
check("B8b viewer jumped to page 3 via BroadcastChannel", v and v["page"] == 3 and not v["sse"], v)
viewer.close(); stop_session()

print("\n== B9 console through the UI: typing, output, size lease renewal")
app.call("Page.bringToFront"); app.eval("go('explore'); const of = window.fetch; window.__rs = 0; window.fetch = (...a) => { if (String(a[0]).includes('/api/term/resize')) window.__rs++; return of(...a); };"); time.sleep(1)
v = app.eval("(async () => { const s = await startConsole('claude'); await new Promise(r => setTimeout(r, 1500)); return { id: s.id, panels: document.querySelectorAll('.termwrap').length, status: document.querySelector('.termstatus').textContent }; })()")
sid = v and v["id"]
check("B9a console opened", v and v["panels"] == 1 and v["status"] == "Running", v)
app.eval("CONSOLE.focus()"); app.call("Input.insertText", {"text": "echo EDGE_$((40+2))"}); app.key("Enter", "\r"); time.sleep(1.2)
v = app.eval("document.querySelector('.xterm-rows') ? document.querySelector('.xterm-rows').innerText : document.querySelector('.termhost').innerText")
check("B9b keystrokes reached bash and output came back", v and "EDGE_42" in v, (v or "")[:200])
v = app.eval("(async () => { const n0 = window.__rs, hidden = document.hidden; await new Promise(r => setTimeout(r, 31500)); return { n0, n1: window.__rs, hidden }; })()")
check("B9c size lease renewed every 30 s", v and v["n1"] > v["n0"], v)
time.sleep(24)   # idle kill fires 45 s after the last I/O (SIGTERM, then SIGKILL 3 s later)
_, l = get("/api/term/list"); ti = next(t for t in l["sessions"] if t["id"] == sid)
check("B9d forgotten console ended by the idle watch (45 s in the test copy), flagged", ti["alive"] is False and ti["idle_killed"] is True, {k: ti[k] for k in ("alive", "idle_killed", "exit_code")})
v = app.eval("({ status: document.querySelector('.termstatus') && document.querySelector('.termstatus').textContent, btn: document.querySelector('.termhead .btn') && document.querySelector('.termhead .btn').textContent })")
check("B9e panel shows it ended", v and v["status"] and v["status"].startswith("Ended") and v["btn"] == "Close", v)

print("\n== B10 double-click while xterm loads opens one panel only")
app.eval("CONSOLE && CONSOLE.close()")
_, r = post("/api/term/start", {"kind": "claude", "cols": 100, "rows": 25}); sid2 = r["session"]["id"]
v = app.eval("(async () => { await refreshTerms(); const info = S.terms.find(t => t.id === '%s'); XTERM_P = null; window.Terminal = undefined; window.FitAddon = undefined; openConsole(info); openConsole(info); await new Promise(r => setTimeout(r, 2500)); return { panels: document.querySelectorAll('.termwrap').length, console: !!CONSOLE }; })()" % sid2)
check("B10 two rapid opens -> one panel", v and v["panels"] == 1 and v["console"], v)
app.eval("CONSOLE && CONSOLE.close()"); post("/api/term/kill", {"id": sid2})

print("\n== B11 Cancel a request whose console is running -> console ended")
_, r = post("/api/op", {"op": "request.add", "text": "edge cancel test"}); rid = r["result"]["request"]["id"]
v = app.eval("(async () => { await reload(); const s = await startConsole('survey', '%s'); await new Promise(r => setTimeout(r, 800)); CONSOLE.close(); await reload(); await refreshTerms(); render(); const card = [...document.querySelectorAll('.reqcard')].find(c => c.querySelector('.q') && c.textContent.includes('edge cancel test')); const cancel = card && [...card.querySelectorAll('button')].find(b => b.textContent.trim() === 'Cancel'); window.confirmDialog = async () => true; cancel.click(); await new Promise(r => setTimeout(r, 2500)); await refreshTerms(); return { sid: s.id, alive: (S.terms.find(t => t.id === s.id) || {}).alive, status: (S.L.requests.find(x => x.id === '%s') || {}).status }; })()" % (rid, rid))
check("B11 cancel ends the console and the request", v and isinstance(v, dict) and v.get("alive") is False and v.get("status") == "cancelled", v)
_, lib = get("/api/library")
rq = next(x for x in lib["requests"] if x["id"] == rid)
check("B11b request carried the console id while running (runner=console)", rq.get("runner") == "console", {k: rq.get(k) for k in ("runner", "console", "status")})

print("\n== B12 settings page renders with the remote switch")
v = app.eval("(() => { go('settings'); const row = [...document.querySelectorAll('.setrow')].find(r => r.textContent.includes('Remote mode')); return { has: !!row, sw: !!(row && row.querySelector('.switch input')), checked: row && row.querySelector('.switch input').checked }; })()")
check("B12 remote switch present and on", v and v["has"] and v["sw"] and v["checked"], v)
check("B12b no JS exceptions so far", not any(x.startswith("EXCEPTION") for x in app.log), [x for x in app.log if x.startswith("EXCEPTION")][:3])

print("\n== B13 ?remote=0 is honoured once and stripped")
t2 = Tab(CDP); t2.nav(SSH + "/?remote=0#today", 3)
v = t2.eval("({ search: location.search, remote: REMOTE, stored: localStorage.getItem('remote') })")
check("B13 ?remote=0 -> off, URL clean", v and v["search"] == "" and v["remote"] is False and v["stored"] == "false", v)
t2.eval("setRemote(true)"); t2.close()

print("\n== S5/B14 server restart: requests claimed by a console revert; terminal runs stay; pages reload")
_, r = post("/api/op", {"op": "request.add", "text": "edge restart console"}); rid_c = r["result"]["request"]["id"]
_, r = post("/api/op", {"op": "request.add", "text": "edge restart terminal"}); rid_t = r["result"]["request"]["id"]
_, r = post("/api/term/start", {"kind": "survey", "request_id": rid_c, "cols": 100, "rows": 25}); sid_c = r["session"]["id"]
st, r = post("/api/launch-survey", {"request_id": rid_t, "launch": False})
check("S5a launch-survey (no terminal) marks runner=terminal", st == 200 and not r["launched"])
_, lib = get("/api/library"); rc = next(x for x in lib["requests"] if x["id"] == rid_c); rt = next(x for x in lib["requests"] if x["id"] == rid_t)
check("S5b before restart: console request working+console id, terminal request working+runner", rc["status"] == "working" and rc.get("console") == sid_c and rt["status"] == "working" and rt.get("runner") == "terminal", (rc.get("console"), rt.get("runner")))
app.eval("window.__marker = 1; go('explore')"); time.sleep(0.5)
h = restart_server()
time.sleep(7)
_, lib = get("/api/library"); rc = next(x for x in lib["requests"] if x["id"] == rid_c); rt = next(x for x in lib["requests"] if x["id"] == rid_t)
check("S5c after restart: console request back to open with a note, console cleared", rc["status"] == "open" and "restarted" in rc.get("note", "") and not rc.get("console"), rc)
check("S5d terminal-run request untouched", rt["status"] == "working", rt["status"])
v = None
for _ in range(6):  # the page may be mid-reload: the evaluation context gets destroyed, so retry
    v = app.eval("({ marker: window.__marker, loaded: !!S.L, page: S.page, started: S.health && S.health.started, terms: (S.terms || []).length })")
    if isinstance(v, dict) and "__error" not in v and v.get("loaded"): break
    time.sleep(1)
check("B14 open page reloaded itself after the restart (new 'started')", isinstance(v, dict) and v.get("marker") is None and v.get("loaded") and v.get("started") == h["started"], (v, h["started"]))
check("B14b no exceptions after reload", not any(x.startswith("EXCEPTION") for x in app.log), [x for x in app.log if x.startswith("EXCEPTION")][:3])

print("\n== cleanup")
for x in (rid, rid_c, rid_t):
    post("/api/op", {"op": "request.update", "id": x, "fields": {"status": "cancelled"}})
stop_session(); app.close()
print("\n%d/%d passed" % (sum(1 for _, ok, _ in RESULTS if ok), len(RESULTS)))
for n, ok, d in RESULTS:
    if not ok: print("  FAILED:", n, d)
