#!/usr/bin/env python3
"""Explain / Ask from a remote browser -> reading assistant in a side console panel; desktop path unchanged."""
import json, os, re, sys, time, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdplib import Tab, close_all, TEST_XDG, PAPER_IDS

SSH = "http://localhost:18765"; PLAIN = "http://localhost:18764"; DIRECT = "http://127.0.0.1:18766"; CDP = 9333
RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail)); print(("PASS " if ok else "FAIL ") + name + (("  -- " + str(detail)[:400]) if detail else ""))


def req(base, path, body=None):
    h = {"Origin": base, "Content-Type": "application/json"}
    r = urllib.request.Request(base + path, json.dumps(body).encode() if body is not None else None, h)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp: return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        try: return e.code, json.load(e)
        except Exception: return e.code, {"ok": False, "error": "non-json"}


post = lambda p, b: req(DIRECT, p, b)
get = lambda p: req(DIRECT, p)
PDF1, PDF2 = PAPER_IDS[:2]
post("/api/reading/stop", {})
for t in get("/api/term/list")[1]["sessions"]:
    if t["alive"]: post("/api/term/kill", {"id": t["id"]})
time.sleep(0.5)

print("\n== A. remote viewer: Ask -> Claude answers in a side panel beside the PDF")
close_all(CDP)
app = Tab(CDP); app.nav(SSH + "/?remote=1#today", 3)
st, r = post("/api/reading/start", {"id": PDF1, "viewer": "browser"}); url = r["reading"]["url"]
viewer = Tab(CDP); viewer.nav(SSH + url, 5)
v = viewer.eval("({ explain: !!document.getElementById('paExplainButton'), ask: !!document.getElementById('paAskButton'), remote: localStorage.getItem('remote'), title: document.getElementById('paExplainButton') && document.getElementById('paExplainButton').title })")
check("A1 Explain and Ask are back in remote mode, titled for the panel", v and v["explain"] and v["ask"] and v["remote"] == "true" and "panel" in (v["title"] or ""), v)
v = viewer.eval("""(async () => {
  document.getElementById('paAskButton').click(); await new Promise(r => setTimeout(r, 300));
  const ta = document.querySelector('.pa-pop textarea'); if (!ta) return { err: 'no ask box' };
  ta.value = 'EDGE_QUESTION_ONE what does this mean';
  [...document.querySelectorAll('.pa-pop button')].find(b => b.textContent.includes('Send')).click();
  await new Promise(r => setTimeout(r, 3500));
  const side = document.querySelector('.pa-side');
  return { side: !!side, open: document.documentElement.classList.contains('pa-side-open'), status: side && side.querySelector('.pa-side-status').textContent,
           text: (document.querySelector('.pa-side .xterm-rows') || {}).innerText || '', outerW: document.getElementById('outerContainer').getBoundingClientRect().width, winW: innerWidth,
           flash: [...document.querySelectorAll('.pa-flash')].map(f => f.textContent).join('|') };
})()""")
check("A2 side panel opened, running, PDF area narrowed", v and v["side"] and v["open"] and v["status"] == "Running" and v["outerW"] < v["winW"] - 300, {k: v.get(k) for k in ("side", "open", "status", "outerW", "winW", "flash")} if v else v)
check("A3 the question reached Claude (stub printed it as its first prompt)", v and "ASSISTANT_STUB" in v["text"] and "EDGE_QUESTION_ONE" in v["text"] and "--session-id" in v["text"], re.findall(r"LAST_ARG.*", (v or {}).get("text", ""))[:1])
_, l = get("/api/term/list"); a = [t for t in l["sessions"] if t["kind"] == "assistant" and t["alive"]]
check("A4 one assistant console for this paper, listed for the library window too", len(a) == 1 and a[0]["paper"] == PDF1 and a[0]["title"].startswith("Claude"), [(t["kind"], t["paper"], t["title"]) for t in l["sessions"]])
_, s = get("/api/reading"); check("A5 reading session notes the chat (digest at the end)", s["reading"] and s["reading"].get("session") and s["reading"].get("assistant_opened"), {k: s["reading"].get(k) for k in ("session", "assistant_opened")})
sid1 = a[0]["id"]

