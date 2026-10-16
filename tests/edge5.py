#!/usr/bin/env python3
"""Expert page: one Claude conversation per discussion, kept in the library; console remotely, terminal window locally."""
import json, os, re, shutil, socket, sys, time, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdplib import Tab, close_all, TEST_XDG, PAPER_IDS

SSH = "http://localhost:18765"; PLAIN = "http://localhost:18764"; DIRECT = "http://127.0.0.1:18766"; CDP = 9333
RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail)); print(("PASS " if ok else "FAIL ") + name + (("  -- " + str(detail)[:500]) if detail else ""))


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
sq = lambda s: re.sub(r"\s+", "", s or "")          # xterm wraps long lines into rows: compare without whitespace
ROOT = get("/api/health")[1]["root"]
PROJ = os.path.join(os.path.expanduser("~/.claude/projects"), re.sub(r"[^A-Za-z0-9]", "-", ROOT))   # Claude Code's project-folder encoding (see server.py claude_project_dir)
XDG = TEST_XDG
CONTEXT = "我想討論 prompt-based continual learning 是否真的避免了 forgetting\n還是只是把問題移到 prompt selection 上 EDGE5_CTX"

# ---- clean slate
post("/api/reading/stop", {})
for t in get("/api/term/list")[1]["sessions"]:
    if t["alive"]: post("/api/term/kill", {"id": t["id"]})
lib = json.load(urllib.request.urlopen(DIRECT + "/api/library"))
for x in lib.get("experts") or []:
    post("/api/expert/remove", {"id": x["id"]})
time.sleep(0.5)
close_all(CDP)
experts = lambda: json.load(urllib.request.urlopen(DIRECT + "/api/library")).get("experts") or []
live_experts = lambda: [t for t in get("/api/term/list")[1]["sessions"] if t["kind"] == "expert" and t["alive"]]

print("\n== A. remote: the Expert page, a new discussion -> console panel, record in the library")
app = Tab(CDP); app.nav(SSH + "/?remote=1#expert", 3.5)
v = app.eval("({ page: S.page, nav: [...document.querySelectorAll('#nav .navitem')].map(b => b.querySelector('span:not(.badge)').textContent), empty: !!document.querySelector('#page .empty'), btns: [...document.querySelectorAll('#pagehead button, #page button')].map(b => b.textContent.trim()) })")
check("A1 Expert sits in the nav after Assistant; empty state with New discussion (header + empty state)", v and v["page"] == "expert" and v["nav"].index("Expert") == v["nav"].index("Assistant") + 1 and v["empty"] and v["btns"].count("New discussion") == 2, v)
app.call("Page.bringToFront")
v = app.eval("""(async () => { [...document.querySelectorAll('#pagehead button, #page button')].find(b => b.textContent.trim() === 'New discussion').click(); await new Promise(r => setTimeout(r, 300));
  const d = document.querySelector('dialog[open]'); if (!d) return { err: 'no dialog' };
  const hint = d.textContent; d.querySelector('input.input').value = 'EDGE5 title';
  const ta = d.querySelector('textarea'); ta.value = %s; ta.dispatchEvent(new Event('input'));
  [...d.querySelectorAll('button')].find(b => b.textContent.includes('Start discussion')).click(); await new Promise(r => setTimeout(r, 4000));
  return { hint, dialogLeft: !!document.querySelector('dialog[open]'), panel: document.querySelectorAll('.termwrap').length, title: (document.querySelector('.termhead .ellip') || {}).textContent, status: (document.querySelector('.termstatus') || {}).textContent,
    text: (document.querySelector('.termwrap .xterm-rows') || {}).innerText || '' }; })()""" % json.dumps(CONTEXT))
