"""Drive the test copy's Trail view in headless Chrome: screenshots + behaviour checks. Usage: python3 trail_check.py [port]"""
import json, sys, time, urllib.request, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdplib import Tab, close_all
S = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18799
BASE = "http://127.0.0.1:%d" % PORT
fails = []
def check(name, cond, info=""):
    print(("PASS " if cond else "FAIL ") + name + (" · " + str(info)[:200] if info else ""))
    if not cond: fails.append(name)

# the finder checks need a journal that contains these words; they are skipped (not failed) when the copy has none
_lib = json.load(urllib.request.urlopen(BASE + "/api/library"))
_texts = [(r.get("text") or "") for r in _lib.get("requests") or []] + [(x.get("context") or "") for x in _lib.get("experts") or []]
HAS_CAPACITY = any("capacity" in x.lower() for x in _texts)
HAS_CJK = sum(1 for x in _texts if "記憶" in x) >= 2
close_all(9333)
t = Tab(9333)
t.call("Emulation.setDeviceMetricsOverride", {"width": 1280, "height": 1600, "deviceScaleFactor": 1, "mobile": False})
t.nav(BASE + "/#explore/trail", 3)
t.eval("localStorage.setItem('exploreView','trail'); 1")
view = t.eval("typeof exploreView === 'function' ? exploreView() : 'nofn'")
check("hash route selects the trail view", view == "trail", view)
if view != "trail":
    t.eval("setExploreView('trail')"); t.drain(1)
