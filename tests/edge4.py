#!/usr/bin/env python3
"""Assistant page: one Claude per paper, opened as a console remotely and as a terminal window locally."""
import json, os, re, socket, sys, time, urllib.request, urllib.error
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
PDF1, PDF2, PDF3 = PAPER_IDS[:3]
_papers = {p["id"]: p for p in get("/api/library")[1]["papers"]}
label = lambda pid: _papers[pid].get("short") or _papers[pid].get("title") or pid   # what the picker matches (fuzzy on short + title) and what the console title carries ("Claude · <short or title>")
post("/api/reading/stop", {})
for t in get("/api/term/list")[1]["sessions"]:
    if t["alive"]: post("/api/term/kill", {"id": t["id"]})
time.sleep(0.5)
close_all(CDP)

print("\n== A. remote: the Assistant page lists the paper being read; Open gives a console panel")
post("/api/reading/start", {"id": PDF1, "viewer": "browser"})
app = Tab(CDP); app.nav(SSH + "/?remote=1#assistant", 3.5)
v = app.eval("({ page: S.page, nav: [...document.querySelectorAll('#nav .navitem')].map(b => b.querySelector('span:not(.badge)').textContent), rows: [...document.querySelectorAll('#page .reqcard')].map(c => c.dataset.id), first: (document.querySelector('#page .reqcard') || {}).textContent })")
check("A1 Assistant sits in the nav next to Explore; the paper being read is listed first", v and v["page"] == "assistant" and v["nav"].index("Assistant") == v["nav"].index("Explore") + 1 and v["rows"][:1] == [PDF1] and "Reading now" in (v["first"] or ""), v)
v = app.eval("""(async () => { const b = [...document.querySelector('#page .reqcard').querySelectorAll('button')].find(x => x.textContent.includes('Open')); const label = b.textContent; b.click(); await new Promise(r => setTimeout(r, 3500));
  return { label, panel: document.querySelectorAll('.termwrap').length, title: (document.querySelector('.termhead .ellip') || {}).textContent, status: (document.querySelector('.termstatus') || {}).textContent, chip: (document.querySelector('#page .reqcard .chip') || {}).textContent }; })()""")
_, l = get("/api/term/list"); a = [t for t in l["sessions"] if t["kind"] == "assistant" and t["alive"]]
check("A2 remote Open -> console panel for this paper, row shows Running", v and v["label"].strip() == "Open Claude" and v["panel"] == 1 and (v["title"] or "").startswith("Claude") and v["status"] == "Running" and len(a) == 1 and a[0]["paper"] == PDF1, v)
sid = a[0]["id"] if a else None
app.eval("CONSOLE && CONSOLE.close()")
v = app.eval("(async () => { await refreshTerms(); render(); const c = document.querySelector('#page .reqcard'); return { chips: [...c.querySelectorAll('.chip')].map(x => x.textContent), btn: [...c.querySelectorAll('button')].map(b => b.textContent.trim()) }; })()")
check("A3 after Hide the row shows Running with Open + End", v and "Running" in v["chips"] and "Open" in v["btn"] and "End" in v["btn"], v)

print("\n== B. picker: start a Claude for another paper")
v = app.eval("""(async () => { const inp = document.querySelector('#page input.input'); inp.value = %s; inp.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 200));
  const hit = [...document.querySelectorAll('#page .reqcard')].find(c => c.dataset.id === '%s' && c.closest('section') && c.closest('section').textContent.includes('Another paper'));
  if (!hit) return { err: 'no hit', ids: [...document.querySelectorAll('#page .reqcard')].map(c => c.dataset.id) };
  [...hit.querySelectorAll('button')].find(b => b.textContent.includes('Open')).click(); await new Promise(r => setTimeout(r, 3000));
  return { panel: document.querySelectorAll('.termwrap').length, title: (document.querySelector('.termhead .ellip') || {}).textContent }; })()""" % (json.dumps(label(PDF2)), PDF2))
_, l = get("/api/term/list"); a = [t for t in l["sessions"] if t["kind"] == "assistant" and t["alive"]]
check("B1 search finds the paper and Open starts its own Claude", v and v.get("panel") == 1 and label(PDF2) in (v.get("title") or "") and sorted(t["paper"] for t in a) == sorted([PDF1, PDF2]), v)
app.eval("CONSOLE && CONSOLE.close()")
v = app.eval("(async () => { await refreshTerms(); render(); const sec = document.querySelector('#page section'); return [...sec.querySelectorAll('.reqcard')].filter(c => [...c.querySelectorAll('.chip')].some(x => x.textContent === 'Running')).map(c => c.dataset.id); })()")
check("B2 both papers listed as Running", sorted(v or []) == sorted([PDF1, PDF2]), v)