xs = experts(); a = live_experts()
x0 = xs[0] if xs else {}
check("A2 Start -> console panel titled after the discussion, record saved with title/context/session", v and not v.get("dialogLeft") and v.get("panel") == 1 and v.get("title") == "Expert · EDGE5 title" and v.get("status") == "Running" and len(xs) == 1 and x0.get("title") == "EDGE5 title" and x0.get("context") == CONTEXT and re.match(r"^[0-9a-f-]{36}$", x0.get("session") or "") and x0.get("opened") == 1 and x0.get("last_opened"), {k: (v or {}).get(k) for k in ("err", "dialogLeft", "panel", "title", "status")} | {"xs": len(xs), "x0": {k: x0.get(k) for k in ("title", "opened")}})
check("A3 console belongs to that conversation (kind expert, expert id)", len(a) == 1 and a[0]["expert"] == x0.get("id") and a[0]["paper"] is None, [(t["kind"], t.get("expert")) for t in a])
txt = sq((v or {}).get("text"))
check("A4 Claude started fresh with the session id, the expert system prompt and the brief as first prompt", "--session-id" + sq(x0.get("session")) in txt and sq("--append-system-prompt You are the Paper Expert") in txt and "EDGE5_CTX" in txt and sq("--effort high") in txt and "LAST_ARG:" + sq("Here is what I want to discuss") in txt, txt[:300])
check("A5 remote hint says console; dialog text explains the expert", v and "console panel" in (v.get("hint") or "") and "critically" in (v.get("hint") or ""), (v or {}).get("hint", "")[:200])
sid_console = a[0]["id"] if a else None
app.eval("CONSOLE && CONSOLE.close()")
v = app.eval("(async () => { await refreshTerms(); render(); const c = document.querySelector('#page .reqcard'); return { id: c && c.dataset.id, chips: [...c.querySelectorAll('.chip')].map(x => x.textContent), btn: [...c.querySelectorAll('button')].map(b => b.textContent.trim() || b.getAttribute('aria-label')), note: c.lastElementChild.textContent }; })()")
check("A6 after Hide the row shows Running with Open / End / Transcript / Rename / Delete", v and v["id"] == x0.get("id") and "Running" in v["chips"] and all(b in v["btn"] for b in ("Open", "End", "Transcript", "Rename", "Delete")) and "opened 1×" in (v["note"] or ""), v)
v = app.eval("(async () => { [...document.querySelector('#page .reqcard').querySelectorAll('button')].find(b => b.textContent.trim() === 'Open').click(); await new Promise(r => setTimeout(r, 1500)); return { panel: document.querySelectorAll('.termwrap').length, title: (document.querySelector('.termhead .ellip') || {}).textContent }; })()")
check("A7 Open attaches to the running console (no second Claude)", v and v["panel"] == 1 and v["title"] == "Expert · EDGE5 title" and len(live_experts()) == 1, v)
app.eval("CONSOLE && CONSOLE.close()")

print("\n== B. validation and title derivation")
st, r = post("/api/expert/new", {"title": "", "context": "   ", "console": True})
check("B1 empty brief refused, nothing recorded", st == 400 and "Describe" in r.get("error", "") and len(experts()) == 1, r.get("error"))
st, r = post("/api/expert/new", {"title": "", "context": "## Are world models actually learning dynamics, or just compressing frames?\nsecond line", "console": True, "cols": 100, "rows": 30})
x1 = (r or {}).get("chat") or {}
check("B2 title taken from the first line (markdown stripped); console started", st == 200 and x1.get("title") == "Are world models actually learning dynamics, or just compressing frames?" and r.get("console") and r.get("started") and len(live_experts()) == 2, {"st": st, "title": x1.get("title"), "err": r.get("error")})
st, r = post("/api/expert/open", {"id": x1["id"], "console": True})
check("B3 open again while running -> same console, not a second one", st == 200 and r.get("started") is False and r.get("console") == [t for t in live_experts() if t["expert"] == x1["id"]][0]["id"], r)
st, r = post("/api/expert/open", {"id": x1["id"], "console": False})
check("B4 terminal form refused while the console runs", st == 400 and "already running as a console" in r.get("error", ""), r.get("error"))
st, r = post("/api/expert/remove", {"id": x1["id"]})
check("B5 delete refused while running", st == 400 and "End it first" in r.get("error", ""), r.get("error"))
st, r = post("/api/op", {"op": "expert.update", "id": x1["id"], "fields": {"title": "  Renamed   via op ", "session": "hack", "context": "hack"}})
x1b = [x for x in experts() if x["id"] == x1["id"]][0]
check("B6 rename via op normalises whitespace and cannot touch session/context", st == 200 and x1b["title"] == "Renamed via op" and x1b["session"] == x1["session"] and x1b["context"] == x1["context"], {k: x1b.get(k) for k in ("title",)})
post("/api/term/kill", {"id": [t for t in live_experts() if t["expert"] == x1["id"]][0]["id"]}); time.sleep(1.2)

print("\n== C. End, transcript, Continue (resume)")
app.call("Page.bringToFront")
v = app.eval("""(async () => { window.confirmDialog = async () => true; await refreshTerms(); render(); const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s');
  [...c.querySelectorAll('button')].find(b => b.textContent.trim() === 'End').click(); await new Promise(r => setTimeout(r, 2500)); await refreshTerms(); render();
  const c2 = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); return { chips: [...c2.querySelectorAll('.chip')].map(x => x.textContent), btn: [...c2.querySelectorAll('button')].map(b => b.textContent.trim()) }; })()""" % (x0["id"], x0["id"]))