print("\n== B. second Ask is pasted into the same console; typing in the panel works")
v = viewer.eval("""(async () => {
  document.getElementById('paAskButton').click(); await new Promise(r => setTimeout(r, 300));
  const ta = document.querySelector('.pa-pop textarea'); ta.value = 'EDGE_QUESTION_TWO and this';
  [...document.querySelectorAll('.pa-pop button')].find(b => b.textContent.includes('Send')).click();
  await new Promise(r => setTimeout(r, 2500));
  return { text: (document.querySelector('.pa-side .xterm-rows') || {}).innerText || '', panels: document.querySelectorAll('.pa-side').length, flash: [...document.querySelectorAll('.pa-flash')].map(f => f.textContent).join('|') };
})()""")
_, l = get("/api/term/list"); a = [t for t in l["sessions"] if t["kind"] == "assistant" and t["alive"]]
check("B1 pasted into the running console, no second console", v and "EDGE_QUESTION_TWO" in v["text"] and v["panels"] == 1 and len(a) == 1 and a[0]["id"] == sid1, (v or {}).get("flash"))
viewer.eval("SIDE && SIDE.focus()"); viewer.call("Input.insertText", {"text": "typed_in_panel_7"}); viewer.key("Enter", "\r"); time.sleep(1.2)
v = viewer.eval("(document.querySelector('.pa-side .xterm-rows') || {}).innerText || ''")
check("B2 keys typed in the panel reach Claude", v and v.count("typed_in_panel_7") >= 2, v[-200:] if v else v)   # echoed by the tty, then by cat

print("\n== C. Hide keeps it running; Ask brings it back; End stops it")
v = viewer.eval("(async () => { [...document.querySelectorAll('.pa-side-head button')].find(b => b.textContent === 'Hide').click(); await new Promise(r => setTimeout(r, 300)); return { open: document.documentElement.classList.contains('pa-side-open'), display: document.querySelector('.pa-side').style.display, outerW: document.getElementById('outerContainer').getBoundingClientRect().width, winW: innerWidth }; })()")
check("C1 hidden: PDF gets the full width", v and not v["open"] and v["display"] == "none" and v["outerW"] >= v["winW"] - 2, v)
_, l = get("/api/term/list"); check("C2 console still alive while hidden", any(t["id"] == sid1 and t["alive"] for t in l["sessions"]))
v = viewer.eval("""(async () => {
  document.getElementById('paAskButton').click(); await new Promise(r => setTimeout(r, 300));
  document.querySelector('.pa-pop textarea').value = 'EDGE_QUESTION_THREE';
  [...document.querySelectorAll('.pa-pop button')].find(b => b.textContent.includes('Send')).click();
  await new Promise(r => setTimeout(r, 2000));
  return { open: document.documentElement.classList.contains('pa-side-open'), text: (document.querySelector('.pa-side .xterm-rows') || {}).innerText || '' };
})()""")
check("C3 Ask re-shows the panel with the new question", v and v["open"] and "EDGE_QUESTION_THREE" in v["text"], (v or {}).get("open"))
v = viewer.eval("""(async () => {
  const b = [...document.querySelectorAll('.pa-side-head button')].find(x => x.textContent === 'End'); b.click(); const armed = b.textContent; b.click();
  await new Promise(r => setTimeout(r, 2500));
  return { armed, status: document.querySelector('.pa-side-status').textContent, btn: [...document.querySelectorAll('.pa-side-head button')][0].textContent };
})()""")
_, l = get("/api/term/list")
check("C4 End asks once, then ends the console", v and v["armed"] == "Really end?" and v["status"].startswith("Ended") and v["btn"] == "Close" and not any(t["id"] == sid1 and t["alive"] for t in l["sessions"]), v)