n = t.eval("({cells: document.querySelectorAll('.trcell').length, rows: document.querySelectorAll('.trrow').length, lanes: document.querySelectorAll('.trlanelbl').length, links: document.querySelectorAll('.trlink').length, ribbons: document.querySelectorAll('.trribbon').length, labels: document.querySelectorAll('.trlabel').length, ins: !!document.querySelector('.trdetail.insights'), ns: (document.querySelector('.trns')||{}).textContent||'' , svgW: (document.querySelector('.trmap')||{}).getAttribute ? document.querySelector('.trmap').getAttribute('width') : 0, svgH: document.querySelector('.trmap') && document.querySelector('.trmap').getAttribute('height'), cap: (document.querySelector('.trcaption')||{}).textContent})")
print(json.dumps(n, ensure_ascii=False))
check("strip has cells and lanes", n and n["cells"] >= 8 and n["lanes"] >= 5, n)
check("list shows every entry (cancelled hidden)", n and n["rows"] >= 9, n and n["rows"])
check("insights panel with north star by default", n and n["ins"] and len(n["ns"]) > 20)
check("links drawn", n and n["links"] >= 3, n and n["links"])
t.shot(S + "/shot_trail_1.png")
# select a station
t.eval("document.querySelector('.trcell').dispatchEvent(new MouseEvent('click', {bubbles:true}))"); t.drain(0.8)
d = t.eval("({sel: !!document.querySelector('.trcell.sel'), detail: !!document.querySelector('.trdetail:not(.insights)'), verbatim: (document.querySelector('.trverbatim')||{}).textContent||'', rowsel: !!document.querySelector('.trrow.sel'), station: (document.querySelector('.trstationh')||{}).textContent||'', acts: [...document.querySelectorAll('.tracts .btn')].map(b=>b.textContent.trim())})")
print(json.dumps(d, ensure_ascii=False))
check("clicking a station opens the detail panel with the verbatim text", d and d["detail"] and len(d["verbatim"]) > 5 and d["rowsel"], d)
t.shot(S + "/shot_trail_2.png")
# search
t.eval("document.querySelector('#trsearch').value='capacity'; document.querySelector('#trsearch').dispatchEvent(new Event('input',{bubbles:true}))"); t.drain(0.8)
sr = t.eval("({rows: document.querySelectorAll('.trrow').length, dim: document.querySelectorAll('.trcell.dim').length, via: [...document.querySelectorAll('.trvia')].map(x=>x.textContent), head: (document.querySelector('.trdayhead')||{}).textContent, cnt: (document.querySelector('#trcount')||{}).textContent})")
print(json.dumps(sr, ensure_ascii=False))
if HAS_CAPACITY: check("search 'capacity' finds the memory-capacity question via keywords", sr and 1 <= sr["rows"] <= 4 and sr["dim"] >= 5, sr)
else: print("SKIP search 'capacity' (no such entry in this copy)")
t.shot(S + "/shot_trail_3.png")
t.eval("document.querySelector('#trsearch').value='記憶'; document.querySelector('#trsearch').dispatchEvent(new Event('input',{bubbles:true}))"); t.drain(0.6)
sr2 = t.eval("document.querySelectorAll('.trrow').length")
if HAS_CJK: check("search in Chinese works", sr2 and sr2 >= 2, sr2)
else: print("SKIP search in Chinese (fewer than two entries contain 記憶)")
t.eval("document.querySelector('#trsearch').value=''; document.querySelector('#trsearch').dispatchEvent(new Event('input',{bubbles:true}))"); t.drain(0.6)
# lane facet
t.eval("document.querySelector('.trlanelbl').dispatchEvent(new MouseEvent('click', {bubbles:true}))"); t.drain(0.6)
lf = t.eval("({chip: !!document.querySelector('.trchips .btnchip'), rows: document.querySelectorAll('.trrow').length, on: !!document.querySelector('.trlanelbl.on')})")
check("lane click isolates a thread", lf and lf["chip"] and lf["on"] and 1 <= lf["rows"] < 10, lf)
t.eval("document.querySelector('.trchips .btnchip').click()"); t.drain(0.6)
check("clearing the thread chip restores the list", t.eval("document.querySelectorAll('.trrow').length") >= 9)
# jot a note via the capture bar (Enter)
t.eval("(()=>{const ta=document.querySelector('.trjot'); ta.focus(); ta.value='CDP 測試筆記：我想知道 replay buffer 的容量是否決定 forgetting'; ta.dispatchEvent(new Event('input',{bubbles:true})); ta.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()"); t.drain(2.5)
jn = t.eval("({rows: document.querySelectorAll('.trrow').length, noted: document.querySelectorAll('.trrow.noted').length, toast: (document.querySelector('.toasts')||{}).textContent||'', newlane: !!document.querySelector('.trlanelbl.new'), sel: !!document.querySelector('.trdetail:not(.insights)')})")
print(json.dumps(jn, ensure_ascii=False))
check("Enter in the capture bar saves a note and it appears in the list and a 'Not analysed yet' lane", jn and jn["noted"] >= 1 and jn["newlane"], jn)
t.eval("document.activeElement && document.activeElement.blur()"); t.drain(1.2)
stale = t.eval("(S.L.trail_live||{}).stale")
check("server reports the analysis as stale after a new note", stale is True, stale)
t.shot(S + "/shot_trail_4.png")
# replay
t.eval("document.querySelector('.trreplay').click()"); t.drain(0.6)
rp = t.eval("({replay: !!document.querySelector('.trmap.replay'), on: document.querySelectorAll('.trcell.on').length, cap: (document.querySelector('#trreplaycap')||{}).textContent})")
check("replay runs step by step with a caption", rp and rp["replay"] and rp["on"] >= 1 and rp["cap"], rp)
t.drain(3)
rp2 = t.eval("({replay: !!document.querySelector('.trmap.replay'), cap: (document.querySelector('#trreplaycap')||{}).textContent})")
check("replay finishes and leaves the strip intact", rp2 and not rp2["replay"], rp2)
# delete the test note through the detail overflow (request.remove)
rid = t.eval("[...S.L.requests].reverse().find(r=>r.kind==='note').id")
t.eval("api.post('/api/op', {op:'request.remove', id:%s}).then(()=>reload())" % json.dumps(rid)); t.drain(1.5)
check("test note removed", t.eval("!S.L.requests.some(r=>r.id===%s)" % json.dumps(rid)))
# survey view still fine + note button
t.eval("document.activeElement && document.activeElement.blur(); setExploreView('survey')"); t.drain(0.8)
sv = t.eval("({hero: !!document.querySelector('.hero'), note: [...document.querySelectorAll('.hero .btn')].some(b=>/Save as a note/.test(b.textContent)), noted: document.querySelectorAll('.reqcard').length})")
check("survey view keeps the hero and gains 'Save as a note'", sv and sv["hero"] and sv["note"], sv)
# today tile
t.eval("document.activeElement && document.activeElement.blur(); go('today')"); t.drain(1.5)
tt = t.eval("[...document.querySelectorAll('.tile h2')].map(x=>x.textContent)")
check("today page shows the trail tile", tt and any('trail' in x.lower() for x in tt), tt)
# settings section
t.eval("go('settings')"); t.drain(1)
st = t.eval("[...document.querySelectorAll('.setsec h2')].map(x=>x.textContent)")
check("settings has a Trail section", st and "Trail" in st, st)
# phone layout
t.call("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 1200, "deviceScaleFactor": 1, "mobile": True})
t.eval("document.activeElement && document.activeElement.blur(); go('explore'); setExploreView('trail')"); t.drain(1.2)
ph = t.eval("({lanes: document.querySelectorAll('.trlanelbl').length, w: document.querySelector('.trmap') && +document.querySelector('.trmap').getAttribute('width'), ins: !!document.querySelector('details.trinsights'), side: !!document.querySelector('.trside'), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth})")
print(json.dumps(ph))
check("phone: no lane gutter, insights folded, strip fits", ph and ph["lanes"] == 0 and ph["ins"] and not ph["side"] and ph["w"] <= 390, ph)
t.eval("document.querySelector('.trrow').dispatchEvent(new MouseEvent('click', {bubbles:true}))"); t.drain(0.8)
check("phone: a row opens the detail in a dialog", t.eval("!!document.querySelector('dialog[open] .trdetail')"))
t.shot(S + "/shot_trail_phone.png")
t.eval("(()=>{const d=document.querySelector('dialog[open]'); d && d.closeDlg && d.closeDlg()})()"); t.drain(0.3)
# dark theme desktop shot
t.call("Emulation.setDeviceMetricsOverride", {"width": 1280, "height": 1300, "deviceScaleFactor": 1, "mobile": False})
t.eval("document.activeElement && document.activeElement.blur(); applyTheme('dark'); go('explore'); setExploreView('trail')"); t.drain(1.2)
t.shot(S + "/shot_trail_dark.png")
t.eval("applyTheme('auto')")
print("\n".join(t.log) or "(no console errors / exceptions)")
check("no uncaught exceptions or console errors", not any(l.startswith("EXCEPTION") or l.startswith("console.error") for l in t.log), t.log[:3])
t.close()
print("FAILED:", fails if fails else "none")