check("C1 End stops Claude; row shows Ended with Continue + View output, record kept", v and "Ended" in v["chips"] and "Continue" in v["btn"] and "View output" in v["btn"] and len(experts()) == 2 and not live_experts(), v)
# a transcript as Claude Code would have written it for this session
os.makedirs(PROJ, exist_ok=True)
jl = os.path.join(PROJ, x0["session"] + ".jsonl")
recs = [{"type": "user", "timestamp": "2026-10-13T10:00:00Z", "message": {"role": "user", "content": "Here is what I want to discuss in this conversation:\n\n" + CONTEXT}},
        {"type": "assistant", "timestamp": "2026-10-13T10:00:30Z", "message": {"role": "assistant", "content": [{"type": "tool_use", "id": "t1", "name": "Bash", "input": {}}]}},
        {"type": "user", "timestamp": "2026-10-13T10:00:31Z", "message": {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "t1", "content": "json"}]}},
        {"type": "assistant", "timestamp": "2026-10-13T10:01:00Z", "message": {"role": "assistant", "content": [{"type": "text", "text": "## Frontier\n- **L2P** (Wang, 2022, arXiv:2112.08654) claims no forgetting EDGE5_REPLY"}]}},
        {"type": "user", "timestamp": "2026-10-13T10:02:00Z", "message": {"role": "user", "content": "但 prompt pool 的 key matching 本身會 drift 吧 EDGE5_Q2"}}]
with open(jl, "w", encoding="utf-8") as f:
    for rec in recs: f.write(json.dumps(rec, ensure_ascii=False) + "\n")
st, r = get("/api/expert/transcript?id=" + x0["id"])
check("C2 transcript endpoint returns the readable turns only (no tool calls), in order", st == 200 and [t["role"] for t in r.get("turns", [])] == ["user", "assistant", "user"] and "EDGE5_REPLY" in r["turns"][1]["text"] and r.get("notes") is None, [(t["role"], t["text"][:30]) for t in r.get("turns", [])])
v = app.eval("""(async () => { const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); [...c.querySelectorAll('button')].find(b => b.textContent.trim() === 'Transcript').click(); await new Promise(r => setTimeout(r, 1200));
  const d = document.querySelector('dialog[open]'); if (!d) return { err: 'no dialog' };
  const out = { title: d.querySelector('h2').textContent, brief: (d.querySelector('.xctx') || {}).textContent, turns: [...d.querySelectorAll('.xturn')].map(t => t.querySelector('.who').textContent.trim() + '|' + t.textContent.includes('EDGE5_REPLY')), btn: [...d.querySelectorAll('.dfoot button')].map(b => b.textContent.trim()) };
  [...d.querySelectorAll('.dfoot button')].find(b => b.textContent.trim() === 'Close').click(); await new Promise(r => setTimeout(r, 300)); out.closed = !document.querySelector('dialog[open]'); return out; })()""" % x0["id"])
check("C3 Transcript dialog shows the brief and the turns, labels the app's opening request", v and v.get("title") == "EDGE5 title" and "EDGE5_CTX" in (v.get("brief") or "") and len(v.get("turns") or []) == 3 and v["turns"][0].startswith("Opening request") and v["turns"][1].startswith("Expert") and "true" in v["turns"][1] and v["turns"][2].startswith("You") and "Continue" in v.get("btn", []) and v.get("closed"), v)
v = app.eval("""(async () => { const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); [...c.querySelectorAll('button')].find(b => b.textContent.trim() === 'Continue').click(); await new Promise(r => setTimeout(r, 4000));
  return { panel: document.querySelectorAll('.termwrap').length, title: (document.querySelector('.termhead .ellip') || {}).textContent, text: (document.querySelector('.termwrap .xterm-rows') || {}).innerText || '' }; })()""" % x0["id"])
txt = sq((v or {}).get("text")); xs = experts(); x0b = [x for x in xs if x["id"] == x0["id"]][0]
check("C4 Continue resumes the same Claude session (--resume <sid>, no opening prompt), opened count 2", v and v["panel"] == 1 and "--resume" + sq(x0["session"]) in txt and "LAST_ARG:--append-system-prompt" not in txt and "EDGE5_CTX" not in txt and x0b["opened"] == 2 and x0b["last_opened"] > x0["last_opened"], {"title": (v or {}).get("title"), "txt": txt[:200], "opened": x0b["opened"]})
app.eval("CONSOLE && CONSOLE.close()")