print("\n== C. local (no remote flag): Open launches a terminal window on this screen")
loc = Tab(CDP); loc.nav(PLAIN + "/#assistant", 3.5)
v = loc.eval("""(async () => { const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); const b = [...c.querySelectorAll('button')].find(x => x.textContent.includes('Open'));
  const label = b.textContent.trim(); const notes = c.querySelectorAll('.small.muted'); return { remote: REMOTE, label, chips: [...c.querySelectorAll('.chip')].map(x => x.textContent), note: notes.length ? notes[notes.length - 1].textContent : '' }; })()""" % PDF1)
check("C1 a console started elsewhere shows as Running and Open attaches (no second Claude)", v and v["remote"] is False and v["label"] == "Open" and "Running" in v["chips"] and "attaches" in (v["note"] or ""), v)
# a paper without a running console: the local Open must take the terminal route (the test copy has terminals disabled, so the error text proves it)
v = loc.eval("""(async () => { const inp = document.querySelector('#page input.input'); inp.value = %s; inp.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 200));
  const hit = [...document.querySelectorAll('#page .reqcard')].find(c => c.dataset.id === '%s'); if (!hit) return { err: 'no hit' };
  const b = [...hit.querySelectorAll('button')].find(x => x.textContent.includes('Open')); const label = b.textContent.trim(); b.click(); await new Promise(r => setTimeout(r, 1500));
  return { label, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ') }; })()""" % (json.dumps(label(PDF3)), PDF3))
check("C2 local Open -> terminal window route (test copy: 'terminals disabled')", v and v.get("label") == "Open terminal" and "terminals disabled" in (v.get("toast") or ""), v)

print("\n== D. terminal-window assistant on the library computer is reported and blocks the console form")
post("/api/reading/assistant", {"id": PDF3})   # terminal route (refused by the test copy) still assigns the paper its chat session, like a real open
sock_path = os.path.join(TEST_XDG, "paper-assistant", "a-%s.sock" % PDF3)   # the test server's own runtime dir (short path)
os.makedirs(os.path.dirname(sock_path), exist_ok=True)
srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
try: os.unlink(sock_path)
except FileNotFoundError: pass
srv.bind(sock_path); srv.listen(2)
try:
    st, r = post("/api/reading/assistant", {"id": PDF3, "console": True})
    check("D1 console form refused while a terminal window runs it", st == 400 and "terminal window" in r.get("error", ""), r.get("error"))
    _, l = get("/api/term/list")
    check("D2 /api/term/list reports the terminal", PDF3 in (l.get("terminals") or []), l.get("terminals"))
    v = loc.eval("(async () => { await reload(); await refreshTerms(); render(); const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); return c ? { chips: [...c.querySelectorAll('.chip')].map(x => x.textContent) } : { err: 'not listed' }; })()" % PDF3)
    check("D3 local page shows 'Terminal open here'", v and "Terminal open here" in (v.get("chips") or []), v)
    st, r = post("/api/reading/assistant", {"id": PDF2})
    check("D4 terminal form refused while the console form runs it", st == 400 and "already running as a console" in r.get("error", ""), r.get("error"))
finally:
    srv.close()
    try: os.unlink(sock_path)
    except FileNotFoundError: pass
_, l = get("/api/term/list"); check("D5 closed terminal disappears from the list", PDF3 not in (l.get("terminals") or []))

print("\n== E. End from the page; shortcuts")
v = app.eval("""(async () => { window.confirmDialog = async () => true; const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); [...c.querySelectorAll('button')].find(b => b.textContent.trim() === 'End').click(); await new Promise(r => setTimeout(r, 2500)); await refreshTerms(); render();
  const c2 = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); return { chips: [...c2.querySelectorAll('.chip')].map(x => x.textContent), btn: [...c2.querySelectorAll('button')].map(b => b.textContent.trim()) }; })()""" % (PDF2, PDF2))
check("E1 End stops that paper's Claude; row offers View output", v and "Ended" in v["chips"] and "View output" in v["btn"], v)
v = app.eval("(() => { go('today'); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true })); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })); return S.page; })()")
check("E2 'g a' jumps to the Assistant page", v == "assistant", v)
check("Z no JS exceptions", not any(x.startswith("EXCEPTION") for x in app.log + loc.log), [x for x in app.log + loc.log if x.startswith("EXCEPTION")][:3])

print("\n== cleanup")
for t in get("/api/term/list")[1]["sessions"]:
    if t["alive"]: post("/api/term/kill", {"id": t["id"]})
post("/api/reading/stop", {}); app.close(); loc.close()
print("\n%d/%d passed" % (sum(1 for _, ok, _ in RESULTS if ok), len(RESULTS)))
for n, ok, d in RESULTS:
    if not ok: print("  FAILED:", n, d)
