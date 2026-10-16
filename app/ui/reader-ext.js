/* Paper Assistant reader extension for the bundled PDF.js viewer.
   Loaded by vendor/pdfjs/web/viewer.html when the URL carries ?paper=<id>.
   - paints saved highlights on each page (positions stored as fractions of the page box, so zoom-independent)
   - select text → popover → save as highlight (+ optional note) through POST /api/op highlight.add
   - click a highlight → edit note / colour / delete
   - listens to the app's SSE for "reader" goto events and highlight changes */
(() => {
  const qs = new URLSearchParams(location.search);
  const PAPER = qs.get('paper');
  if (!PAPER) return;
  const API = location.origin;
  const SESS = qs.get('sess');                                  // set only on tabs opened for a browser reading session
  let SERVER_OLD = false;                                       // server from before 2.4.0: Explain/Ask could only open a terminal on the library computer
  fetch(API + '/api/health', { cache: 'no-store' }).then(r => r.json()).then(j => { const v = String(j.version || '0').split('.').map(Number); SERVER_OLD = (v[0] || 0) < 2 || ((v[0] || 0) === 2 && (v[1] || 0) < 4); }).catch(() => { });
  let REMOTE = false;                                           // this browser is on another computer (same origin as the app, so its flag is readable)
  try { REMOTE = localStorage.getItem('remote') === 'true'; } catch (e) { }
  const COLORS = { yellow: '#ffd43b', green: '#4cc38a', blue: '#5aa9ff', pink: '#ff7ab8' };
  let HL = [];
  let pop = null;
  let noteMode = localStorage.getItem('pa-note-mode') === '1';
  let toggleBtn = null;
  function setNoteMode(on, announce = true) {
    noteMode = !!on;
    localStorage.setItem('pa-note-mode', noteMode ? '1' : '0');
    document.documentElement.classList.toggle('pa-note-mode', noteMode);
    if (toggleBtn) { toggleBtn.classList.toggle('toggled', noteMode); toggleBtn.setAttribute('aria-pressed', String(noteMode)); }
    if (!noteMode) closePop();
    if (announce) flash(noteMode ? 'Note mode on - select text to save a highlight' : 'Note mode off - selection just copies');
  }
  function installToolbar() {
    const group = document.getElementById('editorModeButtons') || document.getElementById('toolbarViewerRight');
    if (!group || document.getElementById('paNoteModeButton')) return;
    toggleBtn = h('button', { id: 'paNoteModeButton', class: 'toolbarButton pa-tb pa-toggle' + (noteMode ? ' toggled' : ''), type: 'button', title: 'Note mode (N): while on, selecting text saves a highlight with a note. Off: selecting text just copies.', 'aria-pressed': String(noteMode), onclick: () => setNoteMode(!noteMode) },
      h('span', { class: 'pa-tb-ic', 'aria-hidden': 'true' }, '✎'), h('span', { class: 'pa-tb-lbl' }, 'Note'));
    const where = REMOTE ? 'in a Claude panel beside the PDF' : 'by the assistant on your main screen';
    const explainBtn = h('button', { id: 'paExplainButton', class: 'toolbarButton pa-tb', type: 'button', title: `Quick explain (E): have the selected text explained ${where}.`, onclick: () => quickExplain() },
      h('span', { class: 'pa-tb-ic', 'aria-hidden': 'true' }, '💡'), h('span', { class: 'pa-tb-lbl' }, 'Explain'));
    const askBtn = h('button', { id: 'paAskButton', class: 'toolbarButton pa-tb', type: 'button', title: `Ask (A): quote the selected text and type a question; answered ${where}.`, onclick: () => openAsk() },
      h('span', { class: 'pa-tb-ic', 'aria-hidden': 'true' }, '?'), h('span', { class: 'pa-tb-lbl' }, 'Ask'));
    const wrap = h('div', { class: 'toolbarHorizontalGroup pa-toggle-wrap' }, toggleBtn, explainBtn, askBtn);
    group.parentElement.insertBefore(wrap, group);
    document.documentElement.classList.toggle('pa-note-mode', noteMode);
  }
  let pending = null; // {page, quote, rects}

  const $ = (sel, root = document) => root.querySelector(sel);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'style') el.style.cssText = v; else if (v != null) el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  };
  const api = async (path, body) => {
    const r = await fetch(API + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    const j = await r.json().catch(() => ({ ok: false, error: 'bad response' }));
    if (!j.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  };
  const flash = (text, kind = '') => {
    const t = h('div', { class: 'pa-flash ' + kind }, text);
    document.body.append(t);
    setTimeout(() => t.classList.add('on'), 10);
    setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 250); }, 1800);
  };

  /* ---------- painting */
  function layerFor(page) {
    let layer = page.querySelector(':scope > .pa-hl-layer');
    if (!layer) { layer = h('div', { class: 'pa-hl-layer' }); page.append(layer); }
    return layer;
  }
  function paintPage(page) {
    const n = +page.dataset.pageNumber;
    if (!n) return;
    const layer = layerFor(page);
    layer.replaceChildren();
    for (const hl of HL) {
      if (hl.page !== n) continue;
      (hl.rects || []).forEach((r, i) => {
        const box = h('div', { class: 'pa-hl', 'data-id': hl.id, title: hl.note ? hl.note : 'Highlight · click to add a note', style: `left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%;background:${COLORS[hl.color] || COLORS.yellow}` });
        box.addEventListener('mousedown', e => e.stopPropagation());
        box.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); openEdit(hl, box); });
        if (i === 0 && hl.note) box.append(h('span', { class: 'pa-hl-mark' }, '✎'));
        layer.append(box);
      });
    }
  }
  function paintAll() { const pages = document.querySelectorAll('#viewer .page'); pages.forEach(paintPage); const n = document.querySelectorAll('#viewer .pa-hl').length; if (n) console.log('pa: painted ' + n + ' boxes on ' + pages.length + ' pages'); }
  async function load() {
    try { HL = (await api('/api/highlights?paper=' + encodeURIComponent(PAPER))).highlights || []; } catch (e) { HL = []; console.warn('pa: could not load highlights', e); }
    console.log('pa: loaded ' + HL.length + ' highlights');
    paintAll();
  }

  /* ---------- selection → highlight */
  function pageBox(page) {
    const r = page.getBoundingClientRect(), cs = getComputedStyle(page);
    const bl = parseFloat(cs.borderLeftWidth) || 0, bt = parseFloat(cs.borderTopWidth) || 0;
    return { left: r.left + bl, top: r.top + bt, w: page.clientWidth || 1, h: page.clientHeight || 1 };
  }
  function captureSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 2) return null;
    const range = sel.getRangeAt(0);
    const startEl = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const page = startEl && startEl.closest('#viewer .page');
    if (!page) return null;
    const box = pageBox(page);
    const rects = [];
    for (const r of range.getClientRects()) {
      if (r.width < 2 || r.height < 2) continue;
      const x = (r.left - box.left) / box.w, y = (r.top - box.top) / box.h, w = r.width / box.w, hh = r.height / box.h;
      if (x < -0.01 || y < -0.01 || x > 1.01 || y > 1.01) continue; // other page
      const last = rects[rects.length - 1];
      if (last && Math.abs(last.y - y) < 0.002 && Math.abs(last.h - hh) < 0.004 && x <= last.x + last.w + 0.01) { last.w = Math.max(last.w, x + w - last.x); continue; }
      rects.push({ x: Math.max(0, x), y: Math.max(0, y), w: Math.min(1, w), h: Math.min(1, hh) });
    }
    if (!rects.length) return null;
    const lastRect = range.getClientRects()[range.getClientRects().length - 1];
    return { page: +page.dataset.pageNumber, quote: text, rects: rects.slice(0, 60), anchor: lastRect };
  }
  function closePop() { if (pop) { pop.remove(); pop = null; } pending = null; }
  function place(el, anchor) {
    const vw = innerWidth, vh = innerHeight;
    let x = anchor.left, y = anchor.bottom + 8;
    document.body.append(el);
    const w = el.offsetWidth, hh = el.offsetHeight;
    if (x + w > vw - 12) x = Math.max(12, vw - w - 12);
    if (y + hh > vh - 12) y = Math.max(12, anchor.top - hh - 8);
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }
  function colorDots(current, onPick) {
    return h('div', { class: 'pa-colors' }, Object.entries(COLORS).map(([k, c]) => h('button', { class: 'pa-dot' + (k === current ? ' on' : ''), style: `background:${c}`, title: k, type: 'button', onclick: e => { e.currentTarget.parentElement.querySelectorAll('.pa-dot').forEach(d => d.classList.remove('on')); e.currentTarget.classList.add('on'); onPick(k); } })));
  }
  function openCreate(cap) {
    closePop();
    pending = cap;
    let color = localStorage.getItem('pa-hl-color') || 'yellow';
    const ta = h('textarea', { class: 'pa-ta', placeholder: 'Add a note (optional) · Ctrl+Enter saves', rows: 3 });
    const save = async () => {
      if (!pending) return;
      const body = { op: 'highlight.add', highlight: { paper: PAPER, page: pending.page, quote: pending.quote, note: ta.value.trim(), color, rects: pending.rects } };
      try {
        const r = await api('/api/op', body);
        HL.push({ id: r.result.ids[0], ...body.highlight });
        paintAll(); window.getSelection().removeAllRanges(); closePop(); flash('Highlight saved', 'ok');
      } catch (e) { flash('Could not save: ' + e.message, 'err'); }
    };
    pop = h('div', { class: 'pa-pop', onmousedown: e => e.stopPropagation(), onkeydown: e => { if (e.key === 'Escape') { e.stopPropagation(); closePop(); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } } },
      h('div', { class: 'pa-quote' }, '“' + (cap.quote.length > 180 ? cap.quote.slice(0, 180) + '…' : cap.quote) + '”'),
      ta,
      h('div', { class: 'pa-row' }, colorDots(color, c => { color = c; localStorage.setItem('pa-hl-color', c); }), h('span', { class: 'pa-grow' }), h('button', { class: 'pa-btn', type: 'button', onclick: closePop }, 'Cancel'), h('button', { class: 'pa-btn primary', type: 'button', onclick: save }, 'Save highlight')));
    place(pop, cap.anchor);
    setTimeout(() => ta.focus({ preventScroll: true }), 30);
  }
  function openEdit(hl, box) {
    closePop();
    let color = hl.color || 'yellow';
    const ta = h('textarea', { class: 'pa-ta', placeholder: 'Note for this highlight · Ctrl+Enter saves', rows: 3 }, hl.note || '');
    const save = async () => {
      try { await api('/api/op', { op: 'highlight.update', id: hl.id, fields: { note: ta.value.trim(), color } }); hl.note = ta.value.trim(); hl.color = color; paintAll(); closePop(); flash('Saved', 'ok'); }
      catch (e) { flash('Could not save: ' + e.message, 'err'); }
    };
    const del = async () => {
      try { await api('/api/op', { op: 'highlight.remove', id: hl.id }); HL = HL.filter(x => x.id !== hl.id); paintAll(); closePop(); flash('Highlight removed'); }
      catch (e) { flash('Could not delete: ' + e.message, 'err'); }
    };
    pop = h('div', { class: 'pa-pop', onmousedown: e => e.stopPropagation(), onkeydown: e => { if (e.key === 'Escape') { e.stopPropagation(); closePop(); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } } },
      h('div', { class: 'pa-quote' }, '“' + (hl.quote.length > 180 ? hl.quote.slice(0, 180) + '…' : hl.quote) + '”'),
      ta,
      h('div', { class: 'pa-row' }, colorDots(color, c => { color = c; }), h('button', { class: 'pa-btn', type: 'button', title: 'Copy quote', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(hl.quote); flash('Quote copied'); } }, 'Copy'), h('span', { class: 'pa-grow' }), h('button', { class: 'pa-btn danger', type: 'button', onclick: del }, 'Delete'), h('button', { class: 'pa-btn primary', type: 'button', onclick: save }, 'Save')));
    place(pop, box.getBoundingClientRect());
    setTimeout(() => ta.focus({ preventScroll: true }), 30);
  }

  /* ---------- quick explain / ask → the assistant terminal on the main screen */
  let lastSel = null; // remember the last selection so a toolbar click (which drops the selection) still has it
  document.addEventListener('selectionchange', () => { const c = captureSelection(); if (c) lastSel = { ...c, at: Date.now() }; });
  function currentSel() { const c = captureSelection(); if (c) return c; return lastSel && Date.now() - lastSel.at < 60000 ? lastSel : null; }
  async function sendAsk(body) {
    if (REMOTE && SERVER_OLD) { flash('The library server is still on the previous version; restart it first (it would open the terminal on the library computer).', 'err'); return false; }
    try {
      const r = await api('/api/reading/ask', { ...body, id: PAPER, console: REMOTE, cols: sideCols(), rows: sideRows() });
      if (r.delivered === 'console') { openSide(r.console); flash(r.started ? 'Claude is starting in the panel…' : 'Sent to Claude', 'ok'); }
      else flash(r.delivered === 'terminal' ? 'Sent to the assistant' : 'Assistant opening on your main screen…', 'ok');
      return true;
    } catch (e) { flash('Could not send: ' + e.message, 'err'); return false; }
  }

  /* ---------- side console: the reading assistant streamed from the library computer (remote mode).
     Same session as "Claude · <paper>" under Explore → Consoles in the library window; both can be attached at once. */
  let SIDE = null, XTERM_P = null;
  const sideW = () => Math.min(Math.max(360, Math.round(innerWidth * 0.42)), 620);
  const sideCols = () => Math.max(60, Math.floor((sideW() - 24) / 7.6));
  const sideRows = () => Math.max(20, Math.floor((innerHeight - 90) / 17));
  function loadXterm() {
    if (window.Terminal && window.FitAddon) return Promise.resolve();
    if (!XTERM_P) {
      const link = h('link', { rel: 'stylesheet', href: '/app/ui/vendor/xterm/xterm.css' }); document.head.append(link);
      const js = src => new Promise((res, rej) => { const el = h('script', { src }); el.onload = res; el.onerror = () => rej(new Error('Could not load ' + src)); document.head.append(el); });
      XTERM_P = js('/app/ui/vendor/xterm/xterm.js').then(() => js('/app/ui/vendor/xterm/addon-fit.js')).catch(e => { XTERM_P = null; throw e; });
    }
    return XTERM_P;
  }
  function fireResize() { try { window.dispatchEvent(new Event('resize')); } catch (e) { } }   // pdf.js refits the pages to the narrower area
  async function openSide(sid) {
    if (SIDE) { if (SIDE.id === sid) { SIDE.show(); return; } SIDE.close(); }
    SIDE = { id: sid, close() { SIDE = null; }, show() { }, focus() { } }; // placeholder while xterm.js loads
    try { await loadXterm(); } catch (e) { flash('Could not load the console: ' + e.message, 'err'); if (SIDE && SIDE.id === sid) SIDE = null; return; }
    if (!SIDE || SIDE.id !== sid) return;
    const client = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).replace(/-/g, '').slice(0, 16);
    let ended = false, hidden = false, lastSize = '', pending = '', flushT = null, arm = 0;
    const status = h('span', { class: 'pa-side-status' }, 'Connecting…');
    const endBtn = h('button', { class: 'pa-btn', type: 'button', title: 'Stop Claude and end this session', onclick: () => {
      if (ended) { close(); return; }
      if (Date.now() - arm > 4000) { arm = Date.now(); endBtn.textContent = 'Really end?'; setTimeout(() => { if (!ended) endBtn.textContent = 'End'; }, 4000); return; }
      api('/api/term/kill', { id: sid }).catch(e => flash('Could not end: ' + e.message, 'err'));
    } }, 'End');
    const host = h('div', { class: 'pa-side-host' });
    const panel = h('div', { class: 'pa-side', style: 'width:' + sideW() + 'px' },
      h('div', { class: 'pa-side-head' }, h('span', { class: 'pa-side-dot' }), h('b', {}, 'Claude'), status, h('span', { class: 'pa-grow' }), endBtn, h('button', { class: 'pa-btn', type: 'button', title: 'Hide the panel; Claude keeps running. Explain / Ask brings it back.', onclick: () => hide() }, 'Hide')),
      host,
      h('div', { class: 'pa-side-foot' }, 'Keys go to Claude while the panel has focus; click the PDF to get back. The same session is under Explore → Consoles in the library window.'));
    panel.addEventListener('mousedown', e => e.stopPropagation());
    panel.addEventListener('click', e => { if (!e.target.closest('button')) term.focus(); });
    document.body.append(panel);
    document.documentElement.classList.add('pa-side-open'); document.documentElement.style.setProperty('--pa-side-w', sideW() + 'px'); fireResize();
    const term = new Terminal({ cursorBlink: true, fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace', fontSize: 12.5, lineHeight: 1.15, scrollback: 10000,
      theme: { background: '#14161c', foreground: '#e6e6e6', cursor: '#e6e6e6', selectionBackground: '#3b4252' } });
    const fit = new FitAddon.FitAddon(); term.loadAddon(fit); term.open(host);
    const fitNow = () => { try { fit.fit(); } catch (e) { } };
    const postSize = () => api('/api/term/resize', { id: sid, cols: term.cols, rows: term.rows, client }).catch(() => { });
    const sendResize = () => { if (hidden || ended) return; fitNow(); const k = term.cols + 'x' + term.rows; if (k === lastSize) return; lastSize = k; postSize(); };
    const ro = new ResizeObserver(() => { clearTimeout(ro._t); ro._t = setTimeout(sendResize, 100); }); ro.observe(host);
    const lease = setInterval(() => { if (!ended && !hidden && !document.hidden) postSize(); }, 30000);
    const onVis = () => { if (!document.hidden && !ended && !hidden) postSize(); }; document.addEventListener('visibilitychange', onVis);
    const outq = []; let sending = false;
    async function pump() {
      if (sending) return; sending = true;
      while (outq.length && !ended) {
        const d = outq[0]; let ok = false;
        for (let i = 0; i < 4 && !ok && !ended; i++) {
          try { await api('/api/term/input', { id: sid, data: d }); ok = true; }
          catch (e) { if (/has ended|No such console/i.test(e.message)) { ended = true; break; } status.textContent = 'Input not delivered yet, retrying…'; await new Promise(r => setTimeout(r, 800 * (i + 1))); }
        }
        if (!ok) { if (!ended) status.textContent = 'Input failed - check the connection'; outq.length = 0; break; }
        outq.shift(); if (/^Input/.test(status.textContent)) status.textContent = 'Running';
      }
      sending = false;
    }
    const flush = () => { flushT = null; const d = pending; pending = ''; if (!d || ended) return; outq.push(d); pump(); };
    term.onData(d => { pending += d; if (!flushT) flushT = setTimeout(flush, 6); });
    const dec = b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
    const es = new EventSource(API + '/api/term/stream?id=' + encodeURIComponent(sid) + '&client=' + client);
    es.addEventListener('snapshot', e => { const d = JSON.parse(e.data); term.reset(); if (d.b64) term.write(dec(d.b64)); ended = !d.info.alive; status.textContent = ended ? 'Ended' : 'Running'; endBtn.textContent = ended ? 'Close' : 'End'; lastSize = ''; sendResize(); });
    es.addEventListener('data', e => term.write(dec(JSON.parse(e.data).b64)));
    es.addEventListener('exit', e => { const d = JSON.parse(e.data); ended = true; status.textContent = 'Ended' + (d.code ? ' (exit ' + d.code + ')' : ''); endBtn.textContent = 'Close'; term.write('\r\n\x1b[2m[session ended - Explain or Ask starts a new one]\x1b[0m\r\n'); es.close(); });
    es.onerror = () => { if (ended) return; if (es.readyState === EventSource.CLOSED) { ended = true; status.textContent = 'Console no longer available'; endBtn.textContent = 'Close'; term.write('\r\n\x1b[2m[console no longer available - the library server restarted; Explain or Ask starts a new one]\x1b[0m\r\n'); } else status.textContent = 'Reconnecting…'; };
    function hide() { hidden = true; panel.style.display = 'none'; document.documentElement.classList.remove('pa-side-open'); fireResize(); }
    function show() { if (!hidden) { term.focus(); return; } hidden = false; panel.style.display = ''; document.documentElement.classList.add('pa-side-open'); fireResize(); lastSize = ''; setTimeout(() => { sendResize(); term.focus(); }, 60); }
    function close() { es.close(); ro.disconnect(); clearInterval(lease); document.removeEventListener('visibilitychange', onVis); clearTimeout(flushT); term.dispose(); panel.remove(); document.documentElement.classList.remove('pa-side-open'); fireResize(); if (SIDE && SIDE.id === sid) SIDE = null; }
    SIDE = { id: sid, close, show, focus: () => term.focus() };
    fitNow();
  }
  function quickExplain() {
    const c = currentSel();
    if (!c) { flash('Select some text first, then press Explain.'); return; }
    sendAsk({ mode: 'explain', text: c.quote, page: c.page });
  }
  function openAsk() {
    const c = currentSel();
    closePop();
    const ta = h('textarea', { class: 'pa-ta', placeholder: c ? 'Your question about this passage · Ctrl+Enter sends' : 'Your question for the assistant · Ctrl+Enter sends', rows: 3 });
    const send = async () => { const q = ta.value.trim(); if (!q) { ta.focus(); return; } if (await sendAsk({ mode: 'ask', text: c ? c.quote : '', question: q, page: c ? c.page : 0 })) closePop(); };
    pop = h('div', { class: 'pa-pop', onmousedown: e => e.stopPropagation(), onkeydown: e => { if (e.key === 'Escape') { e.stopPropagation(); closePop(); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } } },
      c ? h('div', { class: 'pa-quote' }, '“' + (c.quote.length > 180 ? c.quote.slice(0, 180) + '…' : c.quote) + '”') : h('div', { class: 'pa-quote dim' }, 'No text selected - the question goes without a quote.'),
      ta,
      h('div', { class: 'pa-row' }, h('span', { class: 'pa-grow' }), h('button', { class: 'pa-btn', type: 'button', onclick: closePop }, 'Cancel'), h('button', { class: 'pa-btn primary', type: 'button', onclick: send }, 'Send to assistant')));
    const anchor = c && c.anchor && c.anchor.width ? c.anchor : (document.getElementById('paAskButton') || document.body).getBoundingClientRect();
    place(pop, anchor);
    setTimeout(() => ta.focus({ preventScroll: true }), 30);
  }

  document.addEventListener('mouseup', e => {
    if (pop && pop.contains(e.target)) return;
    if (e.target && e.target.closest && e.target.closest('#toolbarContainer, #secondaryToolbar, .pa-pop, .pa-side')) return; // toolbar clicks (Ask / Explain / Note) must not close the box they just opened
    setTimeout(() => {
      if (!noteMode) { if (pop && !pop.contains(e.target)) closePop(); return; }  // off: plain selection, copy as usual
      const cap = captureSelection();
      if (cap) openCreate(cap); else if (pop && !pending?.keep) { /* click elsewhere closes an edit popover */ if (!pop.contains(e.target)) closePop(); }
    }, 10);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && pop) { closePop(); return; }
    const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); e.stopPropagation(); setNoteMode(!noteMode); }
    else if (e.key === 'e' || e.key === 'E') { e.preventDefault(); e.stopPropagation(); quickExplain(); }
    else if (e.key === 'a' || e.key === 'A') { e.preventDefault(); e.stopPropagation(); openAsk(); }
  }, true);

  /* ---------- hook into the viewer */
  function hook() {
    const app = window.PDFViewerApplication;
    if (!app || !app.eventBus) { setTimeout(hook, 150); return; }
    app.eventBus.on('pagerendered', ev => { const page = ev.source && ev.source.div; if (page) paintPage(page); });
    app.eventBus.on('textlayerrendered', ev => { const page = ev.source && ev.source.div; if (page) paintPage(page); });
    app.eventBus.on('pagesloaded', () => paintAll());
    setInterval(() => { document.querySelectorAll('#viewer .page').forEach(p => { if (!p.querySelector(':scope > .pa-hl-layer') && p.dataset.loaded) paintPage(p); }); }, 1500);
    installToolbar();
    load();
    document.documentElement.classList.add('pa-ready');
  }
  hook();

  /* ---------- live events from the app.
     A browser tab gets them relayed from the app's tab over a BroadcastChannel, so a pile of forgotten PDF tabs does
     not each hold one of the browser's ~6 connections to the server. The desktop reader window (reader.py) is a
     separate process with no app tab beside it, so it asks for its own SSE with ?sse=1. */
  function onEvent(d) {
    if (d.type === 'reader') { if (d.paper === PAPER && d.page && window.PDFViewerApplication) { window.PDFViewerApplication.page = d.page; flash('Page ' + d.page); } }
    else if (d.type === 'change') { if (/^highlight\./.test(d.reason || '') || d.reason === 'ops' || d.reason === 'import') load(); }
  }
  function sse() {
    let es;
    try { es = new EventSource(API + '/api/events'); } catch (e) { return; }
    es.addEventListener('reader', e => { try { onEvent({ type: 'reader', ...JSON.parse(e.data) }); } catch (err) { } });
    es.addEventListener('change', e => { try { onEvent({ type: 'change', ...JSON.parse(e.data) }); } catch (err) { } });
    es.onerror = () => { try { es.close(); } catch (err) { } setTimeout(sse, 3000); };
  }
  if (!qs.has('nosse')) {
    if ('BroadcastChannel' in window && !qs.has('sse')) { try { new BroadcastChannel('paper-assistant').onmessage = e => { try { onEvent(e.data || {}); } catch (err) { } }; } catch (e) { sse(); } }
    else sse();
  }

  /* ---------- heartbeat: tells the server this PDF is still open in a browser.
     Only a tab opened for a browser reading session (URL carries ?sess=<token>) beats; a plain viewer tab opened
     from the paper's details never keeps a session alive by mistake. The server ends the session (recording the
     time up to the last beat) when beats stop for a couple of minutes - tab closed, laptop asleep, tunnel down.
     When the tab is back and the session is gone, a banner offers to resume it. */
  (function heartbeat() {
    if (!SESS) return;
    let token = SESS, banner = null;
    const hideBanner = () => { if (banner) { banner.remove(); banner = null; } };
    const showBanner = (state) => {
      if (banner) return;
      const btn = h('button', { class: 'pa-btn primary', type: 'button', onclick: async () => {
        btn.disabled = true;
        try {
          const r = await api('/api/reading/start', { id: PAPER, viewer: 'browser', page: (window.PDFViewerApplication || {}).page || 0 });
          const m = /[?&]sess=([0-9a-f]+)/.exec((r.reading || {}).url || '');
          if (m) token = m[1];
          hideBanner(); flash('Reading session resumed - the clock is running again', 'ok');
        } catch (e) { flash('Could not resume: ' + e.message, 'err'); btn.disabled = false; }
      } }, 'Resume reading');
      const text = state === 'other_paper' ? 'The app is now reading a different paper, so time on this one is no longer being recorded.'
        : 'This reading session has ended (ended in the app, or this computer was offline for a few minutes). Time up to then was recorded.';
      banner = h('div', { class: 'pa-banner' }, h('span', {}, text), btn, h('button', { class: 'pa-btn', type: 'button', onclick: hideBanner }, 'Dismiss'));
      document.body.append(banner);
    };
    const beat = async () => {
      try {
        const r = await api('/api/reading/ping', { id: PAPER, sess: token });
        if (r.active) hideBanner();
        else if (r.state !== 'window') showBanner(r.state); // 'window': the same paper is open in a reader window on the library computer; nothing to do here
      } catch (e) { /* offline: the server will end the session after a few minutes and the next beat shows the banner */ }
    };
    beat();
    setInterval(beat, 20000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) beat(); });
  })();
})();