print("\n== D. local (no remote flag): attach to a running console; new/continue take the terminal route")
loc = Tab(CDP); loc.nav(PLAIN + "/#expert", 3.5)
v = loc.eval("""(() => { const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); return { remote: REMOTE, chips: [...c.querySelectorAll('.chip')].map(x => x.textContent), btn: [...c.querySelectorAll('button')].map(b => b.textContent.trim()), note: c.lastElementChild.textContent, header: document.querySelector('#page .subtitle, #page .pagehead, #page header, #page').textContent.slice(0, 400) }; })()""" % x0["id"])
check("D1 console started remotely shows as Running here; Open attaches", v and v["remote"] is False and "Running" in v["chips"] and "Open" in v["btn"] and "attaches" in (v["note"] or ""), {k: (v or {}).get(k) for k in ("remote", "chips", "btn", "note")})
loc.call("Page.bringToFront")
v = loc.eval("""(async () => { const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); [...c.querySelectorAll('button')].find(b => b.textContent.trim() === 'Open').click(); await new Promise(r => setTimeout(r, 1500)); return { panel: document.querySelectorAll('.termwrap').length, title: (document.querySelector('.termhead .ellip') || {}).textContent }; })()""" % x0["id"])
check("D2 local Open attaches to that console (still exactly one Claude)", v and v["panel"] == 1 and v["title"] == "Expert · EDGE5 title" and len(live_experts()) == 1, v)
loc.eval("CONSOLE && CONSOLE.close()")
n_before = len(experts())
v = loc.eval("""(async () => { [...document.querySelectorAll('#pagehead button, #page button')].find(b => b.textContent.trim() === 'New discussion').click(); await new Promise(r => setTimeout(r, 300));
  const d = document.querySelector('dialog[open]'); if (!d) return { err: 'no dialog' }; const hint = d.textContent; d.querySelector('textarea').value = 'EDGE5 local brief'; [...d.querySelectorAll('button')].find(b => b.textContent.includes('Start discussion')).click(); await new Promise(r => setTimeout(r, 1500));
  return { hint, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '), dialogLeft: !!document.querySelector('dialog[open]') }; })()""")
check("D3 local New -> terminal window route (test copy: 'terminals disabled'); no orphan record", v and "terminal window" in (v.get("hint") or "") and "terminals disabled" in (v.get("toast") or "") and len(experts()) == n_before and v.get("dialogLeft"), {k: (v or {}).get(k) for k in ("toast", "dialogLeft")} | {"n": len(experts()), "before": n_before})
loc.eval("document.querySelector('dialog[open]') && document.querySelector('dialog[open]').closeDlg && document.querySelector('dialog[open]').closeDlg()")
v = loc.eval("""(async () => { document.querySelectorAll('.toast').forEach(t => t.remove()); const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); const b = [...c.querySelectorAll('button')].find(b => b.textContent.trim() === 'Continue'); const label = b && b.title; b.click(); await new Promise(r => setTimeout(r, 1500));
  return { label, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ') }; })()""" % x1["id"])
check("D4 local Continue on an idle discussion -> terminal route", v and "terminal window" in (v.get("label") or "") and "terminals disabled" in (v.get("toast") or ""), v)

print("\n== E. a terminal-window session on the library computer blocks the console form, and the page says so")
sock_path = os.path.join(XDG, "paper-assistant", "x-%s.sock" % x1["id"])
os.makedirs(os.path.dirname(sock_path), exist_ok=True)
srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
try: os.unlink(sock_path)
except FileNotFoundError: pass
srv.bind(sock_path); srv.listen(64)
import threading
def _acc():
    while True:
        try: c, _ = srv.accept(); c.close()
        except OSError: return