print("\n== D. library window: the live card has a Claude button for a browser session")
app.call("Page.bringToFront")
v = app.eval("""(async () => {
  await reload(); const card = document.querySelector('.livecard'); const b = card && [...card.querySelectorAll('button')].find(x => x.textContent.trim() === 'Claude');
  if (!b) return { err: 'no button', card: !!card, R: S.R && S.R.viewer };
  b.click(); await new Promise(r => setTimeout(r, 3500));
  return { panel: document.querySelectorAll('.termwrap').length, title: (document.querySelector('.termhead .ellip') || {}).textContent, status: (document.querySelector('.termstatus') || {}).textContent, text: (document.querySelector('.termwrap .xterm-rows') || {}).innerText || '' };
})()""")
_, l = get("/api/term/list"); a = [t for t in l["sessions"] if t["kind"] == "assistant" and t["alive"]]
check("D1 Claude button opens a new assistant console in the app (previous one was ended)", v and v.get("panel") == 1 and (v.get("title") or "").startswith("Claude") and v.get("status") == "Running" and "ASSISTANT_STUB" in v.get("text", "") and len(a) == 1 and a[0]["id"] != sid1, {k: v.get(k) for k in ("err", "panel", "title", "status")} if v else v)
sid2 = a[0]["id"] if a else None
viewer.call("Page.bringToFront")  # a background tab does not paint its terminal (no animation frames)
v = viewer.eval("""(async () => {
  document.getElementById('paAskButton').click(); await new Promise(r => setTimeout(r, 300));
  document.querySelector('.pa-pop textarea').value = 'EDGE_QUESTION_FOUR';
  [...document.querySelectorAll('.pa-pop button')].find(b => b.textContent.includes('Send')).click();
  await new Promise(r => setTimeout(r, 2500));
  return { text: (document.querySelector('.pa-side .xterm-rows') || {}).innerText || '', panels: document.querySelectorAll('.pa-side').length };
})()""")
app.call("Page.bringToFront"); time.sleep(0.8)  # let the app window paint its terminal (background tabs get no frames)
va = app.eval("(document.querySelector('.termwrap .xterm-rows') || {}).innerText || ''")
check("D2 PDF window and library window share that console (both see the question)", v and "EDGE_QUESTION_FOUR" in v["text"] and va and "EDGE_QUESTION_FOUR" in va and v["panels"] == 1, {"viewer_has": bool(v and "EDGE_QUESTION_FOUR" in v["text"]), "app_has": bool(va and "EDGE_QUESTION_FOUR" in va), "panels": (v or {}).get("panels"), "viewer_tail": ((v or {}).get("text") or "")[-160:], "app_tail": (va or "")[-160:]})
app.eval("CONSOLE && CONSOLE.close()")

print("\n== E. desktop side unchanged: Explain without the remote flag goes to a terminal on the library computer")
st, r = post("/api/reading/ask", {"id": PDF2, "mode": "explain", "text": "some passage", "page": 1})
check("E1 no remote flag + not the browser-read paper -> terminal path (test copy disables terminals, so a 400 proves the route)", st == 400 and "terminals disabled" in r.get("error", ""), r.get("error"))
st, r = post("/api/reading/ask", {"id": PDF1, "mode": "explain", "text": "some passage", "page": 1})
check("E2 the paper that is open in a browser is routed to the console even without the flag", st == 200 and r.get("delivered") == "console" and r.get("console") == sid2, r)
st, r = post("/api/reading/assistant", {})
check("E3 the terminal-form assistant is still refused for a browser session", st == 400 and "library computer" in r.get("error", ""), r.get("error"))

print("\n== cleanup")
for t in get("/api/term/list")[1]["sessions"]:
    if t["alive"]: post("/api/term/kill", {"id": t["id"]})
post("/api/reading/stop", {})
check("Z no JS exceptions in either window", not any(x.startswith("EXCEPTION") for x in app.log + viewer.log), [x for x in app.log + viewer.log if x.startswith("EXCEPTION")][:3])
viewer.close(); app.close()
print("\n%d/%d passed" % (sum(1 for _, ok, _ in RESULTS if ok), len(RESULTS)))
for n, ok, d in RESULTS:
    if not ok: print("  FAILED:", n, d)