threading.Thread(target=_acc, daemon=True).start()   # like the real bridge: accept the liveness probes
try:
    st, r = post("/api/expert/open", {"id": x1["id"], "console": True})
    check("E1 console form refused while a terminal window runs it", st == 400 and "terminal window on the library computer" in r.get("error", ""), r.get("error"))
    st, r = post("/api/expert/open", {"id": x1["id"], "console": False})
    check("E2 a second terminal refused too", st == 400 and "already open in a terminal window" in r.get("error", ""), r.get("error"))
    st, r = post("/api/expert/remove", {"id": x1["id"]})
    check("E3 delete refused while the terminal runs", st == 400 and "terminal window" in r.get("error", "") and "Close it first" in r.get("error", ""), r.get("error"))
    _, l = get("/api/term/list")
    check("E4 /api/term/list reports the expert terminal separately from paper terminals", l.get("expert_terminals") == [x1["id"]] and l.get("terminals") == [], {"x": l.get("expert_terminals"), "t": l.get("terminals")})
    v = app.eval("(async () => { await refreshTerms(); render(); const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); return { chips: [...c.querySelectorAll('.chip')].map(x => x.textContent), note: c.lastElementChild.textContent }; })()" % x1["id"])
    check("E5 remote page shows 'Terminal open on the library computer'", v and "Terminal open on the library computer" in v["chips"] and "close that window" in (v["note"] or ""), v)
    v = loc.eval("(async () => { await refreshTerms(); render(); const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); return [...c.querySelectorAll('.chip')].map(x => x.textContent); })()" % x1["id"])
    check("E6 local page shows 'Terminal open here'", v and "Terminal open here" in v, v)
finally:
    srv.close()
    try: os.unlink(sock_path)
    except FileNotFoundError: pass
_, l = get("/api/term/list"); check("E7 closed terminal disappears from the list", l.get("expert_terminals") == [], l.get("expert_terminals"))

print("\n== F. rename, delete, shortcuts, restart survival")
app.call("Page.bringToFront")
v = app.eval("""(async () => { const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); c.querySelector('button[aria-label="Rename"]').click(); await new Promise(r => setTimeout(r, 300));
  const d = document.querySelector('dialog[open]'); const inp = d.querySelector('input'); const old = inp.value; inp.value = 'EDGE5 renamed'; [...d.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save').click(); await new Promise(r => setTimeout(r, 1500));
  const c2 = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); return { old, now: c2.querySelector('b').textContent }; })()""" % (x1["id"], x1["id"]))
check("F1 Rename dialog updates the title", v and v["old"] == "Renamed via op" and v["now"] == "EDGE5 renamed" and [x for x in experts() if x["id"] == x1["id"]][0]["title"] == "EDGE5 renamed", v)
v = app.eval("""(async () => { const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); document.querySelectorAll('.toast').forEach(t => t.remove()); c.querySelector('button[aria-label="Delete"]').click(); await new Promise(r => setTimeout(r, 600)); return [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '); })()""" % x0["id"])
check("F2 Delete on a running discussion only warns", v and "End the running session first" in v and len(experts()) == 2, v)
v = app.eval("""(async () => { window.confirmDialog = async () => true; const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); c.querySelector('button[aria-label="Delete"]').click(); await new Promise(r => setTimeout(r, 2000)); return [...document.querySelectorAll('#page .reqcard')].map(c => c.dataset.id); })()""" % x1["id"])
check("F3 Delete removes an idle discussion from the list and the library", v == [x0["id"]] and [x["id"] for x in experts()] == [x0["id"]], v)
v = app.eval("(() => { go('today'); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true })); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true })); return S.page; })()")
check("F4 'g x' jumps to the Expert page", v == "expert", v)
v = app.eval("paletteItems().filter(i => i.t === 'Go to Expert' || i.t === 'New expert discussion').map(i => i.t + ':' + (i.k || ''))")
check("F5 command palette lists the page with its chord and a New discussion action", v == ["Go to Expert:g x", "New expert discussion:"], v)
v = app.eval("(() => { go('settings'); const t = document.querySelector('#page').textContent; return { model: t.includes('Expert model'), effort: t.includes('Expert effort') }; })()")
check("F6 Settings has Expert model / effort rows", v and v["model"] and v["effort"], v)
check("Z no JS exceptions", not any(x.startswith("EXCEPTION") for x in app.log + loc.log), [x for x in app.log + loc.log if x.startswith("EXCEPTION")][:3])

print("\n== G. review fixes: snapshots, guards, re-entry, restart, export/import, notes, external rewrite")
import subprocess, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
XDIR = os.path.join(ROOT, ".expert", x0["id"])
def wait_until(fn, secs=8):
    for _ in range(int(secs * 4)):
        if fn(): return True
        time.sleep(0.25)
    return fn()
# G0: a 1-turn jsonl (brief recorded, never answered) -> Continue sends the re-entry prompt; the copy follows each open
with open(jl, "w", encoding="utf-8") as f: f.write(json.dumps(recs[0], ensure_ascii=False) + "\n")
post("/api/term/kill", {"id": [t for t in live_experts() if t["expert"] == x0["id"]][0]["id"]}); time.sleep(1.2)
st, r = post("/api/expert/open", {"id": x0["id"], "console": True, "cols": 100, "rows": 30})
app.call("Page.bringToFront"); time.sleep(0.3)
v = app.eval("(async () => { await refreshTerms(); openConsole(S.terms.find(t => t.id === '%s')); await new Promise(r => setTimeout(r, 2500)); return (document.querySelector('.termwrap .xterm-rows') || {}).innerText || ''; })()" % r.get("console"))
txt = sq(v)
check("G1 brief recorded but never answered -> Continue resumes with the re-entry prompt", st == 200 and "--resume" + sq(x0["session"]) in txt and "LAST_ARG:" + sq("My opening request above was recorded but never answered") in txt, txt[-300:])
app.eval("CONSOLE && CONSOLE.close()")
post("/api/term/kill", {"id": r.get("console")}); time.sleep(1.2)
# G2: full transcript -> End -> the app's copy appears under .expert/<id>/<session>.md (idle watch, 1 s in the test copy)
with open(jl, "w", encoding="utf-8") as f:
    for rec in recs: f.write(json.dumps(rec, ensure_ascii=False) + "\n")
st, r = post("/api/expert/open", {"id": x0["id"], "console": True, "cols": 100, "rows": 30}); time.sleep(0.8)
post("/api/term/kill", {"id": r.get("console")})
snap = os.path.join(XDIR, x0["session"] + ".md")
ok = wait_until(lambda: os.path.isfile(snap) and "EDGE5_REPLY" in open(snap, encoding="utf-8").read(), 10)
check("G2 when the console ends the transcript copy is written under .expert/<id>/", ok and "EDGE5_Q2" in open(snap, encoding="utf-8").read() and "## Brief" in open(snap, encoding="utf-8").read(), os.path.isfile(snap) and open(snap, encoding="utf-8").read()[:200])
# G3: timestamps come back in local time
st, r = get("/api/expert/transcript?id=" + x0["id"])
import datetime as _dt
loc_ts = _dt.datetime.fromisoformat("2026-10-13T10:00:00+00:00").astimezone().replace(tzinfo=None).isoformat(timespec="seconds")
check("G3 transcript timestamps are converted to the library computer's local time", st == 200 and r["turns"][0]["ts"] == loc_ts, (r["turns"][0]["ts"], loc_ts))
# G4: cross-site POST ("Origin: null") refused; over-long brief refused
import urllib.request as _u
rq = _u.Request(DIRECT + "/api/expert/new", json.dumps({"context": "x"}).encode(), {"Origin": "null", "Content-Type": "application/json"})
try:
    with _u.urlopen(rq, timeout=10) as resp: st = resp.status
except urllib.error.HTTPError as e: st = e.code
check("G4a a browser's cross-site POST (Origin: null) is refused", st == 403, st)
st, r = post("/api/expert/new", {"context": "x" * 8001, "console": True})
check("G4b a brief over 8000 characters is refused, nothing recorded", st == 400 and "too long" in r.get("error", "") and len(experts()) == 1, r.get("error"))
# G5: /api/op expert.remove cannot drop a running discussion
st, r = post("/api/expert/open", {"id": x0["id"], "console": True, "cols": 100, "rows": 30}); cid = r.get("console")
st, r = post("/api/op", {"op": "expert.remove", "id": x0["id"]})
check("G5 expert.remove through /api/op is refused while the console runs", st == 400 and "still running as a console" in r.get("error", "") and len(experts()) == 1, r.get("error"))
post("/api/term/kill", {"id": cid}); time.sleep(1.2)
# G6: Ctrl+Enter twice in the New discussion dialog starts one discussion
app.call("Page.bringToFront")
v = app.eval("""(async () => { go('expert'); await new Promise(r => setTimeout(r, 300)); [...document.querySelectorAll('#pagehead button, #page button')].find(b => b.textContent.trim() === 'New discussion').click(); await new Promise(r => setTimeout(r, 300));
  const d = document.querySelector('dialog[open]'); if (!d) return { err: 'no dialog' }; const ta = d.querySelector('textarea'); ta.value = 'EDGE5 double submit'; ta.dispatchEvent(new Event('input'));
  const ev = () => new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }); ta.dispatchEvent(ev()); ta.dispatchEvent(ev()); ta.dispatchEvent(ev());
  await new Promise(r => setTimeout(r, 4000)); return { panel: document.querySelectorAll('.termwrap').length, dialogLeft: !!document.querySelector('dialog[open]') }; })()""")
xs = experts(); dup = [x for x in xs if x["title"] == "EDGE5 double submit"]
check("G6 three Ctrl+Enter presses start exactly one discussion", v and v.get("panel") == 1 and not v.get("dialogLeft") and len(dup) == 1 and len(live_experts()) == 1, {"v": v, "dups": len(dup), "live": len(live_experts())})
app.eval("CONSOLE && CONSOLE.close()")
for t in live_experts(): post("/api/term/kill", {"id": t["id"]})
time.sleep(1.2)
for x in dup: post("/api/expert/remove", {"id": x["id"]})
# G7: the Claude session file is gone -> the copy is shown, Continue starts a fresh session that reads it
os.unlink(jl)
st, r = get("/api/expert/transcript?id=" + x0["id"])
check("G7a without the session file the endpoint returns the app's copy", st == 200 and r["turns"] == [] and "EDGE5_REPLY" in (r.get("saved") or ""), (r.get("saved") or "")[:120])
v = app.eval("""(async () => { await reload(); const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); [...c.querySelectorAll('button')].find(b => b.textContent.trim() === 'Transcript').click(); await new Promise(r => setTimeout(r, 1200));
  const d = document.querySelector('dialog[open]'); if (!d) return { err: 'no dialog' }; const t = d.textContent; d.closeDlg(); return { kept: t.includes('copy the app kept'), reply: t.includes('EDGE5_REPLY') }; })()""" % x0["id"])
check("G7b Transcript dialog shows the kept copy", v and v.get("kept") and v.get("reply"), v)
st, r = post("/api/expert/open", {"id": x0["id"], "console": True, "cols": 100, "rows": 30})
app.call("Page.bringToFront"); time.sleep(0.3)
v = app.eval("(async () => { await refreshTerms(); openConsole(S.terms.find(t => t.id === '%s')); await new Promise(r => setTimeout(r, 2500)); return (document.querySelector('.termwrap .xterm-rows') || {}).innerText || ''; })()" % r.get("console"))
txt = sq(v); x0c = [x for x in experts() if x["id"] == x0["id"]][0]
check("G7c Continue starts a fresh session that reads the copy first (new session id, reopen prompt)", st == 200 and x0c["session"] != x0["session"] and "--session-id" + sq(x0c["session"]) in txt and "LAST_ARG:" + sq("We discussed this before") in txt and sq(".expert/%s/%s.md" % (x0["id"], x0["session"])) in txt, {"old": x0["session"][:8], "new": x0c["session"][:8], "txt": txt[-260:]})
app.eval("CONSOLE && CONSOLE.close()")
post("/api/term/kill", {"id": r.get("console")}); time.sleep(1.2)
st, r = get("/api/expert/transcript?id=" + x0["id"])
check("G7d the earlier session's copy is listed as an earlier session", st == 200 and len(r.get("earlier") or []) == 1 and "EDGE5_REPLY" in r["earlier"][0]["text"], [e["file"] for e in r.get("earlier") or []])
# G8: server restart: records survive, the page reloads, Continue resumes the (new) session
jl2 = os.path.join(PROJ, x0c["session"] + ".jsonl")
with open(jl2, "w", encoding="utf-8") as f:
    for rec in recs: f.write(json.dumps(rec, ensure_ascii=False) + "\n")
before = experts(); h0 = get("/api/health")[1]
subprocess.run([sys.executable, os.path.join(HERE, "harness.py"), "restart-server"], check=True, capture_output=True)
ok = wait_until(lambda: get("/api/health")[1].get("started") != h0.get("started"), 20)
time.sleep(2.5)
after = experts()
v = None
for _ in range(10):
    v = app.eval("(() => ({ started: (S.health || {}).started, page: S.page, chips: (() => { const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); return c ? [...c.querySelectorAll('.chip')].map(x => x.textContent) : null; })() }))()" % x0["id"])
    if isinstance(v, dict) and v.get("started") == get("/api/health")[1].get("started") and v.get("chips"): break
    time.sleep(1)
check("G8a records survive a server restart; the open page reloaded and shows the discussion as Idle", ok and after == before and isinstance(v, dict) and v.get("page") == "expert" and v.get("chips") == ["Idle"], {"same": after == before, "v": v})
st, r = post("/api/expert/open", {"id": x0["id"], "console": True, "cols": 100, "rows": 30})
app.call("Page.bringToFront"); time.sleep(0.3)
v = app.eval("(async () => { await refreshTerms(); openConsole(S.terms.find(t => t.id === '%s')); await new Promise(r => setTimeout(r, 2500)); return (document.querySelector('.termwrap .xterm-rows') || {}).innerText || ''; })()" % r.get("console"))
txt = sq(v); x0d = [x for x in experts() if x["id"] == x0["id"]][0]
check("G8b after the restart Continue resumes the same session (--resume), opened count grows", "--resume" + sq(x0c["session"]) in txt and "LAST_ARG:--append" not in txt and x0d["opened"] == x0c["opened"] + 1, {"txt": txt[-200:], "opened": (x0c["opened"], x0d["opened"])})
app.eval("CONSOLE && CONSOLE.close()")
post("/api/term/kill", {"id": r.get("console")}); time.sleep(1.2)
# G9: export -> import keeps the discussions
st, exp = get("/api/export")
st2, r = post("/api/import", {"library": exp})
check("G9 export/import round trip keeps experts", st == 200 and st2 == 200 and [x["id"] for x in experts()] == [x["id"] for x in exp.get("experts", [])] == [x0["id"]], (st, st2, [x["id"] for x in experts()]))
# G10: notes written by the expert show up
os.makedirs(XDIR, exist_ok=True)
with open(os.path.join(XDIR, "notes.md"), "w", encoding="utf-8") as f: f.write("# Notes\n\n- EDGE5_NOTE point\n")
st, r = get("/api/expert/transcript?id=" + x0["id"])
v = app.eval("""(async () => { const c = [...document.querySelectorAll('#page .reqcard')].find(x => x.dataset.id === '%s'); [...c.querySelectorAll('button')].find(b => b.textContent.trim() === 'Transcript').click(); await new Promise(r => setTimeout(r, 1200));
  const d = document.querySelector('dialog[open]'); if (!d) return { err: 'no dialog' }; const t = d.textContent; d.closeDlg(); return { notes: t.includes('Saved notes'), point: t.includes('EDGE5_NOTE') }; })()""" % x0["id"])
check("G10 notes.md is returned and shown under 'Saved notes'", st == 200 and "EDGE5_NOTE" in (r.get("notes_text") or "") and r.get("notes") == ".expert/%s/notes.md" % x0["id"] and v and v.get("notes") and v.get("point"), (r.get("notes"), v))
# G11: a bridge that is alive but not accepting (full backlog) still counts as open
sock_path = os.path.join(XDG, "paper-assistant", "x-%s.sock" % x0["id"])
try: os.unlink(sock_path)
except FileNotFoundError: pass
srv2 = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM); srv2.bind(sock_path); srv2.listen(1)
fillers = []
for _ in range(3):
    c = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM); c.setblocking(False)
    try: c.connect(sock_path)
    except (BlockingIOError, OSError): pass
    fillers.append(c)
_, l = get("/api/term/list")
check("G11 a busy bridge (full backlog) is reported as open, not dead", x0["id"] in (l.get("expert_terminals") or []) and os.path.exists(sock_path), l.get("expert_terminals"))
for c in fillers: c.close()
srv2.close()
try: os.unlink(sock_path)
except FileNotFoundError: pass
# G12: library.json rewritten by an external tool without the experts key -> no 500s, defaults restored
lp = os.path.join(ROOT, "library.json"); data = json.load(open(lp, encoding="utf-8")); data.pop("experts", None); data["meta"]["rev"] = int(data["meta"].get("rev") or 0) + 1
time.sleep(1.1); json.dump(data, open(lp, "w", encoding="utf-8"), ensure_ascii=False, indent=2); os.utime(lp, None)
ok = wait_until(lambda: "experts" in json.load(urllib.request.urlopen(DIRECT + "/api/library")) and json.load(urllib.request.urlopen(DIRECT + "/api/library")).get("experts") == [], 8)
st, r = get("/api/expert/transcript?id=" + x0["id"])
check("G12 external rewrite without the experts key: defaults restored, lookups answer 400 not 500", ok and st == 400, (ok, st, r.get("error")))
try: os.unlink(jl2)
except FileNotFoundError: pass
shutil.rmtree(os.path.join(ROOT, ".expert"), ignore_errors=True)

print("\n== cleanup")
for t in get("/api/term/list")[1]["sessions"]:
    if t["alive"]: post("/api/term/kill", {"id": t["id"]})
time.sleep(1)
for x in experts(): post("/api/expert/remove", {"id": x["id"]})
try: os.unlink(jl)
except FileNotFoundError: pass
try:
    if os.path.isdir(PROJ) and not os.listdir(PROJ): os.rmdir(PROJ)
except OSError: pass
post("/api/reading/stop", {}); app.close(); loc.close()
print("\n%d/%d passed" % (sum(1 for _, ok, _ in RESULTS if ok), len(RESULTS)))
for n, ok, d in RESULTS:
    if not ok: print("  FAILED:", n, d)
