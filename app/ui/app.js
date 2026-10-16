/* Paper Assistant — app.js (vanilla, no build). Pages: today · library · map · plan · explore (survey + trail) · assistant · expert · daily gap · stats · settings */
'use strict';

/* ============================================================ utils */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const SVG_NS = 'http://www.w3.org/2000/svg';
const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'readOnly', 'indeterminate', 'open', 'textContent', 'draggable']);

function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
  return el;
}
function h(tag, attrs, ...kids) {
  const m = /^([a-z0-9-]*)(#[\w-]+)?((?:\.[\w-]+)*)$/i.exec(tag) || [];
  const el = document.createElement(m[1] || 'div');
  if (m[2]) el.id = m[2].slice(1);
  if (m[3]) el.className = m[3].split('.').filter(Boolean).join(' ');
  if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = (el.className ? el.className + ' ' : '') + v;
      else if (k === 'style') typeof v === 'object' ? Object.assign(el.style, v) : (el.style.cssText = v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (PROPS.has(k)) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  } else kids.unshift(attrs);
  return append(el, kids);
}
function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v);
  }
  return append(el, kids);
}
const icon = (name, cls) => {
  const p = ICONS[name] || '';
  const el = s('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: cls || '' });
  el.innerHTML = p;
  return el;
};
const ICONS = {
  today: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M8 14h3"/>',
  library: '<path d="M4 4h4v16H4zM10 4h4v16h-4zM16.5 4.5l3.5 1-3.6 14-3.5-1z"/>',
  plan: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M9 15l2 2 4-4"/>',
  explore: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v3l2 1"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  map: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="8" cy="18" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M8.2 7.2l7.3 .4M7 15.6l-.2-7.1M10.5 17.6l4-.3M16.5 10.5l.3 4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>', pause: '<path d="M8 5v14M16 5v14"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  cal: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>', pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
  note: '<path d="M4 4h12l4 4v12H4z"/><path d="M8 12h8M8 16h5"/>', queue: '<path d="M4 6h16M4 12h10M4 18h16M18 10v6l3-3z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', sound: '<path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6"/>', refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>',
  up: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.3a2 2 0 0 0 2-1.7l1.4-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
  down: '<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.7a2 2 0 0 0-2 1.7l-1.4 9a2 2 0 0 0 2 2.3zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  grip: '<path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01"/>', chev: '<path d="m9 6 6 6-6 6"/>', back: '<path d="m15 6-6 6 6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>', expert: '<path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12.2V17c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.8"/><path d="M22 10v6"/>',
  flame: '<path d="M12 22c4.4 0 7-2.8 7-6.7 0-3.3-2.2-5.4-3.5-6.9-.3 1.8-1.2 3-2.5 3.6.3-3.4-1.1-7.2-4-9-.1 3.2-1.9 4.7-3.3 6.3C4.4 10.9 5 12.8 5 15.3 5 19.2 7.6 22 12 22z"/>',
  spark: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>', bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>', book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>', upload: '<path d="M12 15V3M7 8l5-5 5 5M4 21h16"/>', help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
  owl: '<circle cx="9" cy="10" r="2"/><circle cx="15" cy="10" r="2"/><path d="M12 2c5 0 8 4 8 9v4a8 8 0 0 1-16 0v-4c0-5 3-9 8-9zM12 13l-1.5 2h3z"/>', more: '<path d="M5 12h.01M12 12h.01M19 12h.01"/>',
  sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8zM5 3l.6 1.6L7 5l-1.4.6L5 7l-.6-1.4L3 5l1.4-.4z"/>',
};

const pad2 = n => String(n).padStart(2, '0');
const localISO = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayStr = () => localISO(new Date());
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return localISO(d); };
const dayDiff = (a, b) => Math.round((new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00')) / 86400000);
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isoWeekday = iso => { const d = new Date(iso + 'T00:00:00').getDay(); return d === 0 ? 7 : d; };
const mondayOf = iso => addDays(iso, -(isoWeekday(iso) - 1));
const fmtMD = iso => iso ? `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}` : '';
const fmtDateZh = iso => iso ? `${MONTHS[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}` : '';
const fmtTime = iso => iso && iso.length >= 16 ? iso.slice(11, 16) : '';
const nowISO = () => { const d = new Date(); return `${localISO(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };
function relDate(iso) {
  if (!iso) return '';
  const t = todayStr(), d = iso.slice(0, 10), n = dayDiff(d, t);
  if (n === 0) return 'Today'; if (n === 1) return 'Tomorrow'; if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return WD[new Date(d + 'T00:00:00').getDay()];
  if (n < 0) return `${-n} days ago`;
  return fmtMD(d);
}
function relWhen(iso) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now(), m = Math.round(ms / 60000);
  if (Math.abs(m) < 1) return 'now';
  if (m < 0) { const a = -m; return a < 60 ? `${a} min ago` : a < 1440 ? `${Math.round(a / 60)} h ago` : `${Math.round(a / 1440)} days ago`; }
  return m < 60 ? `in ${m} min` : m < 1440 ? `in ${Math.round(m / 60)} h` : `in ${Math.round(m / 1440)} days`;
}
const fmtWhen = iso => iso ? `${relDate(iso)} ${fmtTime(iso)}`.trim() : '';
const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const uniq = arr => Array.from(new Set(arr));
const authorsShort = (a, n = 3) => !a || !a.length ? '' : a.length <= n ? a.join(', ') : `${a.slice(0, n).join(', ')} et al.`;
const cssVar = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const greetingWord = (hh = new Date().getHours()) => hh < 5 ? 'Late night' : hh < 11 ? 'Good morning' : hh < 14 ? 'Good afternoon' : hh < 18 ? 'Good afternoon' : 'Good evening';
const isLate = () => new Date().getHours() >= 23;

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem(k); } catch { } },
};

/* Remote mode: this browser runs on another computer and reaches the library through an SSH tunnel.
   PDFs, links and the reader then open in this browser, and nothing is launched on the library machine.
   Turned on by ?remote=1 (the remote launcher) or in Settings; remembered per browser. */
let REMOTE = (() => {
  const u = new URL(location.href), q = u.searchParams.get('remote');
  if (q === '1') store.set('remote', true); else if (q === '0') store.set('remote', false);
  if (q !== null) { u.searchParams.delete('remote'); try { history.replaceState(null, '', u.pathname + u.search + u.hash); } catch { } } // one-shot: a later reload of this tab must not re-pin an old value
  return store.get('remote', null) === true;
})();
function setRemote(on) { REMOTE = !!on; store.set('remote', REMOTE); }
const IN_DESKTOP = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.py); // the desktop window on the library computer itself
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pdfViewerUrl = (p, page) => `/app/ui/vendor/pdfjs/web/viewer.html?file=${encodeURIComponent('/' + String(p.pdf || '').replace(/^\/+/, ''))}&paper=${encodeURIComponent(p.id)}${page ? `#page=${page}` : ''}`;

/* ============================================================ API */
const withTimeout = (ms = 20000) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
const api = {
  async get(path, timeoutMs = 20000) {
    const r = await fetch(path, { cache: 'no-store', signal: withTimeout(timeoutMs) });
    const j = await r.json().catch(() => ({ ok: false, error: 'Bad response from server' }));
    if (!r.ok && j.ok !== true) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  },
  async post(path, body, timeoutMs = 60000) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), signal: withTimeout(timeoutMs) });
    const j = await r.json().catch(() => ({ ok: false, error: 'Bad response from server' }));
    if (!j.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  },
};

/* ============================================================ state */
const PAGES = [
  ['today', 'Today', 'today'], ['library', 'Library', 'library'], ['map', 'Map', 'map'], ['plan', 'Plan', 'plan'],
  ['explore', 'Explore', 'explore'], ['assistant', 'Assistant', 'terminal'], ['expert', 'Expert', 'expert'], ['gaps', 'Daily gap', 'bulb'], ['stats', 'Stats', 'stats'], ['settings', 'Settings', 'settings'],
];
const serverAtLeast = v => { const a = String((S.health || {}).version || '0').split('.').map(Number), b = v.split('.').map(Number); for (let i = 0; i < b.length; i++) { if ((a[i] || 0) > b[i]) return true; if ((a[i] || 0) < b[i]) return false; } return true; };
const STATUS_ZH = { unread: 'Unread', queued: 'Queued', reading: 'Reading', read: 'Read', deep: 'Deep read', skipped: 'Skipped' };
const TIER_ZH = { 1: 'Core', 2: 'Advanced', 3: 'Extended' };
const TIER_DESC = { 1: 'Must read - foundational for the topic', 2: 'Read after the core papers', 3: 'Extended reading - a citation to follow up, reference or frontier work' };
const extendedFrom = p => (p && p.source && p.source.startsWith('extended:')) ? paperById(p.source.slice(9)) : null;
const extendedOf = id => S.L ? S.L.papers.filter(q => q.id !== id && ((q.source || '') === `extended:${id}` || (q.related || []).includes(id))) : [];
const DONE = new Set(['read', 'deep']);

const S = {
  L: null, D: null, B: null, R: null, rev: 0, page: 'today', loaded: false,
  drawerId: null, focusIdx: -1, pendingRender: false,
  lib: { topic: store.get('libTopic', 'all'), q: '', tier: '', status: '', sub: '', phase: '', sort: 'order', view: store.get('libView', 'list') },
  plan: { mode: 'week', offset: 0 },
  radar: { topic: null, data: null, loading: false, error: false, hidden: store.get('radarHidden', {}) },
  assistantLog: [], health: null, celebrateMode: store.get('celebrate', 'always'),
  mascotClicks: 0, lastRadarKey: '', goalToasted: store.get('goalToasted', ''),
};
const settings = () => (S.L && S.L.settings) || {};
const persona = () => settings().persona_name || 'Yan';
const gapVenue = () => (settings().gap_venue || '').trim() || 'NeurIPS';   // Settings → Daily gap → Target venue
const enUI = () => settings().assistant_language === 'en';   // the few strings that are written in the assistant's language rather than the UI's
/* The per-paper note under each title (`interest`): Traditional Chinese by default, English when the assistant language is English. */
const noteL = () => settings().assistant_language === 'en'
  ? { label: 'Note', pending: 'Note pending…', ph: 'Why this paper: the point you were curious about, and what it concludes or does on that point… (leave empty to infer it)', ph2: 'Why read this? What are you curious about? (leave empty to infer it)', toast: 'Inferring the note again; it updates when done.', redo: 'Infer again' }
  : { label: '註記', pending: '註記整理中…', ph: '為什麼找這篇：當初好奇的點，以及它在這點上的結論或操作…（留空會自動推論）', ph2: '為什麼想讀這篇？你好奇的點是什麼（留空會自動推論）', toast: '正在重新推論註記，完成後會自動更新。', redo: '重新推論' };
/* gamification (XP, levels, badges, owl, confetti, radar) is opt-in; reading logs/sessions/heatmap are always kept */
const playful = () => settings().gamification === true;
const HL_COLORS = ['yellow', 'green', 'blue', 'pink'];
const paperHighlights = id => (S.L && S.L.highlights || []).filter(x => x.paper === id).sort((a, b) => (a.page || 0) - (b.page || 0) || (a.created || '').localeCompare(b.created || ''));
const paperDiscussions = id => (S.L && S.L.discussions || []).filter(x => x.paper === id).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created || '').localeCompare(a.created || ''));
const paperById = id => S.L ? S.L.papers.find(p => p.id === id) : null;
const topicById = id => S.L ? S.L.topics.find(t => t.id === id) : null;
const topicEmoji = id => (topicById(id) || {}).emoji || '📚';
const paperTopics = p => (p.topics && p.topics.length ? p.topics : (p.topic ? [p.topic] : []));
const inTopic = (p, tid) => paperTopics(p).includes(tid);

/* ============================================================ theme / prefs */
function applyTheme(t, { persist = true } = {}) {
  const root = document.documentElement;
  if (window.__forceTheme) t = window.__forceTheme;
  if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
  if (persist && !window.__forceTheme) store.set('theme', t);
  $$('[data-theme-toggle]').forEach(b => { b.replaceChildren(icon(currentDark() ? 'sun' : 'moon')); b.title = currentDark() ? 'Switch to light' : 'Switch to dark'; });
}
const currentDark = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
function toggleTheme() {
  const next = currentDark() ? 'light' : 'dark';
  applyTheme(next);
  if (S.L) op({ op: 'settings.update', fields: { theme: next } }, { silent: true, noReload: true });
}
function applyAccent(a) { document.documentElement.dataset.accent = a || 'violet'; store.set('accent', a || 'violet'); }
function applyMotion() {
  const reduce = settings().reduced_motion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) document.documentElement.dataset.motion = 'reduce'; else delete document.documentElement.dataset.motion;
  store.set('motion', settings().reduced_motion ? 'reduce' : 'no');
}
const reducedMotion = () => document.documentElement.dataset.motion === 'reduce';
function applyDensity(d) { if (d === 'compact') document.documentElement.dataset.density = 'compact'; else delete document.documentElement.dataset.density; store.set('density', d); }

/* ============================================================ sounds */
let AC = null;
function ensureAudio() { try { if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; AC ??= new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch { } }
function blip(f0 = 520, f1 = 220, dur = .06, vol = .18) {
  if (!settings().sounds || !AC) return;
  try {
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * .7);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur);
  } catch { }
}
const chord = () => { blip(660, 880, .12, .16); setTimeout(() => blip(880, 1320, .16, .16), 90); };
document.addEventListener('pointerdown', ensureAudio, { passive: true });
document.addEventListener('keydown', ensureAudio);

/* ============================================================ toasts */
function toast(o) {
  if (typeof o === 'string') o = { text: o };
  const box = $('#toasts');
  while (box.children.length >= 3) box.firstChild.remove();
  const t = h('div.toast', { class: o.kind || '', role: 'status' },
    h('span.ic', icon(o.icon || (o.kind === 'ok' ? 'check' : o.kind === 'danger' ? 'x' : o.kind === 'warn' ? 'bell' : 'sparkles'))),
    h('div.tx', o.title ? h('b', o.title) : null, o.text ? h('span', o.text) : null),
    o.action ? h('button.act', { onclick: () => { o.action.fn(); dismiss(); } }, o.action.label) : null,
    h('button.icon-btn.sm.x', { 'aria-label': 'Close', onclick: () => dismiss() }, icon('x')));
  box.appendChild(t);
  let timer = setTimeout(dismiss, o.timeout || (o.action ? 10000 : 5000));
  function dismiss() { clearTimeout(timer); if (!t.isConnected) return; t.classList.add('out'); setTimeout(() => t.remove(), reducedMotion() ? 0 : 200); }
  t.addEventListener('mouseenter', () => clearTimeout(timer));
  t.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 2500); });
  return dismiss;
}
const errToast = e => toast({ kind: 'danger', title: 'Action failed', text: String(e && e.message || e), timeout: 8000 });

/* ============================================================ confetti / xp */
function celebrateConfetti(big = false) {
  if (!playful() || typeof confetti !== 'function' || reducedMotion() || S.celebrateMode === 'off') return;
  if (S.celebrateMode === 'sometimes' && !big && Math.random() > .35) return;
  const base = { disableForReducedMotion: true, colors: [cssVar('--accent'), cssVar('--streak'), '#ffffff'], zIndex: 200 };
  if (!big) return confetti({ ...base, particleCount: 40, spread: 60, origin: { y: .8 }, scalar: .8 });
  confetti({ ...base, particleCount: 120, spread: 100, origin: { y: .7 } });
  setTimeout(() => confetti({ ...base, particleCount: 60, angle: 60, spread: 55, origin: { x: 0 } }), 150);
  setTimeout(() => confetti({ ...base, particleCount: 60, angle: 120, spread: 55, origin: { x: 1 } }), 150);
}
function tinyConfetti(el) {
  if (!playful() || typeof confetti !== 'function' || reducedMotion()) return;
  const r = el ? el.getBoundingClientRect() : { left: 60, top: innerHeight - 60, width: 0, height: 0 };
  confetti({ disableForReducedMotion: true, particleCount: 18, spread: 50, startVelocity: 18, scalar: .7, ticks: 90, zIndex: 200, origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }, colors: [cssVar('--accent'), cssVar('--streak'), '#ffffff'] });
}
function floatXP(el, xpv) {
  if (!xpv || !playful()) return;
  const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
  const x = r ? r.left + r.width / 2 : innerWidth - 120, y = r ? r.top : innerHeight - 100;
  const f = h('div.xpfloat', { style: { left: x + 'px', top: y + 'px' } }, `+${xpv} XP`);
  document.body.appendChild(f); setTimeout(() => f.remove(), 1200);
}

/* ============================================================ dialogs */
function openDialog({ title, body, actions = [], cls = '', onClose, closable = true } = {}) {
  const dlg = h('dialog', { class: cls, 'aria-label': title || 'Dialog' });
  const foot = actions.length ? h('div.dfoot', actions.map(a => a.left ? h('span.left', a.el) : a.el)) : null;
  const inner = h('div.dlg', title ? h('div.row.between', h('h2', title), closable ? h('button.icon-btn.sm', { 'aria-label': 'Close', onclick: () => close() }, icon('x')) : null) : null, body, foot);
  dlg.appendChild(inner);
  document.body.appendChild(dlg);
  dlg.addEventListener('click', e => { if (e.target === dlg && closable) close(); });
  dlg.addEventListener('cancel', e => { if (!closable) e.preventDefault(); else { e.preventDefault(); close(); } });
  function close(v) { if (!dlg.isConnected) return; dlg.close(); dlg.remove(); onClose && onClose(v); }
  dlg.closeDlg = close;
  dlg.showModal();
  return dlg;
}
function confirmDialog(text, { ok = 'OK', danger = false, title = 'Confirm' } = {}) {
  return new Promise(res => {
    let v = false;
    const dlg = openDialog({
      title, cls: 'sm', body: h('p', { class: 'muted', style: 'line-height:1.7' }, text), onClose: () => res(v),
      actions: [{ el: h('button.btn', { onclick: () => dlg.closeDlg() }, 'Cancel') }, { el: h('button.btn', { class: danger ? 'btn-danger' : 'btn-primary', onclick: () => { v = true; dlg.closeDlg(); } }, ok) }],
    });
  });
}

/* ============================================================ popover */
let POP = null;
function closePop() { if (POP) { POP.remove(); POP = null; document.removeEventListener('pointerdown', popOutside, true); document.removeEventListener('keydown', popKey, true); } }
function popOutside(e) { if (POP && !POP.contains(e.target)) closePop(); }
function popKey(e) { if (e.key === 'Escape') { closePop(); e.stopPropagation(); } }
function popover(anchor, content) {
  closePop();
  POP = h('div.pop', { role: 'dialog' }, content);
  document.body.appendChild(POP);
  const r = anchor.getBoundingClientRect(), pw = POP.offsetWidth, ph = POP.offsetHeight;
  let x = Math.min(r.left, innerWidth - pw - 8), y = r.bottom + 6;
  if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 6);
  POP.style.left = Math.max(8, x) + 'px'; POP.style.top = y + 'px';
  setTimeout(() => { document.addEventListener('pointerdown', popOutside, true); document.addEventListener('keydown', popKey, true); }, 0);
  const first = POP.querySelector('button,input'); first && first.focus({ preventScroll: true });
  return POP;
}
function datePopover(anchor, current, onPick) {
  const t = todayStr(), wd = isoWeekday(t);
  const sat = addDays(t, wd === 6 ? 0 : wd === 7 ? 6 : 6 - wd), nextMon = addDays(t, 8 - wd);
  const opt = (label, v, sub) => h('button.btn', { onclick: () => { closePop(); onPick(v); } }, label, sub ? h('span.faint.xs', { style: 'margin-left:auto' }, sub) : null);
  const inp = h('input.input', { type: 'date', value: current || '', onchange: e => { if (e.target.value) { closePop(); onPick(e.target.value); } } });
  popover(anchor, [opt('Today', t, fmtMD(t)), opt('Tomorrow', addDays(t, 1), fmtMD(addDays(t, 1))), opt('This weekend', sat, fmtMD(sat)), opt('Next Monday', nextMon, fmtMD(nextMon)), h('div.sep'), inp, current ? [h('div.sep'), opt('Unschedule (clear date)', '')] : null]);
}

/* ============================================================ data flow */
let offlineTimer = null;
function setOffline(on) { $('#offline').classList.toggle('show', !!on); }
async function loadLibrary() {
  const L = await api.get('/api/library', 45000);
  S.L = L; S.D = L.derived; S.rev = (L.meta || {}).rev || 0; S.R = L.reading || null;
  if (L.now) S.clockSkew = Date.now() / 1000 - L.now;
  if (!S.loaded) {
    S.loaded = true;
    const th = settings().theme || store.get('theme', 'auto');
    applyTheme(store.get('theme', th), { persist: false });
    applyAccent(settings().accent || 'violet');
    applyMotion();
  }
  setOffline(false);
  return L;
}
async function loadBriefing() { try { S.B = await api.get('/api/briefing'); } catch (e) { S.B = S.B || null; } return S.B; }
let reloadRetry = null;
async function reload({ briefing = S.page === 'today' } = {}) {
  try {
    await loadLibrary();
    if (briefing) await loadBriefing();
  } catch (e) { setOffline(true); if (!reloadRetry) reloadRetry = setTimeout(() => { reloadRetry = null; reload({ briefing }); }, 6000); return; } // slow link: try again rather than staying "offline" while the SSE is fine
  if (reloadRetry) { clearTimeout(reloadRetry); reloadRetry = null; }
  try { render(); } catch (e) { console.error('render failed', e); }
}

/* a mouse button is down: rebuilding the page now would swallow the click (mousedown and mouseup would land on different
   elements), so renders wait until it is released. Reset on pointerup, before the click event fires. */
let PTR_DOWN = false;
addEventListener('pointerdown', () => { PTR_DOWN = true; }, true);
addEventListener('pointerup', () => { PTR_DOWN = false; }, true);
addEventListener('pointercancel', () => { PTR_DOWN = false; }, true);
addEventListener('blur', () => { PTR_DOWN = false; });
function typingInProgress() {
  if (PTR_DOWN) return true;
  const a = document.activeElement;
  return a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button', 'color', 'date', 'time', 'datetime-local'].includes(a.type))) && !a.closest('dialog') && !a.closest('#palette') && a.dataset.autosave;
}

/* celebrate op events: {type, xp} */
function celebrate(result, prevD, el) {
  const events = (result && result.events) || [];
  let delay = 0;
  for (const ev of events) {
    setTimeout(() => floatXP(el, ev.xp), delay); delay += 160;
    if (ev.type === 'finish' || ev.type === 'deep') {
      blip();
      const n = (S.D.finished_today || []).length, goalP = settings().weekly_goal_papers || 3;
      toast({ kind: 'ok', title: ev.type === 'deep' ? 'Deep read done!' : 'Finished!', text: `${n} today · weekly goal ${goalP}` });
      const total = S.L.papers.filter(p => DONE.has(p.status)).length;
      celebrateConfetti(total % 5 === 0);
    } else if (ev.type === 'highlight') {
      blip(520, 700, .05, .1);
    } else if (ev.type === 'goal') {
      chord(); toast({ kind: 'ok', title: 'Daily goal reached', text: 'The ring is closed. Nicely done.' }); celebrateConfetti(false);
    } else if (ev.type === 'session') {
      blip(440, 660, .08);
    } else if (ev.type === 'survey') {
      chord();
    }
  }
  if (prevD && S.D && playful()) {
    const before = (prevD.badges || []).map(b => b.id), after = (S.D.badges || []);
    const fresh = after.filter(b => !before.includes(b.id));
    if (fresh.length) setTimeout(() => badgeSheet(fresh[0]), 400);
    if (S.D.level > prevD.level) setTimeout(() => { chord(); toast({ kind: 'ok', title: `Level ${S.D.level}!`, text: `${S.D.xp} XP so far. Keep it up.` }); }, 300);
  }
}
const BADGE_EMOJI = { 'first-finish': '📖', 'streak-7': '🔥', 'streak-30': '🏆', 'papers-10': '📚', 'papers-25': '🎓', 'deep-5': '🔬', 'idea-20': '💡', 'topic-done': '👑', 'night-owl': '🦉', 'early-bird': '🐦', 'survey-first': '🧭' };
function badgeSheet(b) {
  if (!playful()) return;
  chord(); celebrateConfetti(true);
  const dlg = openDialog({ cls: 'sm', body: h('div.badgesheet', h('div.big', BADGE_EMOJI[b.id] || '🏅'), h('h2', `Badge earned: ${b.name}`), h('p.muted', b.desc || ''), b.date ? h('p.faint.xs', b.date) : null), actions: [{ el: h('button.btn.btn-primary', { onclick: () => dlg.closeDlg() }, 'Nice') }] });
}

/* generic mutation */
async function op(o, { el, silent = false, noReload = false, briefing } = {}) {
  const prevD = S.D;
  try {
    const r = await api.post('/api/op', o);
    S.rev = r.rev; S.D = Object.assign({}, S.D, r.derived);
    if (!noReload) await reload({ briefing: briefing ?? (S.page === 'today') });
    if (!silent) celebrate(r.result, prevD, el);
    return r;
  } catch (e) { errToast(e); if (!noReload) reload(); throw e; }
}
async function ops(list) {
  const prevD = S.D;
  const r = await api.post('/api/ops', { ops: list });
  S.rev = r.rev; S.D = Object.assign({}, S.D, r.derived);
  await reload();
  for (const res of r.results || []) celebrate(res, null, null);
  celebrate({}, prevD, null);
  return r;
}

/* ---- common paper actions */
async function setStatus(p, status, el) {
  const prev = p.status;
  await op({ op: 'paper.status', id: p.id, status }, { el });
  if (DONE.has(status) && !DONE.has(prev)) {
    toast({ kind: 'ok', text: `“${p.short || p.title}” marked as ${STATUS_ZH[status].toLowerCase()}`, action: { label: 'Undo', fn: () => op({ op: 'paper.status', id: p.id, status: prev || 'unread' }, { silent: true }) } });
    const cur = paperById(p.id);
    if (cur && !(cur.claims || []).length) setTimeout(() => claimsPrompt(cur), 500);
  } else if (!silentStatus.has(status)) {
    toast({ text: `“${p.short || p.title}” → ${STATUS_ZH[status]}`, action: { label: 'Undo', fn: () => op({ op: 'paper.status', id: p.id, status: prev || 'unread' }, { silent: true }) } });
  }
}
const silentStatus = new Set();
function claimsPrompt(p) {
  const inputs = [0, 1, 2].map(i => h('input.input', { placeholder: i === 0 ? 'e.g. Fisher information measures parameter importance' : i === 1 ? 'Second point (optional)' : 'Third point (optional)' }));
  const dlg = openDialog({
    title: 'Jot down 1–3 claims to remember?', cls: 'sm',
    body: h('div.col', { style: 'gap:8px' }, h('p.muted.small', `“${p.short || p.title}” is done. ${persona()} will bring these back later for recall.`), inputs),
    actions: [{ el: h('button.btn', { onclick: () => dlg.closeDlg() }, 'Skip') }, { el: h('button.btn.btn-primary', { onclick: async () => { const claims = inputs.map(i => i.value.trim()).filter(Boolean); dlg.closeDlg(); if (claims.length) { await op({ op: 'paper.update', id: p.id, fields: { claims } }, { silent: true }); toast({ kind: 'ok', text: 'Claims saved.' }); } } }, 'Save') }],
  });
  setTimeout(() => inputs[0].focus(), 50);
}
async function setPlanned(p, date, el) {
  await op({ op: 'paper.update', id: p.id, fields: { planned: date || '' } }, { el, silent: true });
  toast({ kind: 'ok', text: date ? `“${p.short || p.title}” scheduled for ${relDate(date)} (${fmtMD(date)})` : `“${p.short || p.title}” unscheduled` });
}
async function addToQueue(p, el) {
  if ((S.L.queue || []).includes(p.id)) { toast({ text: 'Already in the queue.' }); return; }
  await op({ op: 'queue.add', id: p.id }, { el, silent: true });
  toast({ kind: 'ok', text: `“${p.short || p.title}” added to queue`, action: { label: 'Undo', fn: () => op({ op: 'queue.remove', id: p.id }, { silent: true }) } });
}
async function openPDF(p) {
  if (p.pdf) { if (REMOTE) { window.open(pdfViewerUrl(p), '_blank'); return; } try { await api.post('/api/open', { path: p.pdf }); } catch (e) { errToast(e); } }
  else if (p.arxiv) {
    const ok = await confirmDialog('The PDF hasn’t been downloaded yet. Download it now?', { ok: 'Download' });
    if (ok) { try { await api.post('/api/download', { id: p.id }); toast({ text: 'Downloading the PDF; this will update when it’s done.' }); } catch (e) { errToast(e); } }
  } else attachPdfDialog(p);
}
function openExternal(url) { if (!url) return; if (REMOTE) { window.open(url, '_blank', 'noopener'); return; } api.post('/api/open', { url }).catch(() => window.open(url, '_blank')); }

/* ============================================================ SSE */
let ES = null, esBackoff = 1000, helloSeen = false;
const BC = 'BroadcastChannel' in window ? new BroadcastChannel('paper-assistant') : null; // PDF tabs listen here instead of each holding an SSE connection (browsers allow ~6 per host)
function connectSSE() {
  if (ES) { try { ES.close(); } catch { } }
  ES = new EventSource('/api/events');
  ES.addEventListener('hello', e => {
    esBackoff = 1000; setOffline(false);
    let d = {}; try { d = JSON.parse(e.data); } catch { }
    if (d.now) S.clockSkew = Date.now() / 1000 - d.now;
    if (!S.health && d.version) S.health = { version: d.version, started: d.started };   // the one-shot /api/health fetch may have failed over a slow tunnel
    if (S.health && ((d.version && d.version !== S.health.version) || (d.started && S.health.started && d.started !== S.health.started))) { location.reload(); return; } // server updated or restarted: load the matching UI
    if (helloSeen) { if (typingInProgress()) deferRender(); else reload(); } // reconnected after a gap (laptop sleep, tunnel drop): sessions may have ended meanwhile
    helloSeen = true;
    if (d.via_ssh && !IN_DESKTOP && store.get('remote', null) === null) { setRemote(true); toast({ kind: 'ok', title: 'Remote mode on', text: 'This connection comes through an SSH tunnel, so PDFs and links will open in this browser. Change it in Settings → Reading sessions.', timeout: 9000 }); render(); }
  });
  ES.addEventListener('change', e => {
    let d = {}; try { d = JSON.parse(e.data); } catch { }
    if (BC) BC.postMessage({ type: 'change', ...d });
    if (!d.rev || d.rev > S.rev) {
      if (typingInProgress()) { deferRender(); return; }
      reload();
    }
  });
  ES.addEventListener('reader', e => { let d = {}; try { d = JSON.parse(e.data); } catch { } if (BC) BC.postMessage({ type: 'reader', ...d }); });
  ES.addEventListener('assistant', e => {
    let d = {}; try { d = JSON.parse(e.data); } catch { }
    S.assistantLog.unshift({ at: nowISO(), ...d }); S.assistantLog = S.assistantLog.slice(0, 20);
    const act = d.paper ? { label: 'Open paper', fn: () => { go('library'); openDrawer(d.paper); } } : d.kind === 'survey' ? { label: 'Take a look', fn: () => go('explore') } : d.kind === 'gap' ? { label: 'Read it', fn: () => { S.gapSel = d.gap; go('gaps'); render(); } } : null;
    toast({ kind: d.kind === 'error' ? 'danger' : 'default', icon: d.kind === 'reminder' ? 'bell' : d.kind === 'survey' ? 'inbox' : d.kind === 'digest' ? 'note' : d.kind === 'gap' ? 'bulb' : playful() ? 'owl' : 'sparkles', title: d.title || persona(), text: d.text || '', action: act, timeout: 10000 });
    if (d.kind === 'reminder' || d.kind === 'survey') blip(660, 880, .1);
  });
  ES.addEventListener('reading', e => { let d = {}; try { d = JSON.parse(e.data); } catch { } onReadingEvent(d); });
  ES.addEventListener('term', () => refreshTerms());
  ES.addEventListener('gap', e => { let d = {}; try { d = JSON.parse(e.data); } catch { } onGapEvent(d); });
  ES.addEventListener('gapchat', e => { let d = {}; try { d = JSON.parse(e.data); } catch { } onGapChatEvent(d); });
  ES.addEventListener('trail', e => { let d = {}; try { d = JSON.parse(e.data); } catch { } onTrailEvent(d); });
  refreshTerms();
  ES.onerror = () => { setOffline(true); try { ES.close(); } catch { } setTimeout(connectSSE, esBackoff); esBackoff = Math.min(esBackoff * 2, 30000); };
}
let pendingTimer = null;
function deferRender() { S.pendingRender = true; if (pendingTimer) return; pendingTimer = setInterval(() => { if (!typingInProgress()) { clearInterval(pendingTimer); pendingTimer = null; if (S.pendingRender) { S.pendingRender = false; reload(); } } }, 800); }
document.addEventListener('focusout', () => { setTimeout(() => { if (S.pendingRender && !typingInProgress()) { S.pendingRender = false; reload(); } }, 50); });   // checked after the focus move: a press on a button keeps PTR_DOWN set until its click

/* ============================================================ components */
function ring(pct, { size = 120, center, done = false } = {}) {
  const p = clamp(pct, 0, 100);
  const el = h('div.ring', { class: done ? 'done' : '', style: `width:${size}px;height:${size}px` },
    s('svg', { viewBox: '0 0 100 100' }, s('circle', { class: 'track', cx: 50, cy: 50, r: 44, pathLength: 100 }), s('circle', { class: 'bar', cx: 50, cy: 50, r: 44, pathLength: 100, 'stroke-dasharray': `${p} 100` })),
    h('div.center', center));
  requestAnimationFrame(() => { const b = el.querySelector('.bar'); if (b) b.setAttribute('stroke-dasharray', `${p} 100`); });
  return el;
}
function sparkline(vals, { w = 140, hgt = 32 } = {}) {
  const max = Math.max(1, ...vals), n = vals.length, pts = vals.map((v, i) => [n === 1 ? w / 2 : (i / (n - 1)) * (w - 6) + 3, hgt - 3 - (v / max) * (hgt - 8)]);
  const line = pts.map(p => p.join(',')).join(' ');
  const area = `${pts[0][0]},${hgt} ${line} ${pts[pts.length - 1][0]},${hgt}`;
  const last = pts[pts.length - 1];
  return s('svg', { class: 'spark', viewBox: `0 0 ${w} ${hgt}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': `Last 7 days: ${vals.join(', ')} min` }, s('polygon', { class: 'area', points: area }), s('polyline', { points: line }), s('circle', { class: 'pt', cx: last[0], cy: last[1], r: 2.5 }));
}
function activityByDate() {
  const m = {};
  for (const a of (S.L.activity || [])) { const d = a.date; if (!d) continue; const o = m[d] ||= { xp: 0, min: 0, n: 0, fin: 0 }; o.xp += a.xp || 0; o.min += a.minutes || 0; o.n++; if (a.type === 'finish' || a.type === 'deep') o.fin++; }
  return m;
}
function heatmap({ weeks = 53 } = {}) {
  const byDate = activityByDate(), t = todayStr();
  const cell = 10, gap = 2.6, top = 10, left = 0;
  const end = new Date(t + 'T00:00:00'), endDow = end.getDay();
  const start = new Date(end); start.setDate(end.getDate() - (weeks - 1) * 7 - endDow);
  const W = left + weeks * (cell + gap), H = top + 7 * (cell + gap);
  const svg = s('svg', { class: 'heat', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Reading activity over the past year' });
  let lastMonth = -1;
  for (let i = 0, d = new Date(start); d <= end; d.setDate(d.getDate() + 1), i++) {
    const k = localISO(d), o = byDate[k], score = o ? o.xp + o.min : 0;
    const lvl = !o ? 0 : score < 15 ? 1 : score < 40 ? 2 : score < 90 ? 3 : 4;
    const col = Math.floor(i / 7), row = d.getDay();
    const x = left + col * (cell + gap), y = top + row * (cell + gap);
    if (row === 0 || i === 0) { const mo = d.getMonth(); if (mo !== lastMonth && (weeks - col) > 2) { svg.appendChild(s('text', { x, y: 7 }, MONTHS[mo])); lastMonth = mo; } }
    const r = s('rect', { x, y, width: cell, height: cell, 'data-l': lvl, class: k === t ? 'today' : '' });
    r.appendChild(s('title', {}, `${k}${o ? ` · ${o.min ? fmtMin(o.min) : ''}${o.fin ? ` · ${o.fin} finished` : ''}${!o.min && !o.fin ? `${o.n} activities` : ''}` : ' · no activity'}`));
    svg.appendChild(r);
  }
  return h('div', svg, h('div.heatlegend', 'Less', [0, 1, 2, 3, 4].map(l => h('i', { 'data-l': l })), 'More'));
}
function barsChart(vals, labels, { goal } = {}) {
  const W = 480, H = 120, padB = 16, max = Math.max(1, goal || 0, ...vals), bw = W / vals.length;
  const svg = s('svg', { class: 'bars', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Weekly focus minutes' });
  if (goal) { const gy = H - padB - (goal / max) * (H - padB - 10); svg.appendChild(s('line', { x1: 0, x2: W, y1: gy, y2: gy })); }
  vals.forEach((v, i) => {
    const bh = Math.max(v > 0 ? 2 : 0, (v / max) * (H - padB - 10));
    svg.appendChild(s('rect', { x: i * bw + bw * .2, y: H - padB - bh, width: bw * .6, height: bh, class: i === vals.length - 1 ? 'cur' : 'past' }, s('title', {}, `${labels[i]}: ${v} min`)));
    if (i % 2 === (vals.length - 1) % 2) svg.appendChild(s('text', { x: i * bw + bw / 2, y: H - 4, 'text-anchor': 'middle' }, labels[i]));
  });
  return svg;
}
function checkbox({ checked = false, onChange, label, cls = '' } = {}) {
  const inp = h('input', { type: 'checkbox', checked, onchange: e => onChange && onChange(e.target.checked, e) });
  const svg = s('svg', { viewBox: '0 0 24 24' }, s('path', { d: 'M5 12.5l4.5 4.5L19 7' }));
  return h('label.chk', { class: cls, 'aria-label': label || 'Select' }, inp, h('span.box', svg));
}
function stars(value, onChange, { ro = false } = {}) {
  const wrap = h('div.stars', { class: ro ? 'ro' : '', role: ro ? 'img' : 'radiogroup', 'aria-label': `Rating ${value} / 5` });
  const btns = [1, 2, 3, 4, 5].map(i => h('button', { type: 'button', class: i <= value ? 'on' : '', 'aria-label': `${i} ${i === 1 ? 'star' : 'stars'}`, onclick: () => onChange && onChange(i === value ? 0 : i), onmouseenter: () => btns.forEach((b, j) => b.classList.toggle('pre', j < i)), onmouseleave: () => btns.forEach(b => b.classList.remove('pre')) }, icon('star')));
  return append(wrap, btns);
}
function dots(n, onChange) {
  const mk = () => [1, 2, 3].map(i => h('i', { class: i <= n ? 'on' : '' }));
  return onChange ? h('span.dots', h('button', { type: 'button', title: `Difficulty ${n}/3 (click to change)`, 'aria-label': `Difficulty ${n}, click to change`, onclick: () => onChange(n % 3 + 1) }, mk())) : h('span.dots', { title: `Difficulty ${n}/3` }, mk());
}
const chip = (text, cls = '', title) => h('span.chip', { class: cls, title }, text);
const tierChip = t => chip(`T${t} ${TIER_ZH[t] || ''}`.trim(), `t${t}`);
function tierPicker(p, anchor) {
  const box = h('div.col.tierpick', { style: 'gap:4px;min-width:260px' }, h('div.faint.xs', { style: 'margin-bottom:2px' }, 'Importance'), [1, 2, 3].map(t => h('button.btn.btn-sm', { class: +p.tier === t ? 'btn-primary' : 'btn-ghost', style: 'justify-content:flex-start;height:auto;padding:6px 10px;text-align:left;white-space:normal', onclick: async () => { closePop(); if (+p.tier !== t) { await op({ op: 'paper.update', id: p.id, fields: { tier: t } }, { silent: true }); toast({ kind: 'ok', text: `“${p.short || p.title}” → T${t} ${TIER_ZH[t]}` }); } } }, h('span.chip', { class: `t${t}`, style: 'margin-right:8px' }, `T${t}`), h('span', h('b', TIER_ZH[t]), h('div.faint.xs', TIER_DESC[t])))));
  popover(anchor, box);
}
const tierChipFor = p => h('button.chip.clickable', { class: `t${p.tier}`, title: `${TIER_DESC[p.tier] || ''} · click to change`, onclick: e => { e.stopPropagation(); tierPicker(p, e.currentTarget); } }, `T${p.tier} ${TIER_ZH[p.tier] || ''}`.trim());
function segmented(options, value, onChange, cls = '') {
  return h('div.seg', { class: cls, role: 'group' }, options.map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String(v === value), onclick: () => onChange(v) }, label)));
}
function emptyState(text, action, ic = 'book') { return h('div.empty', h('div.ill', icon(ic)), h('div', text), action || null); }
function skeletonRows(n = 3) { return h('div.skrow', Array.from({ length: n }, (_, i) => h('div.skeleton', { style: `width:${90 - i * 15}%` }, 'loading'))); }
function tile(title, body, { span = 6, right, cls = '' } = {}) {
  return h('section.tile', { class: `sp${span} ${cls}` }, h('div.tilehead', h('h2', title), right ? h('div.right', right) : null), h('div.tilebody', body));
}
function switchEl(checked, onChange, label) { return h('label.switch', { 'aria-label': label || '' }, h('input', { type: 'checkbox', checked, onchange: e => onChange(e.target.checked) }), h('span.tr')); }

/* ============================================================ shell: nav / topics / header */
function dueCount() {
  const t = todayStr(), now = nowISO();
  const due = (S.L.reminders || []).filter(r => !r.done && r.when && r.when <= now).length;
  const overdue = S.L.papers.filter(p => p.planned && p.planned < t && !DONE.has(p.status)).length;
  return due + overdue;
}
function renderNav() {
  const nav = $('#nav'), tab = $('#tabbar');
  const due = dueCount(), inbox = S.D.inbox_count || 0;
  const badge = id => id === 'plan' && due ? h('span.badge.warn', due) : id === 'explore' && inbox ? h('span.badge.accent.dot', inbox) : null;
  nav.replaceChildren(...PAGES.map(([id, label, ic]) => h('button.navitem', { 'aria-current': S.page === id ? 'page' : null, onclick: () => go(id), title: label }, icon(ic), h('span', label), badge(id))));
  tab.replaceChildren(...PAGES.map(([id, label, ic]) => h('button', { 'aria-current': S.page === id ? 'page' : null, onclick: () => go(id) }, icon(ic), label, badge(id))));
  $('#topics').replaceChildren(...S.L.topics.map(t => {
    const ps = S.L.papers.filter(p => inTopic(p, t.id)), done = ps.filter(p => DONE.has(p.status)).length;
    return h('button.topicitem', { class: S.page === 'library' && S.lib.topic === t.id ? 'active' : '', title: `${t.name}${t.zh ? ` (${t.zh})` : ''}`, onclick: () => { S.lib.topic = t.id; store.set('libTopic', t.id); go('library'); } }, h('span.em', t.emoji || '📚'), h('span.n', t.name || t.zh), h('span.c', `${done}/${ps.length}`));
  }));
  const st = S.D.streak || 0;
  $('#sideStreak').replaceChildren(h('div', h('b', persona()), h('span.faint.xs', { style: 'margin-left:6px' }, isLate() ? 'is sleepy' : 'is here')), h('div', st ? [h('span', { style: S.D.active_today ? '' : 'filter:grayscale(1);opacity:.6' }, '🔥'), ' ', h('b', st), st === 1 ? '-day streak' : '-day streak'] : h('span.faint', 'Read today to start a streak')));
  renderTimerMini();
}
function pageHeader(title, subtitle, actions = []) {
  const head = $('#pagehead');
  head.replaceChildren(
    h('div.titles', h('h1', title), subtitle ? h('div.sub', subtitle) : null),
    h('div.actions', actions, h('button.icon-btn', { 'data-theme-toggle': '', 'aria-label': 'Toggle theme', onclick: toggleTheme }, icon(currentDark() ? 'sun' : 'moon')),
      h('button.icon-btn', { 'aria-label': settings().sounds ? 'Mute sounds' : 'Enable sounds', title: settings().sounds ? 'Sounds: on' : 'Sounds: off', 'aria-pressed': String(!!settings().sounds), onclick: async () => { await op({ op: 'settings.update', fields: { sounds: !settings().sounds } }, { silent: true }); if (settings().sounds) blip(); } }, icon(settings().sounds ? 'sound' : 'mute')),
      h('button.icon-btn', { 'aria-label': 'Keyboard shortcuts', title: 'Shortcuts (?)', onclick: helpSheet }, icon('help'))));
}

/* ============================================================ records helpers (highlights / discussions) */
/* one-line snippet around the first match of q, with the match bolded (text nodes only, never innerHTML) */
function snippetOf(text, q, max = 120) {
  const t = (text || '').replace(/^#+\s*/gm, '').replace(/^[-*]\s+/gm, '').replace(/\s+/g, ' ').trim();
  const lo = t.toLowerCase(), ql = q.toLowerCase(), i = lo.indexOf(ql);
  if (i < 0) return t.length > max ? t.slice(0, max - 1) + '…' : t;
  let start = Math.max(0, i - Math.floor((max - ql.length) / 2)), end = Math.min(t.length, start + max);
  if (end - start < max) start = Math.max(0, end - max);
  const parts = [];
  if (start > 0) parts.push('…');
  const seg = t.slice(start, end), si = i - start;
  parts.push(seg.slice(0, si), h('mark', seg.slice(si, si + ql.length)), seg.slice(si + ql.length));
  if (end < t.length) parts.push('…');
  return parts;
}
/* tiny safe Markdown subset for discussion digests: ### headings, - bullets, **bold**, `code`; everything else is plain text */
function mdInline(text) {
  const out = []; let rest = text || '';
  const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s<>()（）「」，。]+)/;
  const link = (label, url) => h('a', { href: url, target: '_blank', rel: 'noopener', onclick: e => { if (!REMOTE) { e.preventDefault(); openExternal(url); } } }, label);
  for (;;) {
    const m = re.exec(rest); if (!m) { if (rest) out.push(rest); break; }
    if (m.index) out.push(rest.slice(0, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(h('b', tok.slice(2, -2)));
    else if (tok.startsWith('`')) out.push(h('code', tok.slice(1, -1)));
    else if (tok.startsWith('[')) { const k = tok.indexOf(']('); out.push(link(tok.slice(1, k), tok.slice(k + 2, -1))); }
    else { const url = tok.replace(/[.,;:!?]+$/, ''); out.push(link(url, url)); if (url.length < tok.length) out.push(tok.slice(url.length)); }
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}
function mdLite(md, { maxLines = 0 } = {}) {
  const lines = (md || '').replace(/\r/g, '').split('\n').filter(l => l.trim());
  const shown = maxLines && lines.length > maxLines ? lines.slice(0, maxLines) : lines;
  const nodes = []; let ul = null;
  for (const raw of shown) {
    const l = raw.trim();
    const hm = /^(#{1,6})\s+(.*)$/.exec(l), bm = /^[-*•]\s+(.*)$/.exec(l), om = /^(\d{1,2})[.)]\s+(.*)$/.exec(l);
    if (bm) { if (!ul || ul.tagName !== 'UL') { ul = h('ul.mdul'); nodes.push(ul); } ul.appendChild(h('li', mdInline(bm[1]))); continue; }
    if (om) { if (!ul || ul.tagName !== 'OL') { ul = h('ol.mdul.mdol', { start: om[1] }); nodes.push(ul); } ul.appendChild(h('li', mdInline(om[2]))); continue; }
    ul = null;
    if (hm) nodes.push(h('div.mdh', mdInline(hm[2])));
    else nodes.push(h('p.mdp', mdInline(l)));
  }
  return { el: h('div.md', nodes), truncated: shown.length < lines.length, total: lines.length };
}
const firstLineOf = md => { const l = (md || '').split('\n').map(x => x.trim()).find(x => x && !/^#/.test(x)) || ''; return l.replace(/^[-*•]\s+/, '').replace(/\*\*|`/g, ''); };
function highlightsMarkdown(p) {
  const hls = paperHighlights(p.id);
  const head = `# ${p.short || p.title}${p.short ? ` — ${p.title}` : ''}\n\n${hls.length} ${hls.length === 1 ? 'highlight' : 'highlights'}${p.arxiv ? ` · ${p.arxiv}` : ''}\n\n`;
  return head + hls.map(x => `- p. ${x.page}: “${x.quote || ''}”${x.note ? `\n  - Note: ${x.note.replace(/\n+/g, ' ')}` : ''}`).join('\n') + '\n';
}
async function copyText(text, okMsg = 'Copied.') {
  try { await navigator.clipboard.writeText(text); toast({ kind: 'ok', text: okMsg }); return true; }
  catch { toast({ kind: 'warn', text: 'Clipboard unavailable; select the text manually.' }); return false; }
}
function copyHighlights(p) {
  if (!paperHighlights(p.id).length) { toast({ text: 'No highlights on this paper yet.' }); return; }
  copyText(highlightsMarkdown(p), 'Highlights copied as Markdown.');
}
/* jump the reader to a page: reuse the live session when it is this paper, otherwise start one at that page */
async function gotoPage(p, page, el) {
  if (S.R && S.R.paper === p.id) {
    const here = REMOTE ? S.R.viewer === 'browser' : S.R.viewer !== 'browser'; // is the session's PDF showing on this computer?
    if (!here) { window.open(pdfViewerUrl(p, page), '_blank'); return; }       // no: open a plain viewer tab here instead of jumping the other computer's PDF
    try { await api.post('/api/reading/goto', { page, id: p.id }); } catch (e) { errToast(e); }
    return;
  }
  return startReading(p, el, { page });
}

/* ============================================================ paper row (shared) */
function paperRow(p, o = {}) {
  const t = todayStr();
  const overdue = p.planned && p.planned < t && !DONE.has(p.status) ? dayDiff(t, p.planned) : 0;
  const stop = fn => e => { e.stopPropagation(); fn(e); };
  const left = o.check ? checkbox({ checked: DONE.has(p.status), cls: 'ok', label: 'Mark as read', onChange: (v, e) => { e.stopPropagation(); if (v) setStatus(p, 'read', e.target.parentElement); else setStatus(p, 'unread', e.target.parentElement); } }) : h('span.statusdot', { class: p.status, title: STATUS_ZH[p.status] });
  if (o.check) left.addEventListener('click', e => e.stopPropagation());
  const metaParts = [];
  if (!o.compact) {
    if (p.authors && p.authors.length) metaParts.push(authorsShort(p.authors));
    if (p.year) metaParts.push(String(p.year));
    if (p.venue) metaParts.push(p.venue);
    if (p.citations > 0) metaParts.push(`${p.citations.toLocaleString()} citations`);
  }
  const topic = topicById(p.topic), sub = topic && (topic.subtopics || []).find(x => x.id === p.subtopic);
  const chips = [tierChipFor(p)];
  const ext = extendedFrom(p); if (ext && !o.compact) chips.push(h('span.chip.outline', { title: `Extended reading from ${ext.short || ext.title}`, style: 'cursor:pointer', onclick: e => { e.stopPropagation(); openDrawer(ext.id); } }, '↳ ', ext.short || ext.title));
  if (o.compact) { if (p.est_minutes) chips.push(chip(`~${p.est_minutes} min`)); if (topic) chips.push(chip(`${topic.emoji || '📚'} ${topic.name || topic.zh}`, 'outline')); }
  else { paperTopics(p).forEach(tid => { const tt = topicById(tid); if (tt) chips.push(h('span.chip.outline', { title: tt.name, style: `--tc:${tt.color || 'var(--accent)'}` }, h('i', { style: 'width:6px;height:6px;border-radius:50%;background:var(--tc)' }), `${tt.emoji || ''} ${tt.name || tt.zh}`)); }); if (sub) chips.push(chip(sub.name)); if (p.phase) chips.push(chip(p.phase, 'mono')); if (p.planned && !DONE.has(p.status)) chips.push(chip([icon('cal'), ' ', fmtMD(p.planned)], overdue ? 'warn' : 'accent')); if (p.rating) chips.push(h('span.chip', { style: 'padding:0 4px;background:none' }, stars(p.rating, null, { ro: true }))); }
  if (overdue) chips.push(chip(`${overdue} ${overdue === 1 ? 'day' : 'days'} overdue`, 'warn'));
  const nHl = paperHighlights(p.id).length;
  if (nHl) chips.push(h('span.chip.hlc', { title: `${nHl} ${nHl === 1 ? 'highlight' : 'highlights'}` }, icon('edit'), nHl));
  if (o.extraChips) chips.push(...o.extraChips);
  const rm = S.page === 'library' && S.lib.q.trim() && S.lib.recMatch && S.lib.recMatch[p.id];
  const snip = rm ? h('div.snip', h('b', `${rm.kind}:`), ' ', snippetOf(rm.text, S.lib.q.trim())) : null;
  const acts = h('div.acts',
    h('button.icon-btn.sm', { title: 'Focus timer', 'aria-label': 'Focus timer', onclick: stop(() => openTimer(p.id)) }, icon('clock')),
    o.check ? h('button.icon-btn.sm', { title: 'Notes', 'aria-label': 'Notes', onclick: stop(() => openDrawer(p.id, { focusNote: true })) }, icon('note'))
      : h('button.icon-btn.sm', { title: 'Mark as read', 'aria-label': 'Mark as read', onclick: stop(e => setStatus(p, DONE.has(p.status) ? 'unread' : 'read', e.currentTarget)) }, icon('check')),
    h('button.icon-btn.sm', { title: overdue ? 'Reschedule' : 'Schedule', 'aria-label': 'Schedule', onclick: stop(e => datePopover(e.currentTarget, p.planned, d => setPlanned(p, d, e.currentTarget))) }, icon('cal')),
    !o.check ? h('button.icon-btn.sm', { title: 'Add to queue', 'aria-label': 'Add to queue', onclick: stop(e => addToQueue(p, e.currentTarget)) }, icon('plus')) : null,
    h('button.icon-btn.sm', { title: p.pdf ? 'Open PDF' : 'Download PDF', 'aria-label': 'Open PDF', onclick: stop(() => openPDF(p)) }, icon('pdf')));
  if (overdue && o.check) acts.insertBefore(h('button.btn.btn-sm', { onclick: stop(e => datePopover(e.currentTarget, p.planned, d => setPlanned(p, d, e.currentTarget))) }, 'Reschedule'), acts.firstChild);
  const row = h('div.prow.clickable', { class: `${DONE.has(p.status) ? 'done' : ''} ${o.focused ? 'focused' : ''}`, tabindex: 0, 'data-id': p.id, role: 'button', 'aria-label': `${p.short || ''} ${p.title}`,
    onclick: () => openDrawer(p.id), onkeydown: e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); openDrawer(p.id); } } },
    left,
    o.lib ? libRowBody(p, snip, overdue) : h('div.grow', h('div.ttl', h('b', p.short || p.title), p.short ? h('span', { title: p.title }, p.title) : null), snip, metaParts.length ? h('div.meta', metaParts.flatMap((x, i) => i ? [h('i.sep'), x] : [x])) : null, h('div.chips', chips)),
    h('div.readcell', readButton(p, { sm: true })),
    acts,
    p.status === 'reading' && p.progress > 0 ? h('div.prog', h('i', { style: `width:${p.progress}%` })) : null);
  return row;
}

/* Library list row: the title, authors and year on one line, then the 註記 (why the user picked this paper up). */
function libRowBody(p, snip, overdue) {
  const by = [authorsShort(p.authors), p.year ? String(p.year) : ''].filter(Boolean).join(' · ');
  const note = (p.interest || '').trim();
  return h('div.grow.librow',
    h('div.ttl', h('b', p.title || p.short)),
    by ? h('div.by', by) : null,
    snip,
    note ? h('div.inote', note) : h('div.inote.pending', p.why ? p.why : noteL().pending),
    overdue ? h('div.chips', chip(`${overdue} ${overdue === 1 ? 'day' : 'days'} overdue`, 'warn')) : null);
}

/* ============================================================ page: today */
function renderToday() {
  const B = S.B, D = S.D, st = settings(), t = todayStr();
  pageHeader('Today', new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }), [h('button.btn', { onclick: () => openAddPaper() }, icon('plus'), 'Add paper')]);
  if (!B) return h('div.bento', skeletonTile(8), skeletonTile(4), skeletonTile(8), skeletonTile(4));
  const grid = h('div.bento');
  const papers = S.L.papers;
  // inbox banner
  if (D.inbox_count > 0) grid.appendChild(h('div.inboxbanner.sp12', h('span.ic', icon('inbox')), h('div.grow', h('b', `${persona()} brought back ${D.inbox_count} survey ${D.inbox_count === 1 ? 'list' : 'lists'}`), h('div.small.muted', 'Review the candidates in Explore; accepted papers go straight into your library and queue.')), h('button.btn.btn-primary', { onclick: () => go('explore') }, 'Go to Explore')));

  // 1. greeting
  const hh = new Date().getHours(), name = st.user_name ? `, ${st.user_name}` : '';
  const lastActive = (S.L.stats || {}).last_active, gap = lastActive ? dayDiff(t, lastActive) : 0;
  const streak = D.streak || 0, play = playful(), nSess = sessionsToday();
  let status, suggestion = B.suggestions[0] || '', cta = null, ctaPaper = (B.reading[0] || B.today_papers[0] || B.queue_top[0] || null);
  if (lastActive && gap >= 3) {
    const shortest = papers.filter(p => p.tier === 1 && !DONE.has(p.status)).sort((a, b) => (a.est_minutes || 60) - (b.est_minutes || 60))[0];
    status = `Welcome back. ${persona()} kept the library warm for ${gap} days. Start with the shortest one?`;
    if (shortest) { suggestion = `“${shortest.short || shortest.title}” takes only about ${shortest.est_minutes || 60} minutes.`; ctaPaper = shortest; }
  } else if (!play) status = D.minutes_today > 0 ? `${D.minutes_today} min of reading today · ${nSess} ${nSess === 1 ? 'session' : 'sessions'}` : lastActive ? 'Nothing recorded today yet.' : 'A fresh start. Open a paper and the log begins.';
  else if (streak > 0 && D.active_today) status = h('span', 'Day ', h('b', streak), ' of your streak ', h('span.flame', '🔥'), ` · ${D.minutes_today} min focused today`);
  else if (streak > 0) status = `${streak}-day streak. Nothing yet today; 10 minutes keeps it alive.`;
  else if (!lastActive) status = 'A fresh start. Finish your first paper and the heatmap lights up.';
  else status = 'Nothing yet today. Ten minutes of reading relights your streak.';
  if (isLate()) suggestion = 'It’s late. Stop here for tonight; it will stick better tomorrow morning.';
  cta = S.R ? liveCard() : h('div.cta', ctaPaper ? readButton(ctaPaper, { lg: true }) : h('button.btn.btn-primary.btn-lg', { onclick: () => openTimer(null) }, icon('play'), 'Start focus'),
    ctaPaper ? h('span.faint.xs.ellip', { style: 'max-width:240px' }, ctaPaper.short || ctaPaper.title) : null,
    ctaPaper ? h('button.btn.btn-sm.btn-ghost', { title: 'Just the focus timer, no PDF window', onclick: () => openTimer(ctaPaper.id) }, icon('clock'), 'Timer only') : null);
  grid.appendChild(tile('Hello', h('div.greet', h('div.grow', h('div.g', `${greetingWord(hh)}${name}`), h('div.st', status), suggestion ? h('div.sg', h('span.who', persona()), h('span', suggestion)) : null), cta), { span: 8, cls: 'greettile' }));

  // 2. ring
  const goal = B.goal_minutes || 45, mins = B.minutes_today || 0, pct = Math.min(100, Math.round(mins / goal * 100)), done = mins >= goal;
  if (done && S.goalToasted !== t) { S.goalToasted = t; store.set('goalToasted', t); }
  const days7 = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6)), byDate = activityByDate();
  const vals = days7.map(d => (byDate[d] || {}).min || 0);
  grid.appendChild(tile(play ? 'Today’s goal' : 'Today', h('div.ringwrap', ring(pct, { done: play && done, center: [h('b', mins, h('span.unit', `/ ${goal} min`)), h('small', !play ? 'min today' : done ? 'Goal reached' : `${goal - mins} min to go`)] }), sparkline(vals), h('div.sparkdays', days7.map(d => h('span', WD[new Date(d + 'T00:00:00').getDay()])))), { span: 4 }));

  // 3. today's reading list
  const ids = uniq([...B.due_reminders.map(r => r.paper).filter(Boolean), ...B.today_papers.map(p => p.id), ...B.overdue.map(p => p.id), ...B.reading.map(p => p.id), ...B.queue_top.map(p => p.id)]);
  const list = ids.map(paperById).filter(Boolean).filter(p => !DONE.has(p.status) || B.finished_today.includes(p.id)).slice(0, 6);
  const todayBody = list.length ? h('div.plist', list.map(p => paperRow(p, { check: true, compact: true }))) : emptyState('Nothing planned for today. Pick one from the queue?', h('button.btn', { onclick: () => queuePicker(t) }, 'Pick from queue'), 'book');
  grid.appendChild(tile('Up next today', todayBody, { span: 8, right: list.length ? h('span.faint.xs', `${B.finished_today.length} done · ${list.filter(p => !DONE.has(p.status)).length} to read`) : null }));

  // 4. reminders
  const due = B.due_reminders, msgs = (S.L.messages || []).slice(-3).reverse();
  grid.appendChild(tile('Reminders', h('div', due.length ? due.map(r => reminderRow(r, { compact: true })) : h('div.muted.small', { style: 'padding:6px 0' }, 'No reminders right now.'), msgs.length ? h('div.msgs', msgs.map(m => h('div.m', h('time', fmtTime(m.at) || fmtMD(m.at)), h('span', m.text)))) : null), { span: 4, right: h('button.icon-btn.sm', { title: 'New reminder', onclick: () => reminderForm() }, icon('plus')) }));

  // 4b. today's research gap (Daily gap page)
  const tg = (S.L.gaps || []).filter(x => x.date === t && x.status !== 'failed').sort((a, b) => (b.created || '').localeCompare(a.created || ''))[0];
  if (tg) grid.appendChild(tile('Today’s research gap', tg.status === 'generating' ? h('div.row', { style: 'gap:8px' }, h('span.spin'), h('span.muted.small', 'Claude is surveying a new direction; the brief shows up here when it is done.'))
    : h('div.col', { style: 'gap:6px' }, h('b', tg.title), tg.problem ? h('div.small.muted', firstLineOf(tg.problem)) : null, h('div.row', { style: 'gap:8px' }, tg.direction ? chip(tg.direction, '') : null, h('span.grow'), h('button.btn.btn-sm', { onclick: () => { S.gapSel = tg.id; go('gaps'); } }, icon('bulb'), 'Open & discuss'))),
    { span: 12 }));

  // 4c. the trail: what you are after, from every question you asked (Explore → Trail)
  const tr = S.L.trail || {}, trN = (S.L.requests || []).filter(r => (r.text || '').trim()).length + (S.L.experts || []).length;
  if (tr.north_star || trN >= 3) grid.appendChild(tile('Your trail', h('div.col', { style: 'gap:6px' }, tr.north_star ? h('div', { style: 'line-height:1.65' }, tr.north_star.length > 220 ? tr.north_star.slice(0, 219) + '…' : tr.north_star) : h('div.small.muted', `${trN} questions so far; Claude has not read them yet.`),
    h('div.row', { style: 'gap:8px;flex-wrap:wrap' }, (tr.threads || []).slice(0, 5).map(th => chip(th.zh || th.name, '', th.statement)), h('span.grow'), h('button.btn.btn-sm', { onclick: () => { go('explore'); setExploreView('trail'); } }, icon('explore'), 'Open Trail'))), { span: 12 }));

  // 5. recall (playful only)
  let recallBody;
  if (!play) recallBody = null;
  else if (B.recall && B.recall.length) recallBody = h('div.recall', B.recall.map(rc => h('div.recallcard', h('div.src', `“${rc.short}” · finished ${rc.age} days ago`), h('div', rc.claim), h('div.acts', h('button.btn.btn-sm', { onclick: e => { e.currentTarget.closest('.recallcard').remove(); blip(); toast({ kind: 'ok', text: 'Good, it stuck.' }); } }, icon('check'), 'Got it'), h('button.btn.btn-sm.btn-ghost', { onclick: () => openDrawer(rc.paper) }, 'Look again')))));
  else {
    const pool = papers.filter(p => p.tier === 1 && !DONE.has(p.status) && p.why);
    const pick = pool.length ? pool[(new Date().getDate() + pool.length) % pool.length] : papers.find(p => p.why);
    recallBody = pick ? h('div', h('div.quote', pick.why), h('div.row.between', h('span.faint.xs', `Thought of the day · “${pick.short || pick.title}”`), h('button.btn.btn-sm.btn-ghost', { onclick: () => openDrawer(pick.id) }, 'View', icon('chev')))) : h('div.muted.small', 'Finish papers and save a few claims; recall prompts will show up here.');
  }
  if (play) grid.appendChild(tile('Recall', recallBody, { span: 6 }));

  // 6. radar (playful only)
  if (play) grid.appendChild(radarTile());

  // 7. recent records (highlights + discussion digests across all papers)
  grid.appendChild(recentRecordsTile());

  // 8. heatmap (always) with the streak box only in playful mode
  const flameOn = D.active_today;
  if (play) grid.appendChild(tile('Streak & heatmap', h('div.streakwrap', h('div.streakbox', h('div.flame', { class: flameOn ? 'on' : '' }, icon('flame')), h('div', h('div.num', `${streak} ${streak === 1 ? 'day' : 'days'}`), h('div.lbl', `Best ${D.best_streak || 0} days · ${D.freezes || 0} freezes${flameOn ? '' : ' · not lit today yet'}`))), heatmap()), { span: 12 }));
  else grid.appendChild(tile('Reading activity', heatmap(), { span: 12, right: h('span.faint.xs', `${(S.L.sessions || []).length} sessions logged`) }));
  return grid;
}
function recentRecords(n = 8) {
  const hls = (S.L.highlights || []).map(x => ({ kind: 'highlight', at: x.created || '', paper: x.paper, page: x.page, text: x.quote || x.note || '', color: x.color, id: x.id }));
  const ds = (S.L.discussions || []).map(d => ({ kind: 'discussion', at: d.created || d.date || '', paper: d.paper, date: d.date, minutes: d.minutes, text: firstLineOf(d.summary), id: d.id }));
  return [...hls, ...ds].filter(r => paperById(r.paper)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, n);
}
function recentRecordsTile() {
  const recs = recentRecords(8);
  const body = recs.length ? h('div.recs', recs.map(r => {
    const p = paperById(r.paper);
    return h('div.recrow.clickable', { tabindex: 0, role: 'button', 'aria-label': `${p.short || p.title}: open details`, onclick: () => openDrawer(p.id), onkeydown: e => { if (e.key === 'Enter' && !e.isComposing) openDrawer(p.id); } },
      r.kind === 'highlight' ? h('span.rk.hlbar', { class: `c-${r.color || 'yellow'}`, title: 'Highlight' }) : h('span.rk.disc', { title: 'Discussion digest' }, icon('note')),
      h('div.grow', h('div.t', h('b', p.short || p.title), h('span.faint', r.kind === 'highlight' ? `p. ${r.page}` : `${fmtDateZh(r.date)}${r.minutes ? ` · ${r.minutes} min` : ''}`)), h('div.q', r.text || h('span.faint', 'No text'))),
      h('span.faint.xs.when', relDate(r.at.slice(0, 10))));
  })) : h('div.muted.small', { style: 'padding:6px 0' }, 'Highlights and discussion digests from your reading sessions show up here.');
  const nH = (S.L.highlights || []).length, nD = (S.L.discussions || []).length;
  return tile('Recent records', body, { span: 12, right: (nH || nD) ? h('span.faint.xs', `${nH} ${nH === 1 ? 'highlight' : 'highlights'} · ${nD} ${nD === 1 ? 'discussion' : 'discussions'}`) : null });
}
function skeletonTile(span) { return h('section.tile', { class: `sp${span}` }, h('div.tilebody', skeletonRows(3))); }

function reminderRow(r, { compact = false } = {}) {
  const p = r.paper ? paperById(r.paper) : null, due = r.when <= nowISO() && !r.done;
  const title = r.title || (p ? `Read “${p.short || p.title}”` : 'Reminder');
  const row = h('div.remrow', { class: `${due ? 'due' : ''} ${r.done ? 'done' : ''}` },
    checkbox({ checked: !!r.done, label: 'Done', onChange: v => op({ op: 'reminder.update', id: r.id, fields: { done: v } }, { silent: true }) }),
    h('div.grow', h('div.t', p ? h('a', { href: '#', onclick: e => { e.preventDefault(); openDrawer(p.id); } }, title) : title), h('div.w', `${fmtWhen(r.when)} · ${relWhen(r.when)}${r.repeat && r.repeat !== 'none' ? ` · ${r.repeat === 'daily' ? 'daily' : 'weekly'}` : ''}`)),
    h('div.acts',
      !r.done ? h('button.icon-btn.sm', { title: 'Snooze 30 min', 'aria-label': 'Snooze 30 minutes', onclick: () => { const d = new Date(Math.max(Date.now(), new Date(r.when).getTime()) + 30 * 60000); op({ op: 'reminder.update', id: r.id, fields: { when: `${localISO(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00` } }, { silent: true }); toast({ text: 'Snoozed 30 minutes.' }); } }, icon('clock')) : null,
      !compact ? h('button.icon-btn.sm', { title: 'Edit', 'aria-label': 'Edit', onclick: () => reminderForm(r) }, icon('edit')) : null,
      h('button.icon-btn.sm', { title: 'Delete', 'aria-label': 'Delete', onclick: async () => { await op({ op: 'reminder.remove', id: r.id }, { silent: true }); toast({ text: 'Reminder deleted.' }); } }, icon('trash'))));
  return row;
}

/* radar tile */
function radarTile() {
  const topics = S.L.topics.filter(t => t.status !== 'done');
  if (!S.radar.topic || !topics.find(t => t.id === S.radar.topic)) S.radar.topic = (topics.find(t => t.status === 'active') || topics[0] || {}).id || null;
  const body = h('div');
  const chips = h('div.chiprow', topics.map(t => h('button.topicchip', { 'aria-pressed': String(t.id === S.radar.topic), style: `--tc:${t.color || 'var(--accent)'}`, onclick: () => { S.radar.topic = t.id; fillRadar(body, false); chips.querySelectorAll('.topicchip').forEach(c => c.setAttribute('aria-pressed', String(c.textContent.includes(t.name || t.zh)))); } }, h('span.dot'), t.emoji, ' ', t.name || t.zh)));
  const el = tile('Radar', h('div', topics.length > 1 ? chips : null, body), { span: 6, right: h('button.icon-btn.sm', { title: 'Refresh', 'aria-label': 'Refresh radar', onclick: () => fillRadar(body, true) }, icon('refresh')) });
  fillRadar(body, false);
  return el;
}
const RADAR_CACHE = {};
async function fillRadar(body, force) {
  const tid = S.radar.topic;
  if (!tid) { body.replaceChildren(h('div.muted.small', 'No topics yet. Accept a survey or add a topic and the radar starts scanning.')); return; }
  const t = topicById(tid);
  if (!t || !(t.radar_query || '').trim()) { body.replaceChildren(h('div.empty', { style: 'padding:16px' }, h('div', 'This topic has no radar query yet.'), h('button.btn.btn-sm', { onclick: () => go('settings') }, 'Set it up in Settings'))); return; }
  if (!RADAR_CACHE[tid] || force) {
    body.replaceChildren(skeletonRows(4));
    try { RADAR_CACHE[tid] = await api.get(`/api/radar?topic=${encodeURIComponent(tid)}${force ? '&force=1' : ''}`); }
    catch (e) { body.replaceChildren(h('div.muted.small', { style: 'padding:8px 0' }, 'Radar is offline for now.')); return; }
  }
  const data = RADAR_CACHE[tid], hidden = S.radar.hidden;
  const rows = (data.papers || []).filter(p => !hidden[p.id] && p.rating !== -1).slice(0, 5);
  if (!rows.length) { body.replaceChildren(h('div.muted.small', { style: 'padding:8px 0' }, 'No new papers in the last few days.')); return; }
  body.replaceChildren(h('div', rows.map(p => {
    const row = h('div.radarrow', h('div.grow', h('div.ttl', p.title), h('div.meta', h('span', authorsShort(p.authors, 2)), h('span', '·'), h('span', p.published), p.primary ? chip(p.primary, 'mono') : null, p.in_library ? chip('In library', 'ok') : null)),
      h('div.acts',
        h('button.icon-btn.sm', { class: p.in_library || p.rating === 1 ? 'on' : '', title: 'Add to library (T3)', 'aria-label': 'Add to library', disabled: p.in_library, onclick: async e => {
          const payload = { short: `${(p.authors[0] || 'Paper').split(' ').pop()} ${p.year}`, title: p.title, authors: p.authors, year: p.year, venue: p.venue, abstract: p.abstract, arxiv: p.arxiv, tags: p.primary ? [p.primary] : [], est_minutes: 45, difficulty: 2 };
          await op({ op: 'radar.rate', id: p.id, rating: 1, topic: tid, paper: payload }, { el: e.currentTarget, silent: true });
          p.in_library = true; p.rating = 1; tinyConfetti(e.currentTarget); toast({ kind: 'ok', text: `“${payload.short}” added to library (T3)` });
          fillRadar(body, false);
        } }, icon('up')),
        h('button.icon-btn.sm', { title: 'Not interested', 'aria-label': 'Hide', onclick: () => { hidden[p.id] = 1; store.set('radarHidden', hidden); op({ op: 'radar.rate', id: p.id, rating: -1, topic: tid }, { silent: true, noReload: true }).catch(() => { }); row.remove(); } }, icon('down')),
        h('button.icon-btn.sm', { title: 'Open on arXiv', 'aria-label': 'arXiv', onclick: () => openExternal(p.arxiv) }, icon('ext'))));
    return row;
  })), data.fetched ? h('div.faint.xs', { style: 'margin-top:6px' }, `Updated ${fmtWhen(data.fetched)}`) : null);
}

/* queue picker: choose a paper from queue (or any unread) to plan on a date */
function queuePicker(date, { onPick } = {}) {
  const q = (S.L.queue || []).map(paperById).filter(Boolean).filter(p => !DONE.has(p.status));
  const others = S.L.papers.filter(p => !DONE.has(p.status) && !q.includes(p)).sort((a, b) => a.tier - b.tier || a.order - b.order).slice(0, 30);
  const search = h('input.input', { placeholder: 'Search papers…', oninput: () => filter() });
  const list = h('div.plist');
  const dlg = openDialog({ title: date ? `Schedule for ${relDate(date)} (${fmtMD(date)})` : 'Pick a paper', body: h('div.col', { style: 'gap:10px' }, search, h('div', { style: 'max-height:50vh;overflow:auto' }, list)) });
  function filter() {
    const qq = search.value.trim().toLowerCase();
    const mk = (p, tag) => h('div.prow.clickable', { tabindex: 0, onclick: () => pick(p), onkeydown: e => { if (e.key === 'Enter' && !e.isComposing) pick(p); } }, h('span.statusdot', { class: p.status }), h('div.grow', h('div.ttl', h('b', p.short || p.title), h('span', p.title)), h('div.chips', tierChip(p.tier), chip(`~${p.est_minutes || 60} min`), tag ? chip(tag, 'accent') : null)));
    const f = p => !qq || (p.short + ' ' + p.title + ' ' + (p.authors || []).join(' ')).toLowerCase().includes(qq);
    list.replaceChildren(...q.filter(f).map(p => mk(p, 'Queue')), ...others.filter(f).map(p => mk(p)));
    if (!list.children.length) list.appendChild(h('div.empty', `No papers match “${search.value}”.`));
  }
  async function pick(p) { dlg.closeDlg(); if (onPick) return onPick(p); await setPlanned(p, date); }
  filter(); setTimeout(() => search.focus(), 50);
}

/* ============================================================ page: library */
function filteredPapers() {
  const f = S.lib, q = f.q.trim().toLowerCase();
  let ps = S.L.papers.filter(p => (f.topic === 'all' || inTopic(p, f.topic)) && (!f.tier || String(p.tier) === f.tier) && (!f.status || p.status === f.status) && (!f.sub || p.subtopic === f.sub) && (!f.phase || p.phase === f.phase));
  f.recMatch = {};
  if (q) ps = ps.filter(p => {
    if (`${p.short} ${p.title} ${(p.authors || []).join(' ')} ${p.venue} ${p.year} ${(p.tags || []).join(' ')} ${p.why} ${p.interest || ''}`.toLowerCase().includes(q)) return true;
    // records: highlights (quote / note) and discussion digests (summary)
    for (const x of paperHighlights(p.id)) { const src = `${x.quote || ''}`.toLowerCase().includes(q) ? x.quote : `${x.note || ''}`.toLowerCase().includes(q) ? x.note : null; if (src) { f.recMatch[p.id] = { kind: 'Highlight', text: src }; return true; } }
    for (const d of paperDiscussions(p.id)) { if (`${d.summary || ''}`.toLowerCase().includes(q)) { f.recMatch[p.id] = { kind: 'Discussion', text: d.summary }; return true; } }
    return false;
  });
  const ST_ORDER = { reading: 0, queued: 1, unread: 2, read: 3, deep: 4, skipped: 5 };
  const cmp = {
    order: (a, b) => a.tier - b.tier || (a.phase || '').localeCompare(b.phase || '') || a.order - b.order,
    importance: (a, b) => a.tier - b.tier || (b.citations || 0) - (a.citations || 0) || a.order - b.order,
    year: (a, b) => (b.year || 0) - (a.year || 0),
    status: (a, b) => ST_ORDER[a.status] - ST_ORDER[b.status] || a.order - b.order,
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || a.order - b.order,
    added: (a, b) => (b.added || '').localeCompare(a.added || ''),
    citations: (a, b) => (b.citations || 0) - (a.citations || 0),
  }[f.sort] || ((a, b) => a.order - b.order);
  return ps.sort(cmp);
}
function renderLibrary() {
  const f = S.lib;
  const topic = f.topic !== 'all' ? topicById(f.topic) : null;
  if (f.topic !== 'all' && !topic) { f.topic = 'all'; }
  pageHeader('Library', topic ? (topic.description || topic.name) : `${S.L.papers.length} papers · ${S.L.topics.length} topics`, [
    h('button.btn', { onclick: () => openAddPaper() }, icon('plus'), 'Add paper'),
  ]);
  const ps = filteredPapers();
  const sel = (opts, value, onchange, label) => h('select.select', { 'aria-label': label, onchange: e => { onchange(e.target.value); render(); } }, opts.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
  const subs = topic ? (topic.subtopics || []) : [], phases = topic ? (topic.phases || []) : [];
  const search = h('input.input', { id: 'libSearch', type: 'search', placeholder: 'Search title, authors, keywords…', value: f.q, 'aria-label': 'Search papers', oninput: debounce(e => { f.q = e.target.value; renderLibraryList(); }, 120), onkeydown: e => { if (e.key === 'Escape') { e.target.value = ''; f.q = ''; renderLibraryList(); e.target.blur(); } } });
  const ctl = h('div.libctl',
    h('div.chips', h('button.topicchip', { 'aria-pressed': String(f.topic === 'all'), onclick: () => { f.topic = 'all'; f.sub = ''; f.phase = ''; store.set('libTopic', 'all'); render(); } }, 'All', h('span.c', S.L.papers.length)),
      S.L.topics.map(t => h('button.topicchip', { 'aria-pressed': String(f.topic === t.id), style: `--tc:${t.color || 'var(--accent)'}`, onclick: () => { f.topic = t.id; f.sub = ''; f.phase = ''; store.set('libTopic', t.id); render(); } }, h('span.dot'), `${t.emoji || ''} ${t.name || t.zh}`, h('span.c', S.L.papers.filter(p => inTopic(p, t.id)).length)))),
    h('div.filters',
      h('div.search', icon('search'), search, h('kbd', '/')),
      sel([['', 'All tiers'], ['1', 'T1 Core'], ['2', 'T2 Advanced'], ['3', 'T3 Frontier']], f.tier, v => f.tier = v, 'Tier'),
      sel([['', 'All statuses'], ...Object.entries(STATUS_ZH)], f.status, v => f.status = v, 'Status'),
      subs.length ? sel([['', 'All subtopics'], ...subs.map(x => [x.id, x.name])], f.sub, v => f.sub = v, 'Subtopic') : null,
      phases.length ? sel([['', 'All phases'], ...phases.map(x => [x.id, `${x.id} ${x.name}`])], f.phase, v => f.phase = v, 'Phase') : null,
      sel([['order', 'Recommended'], ['importance', 'Importance'], ['year', 'Year'], ['status', 'Status'], ['rating', 'Rating'], ['added', 'Recently added'], ['citations', 'Citations']], f.sort, v => f.sort = v, 'Sort'),
      h('span.grow'),
      segmented([['comfortable', 'Comfortable'], ['compact', 'Compact']], store.get('density', 'comfortable'), v => { applyDensity(v); render(); }, 'sm'),
      segmented([['list', 'List'], ['roadmap', 'Roadmap']], f.view, v => { f.view = v; store.set('libView', v); render(); }, 'sm')));
  const wrap = h('div', ctl, h('div#libList'));
  setTimeout(() => renderLibraryList(ps), 0);
  return wrap;
}
function renderLibraryList(ps) {
  const box = $('#libList'); if (!box) return;
  ps = ps || filteredPapers();
  const f = S.lib;
  if (f.view === 'roadmap') return box.replaceChildren(renderRoadmap(ps));
  const total = f.topic === 'all' ? S.L.papers.length : S.L.papers.filter(p => inTopic(p, f.topic)).length;
  const list = ps.length ? h('div.plist.card', { style: 'padding:0 12px' }, ps.map((p, i) => paperRow(p, { focused: i === S.focusIdx, lib: true }))) : emptyState(f.q ? `No papers match “${f.q}”. Try a shorter keyword or an author name.` : 'No papers match these filters.', f.q ? null : h('button.btn', { onclick: () => openAddPaper() }, icon('plus'), 'Add paper'), 'search');
  box.replaceChildren(h('div.countline', `Showing ${ps.length} / ${total}`), list);
}
function renderRoadmap(ps) {
  const topics = S.lib.topic === 'all' ? S.L.topics : [topicById(S.lib.topic)].filter(Boolean);
  if (!topics.length) return emptyState('No topics yet.');
  return h('div.col', { style: 'gap:24px' }, topics.map(t => {
    const tp = ps.filter(p => inTopic(p, t.id));
    const phases = (t.phases || []).length ? t.phases : [{ id: '', name: 'All', weeks: '', goal: '' }];
    let activeMarked = false;
    return h('div', topics.length > 1 ? h('h2', { style: 'margin-bottom:10px' }, `${t.emoji || ''} ${t.name}`, h('span.muted', { style: 'font-weight:400;margin-left:8px' }, t.zh)) : null,
      t.goals ? h('div.whybox', { style: 'margin-bottom:14px' }, t.goals) : null,
      h('div.roadmap', phases.map(ph => {
        const pp = tp.filter(p => (p.phase || '') === ph.id).sort((a, b) => a.tier - b.tier || a.order - b.order), done = pp.filter(p => DONE.has(p.status)).length;
        const pct = pp.length ? Math.round(done / pp.length * 100) : 0, isDone = pp.length && done === pp.length, isActive = !isDone && !activeMarked && pp.length; if (isActive) activeMarked = true;
        return h('div.phase', { class: isDone ? 'done' : isActive ? 'active' : '' }, h('div.ph', h('h3', `${ph.id ? ph.id + ' · ' : ''}${ph.name}`), ph.weeks ? h('span.wk', ph.weeks) : null, h('span.wk', { style: 'margin-left:auto' }, `${done} / ${pp.length}`)), ph.goal ? h('div.goal', ph.goal) : null, h('div.pbar', { class: isDone ? 'ok' : '' }, h('i', { style: `width:${pct}%` })), pp.length ? h('div.plist', pp.map(p => paperRow(p))) : h('div.faint.small', 'No papers in this phase match the filters.'));
      })));
  }));
}

/* ============================================================ drawer */
function openDrawer(id, { focusNote = false } = {}) {
  S.drawerId = id; $('#app').classList.add('drawer-open');
  renderDrawer();
  if (focusNote) setTimeout(() => { const ta = $('#drawer textarea[data-field="quick_note"]'); ta && ta.focus(); }, 380);
}
function closeDrawer() { S.drawerId = null; $('#app').classList.remove('drawer-open'); setTimeout(() => { if (!S.drawerId) $('#drawer').replaceChildren(); }, 380); }
const DSEC_OPEN = store.get('dsec', { status: true, member: true, why: true, note: true, claims: true, ideas: false, abstract: false, sessions: false, deep: false });
function dsec(key, title, body, right) {
  const d = h('details.dsec', { open: DSEC_OPEN[key] !== false, ontoggle: e => { DSEC_OPEN[key] = e.target.open; store.set('dsec', DSEC_OPEN); } }, h('summary', title, right ? h('span.r', right) : null), h('div.secbody', body));
  return d;
}
function renderDrawer() {
  const dr = $('#drawer'), p = S.drawerId ? paperById(S.drawerId) : null;
  if (!p) { if (S.drawerId) closeDrawer(); return; }
  if (typingInProgress() && dr.contains(document.activeElement)) { deferRender(); return; }
  const topic = topicById(p.topic);
  const upd = (fields, el) => op({ op: 'paper.update', id: p.id, fields }, { silent: true, el });
  const autosave = debounce((field, v) => upd({ [field]: v }).then(() => { if (field === 'quick_note' && v.trim()) blip(440, 660, .05, .1); }), 600);
  const statusSeg = segmented(Object.entries(STATUS_ZH), p.status, v => setStatus(p, v));
  const prog = h('input', { type: 'range', min: 0, max: 100, value: p.progress || 0, 'aria-label': 'Reading progress', onchange: e => op({ op: 'paper.progress', id: p.id, progress: +e.target.value }, { silent: true }), oninput: e => { progLbl.textContent = `${e.target.value}%`; } });
  const progLbl = h('span.mono.small', { style: 'min-width:36px;text-align:right' }, `${p.progress || 0}%`);
  const claims = p.claims || [];
  const claimsEl = h('div.claims', claims.map((c, i) => h('div.cl', h('span.n', i + 1), h('textarea.textarea', { rows: 1, value: c, 'data-autosave': '1', oninput: e => { const arr = [...claims]; arr[i] = e.target.value; autosave('claims', arr.filter(x => x.trim())); } }), h('button.icon-btn.sm', { title: 'Remove', onclick: () => upd({ claims: claims.filter((_, j) => j !== i) }) }, icon('x')))),
    claims.length < 5 ? h('button.btn.btn-sm.btn-ghost', { onclick: () => upd({ claims: [...claims, ''] }).then(() => setTimeout(() => { const tas = $$('#drawer .claims textarea'); tas[tas.length - 1] && tas[tas.length - 1].focus(); }, 50)) }, icon('plus'), 'Add claim') : h('span.faint.xs', 'Max 5'));
  const ideaInp = h('input.input', { placeholder: 'Question or idea, Enter to save', 'data-autosave': '1', onkeydown: async e => { if (e.key === 'Enter' && !e.isComposing && e.target.value.trim()) { const text = e.target.value.trim(); e.target.value = ''; await op({ op: 'idea.add', idea: { text, paper: p.id, kind: text.endsWith('？') || text.endsWith('?') ? 'question' : 'idea' } }, { el: e.target }); toast({ kind: 'ok', text: 'Idea saved (+5 XP).' }); } } });
  const ideas = (S.L.ideas || []).filter(i => i.paper === p.id).slice(-8).reverse();
  const sess = (S.L.sessions || []).filter(x => x.paper === p.id).slice(-10).reverse();
  const deepBox = h('div.col', skeletonRows(2));
  dr.replaceChildren(
    h('div.dhead', h('button.icon-btn', { 'aria-label': 'Close', title: 'Close (Esc)', onclick: closeDrawer }, icon('x')), h('span.statusdot', { class: p.status }), h('span.small.muted', STATUS_ZH[p.status]), h('span.grow'),
      readButton(p, { sm: true }), h('button.icon-btn', { title: 'Focus timer only', 'aria-label': 'Focus timer', onclick: () => openTimer(p.id) }, icon('clock')), h('button.btn.btn-sm', { class: DONE.has(p.status) ? 'btn-ghost' : 'btn-primary', onclick: e => setStatus(p, DONE.has(p.status) ? 'unread' : 'read', e.currentTarget) }, icon('check'), DONE.has(p.status) ? 'Mark unread' : 'Finished')),
    h('div.dbody',
      h('div.dtitle', h('div.short', p.short || p.title), p.short ? h('div.full', p.title) : null, h('div.au', `${authorsShort(p.authors, 4)}${p.year ? ` · ${p.year}` : ''}${p.venue ? ` · ${p.venue}` : ''}${p.citations ? ` · ${p.citations.toLocaleString()} citations` : ''}`),
        h('div.links', p.arxiv ? h('button.btn.btn-sm', { onclick: () => openExternal(p.arxiv) }, 'arXiv', icon('ext')) : null, p.doi ? h('button.btn.btn-sm', { onclick: () => openExternal(p.doi.startsWith('http') ? p.doi : `https://doi.org/${p.doi.replace(/^doi:/, '')}`) }, 'DOI', icon('ext')) : null, p.url && !p.arxiv ? h('button.btn.btn-sm', { onclick: () => openExternal(p.url) }, 'Link', icon('ext')) : null,
          p.pdf ? h('button.btn.btn-sm', { onclick: () => openPDF(p) }, icon('pdf'), 'Open PDF') : h('button.btn.btn-sm', { onclick: () => attachPdfDialog(p) }, icon('upload'), 'Attach PDF'),
          !p.pdf && p.arxiv ? h('button.btn.btn-sm.btn-ghost', { onclick: async e => { e.currentTarget.disabled = true; try { await api.post('/api/download', { id: p.id }); toast({ text: 'Downloading PDF…' }); } catch (err) { errToast(err); } } }, icon('download'), 'Download from arXiv') : null,
          topic ? chip(`${topic.emoji || ''} ${topic.name || topic.zh}`, 'outline') : null)),
      dsec('status', 'Status & progress', [statusSeg, h('div.row', prog, progLbl), h('div.row', { style: 'gap:4px' }, [['Skim', 33], ['Close read', 67], ['Done', 100]].map(([l, v]) => h('button.btn.btn-sm.btn-ghost', { onclick: () => op({ op: 'paper.progress', id: p.id, progress: v }, { silent: true }) }, `${l} ${v}`))),
        h('div.kv', h('span.k', 'Rating'), stars(p.rating || 0, v => upd({ rating: v })), h('span.k', 'Planned'), h('div.row', h('input.input', { type: 'date', value: p.planned || '', style: 'max-width:150px', onchange: e => setPlanned(p, e.target.value) }), p.planned ? h('button.icon-btn.sm', { title: 'Clear date', onclick: () => setPlanned(p, '') }, icon('x')) : null),
          h('span.k', 'Estimate'), h('div.row', h('input.input', { type: 'number', min: 5, step: 5, value: p.est_minutes || 60, style: 'max-width:90px', onchange: e => upd({ est_minutes: +e.target.value || 60 }) }), h('span.small.muted', 'min')), h('span.k', 'Difficulty'), dots(p.difficulty || 2, v => upd({ difficulty: v })),
          h('span.k', 'Tier'), segmented([['1', 'T1'], ['2', 'T2'], ['3', 'T3']], String(p.tier), v => upd({ tier: +v }), 'sm'))]),
      highlightsSection(p),
      discussionsSection(p),
      extendedSection(p),
      dsec('member', 'Topics & source', membershipEditor(p, upd), `${paperTopics(p).length} ${paperTopics(p).length === 1 ? 'topic' : 'topics'}`),
      dsec('interest', noteL().label, [h('textarea.textarea', { placeholder: noteL().ph, value: p.interest || '', rows: 3, 'data-autosave': '1', oninput: e => autosave('interest', e.target.value) }),
        h('div.row', h('button.btn.btn-sm.btn-ghost', { onclick: async e => { e.currentTarget.disabled = true; try { await api.post('/api/interest', { ids: [p.id], force: true }); toast({ text: noteL().toast }); } catch (err) { errToast(err); } } }, icon('refresh'), noteL().redo))]),
      dsec('why', 'Why it matters', [p.why ? h('div.whybox', p.why) : h('div.faint.small', 'Not filled in yet.'), h('textarea.textarea', { placeholder: 'TL;DR: sum it up in one sentence after reading…', value: p.tldr || '', rows: 2, 'data-autosave': '1', oninput: e => autosave('tldr', e.target.value) })]),
      dsec('note', 'Quick note', h('textarea.textarea', { 'data-field': 'quick_note', 'data-autosave': '1', placeholder: 'Jot things down: the core idea, links to other papers, open questions… (autosaves)', value: p.quick_note || '', rows: 5, oninput: e => autosave('quick_note', e.target.value) }), p.quick_note ? 'Saved' : ''),
      dsec('claims', 'Claims to remember', claimsEl, `${claims.length}/5`),
      dsec('ideas', 'Questions & ideas', [ideaInp, ideas.length ? h('div.pill-list', ideas.map(i => h('div.it', h('span.k', i.kind === 'question' ? 'Q' : i.kind === 'todo' ? 'TODO' : 'IDEA'), h('span.grow', i.text), h('button.icon-btn.sm', { title: 'Delete', onclick: () => op({ op: 'idea.remove', id: i.id }, { silent: true }) }, icon('x'))))) : null], ideas.length ? String(ideas.length) : ''),
      dsec('abstract', 'Abstract', p.abstract ? h('div.abstract', p.abstract) : h('div.faint.small', 'No abstract.')),
      dsec('sessions', 'Reading log', [h('div.small.muted', `${fmtMin(p.minutes_read || 0)} total${p.started ? ` · started ${p.started}` : ''}${p.finished ? ` · finished ${p.finished}` : ''} · ${paperHighlights(p.id).length} ${paperHighlights(p.id).length === 1 ? 'highlight' : 'highlights'} · ${paperDiscussions(p.id).length} ${paperDiscussions(p.id).length === 1 ? 'discussion' : 'discussions'}`), sess.length ? h('div', sess.map(x => h('div.sessrow', h('span', `${fmtMD(x.start)} ${fmtTime(x.start)}`), h('span', `${x.minutes} min`)))) : h('div.faint.small', 'No focus sessions yet.')], fmtMin(p.minutes_read || 0)),
      dsec('deep', 'Deep notes', deepBox, p.note ? h('span.mono', p.note.replace(/^notes\//, '')) : ''),
      h('div.dsec', h('div.dz', h('span.muted', 'Remove from library (files are kept)'), h('button.btn.btn-sm.btn-danger', { onclick: async () => { if (await confirmDialog(`Remove “${p.short || p.title}” from the library? The PDF and note files are kept.`, { ok: 'Remove', danger: true })) { closeDrawer(); await op({ op: 'paper.remove', id: p.id }, { silent: true }); toast({ text: 'Removed from library.' }); } } }, icon('trash'), 'Remove')))));
  // deep note (lazy)
  const deepSec = deepBox.closest('details');
  const loadDeep = async () => {
    if (deepBox.dataset.loaded) return; deepBox.dataset.loaded = '1';
    try {
      const r = await api.get(`/api/note?id=${encodeURIComponent(p.id)}`);
      const ta = h('textarea.textarea.notearea', { value: r.text || '', 'data-autosave': '1', spellcheck: 'false' });
      const saveBtn = h('button.btn.btn-sm.btn-primary', { onclick: async () => { try { await api.post('/api/note', { id: p.id, text: ta.value }); toast({ kind: 'ok', text: 'Note saved.' }); saveBtn.disabled = true; } catch (e) { errToast(e); } } }, 'Save');
      saveBtn.disabled = true; ta.addEventListener('input', () => { saveBtn.disabled = false; });
      ta.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveBtn.click(); } });
      deepBox.replaceChildren(ta, h('div.row', saveBtn, REMOTE ? null : h('button.btn.btn-sm', { onclick: () => api.post('/api/open', { path: r.path }).catch(errToast) }, icon('ext'), 'Open in editor'), h('span.faint.xs', { style: 'margin-left:auto' }, 'Markdown · Ctrl+S to save')));
    } catch (e) { deepBox.replaceChildren(h('div.faint.small', `Couldn’t load the note: ${e.message}`)); }
  };
  if (deepSec.open) loadDeep(); else deepSec.addEventListener('toggle', () => deepSec.open && loadDeep(), { once: true });
}

/* ---- drawer: highlights (from the reader) */
const HL_EXPANDED = new Set(), DISC_EXPANDED = new Set();
const QUOTE_MAX = 240;
function highlightsSection(p) {
  const hls = paperHighlights(p.id);
  const hupd = (id, fields) => op({ op: 'highlight.update', id, fields }, { silent: true, noReload: true }).catch(() => reload());
  const rows = hls.map(x => {
    const long = (x.quote || '').length > QUOTE_MAX, open = HL_EXPANDED.has(x.id);
    const qEl = h('div.hlq', long && !open ? x.quote.slice(0, QUOTE_MAX).trimEnd() + '…' : (x.quote || h('span.faint', 'No quote, note only')));
    const more = long ? h('button.btn.btn-sm.btn-ghost.more', { onclick: () => { open ? HL_EXPANDED.delete(x.id) : HL_EXPANDED.add(x.id); renderDrawer(); } }, open ? 'less' : 'more') : null;
    const row = h('div.hl', { class: `c-${x.color || 'yellow'}`, 'data-id': x.id },
      h('div.hlhead', chip(`p. ${x.page || 1}`, 'mono'), h('span.faint.xs', fmtMD(x.created)), h('span.grow'),
        h('div.cdots', { role: 'group', 'aria-label': 'Highlight color' }, HL_COLORS.map(c => h('button.cdot', { class: `c-${c}`, title: c, 'aria-label': `Color ${c}`, 'aria-pressed': String((x.color || 'yellow') === c), onclick: async () => { if (c === x.color) return; row.className = `hl c-${c}`; row.querySelectorAll('.cdot').forEach(b => b.setAttribute('aria-pressed', String(b.classList.contains(`c-${c}`)))); await hupd(x.id, { color: c }); x.color = c; } }))),
        h('button.icon-btn.sm', { title: 'Go to page in the reader', 'aria-label': 'Go to page', onclick: e => gotoPage(p, x.page || 1, e.currentTarget) }, icon('pdf')),
        h('button.icon-btn.sm', { title: 'Copy quote', 'aria-label': 'Copy quote', onclick: () => copyText(x.quote || x.note || '', 'Quote copied.') }, icon('copy')),
        h('button.icon-btn.sm', { title: 'Delete highlight', 'aria-label': 'Delete highlight', onclick: async () => { if (await confirmDialog('Delete this highlight? The PDF is not changed.', { ok: 'Delete', danger: true })) { await op({ op: 'highlight.remove', id: x.id }, { silent: true }); toast({ text: 'Highlight deleted.' }); } } }, icon('trash'))),
      h('div.hlqwrap', qEl, more),
      h('textarea.textarea.hlnote', { rows: 1, placeholder: 'Add a note…', value: x.note || '', 'data-autosave': '1', 'aria-label': 'Highlight note', oninput: debounce(e => hupd(x.id, { note: e.target.value }), 600) }));
    return row;
  });
  const exportBtn = hls.length ? h('button.btn.btn-sm.btn-ghost', { title: 'Copy all highlights and notes of this paper as Markdown', onclick: e => { e.preventDefault(); e.stopPropagation(); copyHighlights(p); } }, icon('copy'), 'Export as Markdown') : null;
  return dsec('highlights', 'Highlights', hls.length ? h('div.hls', rows) : h('div.faint.small', 'Select text in the reader to save a highlight.'), [exportBtn, h('span', hls.length ? String(hls.length) : '')]);
}
/* ---- drawer: discussion digests (written when a reading session with the assistant ends) */
function extendedSection(p) {
  const parent = extendedFrom(p), kids = extendedOf(p.id).filter(q => !(parent && q.id === parent.id)).sort((a, b) => a.tier - b.tier || (a.year || 0) - (b.year || 0));
  const row = q => h('div.extrow', { onclick: () => openDrawer(q.id) }, h('span.statusdot', { class: q.status }), h('div.grow', h('div.ttl', h('b', q.short || q.title), h('span.faint.small', q.year ? ` ${q.year}` : '')), h('div.faint.xs.ellip', q.title)), tierChipFor(q), readButton(q, { sm: true }));
  const add = h('button.btn.btn-sm', { onclick: () => openAddPaper({ from: p }) }, icon('plus'), 'Add extended reading');
  return dsec('extended', 'Extended reading', [
    parent ? h('div.faint.small', { style: 'margin-bottom:6px' }, 'Follow-up of ', h('a', { href: '#', onclick: e => { e.preventDefault(); openDrawer(parent.id); } }, parent.short || parent.title)) : null,
    kids.length ? h('div.extlist', kids.map(row)) : h('div.faint.small', 'Papers this one leads to (citations worth following, related work) show up here as T3 extended reading.'),
    h('div.row', { style: 'margin-top:8px' }, add)], kids.length ? String(kids.length) : '');
}
function discussionsSection(p) {
  const ds = paperDiscussions(p.id);
  const cards = ds.map(d => {
    const open = DISC_EXPANDED.has(d.id), md = mdLite(d.summary, { maxLines: open ? 0 : 6 });
    const tr = d.transcript || '', hiddenPath = !tr || tr.split('/').some(part => part.startsWith('.'));
    return h('div.disc', { 'data-id': d.id },
      h('div.dh', h('span.d', fmtDateZh(d.date) || fmtMD(d.created)), h('span.faint', `${d.minutes ? ` · ${d.minutes} min` : ''}${d.turns ? ` · ${d.turns} ${d.turns === 1 ? 'turn' : 'turns'}` : ''}`), h('span.grow'),
        h('button.icon-btn.sm', { title: 'Copy digest', 'aria-label': 'Copy digest', onclick: () => copyText(d.summary || '', 'Digest copied.') }, icon('copy')),
        h('button.icon-btn.sm', { title: 'Delete digest', 'aria-label': 'Delete digest', onclick: async () => { if (await confirmDialog('Delete this discussion digest? The transcript file is kept.', { ok: 'Delete', danger: true })) { await op({ op: 'discussion.remove', id: d.id }, { silent: true }); toast({ text: 'Digest deleted.' }); } } }, icon('trash'))),
      md.el,
      (md.truncated || open) && md.total > 6 ? h('button.btn.btn-sm.btn-ghost.more', { onclick: () => { open ? DISC_EXPANDED.delete(d.id) : DISC_EXPANDED.add(d.id); renderDrawer(); } }, open ? 'Show less' : `Show more (${md.total - 6} more lines)`) : null,
      tr && !REMOTE ? h('div.row', { style: 'gap:8px;align-items:center' }, h('button.btn.btn-sm', { onclick: () => (hiddenPath ? api.post('/api/reading/transcript', { id: d.id }) : api.post('/api/open', { path: tr })).catch(errToast) }, icon('ext'), 'Open transcript'), h('span.faint.xs.tr', tr)) : null);
  });
  return dsec('discussions', 'Discussions', ds.length ? h('div.discs', cards) : h('div.faint.small', 'After a reading session with the assistant, a digest of the discussion lands here.'), ds.length ? String(ds.length) : '');
}

function membershipEditor(p, upd) {
  const cur = paperTopics(p);
  const list = h('div.topiccheck', S.L.topics.map(t => h('label', checkbox({ checked: cur.includes(t.id), label: t.name || t.zh, onChange: v => {
    let next = v ? [...cur, t.id] : cur.filter(x => x !== t.id); next = uniq(next);
    const primary = next.includes(p.topic) ? p.topic : (next[0] || '');
    next = [primary, ...next.filter(x => x !== primary)].filter(Boolean);
    upd({ topic: primary, topics: next });
  } }), h('span', `${t.emoji || ''} ${t.name || t.zh}`), t.id === p.topic ? h('span.pri', 'Primary') : null)));
  const svs = (p.surveys || []).map(id => (S.L.surveys || []).find(s => s.id === id)).filter(Boolean);
  const kw = h('input.input', { value: (p.keywords || []).join(', '), placeholder: 'Keywords, comma-separated', 'data-autosave': '1', onchange: e => upd({ keywords: e.target.value.split(/[,，]/).map(x => x.trim()).filter(Boolean).slice(0, 20) }) });
  const rel = (p.related || []).map(paperById).filter(Boolean);
  return [h('div.label', 'Topics (pick any; the first is primary)'), list,
    h('div.label', { style: 'margin-top:4px' }, 'Survey batch'), svs.length ? h('div.row.wrap', { style: 'gap:4px' }, svs.map(sv => h('button.chip.btnchip', { title: sv.query || '', onclick: () => { MAP.group = 'survey'; store.set('mapGroup', 'survey'); MAP.isolate = sv.id; go('map'); } }, `${(sv.created || '').slice(0, 10)} · ${(sv.direction || {}).name || (sv.topic || {}).name || sv.query}`))) : h('div.faint.small', p.source === 'curated' ? 'Original reading list' : p.source === 'radar' ? 'From radar' : 'Added manually'),
    h('div.label', { style: 'margin-top:4px' }, 'Keywords'), kw, (p.keywords || []).length ? h('div.row.wrap', { style: 'gap:4px' }, p.keywords.map(k => chip(k, 'outline'))) : null,
    rel.length ? [h('div.label', { style: 'margin-top:4px' }, `Citation links (${rel.length})`), h('div.row.wrap', { style: 'gap:4px' }, rel.map(r => h('button.chip.btnchip', { onclick: () => openDrawer(r.id) }, r.short || r.title)))] : null];
}

/* ============================================================ add paper */
function openAddPaper(pre = {}) {
  const f = {}; const from = pre.from || null;
  const inp = (k, ph, type = 'text', extra = {}) => (f[k] = h('input.input', { placeholder: ph, type, ...extra }));
  const topics = S.L.topics;
  const idEl = inp('id', 'e.g. 1612.00796 or an arXiv URL');
  const status = h('div.faint.xs');
  const fetchMeta = async () => {
    const raw = idEl.value.trim(); if (!raw) return;
    const m = /(\d{4}\.\d{4,5})(v\d+)?/.exec(raw) || /([a-z-]+(?:\.[A-Z]{2})?\/\d{7})/.exec(raw);
    if (!m) return;
    const aid = m[1]; idEl.value = aid;
    if (f.title.value.trim()) return;
    status.textContent = 'Looking it up on arXiv…'; [f.title, f.authors, f.year, f.venue].forEach(x => x.classList.add('skeleton'));
    try {
      const r = await api.get(`/api/arxiv?id=${encodeURIComponent(aid)}`), p = r.paper;
      f.title.value = p.title; f.authors.value = (p.authors || []).join(', '); f.year.value = p.year || ''; f.venue.value = p.venue || ''; f.arxiv.value = p.arxiv || ''; f.short.value = f.short.value || p.short || ''; f.abstract = p.abstract || ''; f.tags = p.tags || [];
      status.textContent = 'Filled in from arXiv.';
    } catch (e) { status.textContent = `Not found: ${e.message}`; }
    finally { [f.title, f.authors, f.year, f.venue].forEach(x => x.classList.remove('skeleton')); }
  };
  idEl.addEventListener('blur', fetchMeta); idEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fetchMeta(); } });
  const body = h('div.formgrid',
    h('div.field.full', h('label', 'arXiv id / URL (optional)'), h('div.row', idEl, h('button.btn', { onclick: fetchMeta }, 'Look up')), status),
    h('div.field.full', h('label', 'Title'), inp('title', 'Paper title')),
    h('div.field', h('label', 'Short name'), inp('short', 'e.g. EWC')),
    h('div.field', h('label', 'Authors (comma-separated)'), inp('authors', 'Kirkpatrick, Pascanu, …')),
    h('div.field', h('label', 'Year'), inp('year', '2017', 'number')),
    h('div.field', h('label', 'Venue'), inp('venue', 'PNAS 2017')),
    h('div.field.full', h('label', 'arXiv link'), inp('arxiv', 'https://arxiv.org/abs/…')),
    h('div.field', h('label', 'Topic'), (f.topic = h('select.select', topics.map(t => h('option', { value: t.id, selected: t.id === (from ? from.topic : (S.lib.topic !== 'all' ? S.lib.topic : topics[0] && topics[0].id)) }, `${t.emoji || ''} ${t.name || t.zh}`)), h('option', { value: '' }, '(Uncategorized)')))),
    h('div.field', h('label', 'Importance'), (f.tier = h('select.select', [1, 2, 3].map(t => h('option', { value: t, selected: t === (from ? 3 : (pre.tier || 2)) }, `T${t} ${TIER_ZH[t]} - ${TIER_DESC[t]}`))))),
    from ? h('div.field.full', h('div.faint.small', icon('book'), ` Extended reading from “${from.short || from.title}” - it will be linked to that paper and inherit its topic.`)) : null,
    h('div.field.full', h('label', noteL().label), (f.interest = h('textarea.textarea', { rows: 2, placeholder: noteL().ph2 }))),
    h('div.field.full', h('label', 'Why it matters'), (f.why = h('textarea.textarea', { rows: 2, placeholder: 'One or two sentences: why read this one?' }))));
  const dlg = openDialog({
    title: from ? `Add extended reading for “${from.short || from.title}”` : 'Add paper', body, cls: 'lg',
    actions: [{ el: h('button.btn', { onclick: () => dlg.closeDlg() }, 'Cancel') }, { el: h('button.btn.btn-primary', { onclick: async e => {
      const title = f.title.value.trim(); if (!title) { f.title.focus(); toast({ kind: 'warn', text: 'Please enter a title.' }); return; }
      let id = idEl.value.trim() || `manual:${Date.now().toString(36)}`;
      const paper = { id, title, short: f.short.value.trim() || title.split(/[:：]/)[0].slice(0, 24), authors: f.authors.value.split(/[,，]/).map(x => x.trim()).filter(Boolean), year: +f.year.value || 0, venue: f.venue.value.trim(), arxiv: f.arxiv.value.trim() || (/^\d{4}\.\d{4,5}$/.test(id) ? `https://arxiv.org/abs/${id}` : ''), topic: f.topic.value, tier: +f.tier.value, why: f.why.value.trim(), interest: f.interest.value.trim(), abstract: f.abstract || '', tags: f.tags || [], source: from ? `extended:${from.id}` : 'manual', related: from ? [from.id] : [], topics: from ? uniq([f.topic.value, ...paperTopics(from)].filter(Boolean)) : (f.topic.value ? [f.topic.value] : []) };
      try { await op({ op: 'paper.add', paper }, { el: e.currentTarget, silent: true }); dlg.closeDlg(); toast({ kind: 'ok', text: `“${paper.short}” added to library` }); celebrateConfetti(false); blip(); if (paper.arxiv) api.post('/api/download', { id }).catch(() => { }); }
      catch (err) { /* errToast already shown */ }
    } }, 'Add to library') }],
  });
  setTimeout(() => idEl.focus(), 50);
}

/* ============================================================ page: plan */
let DRAG = null;
function planCard(p, { month = false } = {}) {
  const t = todayStr(), late = p.planned < t && !DONE.has(p.status);
  const card = h('div.pcard', { draggable: true, class: `${DONE.has(p.status) ? 'done' : ''} ${late ? 'late' : ''}`, title: p.title, tabindex: 0, 'data-id': p.id,
    ondragstart: e => { DRAG = { kind: 'paper', id: p.id }; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id); },
    ondragend: () => { DRAG = null; card.classList.remove('dragging'); $$('.daycol.over,.mday.over').forEach(x => x.classList.remove('over')); },
    onclick: () => openDrawer(p.id), onkeydown: e => { if (e.key === 'Enter' && !e.isComposing) openDrawer(p.id); } },
    h('b', p.short || p.title), h('div.m', chip(`T${p.tier}`, `t${p.tier}`, TIER_ZH[p.tier]), h('span', `${p.est_minutes || 60} min`)),
    h('div.acts', h('button.icon-btn.sm', { title: 'Change date', onclick: e => { e.stopPropagation(); datePopover(e.currentTarget, p.planned, d => setPlanned(p, d)); } }, icon('cal')), h('button.icon-btn.sm', { title: 'Unschedule', onclick: e => { e.stopPropagation(); setPlanned(p, ''); } }, icon('x'))));
  return card;
}
function dropTarget(el, date) {
  el.addEventListener('dragover', e => { if (DRAG && DRAG.kind === 'paper') { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('over'); } });
  el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('over'); });
  el.addEventListener('drop', async e => { e.preventDefault(); el.classList.remove('over'); const id = (DRAG && DRAG.id) || e.dataTransfer.getData('text/plain'); DRAG = null; const p = paperById(id); if (p && p.planned !== date) await setPlanned(p, date); });
}
function renderPlan() {
  const pl = S.plan, st = settings(), t = todayStr(), goal = st.daily_goal_minutes || 45, work = new Set(st.work_days || [1, 2, 3, 4, 5]);
  pageHeader('Plan', `Daily goal ${goal} min · Work days ${[...work].sort().map(d => WD[d % 7]).join(', ')}`, [h('button.btn', { onclick: () => reminderForm() }, icon('bell'), 'New reminder'), h('button.btn.btn-primary', { onclick: autoSchedule }, icon('sparkles'), 'Auto-schedule')]);
  const planned = S.L.papers.filter(p => p.planned);
  const byDay = {}; for (const p of planned) (byDay[p.planned] ||= []).push(p);
  let board;
  const nav = h('div.row', { style: 'margin-bottom:12px;flex-wrap:wrap' }, segmented([['week', 'This week'], ['next', 'Next week'], ['month', 'Month']], pl.mode, v => { pl.mode = v; pl.offset = v === 'next' ? 1 : 0; render(); }),
    h('span.grow'), h('button.icon-btn.sm', { title: 'Previous', onclick: () => { pl.offset--; render(); } }, icon('back')), h('button.btn.btn-sm.btn-ghost', { onclick: () => { pl.offset = pl.mode === 'next' ? 1 : 0; render(); } }, 'Back to today'), h('button.icon-btn.sm', { title: 'Next', onclick: () => { pl.offset++; render(); } }, icon('chev')));
  if (pl.mode === 'month') {
    const base = new Date(t + 'T00:00:00'); base.setDate(1); base.setMonth(base.getMonth() + pl.offset);
    const y = base.getFullYear(), m = base.getMonth(), first = localISO(base), startIso = mondayOf(first);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(startIso, i), inMonth = +d.slice(5, 7) === m + 1, ps = (byDay[d] || []).sort((a, b) => a.tier - b.tier);
      const cell = h('div.mday', { class: `${inMonth ? '' : 'out'} ${d === t ? 'today' : ''}`, onclick: e => { if (e.target === cell || e.target.classList.contains('d')) queuePicker(d); } }, h('b.d', +d.slice(8, 10)), ps.map(p => planCard(p, { month: true })));
      dropTarget(cell, d); cells.push(cell);
    }
    board = h('div', h('div.row.between', { style: 'margin-bottom:8px' }, h('h2', new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })), h('span.faint.xs', 'Click a day to pick from the queue; drag cards to move them')), h('div.monthgrid', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(w => h('div.faint.xs', { style: 'text-align:center;padding:2px' }, w)), cells));
  } else {
    const start = addDays(mondayOf(t), pl.offset * 7);
    const cols = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i), ps = (byDay[d] || []).sort((a, b) => a.tier - b.tier), mins = ps.filter(p => !DONE.has(p.status)).reduce((a, p) => a + (p.est_minutes || 60), 0);
      const over = mins > goal * 1.5, wd = i + 1;
      const col = h('div.daycol', { class: `${work.has(wd) ? 'work' : 'off'} ${d === t ? 'today' : ''}` },
        h('div.dh', h('span', WD[(i + 1) % 7]), h('b', +d.slice(8, 10)), h('button.icon-btn.sm.add', { title: 'Add paper', 'aria-label': `Add a paper on ${fmtMD(d)}`, onclick: () => queuePicker(d) }, icon('plus'))),
        h('div.items', ps.map(p => planCard(p))),
        h('div.df', { class: over ? 'warn' : '', title: over ? 'Over 1.5× the daily goal; this may be too much' : '' }, over ? icon('bell', '') : null, mins ? `${mins} / ${goal} min` : h('span.faint', `— / ${goal} min`)));
      dropTarget(col, d); return col;
    });
    board = h('div', h('div.row.between', { style: 'margin-bottom:8px' }, h('h2', `${fmtMD(start)} – ${fmtMD(addDays(start, 6))}`), h('span.faint.xs', 'Drag cards between days')), h('div.week', cols));
  }
  // queue panel
  const q = (S.L.queue || []).map(paperById).filter(Boolean);
  const queueEl = h('div.queue', q.length ? q.map((p, i) => queueRow(p, i)) : emptyState('The queue is empty. Add papers from the Library with “+”.', h('button.btn.btn-sm', { onclick: () => go('library') }, 'Go to Library'), 'queue'));
  const qTotal = q.filter(p => !DONE.has(p.status)).reduce((a, p) => a + (p.est_minutes || 60), 0);
  const queueCard = h('section.card', h('div.cardhead', h('h2', { class: 'small muted' }, 'Queue'), h('span.faint.xs', { style: 'margin-left:auto' }, q.length ? `${q.length} ${q.length === 1 ? 'paper' : 'papers'} · ~${fmtMin(qTotal)}` : '')), h('div', { style: 'padding:8px 12px 12px' }, queueEl, q.length ? h('div.row', { style: 'margin-top:10px' }, h('button.btn.btn-sm', { onclick: autoSchedule }, icon('sparkles'), 'Auto-schedule'), h('span.faint.xs', 'Spread across work days by estimated time')) : null));
  // reminders panel
  const rems = [...(S.L.reminders || [])].sort((a, b) => (a.done - b.done) || a.when.localeCompare(b.when));
  const remCard = h('section.card', h('div.cardhead', h('h2', { class: 'small muted' }, 'Reminders'), h('button.icon-btn.sm', { style: 'margin-left:auto', title: 'New reminder', onclick: () => reminderForm() }, icon('plus'))), h('div', { style: 'padding:4px 12px 12px' }, rems.length ? rems.map(r => reminderRow(r)) : h('div.muted.small', { style: 'padding:8px 0' }, 'No reminders right now.')));
  return h('div', nav, h('div.plangrid', board, h('div.sidepanel', queueCard, remCard)));
}
function queueRow(p, i) {
  const row = h('div.qrow', { draggable: true, 'data-id': p.id,
    ondragstart: e => { DRAG = { kind: 'queue', id: p.id }; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id); },
    ondragend: () => { DRAG = null; row.classList.remove('dragging'); $$('.qrow.over').forEach(x => x.classList.remove('over')); },
    ondragover: e => { if (DRAG && DRAG.kind === 'queue' && DRAG.id !== p.id) { e.preventDefault(); row.classList.add('over'); } },
    ondragleave: () => row.classList.remove('over'),
    ondrop: async e => { e.preventDefault(); row.classList.remove('over'); if (!DRAG || DRAG.kind !== 'queue') return; const ids = [...S.L.queue]; const from = ids.indexOf(DRAG.id), to = ids.indexOf(p.id); if (from < 0 || to < 0) return; ids.splice(from, 1); ids.splice(to, 0, DRAG.id); DRAG = null; await op({ op: 'queue.set', ids }, { silent: true }); } },
    h('span.handle', { title: 'Drag to reorder' }, icon('grip')), h('span.n', i + 1), h('span.statusdot', { class: p.status }),
    h('span.ttl', { title: p.title, onclick: () => openDrawer(p.id), style: 'cursor:pointer' }, p.short || p.title, h('small', `${p.est_minutes || 60} min`)),
    h('div.row', { style: 'gap:0' }, h('button.icon-btn.sm', { title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: async () => { const ids = [...S.L.queue]; ids.splice(i, 1); ids.splice(i - 1, 0, p.id); await op({ op: 'queue.set', ids }, { silent: true }); } }, icon('up')),
      h('button.icon-btn.sm', { title: 'Remove from queue', 'aria-label': 'Remove from queue', onclick: async () => { await op({ op: 'queue.remove', id: p.id }, { silent: true }); toast({ text: `“${p.short || p.title}” removed from queue`, action: { label: 'Undo', fn: () => op({ op: 'queue.add', id: p.id, index: i }, { silent: true }) } }); } }, icon('x'))));
  return row;
}
function autoSchedule() {
  const st = settings(), goal = st.daily_goal_minutes || 45, work = new Set(st.work_days || [1, 2, 3, 4, 5]), t = todayStr();
  const q = (S.L.queue || []).map(paperById).filter(p => p && !DONE.has(p.status));
  const todo = q.filter(p => !p.planned || p.planned < t);
  if (!todo.length) { toast({ text: q.length ? 'Everything in the queue already has a date.' : 'The queue is empty. Add a few papers first.' }); return; }
  const load = {}; for (const p of S.L.papers) if (p.planned && p.planned >= t && !DONE.has(p.status) && !todo.includes(p)) load[p.planned] = (load[p.planned] || 0) + (p.est_minutes || 60);
  const plan = []; let d = t, guard = 0;
  const usedToday = S.D.minutes_today || 0;
  for (const p of todo) {
    while (guard++ < 400) {
      const wd = isoWeekday(d), cap = goal - (load[d] || 0) - (d === t ? usedToday : 0);
      if (work.has(wd) && (cap >= (p.est_minutes || 60) || (cap >= goal * .6 && (p.est_minutes || 60) > goal))) break;
      d = addDays(d, 1);
    }
    plan.push({ p, date: d }); load[d] = (load[d] || 0) + (p.est_minutes || 60);
    if ((p.est_minutes || 60) > goal) d = addDays(d, 1);
  }
  const time = /^\d{2}:\d{2}$/.test(st.morning_briefing || '') ? st.morning_briefing : '09:00';
  const remind = h('input', { type: 'checkbox', checked: true });
  const dlg = openDialog({
    title: 'Auto-schedule preview', cls: 'sm',
    body: h('div.col', { style: 'gap:10px' }, h('p.muted.small', `Papers are spread across work days by estimated time and your daily goal (${goal} min). Papers already scheduled for a future date are left alone.`), h('div.preview', plan.map(({ p, date }) => h('div.d', h('span.k', `${relDate(date)} ${fmtMD(date)}`), h('span', `${p.short || p.title} `, h('span.faint', `${p.est_minutes || 60} min`))))), h('label.row.small', h('span.switch', remind, h('span.tr')), `Also add reminders at ${time}`)),
    actions: [{ el: h('button.btn', { onclick: () => dlg.closeDlg() }, 'Cancel') }, { el: h('button.btn.btn-primary', { onclick: async () => {
      dlg.closeDlg();
      const list = [];
      for (const { p, date } of plan) { list.push({ op: 'paper.update', id: p.id, fields: { planned: date } }); if (remind.checked) list.push({ op: 'reminder.add', reminder: { when: `${date}T${time}:00`, paper: p.id, kind: 'read', repeat: 'none' } }); }
      try { await ops(list); toast({ kind: 'ok', text: `Scheduled ${plan.length} ${plan.length === 1 ? 'paper' : 'papers'}.` }); blip(); } catch (e) { errToast(e); }
    } }, `Apply (${plan.length})`) }],
  });
}
function reminderForm(r) {
  const d = r ? new Date(r.when) : new Date(Date.now() + 3600000); d.setSeconds(0, 0);
  const whenV = `${localISO(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const title = h('input.input', { value: r ? r.title : '', placeholder: 'e.g. Read EWC' });
  const when = h('input.input', { type: 'datetime-local', value: whenV });
  const repeat = h('select.select', [['none', 'No repeat'], ['daily', 'Daily'], ['weekly', 'Weekly']].map(([v, l]) => h('option', { value: v, selected: (r ? r.repeat : 'none') === v }, l)));
  const paper = h('select.select', h('option', { value: '' }, '(No paper)'), S.L.papers.filter(p => !DONE.has(p.status) || (r && r.paper === p.id)).map(p => h('option', { value: p.id, selected: r && r.paper === p.id }, `${p.short || p.title}`)));
  const dlg = openDialog({
    title: r ? 'Edit reminder' : 'New reminder', cls: 'sm',
    body: h('div.col', { style: 'gap:10px' }, h('div.field', h('label', 'Title'), title), h('div.field', h('label', 'Time'), when), h('div.field', h('label', 'Repeat'), repeat), h('div.field', h('label', 'Paper'), paper)),
    actions: [{ el: h('button.btn', { onclick: () => dlg.closeDlg() }, 'Cancel') }, { el: h('button.btn.btn-primary', { onclick: async () => {
      if (!when.value) { when.focus(); return; }
      const fields = { title: title.value.trim(), when: when.value.length === 16 ? when.value + ':00' : when.value, repeat: repeat.value, paper: paper.value || null };
      dlg.closeDlg();
      if (r) await op({ op: 'reminder.update', id: r.id, fields }, { silent: true }); else await op({ op: 'reminder.add', reminder: { ...fields, kind: fields.paper ? 'read' : 'custom' } }, { silent: true });
      toast({ kind: 'ok', text: r ? 'Reminder updated.' : `Reminder set for ${fmtWhen(fields.when)}` });
    } }, r ? 'Save' : 'Create') }],
  });
  setTimeout(() => title.focus(), 50);
}

/* ============================================================ Yan console (in-app Claude terminal)
   Claude Code runs in a pseudo-terminal on the library computer; this panel attaches to it with xterm.js.
   Output: SSE /api/term/stream (base64 chunks, full replay on re-attach). Input: POST /api/term/input. */
let XTERM_P = null, CONSOLE = null;
function loadXterm() {
  if (window.Terminal && window.FitAddon) return Promise.resolve();
  if (!XTERM_P) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/app/ui/vendor/xterm/xterm.css'; document.head.appendChild(link);
    const js = src => new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error(`Could not load ${src}`)); document.head.appendChild(el); });
    XTERM_P = js('/app/ui/vendor/xterm/xterm.js').then(() => js('/app/ui/vendor/xterm/addon-fit.js')).catch(e => { XTERM_P = null; throw e; });
  }
  return XTERM_P;
}
function refreshTerms() {
  return api.get('/api/term/list').then(r => {
    const sig = () => JSON.stringify([(S.terms || []).map(({ last_io, clients, ...t }) => t), S.terminals || [], S.expertTerminals || []]);   // last_io/clients change whenever Claude prints: not worth a re-render
    const before = sig(); S.terms = r.sessions || []; S.terminals = r.terminals || []; S.expertTerminals = r.expert_terminals || [];
    if ((S.page === 'explore' || S.page === 'assistant' || S.page === 'expert') && sig() !== before) { if (typingInProgress()) deferRender(); else render(); }
  }).catch(() => { });
}
const termFor = rid => (S.terms || []).find(t => t.request === rid && t.alive);
const assistantFor = pid => (S.terms || []).find(t => t.kind === 'assistant' && t.paper === pid && t.alive);
const expertFor = xid => (S.terms || []).find(t => t.kind === 'expert' && t.expert === xid && t.alive);
const consoleSize = () => ({ cols: Math.max(80, Math.min(220, Math.floor((Math.min(window.innerWidth, 1400) - 80) / 8))), rows: Math.max(18, Math.floor((window.innerHeight - 190) / 17)) });
async function startConsole(kind, requestId) {
  const cols = Math.max(80, Math.min(220, Math.floor((Math.min(window.innerWidth, 1400) - 80) / 8))), rows = Math.max(18, Math.floor((window.innerHeight - 190) / 17));
  const r = await api.post('/api/term/start', { kind, request_id: requestId, cols, rows });
  S.terms = [...(S.terms || []).filter(t => t.id !== r.session.id), r.session];
  openConsole(r.session);
  return r.session;
}
async function openConsole(info) {
  if (CONSOLE) { if (CONSOLE.id === info.id) { CONSOLE.focus(); return; } CONSOLE.close(); }
  CONSOLE = { id: info.id, close() { CONSOLE = null; }, focus() { } }; // placeholder: a second click while xterm.js loads must not open a second panel
  try { await loadXterm(); } catch (e) { errToast(e); if (CONSOLE && CONSOLE.id === info.id) CONSOLE = null; return; }
  if (!CONSOLE || CONSOLE.id !== info.id) return; // closed or replaced while loading
  const sid = info.id, client = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).replace(/-/g, '').slice(0, 16);
  let ended = !info.alive, pending = '', flushT = null, lastSize = '', lease = null;
  const status = h('span.termstatus', 'Connecting…');
  const endBtn = h('button.btn.btn-sm', { title: 'Stop Claude and end this session', onclick: async () => { if (ended) { close(); return; } if (await confirmDialog(info.kind === 'expert' ? 'End this session? The discussion stays on the Expert page and Continue picks it up later.' : 'End this Claude session? Anything it has not saved is lost.', { ok: 'End session', danger: true })) api.post('/api/term/kill', { id: sid }).catch(errToast); } }, ended ? 'Close' : 'End session');
  const host = h('div.termhost');
  const panel = h('div.termpanel', { role: 'dialog', 'aria-label': `${persona()} console` },
    h('div.termhead', h('span.livedot'), h('b', `${persona()} console`), h('span.mono.faint.ellip.grow.small', info.title || ''), status, endBtn,
      h('button.btn.btn-sm.btn-primary', { title: 'Hide this panel; the session keeps running', onclick: () => close() }, 'Hide')),
    host,
    h('div.termfoot', `Your keys go to Claude (Esc, Ctrl+C, arrows, Enter). Hide keeps the session running on the library computer; reopen it from ${info.kind === 'expert' ? 'the Expert page' : info.kind === 'assistant' ? 'the Assistant page' : 'Explore'}. When two windows are attached, the smaller one sets the size.`));
  const wrap = h('div.termwrap', panel);
  panel.addEventListener('click', e => { if (!e.target.closest('button')) term.focus(); }); // keys must go to Claude, not to the page's shortcuts
  document.body.appendChild(wrap);
  const term = new Terminal({ cursorBlink: true, fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace', fontSize: 13, lineHeight: 1.15, scrollback: 10000,
    theme: { background: '#14161c', foreground: '#e6e6e6', cursor: '#e6e6e6', selectionBackground: '#3b4252' } });
  const fit = new FitAddon.FitAddon(); term.loadAddon(fit); term.open(host);
  const fitNow = () => { try { fit.fit(); } catch { } };
  const postSize = () => api.post('/api/term/resize', { id: sid, cols: term.cols, rows: term.rows, client }, 15000).catch(() => { });
  const sendResize = () => { fitNow(); const k = `${term.cols}x${term.rows}`; if (k === lastSize || ended) return; lastSize = k; postSize(); };
  const ro = new ResizeObserver(debounce(sendResize, 100)); ro.observe(host);
  lease = setInterval(() => { if (!ended && !document.hidden) postSize(); }, 30000); // renews this window's size lease; a window that went to sleep (or is in a background tab) stops setting the pty size
  const onVis = () => { if (!document.hidden && !ended) postSize(); }; document.addEventListener('visibilitychange', onVis);
  const outq = []; let sending = false;
  async function pump() { // keystrokes go out in order; a chunk lost on a flaky tunnel is retried, never silently dropped
    if (sending) return; sending = true;
    while (outq.length && !ended) {
      const d = outq[0]; let ok = false;
      for (let i = 0; i < 4 && !ok && !ended; i++) {
        try { await api.post('/api/term/input', { id: sid, data: d }, 15000); ok = true; }
        catch (e) { if (/has ended|No such console/i.test(e.message)) { ended = true; break; } status.textContent = `Input not delivered yet, retrying… (${e.message})`; await sleep(800 * (i + 1)); }
      }
      if (!ok) { if (!ended) status.textContent = 'Input failed - check the connection and type it again'; outq.length = 0; break; }
      outq.shift(); if (/^Input/.test(status.textContent)) status.textContent = 'Running';
    }
    sending = false;
  }
  const flush = () => { flushT = null; const d = pending; pending = ''; if (!d || ended) return; outq.push(d); pump(); };
  term.onData(d => { pending += d; if (!flushT) flushT = setTimeout(flush, 6); });
  const dec = b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const es = new EventSource(`/api/term/stream?id=${encodeURIComponent(sid)}&client=${client}`);
  es.addEventListener('snapshot', e => { const d = JSON.parse(e.data); term.reset(); if (d.b64) term.write(dec(d.b64)); ended = !d.info.alive; status.textContent = ended ? 'Ended' : 'Running'; endBtn.textContent = ended ? 'Close' : 'End session'; lastSize = ''; sendResize(); term.focus(); });
  es.addEventListener('data', e => term.write(dec(JSON.parse(e.data).b64)));
  es.addEventListener('exit', e => { const d = JSON.parse(e.data); ended = true; status.textContent = `Ended${d.code ? ` (exit ${d.code})` : ''}`; endBtn.textContent = 'Close'; term.write('\r\n\x1b[2m[session ended]\x1b[0m\r\n'); es.close(); refreshTerms(); });
  es.onerror = () => { if (ended) return; if (es.readyState === EventSource.CLOSED) { ended = true; status.textContent = 'Console no longer available'; endBtn.textContent = 'Close'; term.write(`\r\n\x1b[2m[console no longer available - it ended more than an hour ago, or the library server restarted; ${info.kind === 'expert' ? 'press Continue on the Expert page to pick the discussion up' : info.kind === 'assistant' ? 'reopen it from the Assistant page' : 'start a new one from Explore'}]\x1b[0m\r\n`); refreshTerms(); } else status.textContent = 'Reconnecting…'; };
  function close() { es.close(); ro.disconnect(); clearInterval(lease); document.removeEventListener('visibilitychange', onVis); clearTimeout(flushT); flush(); term.dispose(); wrap.remove(); if (CONSOLE && CONSOLE.id === sid) CONSOLE = null; }
  CONSOLE = { id: sid, close, focus: () => term.focus() };
  fitNow(); term.focus();
}

/* ============================================================ page: assistant (one Claude per paper) */
async function openAssistantFor(p) {
  const live = assistantFor(p.id);
  if (live) { openConsole(live); return; }                       // already running as a console (maybe started from the other computer): attach
  if (REMOTE) {
    if (!serverAtLeast('2.4.0')) { toast({ kind: 'warn', title: 'Library server needs a restart', text: 'It is still running the previous version, which would open the terminal on the library computer. Restart it first (see the remote guide).', timeout: 10000 }); return; }
    return openAssistantConsole(p.id);
  }
  if ((S.terminals || []).includes(p.id)) { toast({ text: `The Claude terminal for “${p.short || p.title}” is already open on this screen.` }); return; }
  try { await api.post('/api/reading/assistant', { id: p.id }); toast({ kind: 'ok', icon: 'terminal', title: `Claude terminal opened`, text: `“${p.short || p.title}” · on this screen, loaded with the paper and your notes.` }); setTimeout(refreshTerms, 1500); }
  catch (e) { errToast(e); }
}
function renderAssistant() {
  const terms = S.terms || [], termsOf = pid => terms.filter(t => t.kind === 'assistant' && t.paper === pid);
  pageHeader('Assistant', `One Claude session per paper, loaded with its full text and your notes. ${REMOTE ? 'Opens in a console panel right here; Explain and Ask in the PDF window use the same one.' : 'Opens in a terminal window on this screen; Explain and Ask in the reader send to it.'}`, []);
  const lastUse = p => { const d = paperDiscussions(p.id)[0]; return [...termsOf(p.id).map(t => t.started), d && (d.created || d.date), p.chat_session ? p.last_opened : null].filter(Boolean).sort().pop() || ''; };
  const rows = S.L.papers.filter(p => p.chat_session || termsOf(p.id).length || (S.R && S.R.paper === p.id) || (S.terminals || []).includes(p.id));
  rows.sort((a, b) => ((S.R && S.R.paper === b.id) - (S.R && S.R.paper === a.id)) || lastUse(b).localeCompare(lastUse(a)));
  const row = (p, { picker = false } = {}) => {
    const live = assistantFor(p.id), ended = termsOf(p.id).filter(t => !t.alive).sort((a, b) => (b.ended || '').localeCompare(a.ended || ''))[0];
    const term = (S.terminals || []).includes(p.id), reading = S.R && S.R.paper === p.id, tp = topicById(p.topic), nD = paperDiscussions(p.id).length;
    const status = live ? chip('Running', 'accent') : term ? chip('Terminal open here', 'ok') : ended ? chip('Ended', '') : picker ? null : chip('Idle', '');
    const notes = [tp ? `${tp.emoji || ''} ${tp.name || tp.zh}`.trim() : null, nD ? `${nD} ${nD === 1 ? 'discussion' : 'discussions'} saved` : null, lastUse(p) ? `last ${relWhen(lastUse(p))}` : null,
      live && !REMOTE ? 'running as a console (started from the other computer); Open attaches to it here' : null,
      term && REMOTE ? 'open in a terminal window on the library computer; close it there to use it here' : null].filter(Boolean);
    return h('div.reqcard', { 'data-id': p.id },
      h('div.row', h('span.livedot', { class: live || term ? '' : 'off' }),
        h('div.grow', { style: 'min-width:0' }, h('div.row', { style: 'gap:8px' }, h('b.ellip', p.short || p.title), reading ? chip('Reading now', 'accent') : null), p.short && p.title !== p.short ? h('div.small.muted.ellip', p.title) : null),
        status,
        h('button.btn.btn-sm', { class: live || reading ? 'btn-primary' : '', title: live ? 'Attach to the running session' : REMOTE ? 'Open Claude in a console panel here' : 'Open a Claude terminal on this screen', onclick: () => openAssistantFor(p) }, icon('terminal'), live ? 'Open' : REMOTE ? 'Open Claude' : 'Open terminal'),
        live ? h('button.btn.btn-sm.btn-ghost', { title: 'Stop Claude and end this session', onclick: async () => { if (await confirmDialog(`End the Claude session for “${p.short || p.title}”? Anything it has not saved is lost.`, { ok: 'End session', danger: true })) api.post('/api/term/kill', { id: live.id }).catch(errToast); } }, 'End') : null,
        !live && ended ? h('button.btn.btn-sm.btn-ghost', { title: 'Show what the last session printed', onclick: () => openConsole(ended) }, 'View output') : null,
        h('button.icon-btn.sm', { title: 'Paper details', 'aria-label': 'Paper details', onclick: () => { go('library'); openDrawer(p.id); } }, icon('book'))),
      notes.length ? h('div.small.muted', notes.join(' · ')) : null);
  };
  const results = h('div.col', { style: 'gap:8px;margin-top:8px' });
  const shown = new Set(rows.map(p => p.id));
  const search = h('input.input', { placeholder: 'Start with another paper… search by short name or title', 'data-autosave': '1', oninput: e => {
    const q = e.target.value.trim();
    const hits = q ? S.L.papers.map(p => [fuzzy(q, `${p.short || ''} ${p.title}`), p]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, 8).map(([, p]) => p) : [];
    results.replaceChildren(...hits.map(p => row(p, { picker: true })), q && !hits.length ? h('div.small.muted', 'No paper matches.') : null);
  } });
  const list = rows.length ? h('div.col', { style: 'gap:8px' }, rows.map(p => row(p))) : h('div.card', emptyState('No conversations yet. Press Read on a paper, or pick one below.', null, 'terminal'));
  const live = terms.filter(t => t.kind === 'assistant' && t.alive).length;
  return h('div',
    h('section', h('h2', { style: 'margin:0 0 10px' }, 'Papers with a Claude session', live ? h('span.badge.accent', { style: 'margin-left:8px' }, live) : null), list),
    h('section', { style: 'margin-top:24px' }, h('h2', { style: 'margin:0 0 8px' }, 'Another paper'), search, results),
    h('div.small.muted', { style: 'margin-top:20px' }, 'Each paper keeps one Claude chat; reopening continues it. A session that is open as a terminal window on the library computer cannot be opened as a console at the same time, and vice versa. Consoles end by themselves after 8 hours without input or output.'));
}

/* ============================================================ page: expert (one Claude conversation per discussion) */
function expertServerOk() {
  if (!serverAtLeast('2.5.0')) { toast({ kind: 'warn', title: 'Library server needs a restart', text: `It is still running a version without the Expert page. ${REMOTE ? 'Restart it first (see the remote guide).' : 'Run: systemctl --user restart paper-assistant-server'}`, timeout: 10000 }); return false; }
  return true;
}
const EXPERT_BUSY = new Set();   // discussion ids with an open() in flight (and just-launched terminal windows): one click, one Claude
async function attachExpertConsole(r, fallbackTitle) {
  await refreshTerms();
  const info = (S.terms || []).find(t => t.id === r.console) || { id: r.console, alive: true, title: fallbackTitle };
  openConsole(info);
}
async function openExpertChat(x) {
  if (EXPERT_BUSY.has(x.id)) return;
  EXPERT_BUSY.add(x.id);
  let launched = false;                                            // a terminal window: keep the guard until its bridge socket shows up
  try {
    let live = expertFor(x.id);
    if (!live) { await refreshTerms(); live = expertFor(x.id); }     // the list may be stale (a console or terminal window opened from the other computer)
    if (live) { openConsole(live); return; }                        // already running as a console: attach
    if (!expertServerOk()) return;
    if (!REMOTE && (S.expertTerminals || []).includes(x.id)) { toast({ text: `“${x.title}” is already open in a terminal window on this screen.` }); return; }
    const r = await api.post('/api/expert/open', { id: x.id, console: REMOTE, ...consoleSize() });
    if (r.console) await attachExpertConsole(r, `Expert · ${x.title}`);
    else { launched = true; toast({ kind: 'ok', icon: 'terminal', title: 'Expert terminal opened', text: `“${x.title}” · on this screen${r.resumed ? ', continuing where it stopped' : ''}.` }); setTimeout(refreshTerms, 1500); setTimeout(refreshTerms, 4000); }
  } catch (e) { errToast(e); }
  finally { if (launched) setTimeout(() => EXPERT_BUSY.delete(x.id), 4000); else EXPERT_BUSY.delete(x.id); }
}
function newExpertDialog(preset = '') {
  if (!expertServerOk()) return;
  if (document.querySelector('dialog[open]')) return;
  const title = h('input.input', { placeholder: 'Title (optional - Claude condenses your question into one otherwise)', maxlength: '80', 'aria-label': 'Title' });
  const ta = h('textarea.textarea', { rows: 7, 'data-autosave': '1', 'aria-label': 'Discussion brief', maxlength: '8000', placeholder: enUI() ? 'What do you want to discuss, and from which angle?\ne.g. “Does prompt-based continual learning really avoid forgetting, or does it move the problem to prompt selection? Take the evaluation-protocol angle.”' : 'What do you want to discuss, and from which angle?\ne.g. “我想討論 prompt-based continual learning 是否真的避免了 forgetting，還是只是把問題移到 prompt selection 上；請從 evaluation protocol 的角度切入”', onkeydown: e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.isComposing) submit(); } });
  if (preset) ta.value = preset;
  const btn = h('button.btn.btn-primary', { onclick: () => submit() }, icon('expert'), 'Start discussion');
  const dlg = openDialog({ title: 'New expert discussion', cls: 'lg', body: h('div.col', { style: 'gap:10px' },
    h('p.muted.small', { style: 'line-height:1.6;margin:0' }, 'The expert first searches for the most recent papers on your topic (arXiv, OpenAlex, Semantic Scholar), reads them, and then discusses them critically along the direction you set here. It follows your lead and does not add questions or suggestions of its own.'),
    title, ta, h('div.faint.xs', REMOTE ? 'Runs as a console panel here; Claude itself runs on the library computer. Ctrl+Enter starts.' : 'Opens a Claude terminal window on this screen. Ctrl+Enter starts.')),
    actions: [{ el: h('button.btn', { onclick: () => dlg.closeDlg() }, 'Cancel') }, { el: btn }] });
  setTimeout(() => ta.focus(), 50);
  let busy = false;
  async function submit() {
    if (busy) return;                                   // Ctrl+Enter repeats and double clicks must not start two discussions
    const context = ta.value.trim(); if (!context) { ta.focus(); return; }
    busy = true; btn.disabled = true; ta.disabled = true; title.disabled = true;
    try {
      const r = await api.post('/api/expert/new', { title: title.value.trim(), context, console: REMOTE, ...consoleSize() });
      dlg.closeDlg();
      const name = (r.chat || {}).title || '';
      if (r.console) await attachExpertConsole(r, `Expert · ${name}`);
      else toast({ kind: 'ok', icon: 'terminal', title: 'Expert terminal opened', text: `“${name}” · on this screen; it starts by searching the literature.` });
      setTimeout(() => { reload(); refreshTerms(); }, 1500); setTimeout(refreshTerms, 4000);
    } catch (e) { errToast(e); busy = false; btn.disabled = false; ta.disabled = false; title.disabled = false; }
  }
}
function renameExpert(x) {
  const inp = h('input.input', { value: x.title, maxlength: '80', 'aria-label': 'Title', onkeydown: e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } } });
  const dlg = openDialog({ title: 'Rename discussion', cls: 'sm', body: inp, actions: [{ el: h('button.btn', { onclick: () => dlg.closeDlg() }, 'Cancel') }, { el: h('button.btn.btn-primary', { onclick: () => save() }, 'Save') }] });
  setTimeout(() => { inp.focus(); inp.select(); }, 50);
  function save() { const t = inp.value.trim(); if (!t) { inp.focus(); return; } dlg.closeDlg(); op({ op: 'expert.update', id: x.id, fields: { title: t } }).catch(() => { }); }
}
let transcriptLoading = false;
async function openExpertTranscript(x) {
  if (transcriptLoading || document.querySelector('dialog[open]')) return;
  transcriptLoading = true;
  let r;
  try { r = await api.get(`/api/expert/transcript?id=${encodeURIComponent(x.id)}`); } catch (e) { errToast(e); return; } finally { transcriptLoading = false; }
  if (document.querySelector('dialog[open]')) return;
  const turns = r.turns || [];
  const body = h('div.col', { style: 'gap:10px' },
    h('div.xctx', h('div.faint.xs', { style: 'margin-bottom:4px' }, 'Discussion brief'), h('div', { style: 'white-space:pre-wrap' }, x.context || '')),
    turns.length ? h('div.xlog', turns.map((t, i) => h('div.xturn', { class: t.role }, h('div.who', t.role === 'user' ? (i === 0 ? 'Opening request (sent by the app)' : 'You') : 'Expert', h('span.faint.xs', { style: 'margin-left:8px;font-weight:400' }, fmtWhen(t.ts))), mdLite(t.text).el)))
      : r.saved ? h('div.xlog', h('div.small.muted', 'The Claude session file has expired; this is the copy the app kept. Continue starts a new session that reads it first.'), mdLite(r.saved).el)
      : h('div.empty', 'Nothing recorded yet - the transcript appears after the first exchange.'),
    (r.earlier || []).length ? h('details', h('summary', { style: 'cursor:pointer;font-weight:600' }, `Earlier sessions of this discussion (${r.earlier.length})`), r.earlier.map(s => h('div.xlog', { style: 'margin-top:8px' }, h('div.faint.xs', s.file), mdLite(s.text).el))) : null,
    r.notes_text ? h('details', { open: true }, h('summary', { style: 'cursor:pointer;font-weight:600' }, `Saved notes (${r.notes})`), mdLite(r.notes_text).el) : null);
  const dlg = openDialog({ title: x.title, cls: 'lg', body, actions: [
    { left: true, el: h('button.btn.btn-ghost', { onclick: () => copyText(turns.map(t => `${t.role === 'user' ? 'You' : 'Expert'}:\n${t.text}`).join('\n\n'), 'Transcript copied.') }, icon('copy'), 'Copy') },
    { el: h('button.btn', { onclick: () => dlg.closeDlg() }, 'Close') },
    { el: h('button.btn.btn-primary', { onclick: () => { dlg.closeDlg(); openExpertChat(x); } }, icon('terminal'), 'Continue') }] });
}
function renderExpert() {
  const chats = [...(S.L.experts || [])].sort((a, b) => (b.last_opened || b.created || '').localeCompare(a.last_opened || a.created || ''));
  pageHeader('Expert', `A paper expert to argue with: give it a topic and a direction; it finds the newest papers and discusses them critically. ${REMOTE ? 'Runs in a console panel right here.' : 'Runs in a terminal window on this screen.'}`,
    [h('button.btn.btn-primary', { onclick: () => newExpertDialog() }, icon('plus'), 'New discussion')]);
  const row = x => {
    const live = expertFor(x.id), ended = (S.terms || []).filter(t => t.kind === 'expert' && t.expert === x.id && !t.alive).sort((a, b) => (b.ended || '').localeCompare(a.ended || ''))[0];
    const term = (S.expertTerminals || []).includes(x.id);
    const status = live ? chip('Running', 'accent') : term ? chip(REMOTE ? 'Terminal open on the library computer' : 'Terminal open here', 'ok') : ended ? chip('Ended', '') : chip('Idle', '');
    const notes = [x.last_opened ? `last ${relWhen(x.last_opened)}` : `created ${relWhen(x.created)}`, x.opened ? `opened ${x.opened}×` : null,
      live && !REMOTE ? 'running as a console (started from the other computer); Open attaches to it here' : null,
      term && REMOTE ? 'close that window to continue it here' : null].filter(Boolean);
    return h('div.reqcard', { 'data-id': x.id },
      h('div.row', h('span.livedot', { class: live || term ? '' : 'off' }),
        h('div.grow', { style: 'min-width:0' }, h('b.ellip', x.title), h('div.small.muted.ellip', firstLineOf(x.context) || '')),
        status,
        h('button.btn.btn-sm', { class: live ? 'btn-primary' : '', title: live ? 'Attach to the running session' : REMOTE ? 'Continue in a console panel here' : 'Continue in a terminal window on this screen', onclick: () => openExpertChat(x) }, icon('terminal'), live ? 'Open' : 'Continue'),
        live ? h('button.btn.btn-sm.btn-ghost', { title: 'Stop Claude; the conversation can be continued later', onclick: async () => { if (await confirmDialog(`End the running session for “${x.title}”? You can continue the conversation later.`, { ok: 'End session', danger: true })) api.post('/api/term/kill', { id: live.id }).catch(errToast); } }, 'End') : null,
        !live && ended ? h('button.btn.btn-sm.btn-ghost', { title: 'Show what the last session printed', onclick: () => openConsole(ended) }, 'View output') : null,
        h('button.btn.btn-sm.btn-ghost', { title: 'Read the conversation so far', onclick: () => openExpertTranscript(x) }, 'Transcript'),
        h('button.icon-btn.sm', { title: 'Rename', 'aria-label': 'Rename', onclick: () => renameExpert(x) }, icon('edit')),
        h('button.icon-btn.sm', { title: 'Delete from this list', 'aria-label': 'Delete', onclick: async () => {
          await refreshTerms();
          if (expertFor(x.id) || (S.expertTerminals || []).includes(x.id)) { toast({ kind: 'warn', text: 'End the running session first.' }); return; }
          if (await confirmDialog(`Delete “${x.title}” from the Expert page? A copy of the transcript stays in the library folder (.expert/) but it is no longer listed here.`, { ok: 'Delete', danger: true })) api.post('/api/expert/remove', { id: x.id }).then(() => reload()).catch(errToast); } }, icon('trash'))),
      h('div.small.muted', notes.join(' · ')),
      !live && ended && ended.idle_killed ? h('div.small.muted', 'Ended automatically after 8 hours without any input or output; Continue picks it up again.') : null);
  };
  const live = (S.terms || []).filter(t => t.kind === 'expert' && t.alive).length;
  return h('div',
    h('section', h('h2', { style: 'margin:0 0 10px' }, 'Discussions', live ? h('span.badge.accent', { style: 'margin-left:8px' }, live) : null),
      chats.length ? h('div.col', { style: 'gap:8px' }, chats.map(row)) : h('div.card', emptyState('No discussions yet. Start one with a topic and the angle you want to take.', h('button.btn.btn-primary', { onclick: () => newExpertDialog() }, icon('plus'), 'New discussion'), 'expert'))),
    h('div.small.muted', { style: 'margin-top:20px' }, 'Each discussion is one Claude conversation; Continue picks it up where it stopped, and it stays listed here until you delete it. A conversation open as a terminal window on the library computer cannot be opened as a console at the same time, and vice versa. Consoles end by themselves after 8 hours without input or output.'));
}

/* ============================================================ page: daily gap (one research direction a day + a chat about it) */
const GAP_LENS_LABEL = { assumption: 'Flip an assumption', transfer: 'Change the setting', evaluation: 'Measurement', scale: 'Scale', theory: 'Theory', mechanism: 'Mechanism', brain: 'Brain & cognition', efficiency: 'Efficiency', failure: 'Failure modes', data: 'Data-centric', 'test-time': 'Test-time adaptation', agents: 'Agents', safety: 'Safety', negative: 'Negative result', unify: 'Unification' };
const GAP_MODE_LABEL = { lens: 'one seed', cross: 'two seeds crossed', wild: 'long jump' };
const gapPrompts = () => ['Poke holes in this idea', 'Is it really new? Search harder for prior work', 'Design the first experiment in detail', 'Give me a wilder variant', 'What is the smallest-compute version?', `Draft a ${gapVenue()} title and abstract`];
const GC = { id: null, turns: [], busy: false, partial: '', status: '', pending: '', error: '', earlier: [], loading: false, drafts: {}, seq: 0 };
const gapsSorted = () => [...((S.L && S.L.gaps) || [])].sort((a, b) => (b.created || '').localeCompare(a.created || ''));
const gapLive = () => (S.L && S.L.gap_live) || { gen: null, chats: {} };
function gapServerOk() {
  if (!serverAtLeast('2.6.0')) { toast({ kind: 'warn', title: 'Library server needs a restart', text: `It is still running a version without the Daily gap page. ${REMOTE ? 'Restart it first (see the remote guide).' : 'Run: systemctl --user restart paper-assistant-server'}`, timeout: 10000 }); return false; }
  return true;
}
function selectedGap() {
  const gs = gapsSorted();
  return gs.find(g => g.id === S.gapSel) || gs[0] || null;
}
let GAP_GEN_BUSY = false;
async function generateGap() {
  if (GAP_GEN_BUSY || !gapServerOk()) return;
  if (gapLive().gen) { toast({ text: 'Claude is already writing a brief.' }); return; }
  GAP_GEN_BUSY = true;
  try { const r = await api.post('/api/gap/generate', {}); S.gapSel = r.id; await reload(); toast({ kind: 'ok', icon: 'bulb', title: 'Writing a new brief', text: `Starting from ${(r.seed.labels || []).join(' + ')} · ${GAP_LENS_LABEL[r.seed.lens] || r.seed.lens}. It takes a few minutes; you can leave this page.` }); }
  catch (e) { errToast(e); }
  finally { GAP_GEN_BUSY = false; }
}
/* chat state for the selected brief: fetched on selection, then kept current by `gapchat` events */
async function loadGapChat(id, { force = false } = {}) {
  if (!id) return;
  if (GC.id === id && GC.loading && !force) return;
  if (GC.id !== id) Object.assign(GC, { id, turns: [], busy: false, partial: '', status: '', pending: '', error: '', earlier: [] });
  GC.loading = true; const seq = ++GC.seq;
  try {
    const r = await api.get(`/api/gap/chat?id=${encodeURIComponent(id)}`);
    if (seq !== GC.seq || GC.id !== id) return;
    Object.assign(GC, { turns: r.turns || [], busy: !!r.busy, partial: r.partial || '', status: r.status || '', pending: r.busy ? (r.pending || '') : '', earlier: r.earlier || [] });
    if (!r.busy && r.error) GC.error = r.error;
  } catch (e) { if (seq === GC.seq) GC.error = e.message; }
  finally { if (seq === GC.seq) GC.loading = false; }
  patchGapChat({ scroll: true });
}
function onGapChatEvent(d) {
  if (S.L && S.L.gap_live) { const c = S.L.gap_live.chats || (S.L.gap_live.chats = {}); if (d.busy) c[d.id] = { partial: d.partial, status: d.status, pending: d.pending }; else delete c[d.id]; }
  if (d.id !== GC.id) return;
  if (d.busy) { Object.assign(GC, { busy: true, partial: d.partial || '', status: d.status || '', pending: d.pending || GC.pending, error: '' }); patchGapChat(); }
  else { GC.busy = false; GC.status = ''; if (d.error) GC.error = d.error; loadGapChat(d.id, { force: true }).then(() => { GC.partial = ''; GC.pending = ''; patchGapChat({ scroll: true }); }); }
}
function onGapEvent(d) {
  const L = S.L; if (!L) return;
  if (d.done) { if (L.gap_live) L.gap_live.gen = null; return; }   // the record itself arrives with the library change event
  if (!L.gap_live) L.gap_live = { gen: null, chats: {} };
  L.gap_live.gen = Object.assign({}, L.gap_live.gen || { id: d.id, started: Date.now() / 1000 }, { id: d.id, steps: d.steps || [] });
  const el = $('#gapsteps'); if (el && S.page === 'gaps') el.replaceChildren(...gapStepsEls());
}
function gapStepsEls() {
  const steps = (gapLive().gen || {}).steps || [];
  return steps.map((s, i) => h('li', { class: i === steps.length - 1 ? 'now' : '' }, s.text));
}
async function sendGapChat(text) {
  const g = selectedGap(); text = (text || '').trim();
  if (!g || !text || GC.busy) return;
  if (!gapServerOk()) return;
  GC.busy = true; GC.pending = text; GC.partial = ''; GC.status = 'Thinking…'; GC.error = ''; GC.drafts[g.id] = '';
  const ta = $('#gcinput'); if (ta) ta.value = '';
  patchGapChat({ scroll: true });
  try { await api.post('/api/gap/chat', { id: g.id, text }); }
  catch (e) { GC.busy = false; GC.pending = ''; GC.status = ''; GC.drafts[g.id] = text; const t2 = $('#gcinput'); if (t2) t2.value = text; errToast(e); patchGapChat(); }
}
function gapTurnEl(role, text, { ts, live = false } = {}) {
  return h('div.gcturn', { class: role === 'user' ? 'user' : 'assistant' },
    h('div.who', role === 'user' ? 'You' : 'Claude', ts ? h('span.faint.xs', { style: 'margin-left:8px;font-weight:400' }, fmtWhen(ts)) : null, live ? h('span.faint.xs', { style: 'margin-left:8px;font-weight:400' }, 'writing…') : null),
    text ? mdLite(text).el : h('div.faint.small', '…'));
}
function gapChatLogEls() {
  const els = [];
  if (GC.earlier.length) els.push(h('details.gcearlier', h('summary', `Earlier chats about this brief (${GC.earlier.length})`), GC.earlier.map(e => h('div', { style: 'margin-top:6px' }, h('div.faint.xs', e.file), mdLite(e.text).el))));
  GC.turns.forEach(t => els.push(gapTurnEl(t.role, t.text, { ts: t.ts })));
  const lastUser = [...GC.turns].reverse().find(t => t.role === 'user');
  if (GC.busy && GC.pending && !(lastUser && lastUser.text.trim() === GC.pending.trim() && GC.turns[GC.turns.length - 1] === lastUser)) els.push(gapTurnEl('user', GC.pending));
  if (GC.busy) els.push(GC.partial ? gapTurnEl('assistant', GC.partial, { live: true }) : null, h('div.gcstatus', h('span.spin'), GC.status || 'Thinking…'));
  if (!GC.busy && GC.error) els.push(h('div.gcerr', GC.error));
  if (!els.filter(Boolean).length) els.push(h('div.gcempty', h('div.faint.small', GC.loading ? 'Loading…' : 'Talk it through with Claude: it has the brief and the papers behind it, can search for more, and can add papers or ideas to your library when you ask.'),
    GC.loading ? null : h('div.gcsugg', gapPrompts().map(p => h('button.chip.btnchip', { onclick: () => sendGapChat(p) }, p)))));
  return els.filter(Boolean);
}
function patchGapChat({ scroll = false } = {}) {
  const log = $('#gclog'); if (!log || S.page !== 'gaps') return;
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  log.replaceChildren(...gapChatLogEls());
  if (scroll || nearBottom) log.scrollTop = log.scrollHeight;
  const send = $('#gcsend'), stop = $('#gcstop');
  if (send) send.disabled = GC.busy || send.dataset.ready !== '1'; if (stop) stop.hidden = !GC.busy;
}
function gapChatPanel(g) {
  const serverBusy = !!(gapLive().chats || {})[g.id];
  if (GC.id !== g.id || (!GC.loading && GC.busy !== serverBusy)) setTimeout(() => loadGapChat(g.id, { force: true }), 0);   // new selection, or an answer started/ended while this browser missed the events
  const ready = g.status === 'ready';
  const ta = h('textarea#gcinput.textarea', { rows: 3, 'data-autosave': '1', 'aria-label': 'Message to Claude', disabled: !ready, placeholder: ready ? 'Ask, push back, or riff on it… (Enter sends, Shift+Enter new line)' : g.status === 'generating' ? 'Available once the brief is written' : 'Generate a new brief to chat',
    value: GC.drafts[g.id] || '', oninput: e => { GC.drafts[g.id] = e.target.value; },
    onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); sendGapChat(ta.value); } } });
  const st = settings();
  const panel = h('section.card.gcpanel', { 'aria-label': 'Chat with Claude about this brief' },
    h('div.gchead', icon('sparkles'), h('b', 'Discuss with Claude'), h('span.faint.xs.grow', `${(st.gap_model || 'opus')} · ${st.gap_chat_effort || 'medium'} effort`),
      g.chat_turns ? h('button.icon-btn.sm', { title: 'Copy this chat as text', 'aria-label': 'Copy chat', onclick: () => copyText(GC.turns.map(t => `${t.role === 'user' ? 'You' : 'Claude'}:\n${t.text}`).join('\n\n'), 'Chat copied.') }, icon('copy')) : null),
    h('div#gclog.gclog', { role: 'log', 'aria-live': 'polite' }, gapChatLogEls()),
    h('div.gccompose', ta, h('div.row', { style: 'gap:6px' },
      h('span.faint.xs.grow', REMOTE ? 'Claude runs on the library computer.' : 'Each message is one Claude turn; the chat is kept with the brief.'),
      h('button#gcstop.btn.btn-sm', { hidden: !GC.busy, title: 'Stop this answer', onclick: () => api.post('/api/gap/stop', { id: g.id }).catch(errToast) }, icon('stop'), 'Stop'),
      h('button#gcsend.btn.btn-sm.btn-primary', { disabled: GC.busy || !ready, 'data-ready': ready ? '1' : '0', onclick: () => sendGapChat(ta.value) }, 'Send'))));
  setTimeout(() => { const log = $('#gclog'); if (log) log.scrollTop = log.scrollHeight; }, 0);
  return panel;
}
function gapPaperRow(g, p) {
  const aid = p.arxiv || '', url = aid ? `https://arxiv.org/abs/${aid}` : p.doi ? `https://doi.org/${p.doi}` : '';
  const have = aid ? paperById(aid) : null;
  const ver = p.verified === true ? h('span.gcheck', { title: `Checked on ${aid ? 'arXiv' : 'OpenAlex'}` }, icon('check')) : p.verified === false ? chip('Not found when checked', 'warn', p.found_title ? `The id points to “${p.found_title}”` : 'The cited id did not resolve; treat this entry with care') : null;
  return h('li.gpaper',
    h('div.row', { style: 'gap:6px;align-items:baseline' },
      url ? h('a.gptitle', { href: url, target: '_blank', rel: 'noopener', onclick: e => { if (!REMOTE) { e.preventDefault(); openExternal(url); } } }, p.title) : h('span.gptitle', p.title),
      ver),
    h('div.small.muted', `${p.first_author || ''}${p.year ? ` ${p.year}` : ''}${aid ? ` · arXiv:${aid}` : p.doi ? ` · ${p.doi}` : ''}`, p.takeaway ? ` — ${p.takeaway}` : ''),
    aid ? h('div.gpacts', have ? h('button.btn.btn-sm.btn-ghost', { onclick: () => { go('library'); openDrawer(have.id); } }, icon('book'), 'On your shelf') : h('button.btn.btn-sm.btn-ghost', { title: 'Add to the library and queue it', onclick: e => addGapPaper(g, p, e.currentTarget) }, icon('plus'), 'Add to library')) : null);
}
async function addGapPaper(g, p, btn) {
  btn.disabled = true;
  try {
    const r = await api.get(`/api/arxiv?id=${encodeURIComponent(p.arxiv)}`), m = r.paper;
    const topic = ((g.seed || {}).topics || [])[0] || '';
    const paper = { id: m.id, title: m.title, short: m.short, authors: m.authors || [], year: m.year || 0, venue: m.venue || '', arxiv: m.arxiv, abstract: m.abstract || '', tags: m.tags || [], doi: m.doi || '',
      topic, topics: topic ? [topic] : [], tier: 3, status: 'queued', why: `${p.takeaway || ''}${p.takeaway ? ' ' : ''}(from the daily gap “${g.title}”)`.trim(), source: `gap:${g.id}` };
    await op({ op: 'paper.add', paper }, { silent: true });
    api.post('/api/download', { id: m.id }).catch(() => { });
    toast({ kind: 'ok', text: `“${m.short}” added to the library and queued.` });
  } catch (e) { btn.disabled = false; errToast(e); }
}
function gapToMarkdown(g) {
  const i = g.idea || {}, sd = g.seed || {};
  const sec = (t, b) => b ? `## ${t}\n\n${b}\n\n` : '';
  return `# ${g.title}\n\n${g.date} · ${g.direction || ''} · from ${(sd.labels || []).join(' + ')} · lens: ${GAP_LENS_LABEL[sd.lens] || sd.lens || ''}\n\n${g.jump ? `> ${g.jump}\n\n` : ''}` +
    sec('Frontier', g.survey) + sec('Gap', g.gap) + sec('Problem', g.problem) +
    (i.name ? `## Direction: ${i.name}\n\n${i.sketch || ''}\n\n**First experiment.** ${i.first_experiment || ''}\n\n**Why feasible.** ${i.why_feasible || ''}\n\n` : '') +
    sec('Closest work (novelty check)', g.novelty) + sec('Risks', g.risks) + sec((g.venue || gapVenue()) + ' angle', g.neurips) +
    ((g.papers || []).length ? `## Papers\n\n${g.papers.map(p => `- ${p.title} (${p.first_author}, ${p.year})${p.arxiv ? ` arXiv:${p.arxiv}` : p.doi ? ` doi:${p.doi}` : ''} — ${p.takeaway || ''}`).join('\n')}\n` : '');
}
function deepDiveGap(g) {
  const brief = (enUI() ? `I want to dig into this research direction (from the Daily gap of ${g.date}):\n\n` : `我想深入討論這個研究方向（來自 Daily gap ${g.date}）：\n\n`) + gapToMarkdown(g).slice(0, 7900);
  if (S.page !== 'expert') go('expert');
  setTimeout(() => newExpertDialog(brief), 120);
}
function gapSeedLine(g) {
  const sd = g.seed || {};
  const seeds = (sd.papers || []).map((pid, i) => { const p = paperById(pid); const label = (sd.labels || [])[i] || pid; return p ? h('button.linkbtn', { onclick: () => { go('library'); openDrawer(p.id); } }, label) : h('span', label); });
  return h('div.gseed', icon('spark'), h('span', 'From '), seeds.flatMap((x, i) => i ? [h('span', ' + '), x] : [x]), h('span.faint', ` · ${GAP_LENS_LABEL[sd.lens] || sd.lens || ''} · ${GAP_MODE_LABEL[sd.mode] || ''}`));
}
function gapBriefCard(g) {
  const sd = g.seed || {};
  if (g.status === 'generating') {
    const live = gapLive().gen, mine = live && live.id === g.id;
    return h('section.card.gapcard.pending',
      h('div.row', { style: 'gap:10px' }, h('span.spin'), h('div.grow', h('h2', { style: 'margin:0' }, 'Writing a research brief…'), h('div.small.muted', mine ? `Started ${relWhen(new Date(live.started * 1000).toISOString())}; it usually takes 3-10 minutes. You can leave this page.` : 'Waiting for the library server…'))),
      gapSeedLine(g),
      h('ol#gapsteps.gsteps', gapStepsEls()));
  }
  if (g.status === 'failed') {
    return h('section.card.gapcard',
      h('div.row', { style: 'gap:8px' }, chip('Failed', 'danger'), h('span.faint.xs', fmtWhen(g.created))), gapSeedLine(g),
      h('p.small', { style: 'white-space:pre-wrap' }, g.error || 'Claude did not finish this brief.'),
      h('div.row', { style: 'gap:8px' }, h('button.btn.btn-primary', { disabled: !!gapLive().gen, onclick: generateGap }, icon('refresh'), 'Try again'),
        h('button.btn.btn-ghost', { onclick: () => removeGap(g) }, icon('trash'), 'Delete')));
  }
  const i = g.idea || {};
  const sec = (title, body, cls = '') => body ? h('div.gsec', { class: cls }, h('div.gsh', title), typeof body === 'string' ? mdLite(body).el : body) : null;
  const rate = v => h('button.icon-btn.sm.rate', { title: v > 0 ? 'Promising' : 'Not for me', 'aria-label': v > 0 ? 'Promising' : 'Not for me', 'aria-pressed': String(g.rating === v), class: g.rating === v ? 'on' : '', onclick: () => op({ op: 'gap.update', id: g.id, fields: { rating: g.rating === v ? 0 : v } }, { silent: true }).catch(() => { }) }, v > 0 ? '👍' : '👎');
  const note = h('textarea.textarea', { rows: 2, 'data-autosave': '1', 'aria-label': 'Your note on this brief', placeholder: 'Your note (kept with the brief)…', value: g.note || '', oninput: debounce(e => op({ op: 'gap.update', id: g.id, fields: { note: e.target.value } }, { silent: true, noReload: true }).catch(() => { }), 700) });
  const unver = (g.papers || []).filter(p => p.verified === false).length;
  return h('section.card.gapcard',
    h('div.gtop', chip(relDate(g.date) || g.date, g.date === todayStr() ? 'accent' : ''), g.direction ? h('span.chip.gdirchip', { title: g.direction }, g.direction) : null, h('span.grow'),
      rate(1), rate(-1),
      h('button.icon-btn.sm', { title: g.starred ? 'Unstar' : 'Star (keep for later)', 'aria-label': g.starred ? 'Unstar' : 'Star', 'aria-pressed': String(!!g.starred), class: g.starred ? 'on star' : 'star', onclick: () => op({ op: 'gap.update', id: g.id, fields: { starred: !g.starred } }, { silent: true }).catch(() => { }) }, icon('star')),
      h('button.icon-btn.sm', { title: 'More', 'aria-label': 'More actions', onclick: e => popover(e.currentTarget, h('div.col', { style: 'gap:2px;min-width:220px' },
        h('button.btn.btn-ghost', { onclick: () => { closePop(); copyText(gapToMarkdown(g), 'Brief copied as Markdown.'); } }, icon('copy'), 'Copy as Markdown'),
        h('button.btn.btn-ghost', { onclick: () => { closePop(); deepDiveGap(g); } }, icon('expert'), 'Deep-dive with the Expert'),
        h('button.btn.btn-ghost', { onclick: () => { closePop(); renameGap(g); } }, icon('edit'), 'Rename'),
        h('div.sep'),
        h('button.btn.btn-ghost', { onclick: () => { closePop(); removeGap(g); } }, icon('trash'), 'Delete brief'))) }, icon('more'))),
    h('h2.gtitle', g.title),
    gapSeedLine(g),
    g.jump ? h('div.gjump', g.jump) : null,
    sec('Frontier', g.survey),
    sec('Gap', g.gap, 'hl'),
    sec('Problem', g.problem ? h('div.gproblem', mdLite(g.problem).el) : null),
    i.name || i.sketch ? h('div.gsec.idea', h('div.gsh', 'A direction to try', i.name ? h('span.gidea', i.name) : null), mdLite(i.sketch || '').el,
      i.first_experiment ? h('div.gsub', h('b', 'First experiment'), mdLite(i.first_experiment).el) : null,
      i.why_feasible ? h('div.gsub', h('b', 'Why feasible'), mdLite(i.why_feasible).el) : null) : null,
    sec('Closest work (novelty check)', g.novelty),
    h('div.gpair', sec('Risks', g.risks), sec((g.venue || gapVenue()) + ' angle', g.neurips)),
    (g.papers || []).length ? h('div.gsec', h('div.gsh', `Papers (${g.papers.length})`, unver ? h('span.faint.xs', { style: 'margin-left:8px;text-transform:none;font-weight:400' }, `${unver} could not be confirmed`) : null), h('ul.gpapers', g.papers.map(p => gapPaperRow(g, p)))) : null,
    (g.keywords || []).length ? h('div.row.wrap', { style: 'gap:6px' }, g.keywords.map(k => chip(k, ''))) : null,
    note,
    h('div.faint.xs', [g.model ? `Written by ${g.model}` : null, g.finished ? fmtWhen(g.finished) : null, g.reason === 'daily' ? 'daily brief' : 'on request'].filter(Boolean).join(' · ')));
}
function renameGap(g) {
  const inp = h('input.input', { value: g.title, maxlength: '160', 'aria-label': 'Title', onkeydown: e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } } });
  const dlg = openDialog({ title: 'Rename brief', cls: 'sm', body: inp, actions: [{ el: h('button.btn', { onclick: () => dlg.closeDlg() }, 'Cancel') }, { el: h('button.btn.btn-primary', { onclick: () => save() }, 'Save') }] });
  setTimeout(() => { inp.focus(); inp.select(); }, 50);
  function save() { const t = inp.value.trim(); if (!t) { inp.focus(); return; } dlg.closeDlg(); op({ op: 'gap.update', id: g.id, fields: { title: t } }, { silent: true }).catch(() => { }); }
}
async function removeGap(g) {
  if (!(await confirmDialog(`Delete “${g.title || 'this brief'}”? Its Markdown copy and chat transcript stay in the library folder (.gaps/).`, { ok: 'Delete', danger: true }))) return;
  try { await op({ op: 'gap.remove', id: g.id }, { silent: true }); if (S.gapSel === g.id) S.gapSel = null; } catch (e) { }
}
function renderGaps() {
  const gs = gapsSorted(), live = gapLive(), g = selectedGap(), t = todayStr(), st = settings();
  const hasToday = gs.some(x => x.date === t && x.status !== 'failed');
  pageHeader('Daily gap', `One research direction a day, a jump away from your library: the frontier, one gap, the problem, and a direction to try. Aimed at ${gapVenue()}.`,
    [h('button.btn.btn-primary', { disabled: !!live.gen, title: live.gen ? 'Claude is writing a brief' : 'Survey another random direction now', onclick: generateGap }, icon('bulb'), live.gen ? 'Writing…' : hasToday ? 'Another one' : 'Today’s brief')]);
  const auto = st.daily_gap !== false && (st.daily_gap_time ?? '08:00');
  const when = auto ? `A new brief arrives every day after ${st.daily_gap_time || '08:00'} (Settings → Daily gap).` : 'Daily briefs are off (Settings → Daily gap); press the button for one.';
  if (!g) return h('div', h('div.hero', h('h2', { style: 'margin-bottom:8px' }, 'No briefs yet'),
    h('p.muted', { style: 'line-height:1.7;margin:0 0 12px' }, 'Each brief starts from one or two random papers in your library, jumps with a random lens (flip an assumption, change the setting, theory, mechanism, brain and cognition…), surveys that direction’s newest papers, and names one gap, the problem it poses and one feasible way in. Every paper it cites comes from a live search and is checked against arXiv.'),
    h('div.foot', h('button.btn.btn-primary.btn-lg', { disabled: !!live.gen, onclick: generateGap }, icon('bulb'), 'Write today’s brief'), h('span.faint.small', when))));
  const filter = S.gapFilter || 'all';
  const hist = gs.filter(x => filter === 'starred' ? x.starred : filter === 'liked' ? x.rating > 0 : true);
  const histEl = h('section', { style: 'margin-top:24px' },
    h('div.row', { style: 'gap:10px;margin-bottom:10px' }, h('h2', { style: 'margin:0' }, 'All briefs', h('span.faint.small', { style: 'margin-left:8px;font-weight:400' }, gs.length)), h('span.grow'),
      segmented([['all', 'All'], ['starred', 'Starred'], ['liked', '👍']], filter, v => { S.gapFilter = v; render(); })),
    hist.length ? h('div.col', { style: 'gap:6px' }, hist.map(x => h('button.ghrow', { class: x.id === g.id ? 'sel' : '', 'data-id': x.id, onclick: () => { S.gapSel = x.id; render(); $('#content').scrollTop = 0; } },
      h('span.gd', fmtMD(x.date)), x.status === 'generating' ? h('span.spin') : x.status === 'failed' ? chip('Failed', 'danger') : null,
      h('span.grow.ellip', x.title || (x.status === 'generating' ? 'Writing…' : '(untitled)')), x.direction ? h('span.faint.xs.ellip.gdir', x.direction) : null,
      x.chat_turns ? h('span.faint.xs', `${x.chat_turns} ✉`) : null, x.rating > 0 ? h('span', '👍') : x.rating < 0 ? h('span', '👎') : null, x.starred ? h('span.gstar', icon('star')) : null)))
      : h('div.small.muted', 'Nothing here yet.'));
  return h('div',
    h('div.gapgrid', h('div.gapmain', gapBriefCard(g)), h('div.gapside', gapChatPanel(g))),
    histEl,
    h('div.small.muted', { style: 'margin-top:20px' }, `${when} Briefs and chats are kept in library.json and as Markdown under .gaps/ in the library folder.`));
}

/* ============================================================ page: explore */
const REQ_ZH = { open: 'Open', working: 'In progress', done: 'Done', cancelled: 'Cancelled', noted: 'Note' };
const LAUNCHED = {};
/* Explore has two views: Survey (ask Yan, inbox, consoles, requests) and Trail (every question you ever asked, over time) */
function exploreView() { return S.exploreView || store.get('exploreView', 'survey'); }
function setExploreView(v) { S.exploreView = v; store.set('exploreView', v); render(); }
function renderExplore() {
  const view = exploreView();
  const sw = segmented([['survey', 'Survey'], ['trail', 'Trail']], view, setExploreView);
  const stale = trailLive().stale && (S.L.trail || {}).updated;
  if (stale && view === 'survey') sw.lastChild.appendChild(h('span.badge.accent.dot', { style: 'margin-left:6px', title: 'New questions since the last analysis' }, ''));
  pageHeader('Explore', view === 'trail' ? `Every question you have handed ${persona()}, as a map over time: what you wanted, when, and where it led` : `Hand ${persona()} a direction; survey results land in the inbox here`,
    [sw, h('button.btn', { title: 'Open a plain Claude Code session in the library folder', onclick: e => { const b = e.currentTarget; b.disabled = true; startConsole('claude').catch(errToast).finally(() => { b.disabled = false; }); } }, icon('terminal'), 'Claude console')]);
  return view === 'trail' ? renderTrail() : renderExploreSurvey();
}
/* ask for a survey: request.add, then a console running /paper-survey for it */
async function submitSurveyRequest(text, { btn, onDone } = {}) {
  text = (text || '').trim(); if (!text) return null;
  if (btn) btn.disabled = true;
  try {
    const r = await op({ op: 'request.add', text }, { silent: true, noReload: true });
    const rid = r.result.request.id;
    onDone && onDone(rid);
    try { await startConsole('survey', rid); }
    catch (e) { LAUNCHED[rid] = { launched: false, command: `cd ${(S.health || {}).root || '<library folder>'} && claude ${JSON.stringify('/paper-survey ' + text)}` }; toast({ kind: 'warn', title: 'Couldn’t start the console', text: e.message }); }
    await reload();
    return rid;
  } catch (e) { return null; } finally { if (btn) btn.disabled = false; }
}
/* keep a question without asking for a survey: it goes into the Trail as a note */
async function saveQuestionNote(text, { btn, tags } = {}) {
  text = (text || '').trim(); if (!text) return null;
  if (!serverAtLeast('2.7.0')) { toast({ kind: 'warn', title: 'Library server needs a restart', text: `It is still running a version without notes. ${REMOTE ? 'Restart it first (see the remote guide).' : 'Run: systemctl --user restart paper-assistant-server'}`, timeout: 10000 }); return null; }
  if (btn) btn.disabled = true;
  try {
    const r = await op({ op: 'request.add', text, kind: 'note', tags: tags || [] }, { silent: true, noReload: true });
    const rid = r.result.request.id;
    if (innerWidth > 720) trailFilterState().sel = rid;
    await reload();
    toast({ kind: 'ok', icon: 'note', text: `Noted. It is kept in your trail with today’s date; send it to ${persona()} whenever you want the survey.`, timeout: 6000, action: { label: 'Undo', fn: () => op({ op: 'request.remove', id: rid }, { silent: true }).then(() => { if (trailFilterState().sel === rid) trailFilterState().sel = null; }) } });
    return rid;
  } catch (e) { return null; } finally { if (btn) btn.disabled = false; }
}
function renderExploreSurvey() {
  const surveys = S.L.surveys || [], reqs = [...(S.L.requests || [])].reverse().filter(r => r.status !== 'noted');
  const inbox = surveys.filter(sv => sv.status === 'proposed'), hist = surveys.filter(sv => sv.status !== 'proposed').reverse();
  const ta = h('textarea.textarea', { placeholder: `Tell ${persona()} what you want to dig into…\ne.g. “I want to get into explainable AI” or “recent prompt-based continual learning methods”`, rows: 3, 'data-autosave': '1', value: S.exploreDraft || '', oninput: e => { S.exploreDraft = e.target.value; }, onkeydown: e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.isComposing) submit(); } });
  const btn = h('button.btn.btn-primary.btn-lg', { onclick: () => submit() }, icon('owl'), `Ask ${persona()} to survey`);
  const noteBtn = h('button.btn.btn-lg', { title: 'Keep the question in your trail without starting a survey', onclick: async () => { const t = ta.value.trim(); if (!t) { ta.focus(); return; } if (await saveQuestionNote(t, { btn: noteBtn })) { ta.value = ''; S.exploreDraft = ''; } } }, icon('note'), 'Save as a note');
  async function submit() {
    const text = ta.value.trim(); if (!text) { ta.focus(); return; }
    noteBtn.disabled = true;
    try { await submitSurveyRequest(text, { btn, onDone: () => { ta.value = ''; S.exploreDraft = ''; } }); } finally { noteBtn.disabled = false; }
  }
  const hero = h('div.hero', h('h2', { style: 'margin-bottom:10px' }, `${persona()} can survey a direction for you`), ta,
    h('div.ex', ['I want to get into explainable AI', 'Recent prompt-based methods in continual learning', 'Landmark papers on continual pretraining of LLMs'].map(x => h('button.chip.btnchip', { onclick: () => { ta.value = x; S.exploreDraft = x; ta.focus(); } }, x))),
    h('div.foot', btn, noteBtn, h('span.faint.small', `${persona()} works in a console right here and confirms the direction with you first; the list shows up in the inbox below when it’s done. Every question you ask is also kept in your Trail.`)));
  const inboxEl = h('section', h('h2', { style: 'margin:24px 0 10px' }, 'Inbox', inbox.length ? h('span.badge.accent', { style: 'margin-left:8px' }, inbox.length) : null),
    inbox.length ? h('div.col', { style: 'gap:16px' }, inbox.map(surveyCard)) : (reqs.length || hist.length) ? h('div.card', emptyState(reqs.some(r => r.status === 'working') ? `${persona()} is surveying; you’ll be notified when it’s done.` : 'Inbox is empty.', null, 'inbox')) : null);
  const terms = [...(S.terms || [])].reverse();
  const termEl = terms.length ? h('section', h('h2', { style: 'margin:24px 0 10px' }, 'Consoles'), h('div.col', { style: 'gap:8px' }, terms.map(t => h('div.reqcard',
    h('div.row', h('span', { class: `livedot ${t.alive ? '' : 'off'}` }), h('span.mono.small.ellip.grow', t.title), chip(t.alive ? 'Running' : 'Ended', t.alive ? 'accent' : ''), h('span.faint.xs', fmtWhen(t.started)),
      h('button.btn.btn-sm', { onclick: () => openConsole(t) }, icon('terminal'), t.alive ? 'Open' : 'View output'),
      t.alive ? h('button.btn.btn-sm.btn-ghost', { title: 'Stop Claude and end this session', onclick: async () => { if (await confirmDialog(t.kind === 'expert' ? `End the console “${t.title}”? The discussion stays on the Expert page and Continue picks it up later.` : `End the console “${t.title}”? Anything it has not saved is lost.`, { ok: 'End session', danger: true })) { try { await api.post('/api/term/kill', { id: t.id }); } catch (e) { errToast(e); } } } }, 'End') : null),
    !t.alive && t.idle_killed ? h('div.small.muted', 'Ended automatically after 8 hours without any input or output.') : null)))) : null;
  const reqEl = reqs.length ? h('section', h('h2', { style: 'margin:24px 0 10px' }, 'Requests', h('button.btn.btn-sm.btn-ghost', { style: 'margin-left:10px;font-weight:400', onclick: () => setExploreView('trail') }, 'See them over time in Trail', icon('chev'))), h('div.col', { style: 'gap:8px' }, reqs.map(requestCard))) : null;
  const histEl = hist.length ? h('details.card', { style: 'margin-top:24px;padding:12px 16px' }, h('summary', { style: 'cursor:pointer;font-weight:600;font-size:13px;color:var(--fg-2)' }, `Past surveys (${hist.length})`), h('div', { style: 'margin-top:8px' }, hist.map(sv => h('div.histrow', h('span', (sv.topic || {}).emoji || '📚'), h('span.grow', h('b', (sv.topic || {}).name || (sv.topic || {}).zh || sv.query), h('span.muted', { style: 'margin-left:8px' }, (sv.direction || {}).name || '')), chip(sv.status === 'accepted' ? `Accepted ${sv.candidates.filter(c => c.selected).length}` : 'Declined', sv.status === 'accepted' ? 'ok' : ''), h('span.faint.xs', fmtMD(sv.created)))))) : null;
  const empty = !reqs.length && !surveys.length ? h('div.empty', { style: 'padding:40px 16px' }, 'No surveys requested yet. Try typing a direction.') : null;
  return h('div', hero, empty, inboxEl, termEl, reqEl, histEl);
}
function requestCard(r) {
  const lr = LAUNCHED[r.id], live = termFor(r.id), cmd = (lr && lr.command) || `cd ${(S.health || {}).root || '<library folder>'} && claude ${JSON.stringify('/paper-survey ' + r.text)}`;
  const chipCls = r.status === 'done' ? 'ok' : r.status === 'working' ? 'accent' : r.status === 'cancelled' ? '' : 'warn';
  return h('div.reqcard',
    h('div.row', h('span.q.grow', r.text), chip(REQ_ZH[r.status] || r.status, chipCls), h('span.faint.xs', fmtWhen(r.created))),
    (r.status === 'open' || r.status === 'working') ? [h('div.codeblock', h('code', cmd), h('button.icon-btn.sm', { title: 'Copy command', 'aria-label': 'Copy command', onclick: e => { navigator.clipboard && navigator.clipboard.writeText(cmd).then(() => toast({ kind: 'ok', text: 'Command copied.' })).catch(() => toast({ kind: 'warn', text: 'Clipboard unavailable; select it manually.' })); } }, icon('copy'))),
      h('div.row.small.muted', live ? `${persona()} is working in a console; open it to answer questions.` : lr && lr.launched === false ? 'Run it in a console, or copy the command above and run it yourself.' : `${persona()} confirms the direction with you first; the list appears in the inbox when it’s done.`, h('span.grow'),
        live ? h('button.btn.btn-sm.btn-primary', { onclick: () => openConsole(live) }, icon('terminal'), 'Open console')
          : h('button.btn.btn-sm', { onclick: async e => { const b = e.currentTarget; if (r.status === 'working' && !await confirmDialog(`This request is already marked as in progress${r.runner === 'terminal' ? ' (it was started in a system terminal on the library computer)' : ''}. Start a console for it anyway?`, { ok: 'Start console' })) return; b.disabled = true; try { await startConsole('survey', r.id); await reload(); } catch (err) { errToast(err); } finally { b.disabled = false; } } }, icon('terminal'), r.status === 'open' ? `Send ${persona()}` : 'Run in console'),
        !live && !REMOTE ? h('button.btn.btn-sm.btn-ghost', { title: 'Open a system terminal window on this computer instead', onclick: async () => { try { const lr2 = await api.post('/api/launch-survey', { request_id: r.id }); LAUNCHED[r.id] = lr2; toast({ kind: lr2.launched ? 'ok' : 'warn', text: lr2.launched ? 'Terminal opened.' : 'No terminal found; run the command manually.' }); await reload(); } catch (err) { errToast(err); } } }, 'System terminal') : null,
        h('button.btn.btn-sm.btn-ghost', { onclick: async () => { if (await confirmDialog(live ? 'Cancel this request and end its console?' : 'Cancel this request?', { ok: 'Cancel request' })) { if (live) await api.post('/api/term/kill', { id: live.id }).catch(() => { }); await op({ op: 'request.update', id: r.id, fields: { status: 'cancelled' } }, { silent: true }); } } }, 'Cancel'))] : null,
    r.note ? h('div.small.muted', r.note) : null);
}
function surveyCard(sv) {
  const sel = new Set(sv.candidates.filter(c => c.selected).map(c => c.id));
  const topic = sv.topic || {}, dir = sv.direction || {};
  const planOn = h('input', { type: 'checkbox', checked: (sv.plan || []).length > 0 });
  const proposedExists = !!(topic.id && topicById(topic.id));
  const topicSel = h('select.select', { 'aria-label': 'File under topic', style: 'width:auto;max-width:240px;height:28px;font-size:var(--fs-xs)' },
    !proposedExists ? h('option', { value: '' }, `New topic: ${topic.emoji || ''} ${topic.name || topic.zh || 'Untitled'}`) : null,
    S.L.topics.map(t => h('option', { value: t.id, selected: t.id === topic.id }, `${t.emoji || ''} ${t.name || t.zh}`)));
  const countBtn = h('button.btn.btn-primary', { onclick: () => decide([...sel]) });
  const upd = () => { countBtn.textContent = sel.size === sv.candidates.length ? 'Accept all' : `Accept ${sel.size} selected`; countBtn.disabled = sel.size === 0; };
  const groups = [1, 2, 3].map(t => ({ t, cs: sv.candidates.filter(c => (c.tier || 2) === t) })).filter(g => g.cs.length);
  async function decide(accept) {
    const chosen = topicSel.value, body = { op: 'survey.decide', id: sv.id, accept, schedule: planOn.checked };
    if (chosen && chosen !== topic.id) body.topic_id = chosen;
    const tgt = chosen ? topicById(chosen) : null;
    try { await op(body); celebrateConfetti(true); chord(); toast({ kind: 'ok', title: `Added ${accept.length} ${accept.length === 1 ? 'paper' : 'papers'} to library`, text: `Topic: ${tgt ? (tgt.name || tgt.zh) : (topic.name || topic.zh || '')}${planOn.checked && (sv.plan || []).length ? ', scheduled as suggested' : ''}. PDFs download in the background.` }); } catch (e) { }
  }
  const card = h('div.survey',
    h('div.sh', h('span.em', topic.emoji || '📚'), h('div.grow', h('h3', topic.name || sv.query, topic.zh ? h('span.muted', { style: 'font-weight:400;margin-left:8px' }, topic.zh) : null), dir.name ? h('div.dir', dir.name) : null, h('div.row.wrap', { style: 'margin-top:6px;gap:4px' }, chip(`${sv.candidates.length} candidates`, 'accent'), h('span.faint.xs', `Request: “${sv.query || ''}” · ${fmtWhen(sv.created)}`))), h('span.faint.xs', { style: 'white-space:nowrap' }, fmtMD(sv.created))),
    (dir.primer || sv.summary) ? h('div.primer', dir.primer ? h('p', dir.primer) : null, sv.summary ? h('p.sum', { style: dir.primer ? 'margin-top:8px' : '' }, sv.summary) : null, (dir.chosen_from || []).length ? h('div.row.wrap', { style: 'margin-top:10px;gap:4px' }, h('span.faint.xs', 'Also considered:'), dir.chosen_from.filter(x => x.name !== dir.name).map(x => chip(`${x.name}${x.trend === 'rising' ? ' ↗' : ''}`, 'outline', x.primer || ''))) : null) : null,
    groups.map(g => h('div.tiergroup', h('h4', `T${g.t} ${TIER_ZH[g.t]}`), g.cs.map(c => {
      const row = h('div.cand', { class: sel.has(c.id) ? '' : 'off' },
        checkbox({ checked: sel.has(c.id), label: 'Select', onChange: v => { v ? sel.add(c.id) : sel.delete(c.id); row.classList.toggle('off', !v); upd(); } }),
        h('div.grow', h('div.ttl', h('b', c.short || c.title), c.short ? h('span', { style: 'margin-left:8px' }, c.title) : null), h('div.meta', h('span', `${authorsShort(c.authors, 2)}${c.year ? ` · ${c.year}` : ''}${c.venue ? ` · ${c.venue}` : ''}${c.citations ? ` · ${c.citations.toLocaleString()} citations` : ''}`)), c.why ? h('div.why', c.why) : null, c.reason ? h('div.reason', `${persona()}: ${c.reason}`) : null,
          h('div.meta', chip(`~${c.est_minutes || 60} min`), dots(c.difficulty || 2), c.score ? chip(`${Math.round(c.score * 100)}% match`, 'mono') : null, paperById(c.id) ? [chip('In library', 'ok'), h('span.faint', 'will also be filed under this topic')] : null, c.arxiv ? h('button.chip.btnchip', { onclick: () => openExternal(c.arxiv) }, 'arXiv ↗') : null)));
      return row;
    }))),
    sv.lineage ? h('div.lineage', sv.lineage) : null,
    h('div.sf', h('label.row.small', { style: 'gap:6px' }, h('span.muted', 'Topic'), topicSel), h('label.row.small', h('span.switch', planOn, h('span.tr')), `Auto-schedule${(sv.plan || []).length ? ` (${sv.plan.length} with suggested dates)` : ''}`), h('span.grow'), h('button.btn', { onclick: async () => { if (await confirmDialog('Skip this list? You can request another survey later.', { ok: 'Skip' })) { await op({ op: 'survey.decide', id: sv.id, accept: [] }, { silent: true }); toast({ text: 'Survey skipped.' }); } } }, 'Not needed'), countBtn));
  upd();
  return card;
}


/* ============================================================ explore: trail (your questions over time) */
const trailLive = () => (S.L && S.L.trail_live) || { running: false, step: '', stale: false, status: 'idle' };
const trailData = () => (S.L && S.L.trail) || {};
const TRAIL_KIND_LABEL = { survey: 'Survey request', note: 'Note', expert: 'Expert discussion' };
const TRAIL_LINK_LABEL = { grew: 'grew out of', returns: 'returns to', contrasts: 'contrasts with', same: 'same as' };
const TRAIL_FALLBACK_COLORS = ['#7c5cff', '#0ea5e9', '#f59e0b', '#16a34a', '#e11d48', '#8b5cf6', '#14b8a6', '#f97316'];
/* a usable ISO timestamp, else the date in the id (q_20261012_…), else '' (listed as undated, never drawn) */
const trailDate = (iso, id) => /^\d{4}-\d{2}-\d{2}/.test(iso || '') ? iso : (/^[qx]_(\d{4})(\d{2})(\d{2})_/.exec(id || '') ? `${RegExp.$1}-${RegExp.$2}-${RegExp.$3}T00:00:00` : '');
/* one list of everything the user wrote, oldest first: requests (surveys + notes) and expert briefs */
function trailEntries() {
  const L = S.L, t = trailData(), items = {};
  for (const it of t.items || []) items[it.id] = it;
  const surveys = {}; for (const sv of L.surveys || []) surveys[sv.id] = sv;
  const out = [];
  for (const r of L.requests || []) {
    if (!r.id || !(r.text || '').trim()) continue;
    const sv = r.survey ? surveys[r.survey] : null, topic = sv && sv.topic && sv.topic.id ? (topicById(sv.topic.id) || sv.topic) : null;
    out.push({ id: r.id, src: 'request', kind: r.kind === 'note' ? 'note' : 'survey', text: r.text, created: trailDate(r.created, r.id), status: r.status || 'open', survey: sv || null, topic, tags: r.tags || [], pinned: !!r.pinned, note: r.note || '', a: items[r.id] || null, raw: r });
  }
  for (const x of L.experts || []) {
    if (!x.id) continue;
    out.push({ id: x.id, src: 'expert', kind: 'expert', text: x.context || x.title || '', title: x.title || '', created: trailDate(x.created, x.id), status: 'done', survey: null, topic: null, tags: [], pinned: false, note: '', a: items[x.id] || null, raw: x });
  }
  out.sort((a, b) => (a.created || '').localeCompare(b.created || '') || a.id.localeCompare(b.id));
  out.forEach((e, i) => { e.num = i + 1; });
  return out;
}
/* lanes of the strip: Claude's threads when analysed (entries newer than the analysis go to a "New" lane), else grouped by survey topic */
function trailThreads(entries) {
  const t = trailData(), ready = (t.threads || []).length > 0;
  const lanes = [], byId = {};
  if (ready) {
    for (const th of t.threads) { const ln = { id: th.id, name: th.name || th.id, zh: th.zh || '', statement: th.statement || '', color: th.color || TRAIL_FALLBACK_COLORS[lanes.length % TRAIL_FALLBACK_COLORS.length], role: th.role || 'side', topic_id: th.topic_id || '', entries: [], fallback: false }; lanes.push(ln); byId[ln.id] = ln; }
    let fresh = null;
    for (const e of entries) {
      const tid = e.a && e.a.thread && byId[e.a.thread] ? e.a.thread : null;
      if (tid) { e.thread = tid; byId[tid].entries.push(e); continue; }
      if (!fresh) fresh = { id: '__new', name: 'Not analysed yet', zh: '', statement: 'Newer than the last analysis', color: '#9aa3b2', role: 'new', topic_id: '', entries: [], fallback: true };
      e.thread = '__new'; fresh.entries.push(e);
    }
    if (fresh) lanes.push(fresh);
  } else {
    const mk = (id, name, zh, color, role) => { const ln = { id, name, zh, statement: '', color, role, topic_id: '', entries: [], fallback: true }; lanes.push(ln); byId[id] = ln; return ln; };
    for (const e of entries) {
      let ln;
      if (e.topic) ln = byId['t:' + e.topic.id] || mk('t:' + e.topic.id, e.topic.name || e.topic.zh || 'Topic', e.topic.zh || '', /^#[0-9a-f]{6}$/i.test(e.topic.color || '') ? e.topic.color : TRAIL_FALLBACK_COLORS[lanes.length % TRAIL_FALLBACK_COLORS.length], 'core');
      else if (e.kind === 'expert') ln = byId.experts || mk('experts', 'Expert discussions', '', '#8b5cf6', 'side');
      else if (e.kind === 'note') ln = byId.notes || mk('notes', 'Notes', '', '#f59e0b', 'side');
      else ln = byId.pending || mk('pending', 'Surveys in progress', '', '#9aa3b2', 'side');
      e.thread = ln.id; ln.entries.push(e);
    }
  }
  return lanes.filter(l => l.entries.length);
}
function trailFilterState() { return S.trail || (S.trail = { sel: null, q: '', thread: null, kind: 'all', showCancelled: false, storyOpen: false, draft: '', replay: null }); }
function trailMatches(e, st) {
  if (!st.showCancelled && e.status === 'cancelled' && st.sel !== e.id) return false;
  if (st.kind !== 'all' && e.kind !== st.kind) return false;
  if (st.thread && e.thread !== st.thread) return false;
  return true;
}
/* search: every token must match; the rank says where it matched (verbatim text first), which the list shows as "matched: …" */
function trailSearchRank(e, q, lanes) {
  if (!q) return { rank: 0, via: '' };
  const toks = q.toLowerCase().split(/\s+/).filter(Boolean); if (!toks.length) return { rank: 0, via: '' };
  const lane = lanes.find(l => l.id === e.thread) || {};
  const groups = [[1, [e.text, e.title]], [2, [e.a && e.a.station, e.a && e.a.gist, e.a && e.a.intent]], [3, [...((e.a && e.a.keywords) || []), ...(e.tags || []).map(x => '#' + x), e.note]], [4, [lane.zh, lane.name, e.topic && e.topic.name, e.topic && e.topic.zh]], [5, (e.survey && e.survey.status === 'accepted' ? e.survey.candidates.filter(c => c.selected).map(c => c.short || c.title) : [])], [6, [e.id]]];
  const all = groups.flatMap(([, vals]) => vals).filter(Boolean).join('\n').toLowerCase();
  if (!toks.every(w => all.includes(w))) return null;
  for (const [rank, vals] of groups) { const hit = vals.filter(Boolean).find(v => toks.some(w => String(v).toLowerCase().includes(w))); if (hit) return { rank, via: rank === 1 ? '' : String(hit) }; }
  return { rank: 7, via: '' };
}
const trailGist = e => (e.a && e.a.gist) || e.title || (e.text || '').replace(/\s+/g, ' ').trim();
const trailStation = e => (e.a && (e.a.station || e.a.gist)) || e.title || (e.text || '').replace(/\s+/g, ' ').trim();
const cut = (str, n) => (str || '').length > n ? str.slice(0, n - 1) + '…' : (str || '');
const ageDays = iso => Math.max(0, dayDiff(todayStr(), (iso || todayStr()).slice(0, 10)));
const hexLum = hex => { const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || ''); if (!m) return 0.3; const [r, g, b] = [1, 2, 3].map(i => parseInt(m[i], 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

/* the strip and the list depend on filters and the selection; they are rebuilt in place so the capture box and the search field are never replaced under the user's hands */
function trailPatch() {
  const root = document.querySelector('#page .trail'); if (!root) { render(); return; }
  trailStopReplay();
  const parts = trailParts();
  for (const [sel, node] of [['.trstripcard', parts.strip], ['.trgrid', parts.grid], ['.trchips', parts.chips]]) { const old = root.querySelector(sel); if (old && node) old.replaceWith(node); else if (old && !node) old.replaceChildren(); }
  const cnt = root.querySelector('#trcount'); if (cnt) cnt.textContent = parts.count;
  const st = trailFilterState(); root.querySelectorAll('.trkinds button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st.kind)));
}
function trailParts() {
  const st = trailFilterState(), all = trailEntries(), lanes = trailThreads(all);
  const visible = all.filter(e => trailMatches(e, st)), q = st.q.trim();
  const ranks = {}; const hitList = [];
  for (const e of visible) { const r = trailSearchRank(e, q, lanes); if (r) { ranks[e.id] = r; hitList.push(e); } }
  const hits = new Set(hitList.map(e => e.id));
  if (st.sel && !all.some(e => e.id === st.sel)) st.sel = null;
  const sel = st.sel ? all.find(e => e.id === st.sel) : null;
  const side = sel ? trailDetail(sel, all, lanes) : trailInsights(trailData(), lanes, all);
  const grid = h('div.trgrid', h('div.trmain', innerWidth <= 720 && !sel ? h('details.trinsights', h('summary', 'Insights'), side) : null, trailLedger(visible, hits, ranks, lanes, st)), innerWidth <= 720 ? null : h('div.trside', side));
  return { all, lanes, strip: trailStrip(all, visible.filter(e => e.created), hits, lanes, st), grid, chips: trailChips(st, lanes), count: q || st.thread || st.kind !== 'all' ? `${hits.size} of ${all.length}` : `${all.length} ${all.length === 1 ? 'question' : 'questions'}` };
}
function renderTrail() {
  trailStopReplay();
  const st = trailFilterState(), live = trailLive(), t = trailData();
  const jot = trailJotBar(st);
  const all = trailEntries();
  if (!all.length) return h('div.trail', jot, h('div.card', { style: 'margin-top:4px' }, emptyState('Nothing in your trail yet. Jot a direction above, or ask for a survey: every question is kept with its date, and Claude draws the threads once there are a few.', null, 'explore')));
  const parts = trailParts();
  return h('div.trail',
    jot, trailSuggestions(t, st),
    trailFinder(st, parts.count, live, t),
    parts.chips,
    parts.strip,
    parts.grid);
}
/* capture bar: Enter saves a note, Ctrl+Enter asks Yan to survey, Shift+Enter a new line; `n` anywhere on the page focuses it */
function trailJotBar(st) {
  const inp = h('textarea#trjot.textarea.trjot', { rows: 1, placeholder: `Jot a question or direction…  Enter saves a note · Ctrl+Enter asks ${persona()} to survey`, 'data-autosave': '1', value: st.draft || '', 'aria-label': 'Jot a question',
    oninput: e => { st.draft = e.target.value; e.target.style.height = 'auto'; e.target.style.height = Math.min(6 * 22 + 16, e.target.scrollHeight) + 'px'; },
    onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); (e.ctrlKey || e.metaKey) ? ask() : save(); } } });
  if (st.draft) requestAnimationFrame(() => { inp.style.height = 'auto'; inp.style.height = Math.min(6 * 22 + 16, inp.scrollHeight) + 'px'; });
  const saveBtn = h('button.btn', { onclick: () => save() }, icon('note'), 'Save note');
  const askBtn = h('button.btn.btn-primary', { onclick: () => ask() }, icon('owl'), `Ask ${persona()} to survey`);
  const refocus = () => setTimeout(() => { const el = $('#trjot'); el && el.focus(); }, 60);
  async function save() { const t = inp.value.trim(); if (!t) { inp.focus(); return; } st.draft = ''; inp.blur(); if (await saveQuestionNote(t, { btn: saveBtn })) refocus(); else { st.draft = t; inp.focus(); } }
  async function ask() { const t = inp.value.trim(); if (!t) { inp.focus(); return; } inp.blur(); const rid = await submitSurveyRequest(t, { btn: askBtn, onDone: id => { st.draft = ''; if (innerWidth > 720) st.sel = id; } }); if (rid) { toast({ kind: 'ok', icon: 'owl', text: `${persona()} is on it; the console is open in the Survey view.`, action: { label: 'Survey view', fn: () => setExploreView('survey') } }); } }
  return h('div.trjotbar.card', inp, h('div.row', { style: 'gap:6px' }, saveBtn, askBtn));
}
function fillJot(text) { const st = trailFilterState(); st.draft = text; const ta = $('.trjot'); if (ta) { ta.value = text; ta.style.height = 'auto'; ta.style.height = Math.min(6 * 22 + 16, ta.scrollHeight) + 'px'; ta.focus(); ta.scrollIntoView({ block: 'center' }); } }
/* Claude's first two "ask next" questions, right where the user is about to type (click fills the box, never sends) */
function trailSuggestions(t, st) {
  const next = (t.next || []).slice(0, 2); if (!next.length) return null;
  return h('div.trsugg', h('span.faint.xs', `${persona()} suggests:`), next.map(n => h('button.chip.btnchip', { title: n.why || 'Click to put it in the box', onclick: () => fillJot(n.text) }, cut(n.text, 64))));
}
function trailFinder(st, count, live, t) {
  const search = h('input#trsearch.input.trsearch', { type: 'search', placeholder: 'Search your questions…  (/)', value: st.q, 'aria-label': 'Search questions', onfocus: e => { const n = e.target.value.length; try { e.target.setSelectionRange(n, n); } catch { } },
    oninput: e => { st.q = e.target.value; trailPatch(); }, onkeydown: e => { if (e.key === 'Enter' && !e.isComposing) { const first = document.querySelector('#page .trrow'); if (first) { trailSelect(first.dataset.id); } } else if (e.key === 'Escape') { e.target.value = ''; st.q = ''; trailPatch(); } } });
  const kinds = segmented([['all', 'All'], ['survey', 'Surveys'], ['note', 'Notes'], ['expert', 'Experts']], st.kind, v => { st.kind = v; trailPatch(); }, 'sm trkinds');
  [...kinds.children].forEach((b, i) => { b.dataset.v = ['all', 'survey', 'note', 'expert'][i]; });
  let status;
  if (live.running) status = h('span.row.small.muted', { style: 'gap:6px' }, h('span.spin'), h('span.ellip', { style: 'max-width:260px' }, live.step || 'Claude is reading your questions…'));
  else if (!t.updated) status = h('button.chip.btnchip', { title: 'Claude has not read your questions yet', onclick: analyzeTrail }, 'Not analysed ↻');
  else if (live.stale) status = h('button.chip.btnchip.warn', { title: settings().trail_auto !== false ? 'New questions since the last analysis; it re-reads automatically ~3 min after you stop writing' : 'New questions since the last analysis', onclick: analyzeTrail }, 'Stale · Re-analyse');
  return h('div.trfinder', search, kinds,
    h('label.row.small.muted', { style: 'gap:6px;white-space:nowrap' }, h('input', { type: 'checkbox', checked: st.showCancelled, onchange: e => { st.showCancelled = e.target.checked; trailPatch(); } }), 'Cancelled'),
    h('span.grow'), status, h('span#trcount.faint.xs', count));
}
function trailChips(st, lanes) {
  const chips = [];
  if (st.thread) { const l = lanes.find(x => x.id === st.thread) || {}; chips.push(h('button.chip.btnchip.accent', { onclick: () => { st.thread = null; trailPatch(); } }, h('span.dot', { style: `background:${l.color || 'var(--fg-3)'}` }), `Thread: ${l.zh || l.name || st.thread}`, ' ×')); }
  if (st.q.trim() || st.thread || st.kind !== 'all') chips.push(h('button.btn.btn-sm.btn-ghost', { onclick: () => { st.q = ''; st.thread = null; st.kind = 'all'; const inp = $('#trsearch'); if (inp) inp.value = ''; trailPatch(); } }, icon('x'), 'Clear'));
  return h('div.trchips', chips);
}
function trailSelect(id, { scroll = true } = {}) {
  const st = trailFilterState();
  st.sel = st.sel === id ? null : id;
  if (st.sel && innerWidth <= 720) {
    const all = trailEntries(), lanes = trailThreads(all), e = all.find(x => x.id === st.sel), ex = document.querySelector('dialog[data-trail]');
    if (e && ex) ex.querySelector('.trdetail').replaceWith(trailDetail(e, all, lanes, { dialog: true }));
    else if (e) { const dlg = openDialog({ cls: 'lg', body: trailDetail(e, all, lanes, { dialog: true }), onClose: () => { if (st.sel === e.id) st.sel = null; trailPatch(); } }); dlg.dataset.trail = '1'; }
  } else if (!st.sel) { const ex = document.querySelector('dialog[data-trail]'); if (ex && ex.closeDlg) ex.closeDlg(); }
  trailPatch();
  if (st.sel && scroll) scrollTrailTo(st.sel);
}
function scrollTrailTo(id) { requestAnimationFrame(() => { const el = document.querySelector(`.trrow[data-id="${CSS.escape(id)}"]`); if (el) { const d = el.closest('details.trmonth'); if (d && !d.open) d.open = true; el.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 700); } }); }
let TRAIL_BUSY = false;
async function analyzeTrail() {
  if (TRAIL_BUSY) return;
  if (!serverAtLeast('2.7.0')) { toast({ kind: 'warn', title: 'Library server needs a restart', text: `It is still running a version without the Trail. ${REMOTE ? 'Restart it first (see the remote guide).' : 'Run: systemctl --user restart paper-assistant-server'}`, timeout: 10000 }); return; }
  TRAIL_BUSY = true;
  try { await api.post('/api/trail/analyze', {}); if (S.L.trail_live) { S.L.trail_live.running = true; S.L.trail_live.step = 'Starting Claude…'; } render(); toast({ kind: 'ok', icon: 'sparkles', text: 'Claude is reading your questions; this takes a minute or two.' }); }
  catch (e) { errToast(e); }
  finally { TRAIL_BUSY = false; }
}

/* ---- the strip: lanes = threads, columns = days (then weeks, months, whatever fits the card), quiet stretches as short gaps, branch curves for lineage */
function trailStrip(all, visible, hits, lanes, st) {
  const phone = innerWidth <= 720;
  const content = $('#content'), W = clamp(((content && content.clientWidth) || 1072) - 32, 320, 1040) - 2;
  const L = phone ? 0 : 128, A = 20, lh = lanes.length <= 4 ? 34 : lanes.length <= 6 ? 30 : lanes.length <= 8 ? 22 : 18, H = A + lanes.length * lh + 6, P = W - L - 16;
  const entries = visible;
  /* granularity: day → week → month, the first whose buckets and gaps fit the plot width */
  const keyFns = { day: iso => iso.slice(0, 10), week: iso => mondayOf(iso.slice(0, 10)), month: iso => iso.slice(0, 7) + '-01' };
  const unitsBetween = { day: (a, b) => dayDiff(b, a), week: (a, b) => Math.round(dayDiff(b, a) / 7), month: (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)) };
  const gwOf = u => u <= 0 ? 0 : clamp(8 + 6 * Math.log2(1 + u), 10, 36);
  let g = 'day', B = [], gws = [];
  for (const cand of ['day', 'week', 'month']) {
    g = cand; B = [...new Set(entries.map(e => keyFns[g](e.created)))].sort(); gws = B.map((k, i) => i < B.length - 1 ? gwOf(unitsBetween[g](k, B[i + 1]) - 1) : 0);
    if (B.length * 14 + gws.reduce((a, b) => a + b, 0) <= P) break;
  }
  const cwMax = B.length <= 10 ? 56 : 40, sumG = gws.reduce((a, b) => a + b, 0);
  let cw = clamp(Math.floor((P - sumG) / Math.max(1, B.length)), 14, cwMax);
  const todayKey = keyFns[g](nowISO()), lastIsToday = B.length && B[B.length - 1] === todayKey;
  let todayGw = 0;
  if (B.length && !lastIsToday) todayGw = gwOf(unitsBetween[g](B[B.length - 1], todayKey) - 1) || 10;
  let slack = P - (B.length * cw + sumG + todayGw);
  if (slack > 0 && (sumG + todayGw) > 0) { const tot = sumG + todayGw, scale = 1 + slack / tot; gws = gws.map(w => Math.min(96, w * scale)); todayGw = Math.min(96, todayGw * scale); slack = P - (B.length * cw + gws.reduce((a, b) => a + b, 0) + todayGw); }
  if (slack > 0 && B.length <= 10) cw = Math.min(120, cw + Math.floor(slack / B.length));   // a young trail still reads as a picture, not a sliver at the left
  const xs = [], colX = [];
  let x = L + 8;
  B.forEach((k, i) => { colX.push(x); xs.push(x + cw / 2); x += cw + gws[i]; });
  const todayX = !lastIsToday && B.length ? x + todayGw : null;
  const bucketIdx = {}; B.forEach((k, i) => { bucketIdx[k] = i; });
  const svg = s('svg', { class: 'trmap', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Your questions over time: one lane per thread, one column per ' + g });
  const cy = k => A + k * lh + lh / 2;
  /* lane separators + today column tint */
  lanes.forEach((l, k) => { if (k) svg.appendChild(s('line', { class: 'trsep', x1: 0, x2: W, y1: A + k * lh, y2: A + k * lh })); });
  if (lastIsToday) svg.appendChild(s('rect', { class: 'trtodaycol', x: colX[B.length - 1], y: A, width: cw, height: H - A - 6, rx: 4 }));
  /* axis */
  let lastMonth = '';
  B.forEach((k, i) => {
    const mon = k.slice(0, 7);
    if (mon !== lastMonth) { svg.appendChild(s('text', { class: 'traxis mon', x: colX[i], y: 13 }, `${MONTHS[+k.slice(5, 7) - 1]}${!lastMonth ? ' ' + k.slice(0, 4) : ''}`)); lastMonth = mon; }
    else if (g === 'day' && cw >= 24) svg.appendChild(s('text', { class: `traxis ${k === todayKey ? 'today' : ''}`, x: xs[i], y: 13, 'text-anchor': 'middle' }, k === todayKey ? 'today' : String(+k.slice(8, 10))));
    else if (g === 'week' && cw >= 28) svg.appendChild(s('text', { class: 'traxis', x: xs[i], y: 13, 'text-anchor': 'middle' }, fmtMD(k)));
    if (gws[i] >= 20) { const days = dayDiff(B[i + 1], k); svg.appendChild(s('text', { class: 'traxis gap', x: colX[i] + cw + gws[i] / 2, y: 13, 'text-anchor': 'middle' }, days < 7 ? `+${days}d` : days < 56 ? `+${Math.round(days / 7)}w` : `+${Math.round(days / 30)}mo`)); svg.appendChild(s('line', { class: 'trtunnel', x1: colX[i] + cw + 4, x2: colX[i] + gws[i] + cw - 4, y1: A - 4, y2: A - 4 })); }
  });
  if (todayX != null) { svg.appendChild(s('line', { class: 'trtoday', x1: todayX, x2: todayX, y1: A - 2, y2: H - 6 })); svg.appendChild(s('text', { class: 'traxis today', x: Math.min(todayX, W - 16), y: 13, 'text-anchor': 'middle' }, 'today')); }
  /* lane labels in the gutter */
  if (L) lanes.forEach((l, k) => {
    const n = l.entries.filter(e => hits.has(e.id)).length, last = l.entries[l.entries.length - 1], dormant = last && ageDays(last.created) > 14;
    const gl = s('g', { class: `trlanelbl ${st.thread === l.id ? 'on' : ''} ${st.thread && st.thread !== l.id ? 'off' : ''} ${l.role} ${dormant ? 'dormant' : ''}`, role: 'button', tabindex: 0, 'aria-pressed': String(st.thread === l.id), onclick: () => { st.thread = st.thread === l.id ? null : l.id; trailPatch(); }, onkeydown: ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); st.thread = st.thread === l.id ? null : l.id; trailPatch(); } } });
    gl.appendChild(s('rect', { x: 0, y: A + k * lh, width: L, height: lh, fill: 'transparent' }));
    gl.appendChild(s('circle', { cx: 10, cy: cy(k), r: 3.2, fill: l.color, class: l.role === 'new' ? 'dotted' : '' }));
    const name = l.zh || l.name;
    gl.appendChild(s('text', { class: 'trlanename', x: 20, y: cy(k) + 3.5 }, cut(name, /[　-鿿]/.test(name) ? 9 : 15)));
    gl.appendChild(s('text', { class: 'trlanecount', x: L - 8, y: cy(k) + 3.5, 'text-anchor': 'end' }, String(n)));
    gl.appendChild(s('title', {}, `${l.name}${l.zh && l.zh !== l.name ? ` · ${l.zh}` : ''}${l.statement ? `\n${l.statement}` : ''}${dormant ? `\nlast touched ${fmtMD(last.created)}` : ''}`));
    svg.appendChild(gl);
  });
  /* cells: bucket × lane */
  const cells = {}, cellOf = {};
  for (const e of entries) { const b = bucketIdx[keyFns[g](e.created)], k = lanes.findIndex(l => l.id === e.thread); if (b == null || k < 0) continue; const key = b + ':' + k; (cells[key] ||= { b, k, es: [] }).es.push(e); cellOf[e.id] = key; }
  /* ribbons: alive span of each lane */
  for (const [k, l] of lanes.entries()) {
    const es = l.entries.filter(e => cellOf[e.id]); if (!es.length) continue;
    const b0 = cells[cellOf[es[0].id]].b, b1 = cells[cellOf[es[es.length - 1].id]].b, dormant = ageDays(es[es.length - 1].created) > 14;
    const noHit = !es.some(e => hits.has(e.id)) || (st.thread && st.thread !== l.id);
    svg.appendChild(s('rect', { class: `trribbon ${dormant ? 'dormant' : ''} ${noHit ? 'dim' : ''}`, x: colX[b0], y: cy(k) - 7, width: colX[b1] + cw - colX[b0], height: 14, rx: 7, fill: l.color, stroke: l.color, 'data-lane': l.id }));
  }
  /* branch curves */
  const t = trailData(), linksG = s('g', { class: 'trlinks' });
  for (const ln of t.links || []) {
    if (ln.kind === 'same') continue;
    const ca = cells[cellOf[ln.from]], cb = cells[cellOf[ln.to]]; if (!ca || !cb) continue;
    if (ca.k === cb.k && Math.abs(ca.b - cb.b) <= 1) continue;
    const x1 = xs[ca.b], y1 = cy(ca.k), x2 = xs[cb.b], y2 = cy(cb.k), lane = lanes[cb.k];
    const d = ca.k === cb.k ? `M${x1},${y1 - 5} Q${(x1 + x2) / 2},${y1 - (lh / 2 - 1)} ${x2},${y2 - 5}` : (() => { const c = clamp((x2 - x1) / 2, 16, 60); return `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`; })();
    const dim = !(hits.has(ln.from) && hits.has(ln.to)) || (st.thread && st.thread !== lanes[ca.k].id && st.thread !== lane.id);
    const p = s('path', { class: `trlink ${ln.kind} ${dim ? 'dim' : ''} ${st.sel && (st.sel === ln.from || st.sel === ln.to) ? 'hot' : ''}`, d, stroke: lane.color, 'data-from': ln.from, 'data-to': ln.to });
    const ea = all.find(e => e.id === ln.from), eb = all.find(e => e.id === ln.to);
    p.appendChild(s('title', {}, `${eb ? trailStation(eb) : ln.to} ${TRAIL_LINK_LABEL[ln.kind] || ln.kind} ${ea ? trailStation(ea) : ln.from}${ln.why ? `\n${ln.why}` : ''}`));
    linksG.appendChild(p);
  }
  svg.appendChild(linksG);
  /* stations */
  const labelsG = s('g', { class: 'trlabels' });
  for (const c of Object.values(cells)) {
    const l = lanes[c.k], x = xs[c.b], y = cy(c.k), n = c.es.length, first = c.es[0];
    const anyHit = c.es.some(e => hits.has(e.id)) && (!st.thread || st.thread === l.id), selected = c.es.find(e => e.id === st.sel);
    const cg = s('g', { class: `trcell ${anyHit ? '' : 'dim'} ${selected ? 'sel' : ''}`, 'data-b': c.b, 'data-ids': c.es.map(e => e.id).join(' '), tabindex: 0, role: 'button', 'aria-label': n === 1 ? `${TRAIL_KIND_LABEL[first.kind]}, ${fmtWhen(first.created)}: ${cut(first.text, 80)}` : `${n} questions on ${B[c.b]}`,
      onclick: () => trailSelect(selected ? selected.id : (hits.has(first.id) ? first : c.es.find(e => hits.has(e.id)) || first).id),
      onkeydown: ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); trailSelect(first.id); } },
      onmouseenter: () => c.es.forEach(e => { const row = document.querySelector(`.trrow[data-id="${CSS.escape(e.id)}"]`); row && row.classList.add('hov'); }), onmouseleave: () => document.querySelectorAll('.trrow.hov').forEach(r => r.classList.remove('hov')) });
    cg.appendChild(s('rect', { class: 'trhit', x: x - cw / 2, y: y - lh / 2, width: cw, height: lh, fill: 'transparent' }));
    if (selected) cg.appendChild(s('circle', { class: 'trhalo', cx: x, cy: y, r: 11, fill: l.color }));
    if (n === 1) {
      const e = first, op = (0.55 + 0.45 * clamp(1 - ageDays(e.created) / 120, 0, 1)).toFixed(2);
      const dg = s('g', { class: `trglyph ${e.kind} ${e.status}`, style: `--o:${op}`, 'data-id': e.id, stroke: l.color });
      if (e.status === 'working') dg.appendChild(s('circle', { class: 'trpulse', cx: x, cy: y, r: 9, stroke: l.color }));
      if (e.status === 'cancelled') dg.appendChild(s('circle', { class: 'trdot ghost', cx: x, cy: y, r: 4 }));
      else if (e.kind === 'expert') dg.appendChild(s('rect', { class: 'trdot', x: x - 4.5, y: y - 4.5, width: 9, height: 9, rx: 1.5, fill: l.color, transform: `rotate(45 ${x} ${y})` }));
      else if (e.kind === 'note' && e.status === 'noted') dg.appendChild(s('circle', { class: 'trdot', cx: x, cy: y, r: 5.5, 'stroke-dasharray': '2 2' }));
      else if (e.status === 'open') dg.appendChild(s('circle', { class: 'trdot', cx: x, cy: y, r: 5.5 }));
      else { dg.appendChild(s('circle', { class: 'trdot', cx: x, cy: y, r: 5.5, fill: l.color })); dg.appendChild(s('circle', { class: 'trinner', cx: x, cy: y, r: 2 })); }
      if (e.pinned) dg.appendChild(s('circle', { class: 'trpin', cx: x + 5, cy: y - 6, r: 2.2 }));
      cg.appendChild(dg);
      if (!phone && ((selected) || (lh >= 30 && cw >= 44))) labelsG.appendChild(s('text', { class: `trlabel ${selected ? 'sel' : ''} ${anyHit ? '' : 'dim'}`, x, y: c.k === lanes.length - 1 && !selected ? y + lh / 2 - 3 : y + lh / 2 - 3, 'text-anchor': 'middle' }, cut(trailStation(e), selected ? 14 : /[　-鿿]/.test(trailStation(e)) ? 7 : 11)));
    } else {
      const pw = Math.max(12, cw - 6), dark = hexLum(l.color) > 0.55;
      cg.appendChild(s('rect', { class: 'trpill', x: x - pw / 2, y: y - 6, width: pw, height: 12, rx: 6, fill: l.color }));
      if (cw >= 16) cg.appendChild(s('text', { class: 'trpilln', x, y: y + 3.2, 'text-anchor': 'middle', fill: dark ? '#111214' : '#ffffff' }, String(n)));
      if (selected) labelsG.appendChild(s('text', { class: 'trlabel sel', x, y: y + lh / 2 - 3, 'text-anchor': 'middle' }, cut(trailStation(selected), 14)));
    }
    cg.appendChild(s('title', {}, n === 1 ? `${WD[new Date(first.created).getDay()]} ${fmtMD(first.created)} · ${fmtTime(first.created)} · ${trailStation(first)}\n${cut(first.text, 120)}` : `${n} questions · ${fmtMD(first.created)}\n${c.es.slice(0, 3).map(e => '· ' + cut(e.text, 60)).join('\n')}${n > 3 ? `\n+${n - 3} more` : ''}`));
    svg.appendChild(cg);
  }
  svg.appendChild(labelsG);
  if (!entries.length) svg.appendChild(s('text', { class: 'traxis', x: W / 2, y: H / 2 + 4, 'text-anchor': 'middle' }, 'Nothing in this view'));
  const caption = h('div.trcaption', h('span#trreplaycap', ''), h('span.grow'), h('span.faint.xs', `by ${g}`));
  const replayBtn = h('button.icon-btn.sm.trreplay', { title: 'Replay: watch your questions appear in order', 'aria-label': 'Replay', onclick: () => trailReplay(svg, B, cells, xs, cw, colX, replayBtn) }, icon('play'));
  const legend = h('div.trlegend', h('span', s('svg', { viewBox: '-8 -8 16 16' }, s('circle', { r: 5.5, class: 'f' }), s('circle', { r: 2, class: 'i' })), 'survey done'), h('span', s('svg', { viewBox: '-8 -8 16 16' }, s('circle', { r: 5.5 })), 'not sent'), h('span', s('svg', { viewBox: '-8 -8 16 16' }, s('circle', { r: 5.5, 'stroke-dasharray': '2 2' })), 'note'), h('span', s('svg', { viewBox: '-8 -8 16 16' }, s('rect', { x: -4.5, y: -4.5, width: 9, height: 9, rx: 1.5, class: 'f', transform: 'rotate(45)' })), 'expert'), h('span', s('svg', { viewBox: '-8 -8 16 16' }, s('rect', { x: -7, y: -5, width: 14, height: 10, rx: 5, class: 'f' })), 'several'), h('span', s('svg', { viewBox: '0 0 24 16' }, s('path', { d: 'M2 13 C 10 13, 14 3, 22 3', fill: 'none', 'stroke-width': 1.5 })), 'grew out of'), h('span', s('svg', { viewBox: '0 0 24 16' }, s('path', { d: 'M2 13 C 10 13, 14 3, 22 3', fill: 'none', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' })), 'returns to'));
  return h('div.card.trstripcard', h('div.trstripbody', svg, replayBtn), h('div.trstripfoot', caption, legend));
}
function trailStopReplay() { const st = trailFilterState(); if (st.replay) { clearInterval(st.replay.timer); st.replay = null; } document.querySelectorAll('.trmap.replay').forEach(x => x.classList.remove('replay')); }
function trailReplay(svg, B, cells, xs, cw, colX, btn) {
  const st = trailFilterState();
  if (st.replay) { trailStopReplay(); btn.replaceChildren(icon('play')); const cap = $('#trreplaycap'); if (cap) cap.textContent = ''; return; }
  if (!B.length) return;
  const cellEls = [...svg.querySelectorAll('.trcell')], links = [...svg.querySelectorAll('.trlink')], ribbons = [...svg.querySelectorAll('.trribbon')];
  const ribbonFull = ribbons.map(r => ({ r, x: +r.getAttribute('x'), w: +r.getAttribute('width') }));
  const cellB = {}; for (const c of Object.values(cells)) for (const e of c.es) cellB[e.id] = c.b;
  svg.classList.add('replay'); cellEls.forEach(c => c.classList.remove('on', 'pop')); links.forEach(p => p.classList.remove('on'));
  let i = -1;
  const step = () => {
    if (!svg.isConnected) { trailStopReplay(); return; }
    i++;
    if (i >= B.length) { clearInterval(st.replay.timer); st.replay = null; svg.classList.remove('replay'); ribbonFull.forEach(({ r, w }) => r.setAttribute('width', w)); btn.replaceChildren(icon('refresh')); const cap = $('#trreplaycap'); if (cap) cap.textContent = `${B.length} ${B.length === 1 ? 'day' : 'steps'} · ${Object.values(cells).reduce((n, c) => n + c.es.length, 0)} questions`; return; }
    const xEnd = colX[i] + cw;
    cellEls.filter(c => +c.dataset.b === i).forEach(c => { c.classList.add('on'); if (!reducedMotion()) { c.classList.add('pop'); setTimeout(() => c.classList.remove('pop'), 320); } });
    links.forEach(p => { if (cellB[p.dataset.from] <= i && cellB[p.dataset.to] <= i) p.classList.add('on'); });
    ribbonFull.forEach(({ r, x, w }) => r.setAttribute('width', Math.max(0, Math.min(w, xEnd - x))));
    const n = Object.values(cells).filter(c => c.b === i).reduce((a, c) => a + c.es.length, 0), k = B[i];
    const cap = $('#trreplaycap'); if (cap) cap.textContent = `${WD[new Date(k + 'T00:00:00').getDay()]} ${fmtMD(k)} · ${n} ${n === 1 ? 'question' : 'questions'}`;
  };
  btn.replaceChildren(icon('stop'));
  st.replay = { timer: setInterval(step, 450) };
  step();
}

/* ---- the list: every question verbatim, newest day first; months before this one fold away unless you are searching; a search shows a flat ranked list */
function trailLedger(visible, hits, ranks, lanes, st) {
  const q = st.q.trim(), laneOf = {}; lanes.forEach(l => { laneOf[l.id] = l; });
  let rows = [...visible].filter(e => hits.has(e.id)).reverse();
  if (q) rows.sort((a, b) => (ranks[a.id].rank - ranks[b.id].rank) || b.created.localeCompare(a.created));
  if (!rows.length) return h('div.card', emptyState(q ? `Nothing matches “${q}”.` : 'Nothing to show with these filters.', q ? h('div.row', { style: 'gap:6px' }, h('button.btn.btn-sm', { onclick: () => { S.lib.q = q; go('library'); } }, 'Search papers in Library'), h('button.btn.btn-sm.btn-ghost', { onclick: () => { st.q = ''; const inp = $('#trsearch'); if (inp) inp.value = ''; trailPatch(); } }, 'Clear')) : null, 'search'));
  const row = (e, withDate) => {
    const l = laneOf[e.thread], selected = st.sel === e.id, r = ranks[e.id] || { rank: 0, via: '' }, tok = q.split(/\s+/)[0] || '';
    return h('button.trrow', { class: `${selected ? 'sel' : ''} ${e.status}`, 'data-id': e.id, onclick: () => trailSelect(e.id, { scroll: false }),
      onmouseenter: () => { const g = document.querySelector(`.trglyph[data-id="${CSS.escape(e.id)}"]`); g && g.classList.add('hov'); document.querySelectorAll(`.trlink[data-from="${CSS.escape(e.id)}"],.trlink[data-to="${CSS.escape(e.id)}"]`).forEach(p => p.classList.add('hot')); }, onmouseleave: () => { document.querySelectorAll('.trglyph.hov').forEach(x => x.classList.remove('hov')); if (st.sel !== e.id) document.querySelectorAll(`.trlink[data-from="${CSS.escape(e.id)}"],.trlink[data-to="${CSS.escape(e.id)}"]`).forEach(p => p.classList.remove('hot')); } },
      h('span.trtime', withDate ? `${fmtMD(e.created)} ${fmtTime(e.created)}` : fmtTime(e.created)),
      h('span.trmark', { style: `--c:${l ? l.color : 'var(--fg-3)'}`, class: `${e.kind} ${e.status}` }),
      h('div.grow', { style: 'min-width:0' },
        e.a && (e.a.station || e.a.gist) ? h('div.trstation', e.a.station || e.a.gist, e.a.station && e.a.gist && e.a.gist !== e.a.station ? h('span.trgist', e.a.gist) : null) : (e.title && e.title !== e.text ? h('div.trstation', e.title) : null),
        h('div.trtext', { class: selected ? 'full' : '' }, tok ? snippetOf(e.text, tok, selected ? 100000 : 240) : e.text),
        r.via ? h('div.trvia', 'matched: ', h('b', cut(r.via, 60))) : null,
        h('div.trmeta', e.kind !== 'survey' ? chip(TRAIL_KIND_LABEL[e.kind], e.kind === 'note' ? 'warn' : '') : null,
          e.status === 'working' ? chip('In progress', 'accent') : e.status === 'open' ? chip('Not sent yet', 'warn') : e.status === 'cancelled' ? chip('Cancelled', '') : null,
          e.topic ? h('span.faint.xs', `${e.topic.emoji || ''} ${e.topic.name || e.topic.zh}`.trim()) : null,
          e.survey && e.survey.status === 'accepted' ? h('span.faint.xs', `${e.survey.candidates.filter(c => c.selected).length} papers`) : e.survey && e.survey.status === 'proposed' ? chip('In inbox', 'accent') : null,
          (e.tags || []).map(tg => chip(`#${tg}`, 'outline')), e.pinned ? h('span.trpinned', icon('star')) : null)),
      h('span.faint.xs.trnum', `#${e.num}`));
  };
  if (q) return h('div.trledger', h('div.trdayhead', h('b', `${rows.length} ${rows.length === 1 ? 'match' : 'matches'}`), h('span.faint.xs', 'best match first')), rows.map(e => row(e, true)));
  const days = []; let cur = null;
  for (const e of rows) { const d = e.created.slice(0, 10); if (!cur || cur.date !== d) { cur = { date: d, rows: [] }; days.push(cur); } cur.rows.push(e); }
  const dayEl = g => h('section.trday', h('div.trdayhead', h('b', !g.date ? 'Undated' : relDate(g.date) === fmtMD(g.date) ? `${WD[new Date(g.date + 'T00:00:00').getDay()]} ${fmtMD(g.date)}` : `${relDate(g.date)} · ${fmtMD(g.date)}`), h('span.faint.xs', `${g.rows.length}`)), g.rows.map(e => row(e, false)));
  const thisMonth = todayStr().slice(0, 7), months = []; let m = null;
  for (const g of days) { const k = g.date.slice(0, 7); if (!m || m.key !== k) { m = { key: k, days: [] }; months.push(m); } m.days.push(g); }
  const active = !!(st.thread || st.kind !== 'all');
  return h('div.trledger', months.map(mo => mo.key === thisMonth || !mo.key || months.length === 1 ? mo.days.map(dayEl)
    : h('details.trmonth', { open: active || mo.days.some(g => g.rows.some(e => e.id === st.sel)) }, h('summary', `${MONTHS[+mo.key.slice(5, 7) - 1]} ${mo.key.slice(0, 4)}`, h('span.faint.xs', { style: 'margin-left:8px;font-weight:400' }, `${mo.days.reduce((n, g) => n + g.rows.length, 0)} questions`)), mo.days.map(dayEl))));
}
/* ---- side panel, nothing selected: the cold-return screen */
function trailInsights(t, lanes, all) {
  const st = trailFilterState(), live = trailLive(), pinned = all.filter(e => e.pinned), byId = {}; all.forEach(e => { byId[e.id] = e; });
  const sec = (title, ...body) => h('div.trsec', h('div.gsh', title), body);
  const parts = [];
  if (pinned.length) parts.push(sec('Pinned', h('div.col', { style: 'gap:4px;margin-top:4px' }, pinned.slice(0, 8).map(e => h('button.trlinkrow', { onclick: () => trailSelect(e.id) }, h('span.trpinned', icon('star')), h('span.grow.ellip', trailStation(e)), h('span.faint.xs', fmtMD(e.created)))))));
  if (t.north_star) parts.push(h('div.trsec.hl', h('div.gsh', 'What you’re after'), h('p.trns', t.north_star), h('div.faint.xs', { style: 'margin-top:6px' }, `as of ${fmtMD(t.updated)} · ${all.length} entries`, (t.north_star_history || []).length ? [' · ', h('button.linkbtn.xs', { onclick: e => popover(e.currentTarget, h('div.col', { style: 'gap:8px;max-width:360px' }, h('div.gsh', 'Earlier north stars'), t.north_star_history.map(x => h('div.small', h('div.faint.xs', fmtWhen(x.as_of)), h('div', { style: 'line-height:1.6' }, x.text))))) }, `history (${t.north_star_history.length})`)] : null)));
  else if (!live.running && !t.updated) parts.push(h('div.trsec.hl', h('div.gsh', `Let ${persona()} read your questions`), h('p.small', { style: 'margin:4px 0 8px;line-height:1.65' }, 'Claude groups them into threads, draws which question grew out of which, names the through-line you keep circling, and lists what you left open and what to ask next.'), h('button.btn.btn-primary.btn-sm', { style: 'align-self:flex-start', disabled: live.running, onclick: analyzeTrail }, icon('sparkles'), 'Analyse')));
  if (t.story) parts.push(sec('How your focus moved', h('div.trstorytext', trailStoryNodes(t.story, all))));
  if ((t.open_loops || []).length) parts.push(sec('Still open', h('div.col', { style: 'gap:6px;margin-top:4px' }, t.open_loops.map(o => { const e = o.id ? byId[o.id] : null; return h('div.trloop', h('span.trbullet'), h('div.grow', { style: 'min-width:0' }, h('div.small', { style: 'line-height:1.55' }, o.text), e ? h('div.row', { style: 'gap:6px;margin-top:2px' }, h('button.linkbtn.xs', { onclick: () => trailSelect(e.id) }, `${trailStation(e)} · ${fmtMD(e.created)}`), e.src === 'request' && (e.status === 'noted' || e.status === 'open' || e.status === 'cancelled') ? h('button.linkbtn.xs', { style: 'color:var(--accent)', onclick: () => sendToSurvey(e) }, 'Survey') : null) : null)); }))));
  if ((t.next || []).length) parts.push(sec('Ask next', h('div.col', { style: 'gap:6px;margin-top:4px' }, t.next.map(n => { const l = lanes.find(x => x.id === n.thread); return h('div.trnq', h('div', { style: 'line-height:1.55' }, l ? h('span.dot', { style: `background:${l.color}`, title: l.name }) : null, n.text), n.why ? h('div.faint.xs', { style: 'margin-top:2px;line-height:1.5' }, n.why) : null, h('div.row', { style: 'gap:4px;margin-top:5px' }, h('button.btn.btn-sm.btn-ghost', { onclick: () => fillJot(n.text) }, icon('edit'), 'Jot'), h('button.btn.btn-sm.btn-ghost', { onclick: e => submitSurveyRequest(n.text, { btn: e.currentTarget }).then(rid => { if (rid) { st.sel = rid; setExploreView('survey'); } }) }, icon('owl'), 'Survey'))); }))));
  if ((t.motifs || []).length) parts.push(sec('Recurring', h('div.row.wrap', { style: 'gap:4px;margin-top:4px' }, t.motifs.map(m => h('button.chip.btnchip', { title: 'Search for it', onclick: () => { st.q = m; const inp = $('#trsearch'); if (inp) inp.value = m; trailPatch(); } }, m)))));
  if (!t.north_star && lanes.length) parts.push(sec('Threads', h('div.col', { style: 'gap:4px;margin-top:4px' }, lanes.map(l => h('button.trthread', { class: st.thread === l.id ? 'on' : '', onclick: () => { st.thread = st.thread === l.id ? null : l.id; trailPatch(); } }, h('span.dot', { style: `background:${l.color}` }), h('div.grow', { style: 'min-width:0' }, h('div.row', { style: 'gap:6px' }, h('b.ellip', l.name), l.zh && l.zh !== l.name ? h('span.muted.small.ellip', l.zh) : null, h('span.grow'), h('span.faint.xs', l.entries.length))))))));
  const foot = h('div.trfoot', live.running ? h('span.row.small.muted', { style: 'gap:6px' }, h('span.spin'), h('span', live.step || 'Analysing…')) : h('span.faint.xs', t.updated ? `Analysed ${fmtWhen(t.updated)} · ${t.model || ''}${t.error ? ` · last attempt failed` : ''}` : (settings().trail_auto !== false ? 'Re-reads automatically ~3 min after you stop writing' : 'Automatic analysis is off (Settings → Trail)')), h('span.grow'),
    live.running ? h('button.btn.btn-sm.btn-ghost', { onclick: async () => { try { await api.post('/api/trail/stop', {}); } catch (e) { errToast(e); } } }, 'Stop') : h('button.btn.btn-sm', { onclick: analyzeTrail, title: t.error || '' }, icon('sparkles'), t.updated ? 'Re-analyse' : 'Analyse'),
    h('a.btn.btn-sm.btn-ghost', { href: '/api/trail/md?download=1', title: 'Every question verbatim plus the analysis, as one Markdown file' }, icon('download'), 'Markdown'));
  if (t.error && (t.status === 'failed' || t.updated)) parts.unshift(h('div.gcerr', { style: 'font-size:var(--fs-xs)' }, t.error));
  return h('div.card.trdetail.insights', parts, foot);
}
/* the story cites entries as [q_…]; each becomes a chip with the station name that selects the entry */
function trailStoryNodes(story, all) {
  const byId = {}; all.forEach(e => { byId[e.id] = e; });
  const out = [], re = /\[([qx]_[0-9]{8}_[0-9a-f]{6})\]/g;
  let last = 0, m;
  while ((m = re.exec(story))) {
    if (m.index > last) out.push(story.slice(last, m.index));
    const e = byId[m[1]];
    if (e) out.push(h('button.trref', { title: `#${e.num} · ${fmtWhen(e.created)}\n${cut(e.text, 120)}`, onclick: () => trailSelect(e.id) }, cut(trailStation(e), 10)));
    else out.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < story.length) out.push(story.slice(last));
  return h('p', out);
}
async function sendToSurvey(e) {
  try {
    if (e.status !== 'open') await op({ op: 'request.update', id: e.id, fields: { kind: 'survey', status: 'open' } }, { silent: true, noReload: true });
    await startConsole('survey', e.id); await reload(); setExploreView('survey');
  } catch (err) { errToast(err); await reload(); }
}
/* ---- the detail panel of one question */
function trailDetail(e, all, lanes, { dialog = false } = {}) {
  const st = trailFilterState(), t = trailData(), lane = lanes.find(l => l.id === e.thread);
  const inLinks = (t.links || []).filter(l => l.to === e.id && all.some(x => x.id === l.from)), outLinks = (t.links || []).filter(l => l.from === e.id && all.some(x => x.id === l.to));
  const isReq = e.src === 'request', live = isReq ? termFor(e.id) : null, a = e.a || null;
  const upd = fields => op({ op: 'request.update', id: e.id, fields }, { silent: true });
  const updD = debounce(fields => op({ op: 'request.update', id: e.id, fields }, { silent: true, noReload: true }), 600);
  const leave = el => { if (!dialog) return; const d = (el && el.closest && el.closest('dialog')) || document.querySelector('dialog[data-trail]'); if (d && d.closeDlg) { st.sel = null; d.closeDlg(); } };
  const statusChip = isReq && e.status !== 'done' ? chip(REQ_ZH[e.status] || e.status, e.status === 'working' ? 'accent' : e.status === 'open' ? 'warn' : e.status === 'noted' ? 'warn' : '') : e.survey ? chip(e.survey.status === 'accepted' ? 'Surveyed' : e.survey.status === 'proposed' ? 'In inbox' : 'Declined', e.survey.status === 'accepted' ? 'ok' : e.survey.status === 'proposed' ? 'accent' : '') : null;
  const head = h('div.row', { style: 'gap:8px;flex-wrap:wrap' },
    dialog ? null : h('button.linkbtn.small', { onclick: () => { st.sel = null; trailPatch(); } }, '← Insights'),
    h('span.trmark.big', { style: `--c:${lane ? lane.color : 'var(--fg-3)'}`, class: `${e.kind} ${e.status}` }), statusChip, h('span.muted.small', fmtWhen(e.created)), h('span.grow'),
    isReq ? h('button.icon-btn.sm', { class: e.pinned ? 'on' : '', title: e.pinned ? 'Unpin' : 'Pin: listed first in Insights, dotted on the strip', 'aria-pressed': String(e.pinned), onclick: () => upd({ pinned: !e.pinned }) }, icon('star')) : null,
    h('button.icon-btn.sm', { title: 'Copy the question', onclick: () => navigator.clipboard && navigator.clipboard.writeText(e.text).then(() => toast({ kind: 'ok', text: 'Copied.' })).catch(() => toast({ kind: 'warn', text: 'Clipboard unavailable.' })) }, icon('copy')));
  const text = h('div.trverbatim', e.title && e.title !== e.text ? h('b', { style: 'display:block;margin-bottom:6px' }, e.title) : null, e.text);
  const stamp = h('div.faint.xs.mono.trstamp', { title: 'Click to copy the id', onclick: () => navigator.clipboard && navigator.clipboard.writeText(e.id).then(() => toast({ kind: 'ok', text: 'Id copied.' })).catch(() => { }) }, `${(e.created || '').replace('T', ' ')} · ${relWhen(e.created)} · #${e.num} · ${e.id}`);
  const reading = a ? h('div.trsec', h('div.gsh', 'Claude’s reading'), a.station ? h('h4.trstationh', a.station) : null, a.gist ? h('div.small.muted', a.gist) : null, a.intent ? h('div.gjump', { style: 'margin-top:6px' }, h('span.faint.xs', { style: 'display:block' }, 'What you wanted to do'), a.intent) : null,
    (a.keywords || []).length || a.question_type ? h('div.row.wrap', { style: 'gap:4px;margin-top:6px' }, a.question_type ? chip(a.question_type, 'accent') : null, (a.keywords || []).map(k => h('button.chip.btnchip', { title: 'Search this keyword', onclick: ev => { st.q = k; const inp = $('#trsearch'); if (inp) inp.value = k; leave(ev.currentTarget); trailPatch(); } }, k))) : null) : h('div.faint.small', 'Not analysed yet');
  const threadRow = lane ? h('button.trthread', { onclick: ev => { st.thread = lane.id; leave(ev.currentTarget); trailPatch(); } }, h('span.dot', { style: `background:${lane.color}` }), h('div.grow', { style: 'min-width:0' }, h('div.row', { style: 'gap:6px' }, h('b.ellip', lane.name), lane.zh && lane.zh !== lane.name ? h('span.muted.small.ellip', lane.zh) : null, h('span.grow'), lane.role === 'core' ? chip('core', 'accent') : null), lane.statement ? h('div.small.muted.trstmt', lane.statement) : null)) : null;
  const linkRow = (l, other) => h('button.trlinkrow', { title: l.why || '', onclick: () => trailSelect(other.id) }, h('span.trmark', { style: `--c:${(lanes.find(x => x.id === other.thread) || {}).color || 'var(--fg-3)'}`, class: `${other.kind} ${other.status}` }), h('div.grow', { style: 'min-width:0' }, h('div.row', { style: 'gap:6px' }, h('span.ellip', trailStation(other)), h('span.grow'), h('span.faint.xs', fmtMD(other.created))), l.why ? h('div.faint.xs', { style: 'line-height:1.4' }, `${TRAIL_LINK_LABEL[l.kind] || l.kind}: ${l.why}`) : null));
  const lineage = h('div.trsec', h('div.gsh', 'Lineage'),
    inLinks.length ? [h('div.faint.xs', { style: 'margin-top:4px' }, 'Grew out of'), h('div.col', { style: 'gap:3px' }, inLinks.map(l => linkRow(l, all.find(x => x.id === l.from))))] : null,
    outLinks.length ? [h('div.faint.xs', { style: 'margin-top:6px' }, 'Led to'), h('div.col', { style: 'gap:3px' }, outLinks.map(l => linkRow(l, all.find(x => x.id === l.to))))] : null,
    !inLinks.length && !outLinks.length ? h('div.faint.small', a ? 'No links yet' : 'Links appear after the analysis') : null);
  let outcome = null;
  if (e.survey) {
    const sv = e.survey, acc = sv.candidates.filter(c => c.selected), tp = sv.topic || {};
    outcome = h('div.trsec', h('div.gsh', 'Outcome'), h('div.row.wrap', { style: 'gap:6px;margin-top:4px' }, h('span', `${tp.emoji || '📚'} ${tp.name || tp.zh || sv.query}`), sv.status === 'proposed' ? h('button.linkbtn.small', { onclick: () => setExploreView('survey') }, 'Proposed · in the inbox') : sv.status === 'accepted' ? h('span.muted.small', `Accepted ${acc.length} of ${sv.candidates.length}`) : h('span.muted.small', 'Declined')),
      sv.summary ? h('p.small.muted', { style: 'margin:6px 0 0;line-height:1.6' }, cut(sv.summary, 300)) : null,
      acc.length ? h('div.col', { style: 'gap:2px;margin-top:6px' }, acc.slice(0, 5).map(c => { const p = paperById(c.id); return h('button.linkbtn.small.ellip', { style: 'text-align:left;max-width:100%', title: c.title, onclick: () => { if (p) { go('library'); openDrawer(p.id); } else if (c.arxiv) openExternal(c.arxiv); } }, `${p && DONE.has(p.status) ? '✓ ' : ''}${c.short || c.title}`); }), acc.length > 5 ? h('span.faint.xs', `+${acc.length - 5} more`) : null) : null);
  } else if (e.src === 'expert') outcome = h('div.trsec', h('div.gsh', 'Outcome'), h('div.small.muted', { style: 'margin-top:4px' }, `Expert discussion · opened ${e.raw.opened || 0}×${e.raw.last_opened ? ` · last ${fmtWhen(e.raw.last_opened)}` : ''}`));
  else if (isReq && e.status === 'working') outcome = h('div.trsec', h('div.gsh', 'Outcome'), h('div.small.muted', { style: 'margin-top:4px' }, live ? `${persona()} is working on it in a console.` : 'Marked as in progress; no console is running for it right now.'));
  const loops = (t.open_loops || []).filter(o => o.id === e.id);
  const loopEl = loops.length ? h('div.trsec.hl', h('div.gsh', 'Still open'), loops.map(o => h('div.small', { style: 'margin-top:4px;line-height:1.6' }, o.text))) : null;
  let noteEl = null, tagsEl = null;
  if (isReq) {
    noteEl = h('div.trsec', h('div.gsh', 'Your note'), h('textarea.textarea', { rows: 2, maxlength: '4000', placeholder: 'What you later thought, found, or decided…', 'data-autosave': '1', value: e.note, 'aria-label': 'Note', style: 'min-height:56px', oninput: ev => updD({ note: ev.target.value }) }));
    const tagInput = h('input#trtagin.input', { placeholder: '+ tag', style: 'height:22px;font-size:var(--fs-xs);max-width:96px;padding:0 8px', 'aria-label': 'Add tag', onkeydown: ev => { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); const v = ev.target.value.trim().replace(/^#/, ''); if (v && !e.tags.includes(v)) upd({ tags: [...e.tags, v] }); ev.target.value = ''; } else if (ev.key === 'Backspace' && !ev.target.value && e.tags.length) upd({ tags: e.tags.slice(0, -1) }); } });
    tagsEl = h('div.trsec', h('div.gsh', 'Tags'), h('div.row.wrap', { style: 'gap:4px;margin-top:4px' }, e.tags.map(tg => h('span.chip.outline', `#${tg}`, h('button.icon-btn.sm', { style: 'width:16px;height:16px;margin:0 -4px 0 2px', title: 'Remove tag', 'aria-label': `Remove tag ${tg}`, onclick: () => upd({ tags: e.tags.filter(x => x !== tg) }) }, icon('x')))), tagInput));
  }
  const acts = h('div.tracts');
  if (isReq && (e.status === 'noted' || e.status === 'open' || e.status === 'cancelled')) acts.appendChild(h('button.btn.btn-primary.btn-sm', { onclick: ev => { ev.currentTarget.disabled = true; leave(ev.currentTarget); sendToSurvey(e); } }, icon('owl'), 'Send to survey'));
  else if (live) acts.appendChild(h('button.btn.btn-primary.btn-sm', { onclick: ev => { leave(ev.currentTarget); openConsole(live); } }, icon('terminal'), 'Open console'));
  else if (isReq && e.status === 'working') acts.appendChild(h('button.btn.btn-primary.btn-sm', { onclick: async ev => { const b = ev.currentTarget; b.disabled = true; leave(b); try { await startConsole('survey', e.id); await reload(); } catch (err) { errToast(err); } finally { b.disabled = false; } } }, icon('terminal'), 'Run in console'));
  else if (e.survey && e.survey.status === 'accepted' && e.topic) acts.appendChild(h('button.btn.btn-primary.btn-sm', { onclick: ev => { leave(ev.currentTarget); S.lib.topic = e.topic.id; store.set('libTopic', e.topic.id); go('library'); } }, icon('library'), 'Open papers'));
  else if (e.src === 'expert') acts.appendChild(h('button.btn.btn-primary.btn-sm', { onclick: ev => { leave(ev.currentTarget); go('expert'); setTimeout(() => openExpertChat(e.raw), 150); } }, icon('expert'), 'Continue'));
  if (e.src !== 'expert') acts.appendChild(h('button.btn.btn-sm', { title: 'Open a new Expert discussion starting from this question', onclick: ev => { leave(ev.currentTarget); const brief = (enUI() ? `${e.text}\n\n(This is a question I noted in Paper Assistant's Explore on ${fmtMD(e.created)}${e.survey && e.survey.topic ? `; the survey topic then was ${e.survey.topic.name || e.survey.topic.zh}` : ''}. Start from the most recent research and discuss it with me.)` : `${e.text}\n\n（這是我 ${fmtMD(e.created)} 在論文書房 Explore 記下的問題${e.survey && e.survey.topic ? `，當時的 survey 主題是 ${e.survey.topic.name || e.survey.topic.zh}` : ''}。請從最前沿的研究切入和我討論。）`).slice(0, 7900); if (S.page !== 'expert') go('expert'); setTimeout(() => newExpertDialog(brief), 120); } }, icon('expert'), 'Discuss'));
  acts.appendChild(h('button.btn.btn-sm.btn-ghost', { title: 'Put this question in the box to ask it again (edit it first)', onclick: ev => { leave(ev.currentTarget); fillJot(e.text); } }, icon('refresh'), 'Ask again'));
  const moreMenu = () => h('div.col', { style: 'gap:2px;min-width:200px' },
    e.kind === 'note' || e.status === 'noted' ? h('button.btn.btn-ghost', { style: 'justify-content:flex-start', onclick: ev => { closePop(); leave(ev.currentTarget); editTrailText(e); } }, icon('edit'), 'Edit text') : null,
    e.status === 'open' || e.status === 'working' ? h('button.btn.btn-ghost', { style: 'justify-content:flex-start', onclick: async ev => { closePop(); if (await confirmDialog(live ? 'Cancel this request and end its console?' : 'Cancel this request?', { ok: 'Cancel request' })) { leave(ev.currentTarget); if (live) await api.post('/api/term/kill', { id: live.id }).catch(() => { }); await op({ op: 'request.update', id: e.id, fields: { status: 'cancelled' } }, { silent: true }); } } }, icon('x'), 'Cancel request') : null,
    e.status === 'noted' ? h('button.btn.btn-ghost', { style: 'justify-content:flex-start', onclick: async ev => { closePop(); leave(ev.currentTarget); await op({ op: 'request.update', id: e.id, fields: { status: 'cancelled' } }, { silent: true }); toast({ text: 'Note archived (shown with “Cancelled”).' }); } }, icon('download'), 'Archive note') : null,
    h('button.btn.btn-ghost', { style: 'justify-content:flex-start;color:var(--danger)', onclick: async ev => { closePop(); if (await confirmDialog(`Delete this question from your trail?${e.survey ? ' The survey and its papers are kept.' : ''}`, { ok: 'Delete', danger: true })) { leave(ev.currentTarget); try { await op({ op: 'request.remove', id: e.id }, { silent: true }); st.sel = null; toast({ text: 'Question deleted.' }); } catch (err) { } } } }, icon('trash'), 'Delete'));
  if (isReq && !dialog) acts.appendChild(h('button.icon-btn.sm', { style: 'margin-left:auto', title: 'More', 'aria-label': 'More actions', onclick: ev => popover(ev.currentTarget, moreMenu()) }, icon('more')));
  const moreInline = isReq && dialog ? h('details.trmore', h('summary', 'More…'), moreMenu()) : null;
  return h('div.card.trdetail', { class: dialog ? 'indialog' : '' }, head, text, stamp, reading, threadRow, lineage, outcome, loopEl, tagsEl, noteEl, acts, moreInline);
}
function editTrailText(e) {
  const ta = h('textarea.textarea', { rows: 6, 'data-autosave': '1', value: e.text, 'aria-label': 'Question text', maxlength: '8000' });
  const dlg = openDialog({ title: 'Edit the note', body: ta, actions: [{ el: h('button.btn', { onclick: () => dlg.closeDlg() }, 'Cancel') }, { el: h('button.btn.btn-primary', { onclick: async () => { const v = ta.value.trim(); if (!v) { ta.focus(); return; } dlg.closeDlg(); await op({ op: 'request.update', id: e.id, fields: { text: v } }, { silent: true }); } }, 'Save') }] });
  setTimeout(() => ta.focus(), 50);
}
function onTrailEvent(d) {
  const L = S.L; if (!L) return;
  L.trail_live = Object.assign({}, L.trail_live || {}, { running: !!d.running, step: d.step || '' });
  if (d.done) {
    if (d.status === 'ready' && d.reason === 'manual') toast({ kind: 'ok', icon: 'sparkles', title: 'Your trail is updated', text: 'Claude re-read your questions.', action: S.page === 'explore' && exploreView() === 'trail' ? null : { label: 'Open Trail', fn: () => { go('explore'); setExploreView('trail'); } } });
    if (d.status === 'failed' && d.reason === 'manual') toast({ kind: 'danger', title: 'Trail analysis failed', text: d.error || '', timeout: 9000 });
    if (d.status === 'stopped') toast({ text: 'Analysis stopped.' });
    return;   // the record itself arrives with the library change event
  }
  if (S.page === 'explore' && exploreView() === 'trail' && !typingInProgress()) render();
}
addEventListener('resize', debounce(() => { if (S.page === 'explore' && exploreView() === 'trail' && S.L && !typingInProgress()) trailPatch(); }, 150));

/* ============================================================ page: stats */
function renderStats() {
  const D = S.D, ps = S.L.papers, t = todayStr(), play = playful();
  const weekStart = mondayOf(t), weekSess = (S.L.sessions || []).filter(x => (x.end || x.start || '').slice(0, 10) >= weekStart), weekMin = weekSess.reduce((a, x) => a + (x.minutes || 0), 0);
  pageHeader('Stats', play ? `Lv ${D.level} · ${D.xp} XP · ${D.streak}-day streak` : `${weekSess.length} ${weekSess.length === 1 ? 'session' : 'sessions'} · ${weekMin} min this week`, [
    h('a.btn', { href: '/api/export', download: `library-${t}.json` }, icon('download'), 'Export JSON'),
    h('button.btn', { onclick: importLibrary }, icon('upload'), 'Import'),
  ]);
  const read = ps.filter(p => p.status === 'read').length, deep = ps.filter(p => p.status === 'deep').length;
  const totalMin = (S.L.sessions || []).reduce((a, x) => a + (x.minutes || 0), 0);
  const nums = h('div.nums', [[read + deep, 'Read (incl. deep)'], [deep, 'Deep reads'], [ps.length, 'Papers'], [totalMin, 'Focus minutes'], [(S.L.ideas || []).length, 'Ideas & questions']].map(([n, l]) => h('div.statnum', h('b', n.toLocaleString()), h('span', l))));
  const lvl = h('div.lvl', h('div.big', `Lv${D.level}`), h('div.grow', h('div.row.between.small', h('span', h('b', D.xp), h('span.muted', ' XP')), h('span.muted', `Next level at ${D.level_next} XP`)), h('div.xpbar', h('i', { style: `width:${Math.round((D.level_progress || 0) * 100)}%` })), h('div.faint.xs', { style: 'margin-top:6px' }, `${Math.max(0, D.level_next - D.xp)} XP to go · 1 focus min = 1 XP · finish = 40 XP (T1 +20) · deep read = 80 XP`)));
  const earned = new Map((D.badges || []).map(b => [b.id, b]));
  const wall = h('div.badges', (D.badge_catalog || []).map(b => { const e = earned.get(b.id); return h('div.bdg', { class: e ? 'on' : '', title: b.desc }, h('div.ic', BADGE_EMOJI[b.id] || '🏅'), h('b', b.name), h('small', e ? `${e.date || ''}` : b.desc)); }));
  // weekly bars
  const byDate = activityByDate(), weeks = [], labels = [];
  const mon = mondayOf(t);
  for (let i = 11; i >= 0; i--) { const ws = addDays(mon, -7 * i); let sum = 0; for (let j = 0; j < 7; j++) sum += (byDate[addDays(ws, j)] || {}).min || 0; weeks.push(sum); labels.push(fmtMD(ws)); }
  const bars = barsChart(weeks, labels, { goal: (settings().daily_goal_minutes || 45) * (settings().work_days || [1, 2, 3, 4, 5]).length });
  const topicProg = h('div.topicprog', S.L.topics.map(tp => {
    const tps = ps.filter(p => p.topic === tp.id), n = tps.length || 1, cnt = k => tps.filter(p => p.status === k).length;
    return h('div.tp', h('span.ellip', `${tp.emoji || ''} ${tp.name || tp.zh}`), h('div.stack', ['deep', 'read', 'reading', 'queued'].map(k => h('i', { class: k, style: `width:${cnt(k) / n * 100}%`, title: `${STATUS_ZH[k]} ${cnt(k)}` }))), h('span.c', `${cnt('read') + cnt('deep')}/${tps.length}`));
  }), h('div.legend', [['deep', 'Deep'], ['read', 'Read'], ['reading', 'Reading'], ['queued', 'Queued']].map(([k, l]) => h('span', h('i', { class: k, style: `background:${k === 'deep' ? 'color-mix(in oklab,var(--ok) 85%,black)' : k === 'read' ? 'var(--ok)' : k === 'reading' ? 'var(--accent)' : 'var(--warn)'}` }), l))));
  const recent = ps.filter(p => DONE.has(p.status) && p.finished).sort((a, b) => b.finished.localeCompare(a.finished)).slice(0, 8);
  const nH = (S.L.highlights || []).length, nD = (S.L.discussions || []).length;
  const recNums = h('div.nums.three', [[nH, 'Highlights'], [nD, 'Discussion digests'], [(S.L.sessions || []).length, 'Reading sessions']].map(([n, l]) => h('div.statnum', h('b', n.toLocaleString()), h('span', l))));
  return h('div.bento',
    tile('Overview', nums, { span: 12 }),
    play ? tile('Level', lvl, { span: 6 }) : tile('Records', recNums, { span: 6 }),
    tile('Topic progress', S.L.topics.length ? topicProg : h('div.muted.small', 'No topics yet.'), { span: 6 }),
    play ? tile('Badges', wall, { span: 12, right: h('span.faint.xs', `${earned.size} / ${(D.badge_catalog || []).length}`) }) : null,
    tile('Heatmap', heatmap(), { span: 12 }),
    tile('Weekly focus minutes', h('div', bars, h('div.faint.xs', { style: 'margin-top:4px' }, 'Dashed line = weekly goal (daily goal × work days)')), { span: 6 }),
    tile('Recently finished', recent.length ? h('div.plist', recent.map(p => h('div.prow.clickable', { tabindex: 0, onclick: () => openDrawer(p.id) }, h('span.statusdot', { class: p.status }), h('div.grow', h('div.ttl', h('b', p.short || p.title)), h('div.meta', `${p.finished}${p.rating ? ` · ${'★'.repeat(p.rating)}` : ''} · ${STATUS_ZH[p.status]}`))))) : emptyState('Nothing here yet. Finish your first paper and this starts filling up.', null, 'book'), { span: 6 }));
}
function importLibrary() {
  const inp = h('input', { type: 'file', accept: 'application/json', style: 'display:none', onchange: async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const lib = JSON.parse(await f.text()); if (!lib.meta || lib.meta.version !== 2) throw new Error('Not a v2 library.json'); if (!await confirmDialog(`Importing replaces your current library (${(lib.papers || []).length} papers). The server backs up the existing file first.`, { ok: 'Import and replace', danger: true })) return; await api.post('/api/import', { library: lib }); toast({ kind: 'ok', text: 'Import complete.' }); reload(); }
    catch (err) { errToast(err); }
  } });
  document.body.appendChild(inp); inp.click(); setTimeout(() => inp.remove(), 60000);
}

/* ============================================================ page: settings */
function renderSettings() {
  const st = settings();
  pageHeader('Settings', 'Preferences, reminder times, topics and local options', []);
  const save = (fields, cb) => op({ op: 'settings.update', fields }, { silent: true }).then(cb);
  const saveD = debounce(save, 500);
  const row = (label, hint, ...ctl) => h('div.setrow', h('div.l', label, hint ? h('small', hint) : null), h('div.r', ctl));
  const text = (k, ph, type = 'text') => h('input.input', { type, value: st[k] || '', placeholder: ph, 'data-autosave': '1', oninput: e => saveD({ [k]: e.target.value }) });
  const num = (k, min, max, step = 1) => { const v = h('input.input', { type: 'number', min, max, step, value: st[k] || 0, style: 'max-width:90px', onchange: e => save({ [k]: clamp(+e.target.value || 0, min, max) }) }); return v; };
  const timeIn = k => h('input.input', { type: 'time', value: st[k] || '', style: 'max-width:130px', onchange: e => save({ [k]: e.target.value }) });
  const goalLbl = h('b.mono', `${st.daily_goal_minutes || 45} min`);
  const goalRange = h('input', { type: 'range', min: 15, max: 180, step: 5, value: st.daily_goal_minutes || 45, style: 'max-width:260px', oninput: e => goalLbl.textContent = `${e.target.value} min`, onchange: e => save({ daily_goal_minutes: +e.target.value }) });
  const ACCENTS = [['violet', '#5e6ad2'], ['blue', '#2563eb'], ['green', '#15803d'], ['rose', '#be123c'], ['amber', '#b45309']];
  const swatches = h('div.swatches', ACCENTS.map(([a, c]) => h('button.swatch', { style: `background:${c}`, 'aria-label': a, 'aria-pressed': String((st.accent || 'violet') === a), onclick: () => { applyAccent(a); save({ accent: a }); } })));
  const days = h('div.days', [1, 2, 3, 4, 5, 6, 7].map(d => h('button', { 'aria-pressed': String((st.work_days || []).includes(d)), onclick: () => { const set = new Set(st.work_days || []); set.has(d) ? set.delete(d) : set.add(d); save({ work_days: [...set].sort() }); } }, ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'][d - 1])));
  const theme = segmented([['auto', 'System'], ['light', 'Light'], ['dark', 'Dark']], store.get('theme', st.theme || 'auto'), v => { applyTheme(v); save({ theme: v }); });
  const topicsEl = h('div', S.L.topics.map(tp => {
    const u = (fields) => op({ op: 'topic.update', id: tp.id, fields }, { silent: true });
    const ud = debounce(u, 600);
    return h('div.toprow',
      h('input.input', { value: tp.emoji || '', 'aria-label': 'emoji', style: 'text-align:center;padding:0', maxlength: 4, 'data-autosave': '1', oninput: e => ud({ emoji: e.target.value }) }),
      h('input.input', { value: tp.name || '', placeholder: 'Name', 'data-autosave': '1', oninput: e => ud({ name: e.target.value }) }),
      h('input.input', { value: tp.zh || '', placeholder: 'Name (Chinese)', 'data-autosave': '1', oninput: e => ud({ zh: e.target.value }) }),
      h('div.row', h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(tp.color || '') ? tp.color : '#7c5cff', 'aria-label': 'Color', onchange: e => u({ color: e.target.value }) }), h('select.select', { 'aria-label': 'Status', onchange: e => u({ status: e.target.value }) }, [['active', 'Active'], ['paused', 'Paused'], ['done', 'Done']].map(([v, l]) => h('option', { value: v, selected: (tp.status || 'active') === v }, l)))),
      h('input.input.rq', { value: tp.radar_query || '', placeholder: 'Radar query (arXiv search, e.g. cat:cs.LG AND abs:"continual learning")', 'data-autosave': '1', oninput: e => ud({ radar_query: e.target.value }), onblur: () => { delete RADAR_CACHE[tp.id]; } }),
      h('span.faint.xs.mono', `${S.L.papers.filter(p => p.topic === tp.id).length} papers`),
      h('button.icon-btn.sm', { title: 'Delete topic (papers are kept)', onclick: async () => { if (await confirmDialog(`Delete topic “${tp.name || tp.zh}”? Its papers are kept but become uncategorized.`, { ok: 'Delete', danger: true })) { await op({ op: 'topic.remove', id: tp.id }, { silent: true }); toast({ text: 'Topic deleted.' }); } } }, icon('trash')));
  }), h('div.row', { style: 'margin-top:10px' }, h('button.btn.btn-sm', { onclick: addTopic }, icon('plus'), 'Add topic')));
  const sec = (title, ...rows) => h('section.card.setsec', h('h2', title), rows);
  const monSel = h('select.select', { 'aria-label': 'PDF screen', onchange: e => save({ reading_monitor: e.target.value }) }, h('option', { value: 'auto', selected: !st.reading_monitor || st.reading_monitor === 'auto' }, 'Auto · secondary screen (portrait preferred)'));
  api.get('/api/monitors').then(r => (r.monitors || []).forEach(m => monSel.appendChild(h('option', { value: String(m.index), selected: String(st.reading_monitor) === String(m.index) }, `Screen ${m.index + 1} · ${m.width}×${m.height}${m.portrait ? ' portrait' : ''}${m.primary ? ' · primary' : ''}`)))).catch(() => { });
  return h('div.setgrid',
    sec('Personal', row('Assistant name', 'Default: Yan', text('persona_name', 'Yan')), row('Your name', 'Used in greetings', text('user_name', '')), row('Email', 'Sent in the User-Agent when the survey script calls external APIs', text('user_email', 'you@example.com', 'email')), row('Research interests', `${persona()} uses this when surveying`, h('textarea.textarea', { value: st.profile || '', rows: 3, placeholder: 'e.g. First-year PhD, continual learning and LLMs, prefers method papers with open-source code…', 'data-autosave': '1', oninput: e => saveD({ profile: e.target.value }) }))),
    sec('Appearance', row('Theme', null, theme), row('Accent', null, swatches), row('Density', 'Row spacing in lists', segmented([['comfortable', 'Comfortable'], ['compact', 'Compact']], store.get('density', 'comfortable'), v => { applyDensity(v); render(); })), row('Reduce motion', 'Also follows the system setting', switchEl(!!st.reduced_motion, v => save({ reduced_motion: v }, applyMotion), 'Reduce motion')), row('Playful mode', 'XP, levels, badges, the owl, confetti and the radar. Reading logs, sessions and the heatmap are always kept.', switchEl(!!st.gamification, v => save({ gamification: v }, () => { render(); toast({ kind: 'ok', text: v ? 'Playful mode on.' : 'Playful mode off. Your logs are untouched.' }); }), 'Playful mode')), st.gamification ? row('Celebrations', 'Local setting', segmented([['always', 'Always'], ['sometimes', 'Sometimes'], ['off', 'Off']], S.celebrateMode, v => { S.celebrateMode = v; store.set('celebrate', v); render(); })) : null, row('Sounds', 'Chimes when you finish and when the timer ends', switchEl(!!st.sounds, v => save({ sounds: v }, () => v && blip()), 'Sounds'))),
    sec('Goals & rhythm', row('Daily focus goal', 'minutes', goalRange, goalLbl), row('Papers per week', null, num('weekly_goal_papers', 1, 30)), row('Pomodoro length', 'minutes', num('pomodoro_minutes', 5, 120, 5)), row('Work days', 'Auto-schedule only uses these days', days)),
    sec('Reading sessions', row('Remote mode', IN_DESKTOP ? 'Only for a browser on another computer; this is the desktop window on the library computer itself' : 'This browser is on another computer: PDFs, links and the reader open here, and nothing is launched on the library machine. Remembered per browser', IN_DESKTOP ? h('span.faint.small', 'Not applicable here') : switchEl(REMOTE, v => { setRemote(v); render(); toast({ kind: 'ok', text: v ? 'Remote mode on: PDFs and links open in this browser.' : 'Remote mode off: Read opens the PDF on the library computer\u2019s screen.' }); }, 'Remote mode')),
      row('PDF screen', 'Where the PDF window opens when you press Read', monSel),
      row('Full-screen PDF', 'The reading window fills that screen; Esc or F11 toggles it', switchEl(st.reading_fullscreen !== false, v => save({ reading_fullscreen: v }), 'Full-screen PDF')),
      row('PDF viewer', 'Built-in: a reader window placed on the chosen screen. System: your default viewer (Papers), which cannot be placed automatically', segmented([['builtin', 'Built-in'], ['system', 'System default']], st.reading_viewer === 'system' ? 'system' : 'builtin', v => save({ reading_viewer: v }))),
      row('Claude assistant', 'Open a Claude Code terminal loaded with the paper’s full text and your notes when a session starts', switchEl(st.reading_assistant !== false, v => save({ reading_assistant: v }), 'Claude assistant')),
      row('Assistant model', 'Claude model for the reading terminal', segmented([['opus', 'Opus'], ['sonnet', 'Sonnet'], ['fable', 'Fable']], st.assistant_model || 'opus', v => save({ assistant_model: v }))),
      row('Assistant effort', 'Reasoning effort for the reading terminal', segmented([['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], st.assistant_effort || 'medium', v => save({ assistant_effort: v }))),
      row('Expert model', 'Claude model for Expert discussions', segmented([['opus', 'Opus'], ['sonnet', 'Sonnet'], ['fable', 'Fable']], st.expert_model || st.assistant_model || 'opus', v => save({ expert_model: v }))),
      row('Expert effort', 'Reasoning effort for Expert discussions; literature search and critique benefit from High', segmented([['medium', 'Medium'], ['high', 'High'], ['xhigh', 'Extra high']], st.expert_effort || 'high', v => save({ expert_effort: v }))),
      row('Explain / Ask replies', 'Language the assistant answers in for Explain and Ask from the reader, the Expert page and Daily gap briefs', segmented([['zh-TW', '繁體中文'], ['en', 'English'], ['auto', 'Match my question']], st.assistant_language || 'zh-TW', v => save({ assistant_language: v }))),
      row('Opening message', 'What the assistant says when its terminal opens. Re-opened sessions just wait for you unless set to Always', segmented([['first', 'Orientation, first time only'], ['always', 'Always'], ['none', 'None']], st.assistant_opening || 'first', v => save({ assistant_opening: v })))),
    sec('Daily gap', row('Daily brief', 'One research direction a day, surveyed by Claude in the background (counts toward your Claude plan’s usage limits)', switchEl(st.daily_gap !== false, v => save({ daily_gap: v }), 'Daily brief')),
      row('Arrives after', 'Written once the library computer is on after this time', h('input.input', { type: 'time', value: st.daily_gap_time ?? '08:00', style: 'max-width:130px', onchange: e => save({ daily_gap_time: e.target.value }) })),
      row('Model', 'Claude model for briefs and their chat', segmented([['opus', 'Opus'], ['sonnet', 'Sonnet'], ['fable', 'Fable']], st.gap_model || 'opus', v => save({ gap_model: v }))),
      row('Target venue', 'The venue the briefs and their chat aim at (NeurIPS, ICLR, ACL, a journal…)', text('gap_venue', 'NeurIPS')),
      row('Brief effort', 'Reasoning effort while surveying and writing the brief', segmented([['medium', 'Medium'], ['high', 'High'], ['xhigh', 'Extra high']], st.gap_effort || 'high', v => save({ gap_effort: v }))),
      row('Chat effort', 'Reasoning effort for chat replies; lower answers faster', segmented([['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], st.gap_chat_effort || 'medium', v => save({ gap_chat_effort: v })))),
    sec('Trail', row('Automatic analysis', 'Claude re-reads all your questions a few minutes after they change (Explore → Trail); one short call without tools', switchEl(st.trail_auto !== false, v => save({ trail_auto: v }), 'Automatic analysis')),
      row('Model', 'Claude model for the trail analysis', segmented([['opus', 'Opus'], ['sonnet', 'Sonnet'], ['fable', 'Fable']], st.trail_model || 'opus', v => save({ trail_model: v }))),
      row('Effort', 'Reasoning effort for the analysis', segmented([['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], st.trail_effort || 'medium', v => save({ trail_effort: v })))),
    sec('Reminders', row('Morning briefing', 'Leave empty to disable', timeIn('morning_briefing')), row('Evening recap', 'Leave empty to disable', timeIn('evening_recap')), row('Streak nudge', 'Only if there’s no activity that day', timeIn('streak_nudge')), row('Desktop notifications', REMOTE ? 'Shown on the library computer, not in this browser' : null, switchEl(st.notifications !== false, v => save({ notifications: v }), 'Desktop notifications'), h('button.btn.btn-sm', { onclick: () => api.post('/api/notify', { title: APP_TITLE, body: `${persona()} is here. Notifications are working.` }).then(() => toast({ kind: 'ok', text: 'Test notification sent.' })).catch(errToast) }, 'Test notification'))),
    sec('Topics', h('div.faint.xs', { style: 'margin-top:-6px' }, 'Columns: emoji · name · name (Chinese) · color / status · radar query'), topicsEl),
    sec('Data & local', h('div.dz', h('span.muted', 'Reset local preferences (theme, sidebar, density, timer state; library data is untouched)'), h('button.btn.btn-sm.btn-danger', { onclick: async () => { if (await confirmDialog('Clear this browser’s local preferences?', { ok: 'Reset', danger: true })) { try { const keepRemote = store.get('remote', null); localStorage.clear(); if (keepRemote !== null) store.set('remote', keepRemote); } catch { } location.reload(); } } }, 'Reset')),
      h('div.footnote', h('span', `${APP_TITLE} v${(S.health || {}).version || '2'}`), h('span', `Data: ${(S.health || {}).root || '<library folder>'}/library.json`), h('a', { href: '/README.md', target: '_blank' }, 'README ↗'), h('a', { href: '/docs/ARCHITECTURE.md', target: '_blank' }, 'Architecture ↗'))));
}
function addTopic() {
  const name = h('input.input', { placeholder: 'Explainable AI' }), zh = h('input.input', { placeholder: 'Optional' }), emoji = h('input.input', { placeholder: '🔍', maxlength: 4 });
  const dlg = openDialog({ title: 'Add topic', cls: 'sm', body: h('div.col', { style: 'gap:10px' }, h('div.field', h('label', 'Name'), name), h('div.field', h('label', 'Chinese name (optional)'), zh), h('div.field', h('label', 'Emoji'), emoji)),
    actions: [{ el: h('button.btn', { onclick: () => dlg.closeDlg() }, 'Cancel') }, { el: h('button.btn.btn-primary', { onclick: async () => { if (!name.value.trim()) { name.focus(); return; } dlg.closeDlg(); await op({ op: 'topic.add', topic: { name: name.value.trim(), zh: zh.value.trim(), emoji: emoji.value.trim() || '📚' } }, { silent: true }); toast({ kind: 'ok', text: 'Topic added.' }); } }, 'Add') }] });
  setTimeout(() => name.focus(), 50);
}

/* ============================================================ page: map (knowledge map) */
const MAP = { group: store.get('mapGroup', 'topic'), view: store.get('mapView', 'graph'), edges: store.get('mapEdges', 'all'), inter: false, q: '', isolate: null };
(() => { try { const q = new URLSearchParams(location.search); const g = q.get('group'), v = q.get('view'), e = q.get('edges'); if (['topic', 'survey', 'cluster', 'subtopic', 'year'].includes(g)) MAP.group = g; if (['graph', 'list'].includes(v)) MAP.view = v; if (['sim', 'related', 'all'].includes(e)) MAP.edges = e; if (q.get('intersect') === '1') MAP.inter = true; if (q.get('isolate')) MAP.isolate = q.get('isolate'); } catch { } })();
const GROUP_MODES = [['topic', 'Topic'], ['survey', 'Survey batch'], ['cluster', 'Knowledge clusters'], ['subtopic', 'Subtopic'], ['year', 'Year']];
const PALETTE = ['#5e6ad2', '#0ea5e9', '#16a34a', '#e11d48', '#d97706', '#7c3aed', '#0d9488', '#db2777', '#65a30d', '#9333ea', '#ea580c', '#2563eb', '#ca8a04', '#0891b2', '#4f46e5', '#b91c1c'];
const YEAR_BUCKETS = [['y1', '≤2016', y => y > 0 && y <= 2016], ['y2', '2017–2019', y => y >= 2017 && y <= 2019], ['y3', '2020–2022', y => y >= 2020 && y <= 2022], ['y4', '2023+', y => y >= 2023], ['y0', 'Unknown year', y => !y]];
let GRAPH = null, GRAPH_REV = -1, GRAPH_LOADING = null;
async function loadGraph(force = false) {
  if (GRAPH && GRAPH_REV === S.rev && !force) return GRAPH;
  if (!GRAPH_LOADING) GRAPH_LOADING = api.get('/api/graph?k=4').then(g => { GRAPH = g; GRAPH_REV = S.rev; GRAPH_LOADING = null; return g; }).catch(e => { GRAPH_LOADING = null; throw e; });
  return GRAPH_LOADING;
}
function nodeGroups(n, mode) {
  if (mode === 'topic') return (n.topics && n.topics.length ? n.topics : (n.topic ? [n.topic] : [''])).map(x => x || '_none');
  if (mode === 'survey') return n.surveys && n.surveys.length ? n.surveys : ['_none'];
  if (mode === 'cluster') return [n.cluster || '_none'];
  if (mode === 'subtopic') return [n.subtopic || '_none'];
  const b = YEAR_BUCKETS.find(([, , f]) => f(n.year || 0)); return [b ? b[0] : 'y0'];
}
function buildGroups(g, mode) {
  const meta = {}, order = [];
  const add = (id, label, desc, color) => { if (!meta[id]) { meta[id] = { id, label, desc: desc || '', color: color || PALETTE[order.length % PALETTE.length], members: [] }; order.push(id); } };
  if (mode === 'topic') { S.L.topics.forEach(t => add(t.id, `${t.emoji || ''} ${t.name || t.zh}`.trim(), t.description, /^#/.test(t.color || '') ? t.color : null)); add('_none', 'Uncategorized', 'Papers without a topic'); }
  else if (mode === 'survey') { Object.entries(g.groupings.survey || {}).sort((a, b) => (a[1].created || '').localeCompare(b[1].created || '')).forEach(([id, m]) => { const sv = (S.L.surveys || []).find(s => s.id === id); add(id, m.label, (sv && sv.summary) || m.query); }); add('_none', 'Original list / manual', 'Papers not brought in by a survey'); }
  else if (mode === 'cluster') { (g.clusters || []).forEach(c => add(c.id, c.label, `Keywords: ${(c.terms || []).join(' · ')}`)); add('_none', 'Unclustered', ''); }
  else if (mode === 'subtopic') { S.L.topics.forEach(t => (t.subtopics || []).forEach(st => add(st.id || st.name, st.name, `${t.emoji || ''} ${t.name || t.zh}${st.description ? ' · ' + st.description : ''}`))); Object.entries(g.groupings.subtopic || {}).forEach(([id, m]) => add(id, m.label, '')); add('_none', 'No subtopic', ''); }
  else { YEAR_BUCKETS.forEach(([id, label]) => add(id, label, 'By publication year')); }
  for (const n of g.nodes) for (const gid of nodeGroups(n, mode)) { if (!meta[gid]) add(gid, gid, ''); meta[gid].members.push(n.id); }
  return { order: order.filter(id => meta[id].members.length), meta };
}
function mapActiveSet(g, groups) {
  const q = MAP.q.trim().toLowerCase();
  if (!q && !MAP.inter && !MAP.isolate) return null;
  const set = new Set();
  for (const n of g.nodes) {
    const gs = nodeGroups(n, MAP.group);
    if (MAP.inter && gs.length < 2) continue;
    if (MAP.isolate && !gs.includes(MAP.isolate)) continue;
    if (q && !`${n.short} ${n.title} ${(n.keywords || []).join(' ')} ${n.year}`.toLowerCase().includes(q)) continue;
    set.add(n.id);
  }
  return set;
}
function renderMap() {
  pageHeader('Map', GRAPH ? `${GRAPH.nodes.length} papers · ${GRAPH.edges.length} links · ${GRAPH.clusters.length} clusters` : 'Building the knowledge map…', [
    MAP.view === 'graph' ? h('button.btn', { onclick: () => { if (FG) { FG.shuffle(); } } }, icon('refresh'), 'Shuffle layout') : null,
  ]);
  const body = h('div#mapBody');
  const wrap = h('div.mappage', body);
  loadGraph().then(() => renderMapBody(body)).catch(e => body.replaceChildren(emptyState(`Couldn’t load the map: ${e.message}`, h('button.btn', { onclick: () => loadGraph(true).then(() => renderMapBody(body)) }, 'Retry'), 'x')));
  if (!GRAPH) body.replaceChildren(skeletonRows(5));
  return wrap;
}
function renderMapBody(body) {
  body = body || $('#mapBody'); if (!body || !GRAPH) return;
  const g = GRAPH, groups = buildGroups(g, MAP.group), active = mapActiveSet(g, groups);
  const sub = $('#pagehead .sub'); if (sub) sub.textContent = `${g.nodes.length} papers · ${g.edges.length} links · ${g.clusters.length} clusters`;
  const multi = g.nodes.filter(n => nodeGroups(n, MAP.group).length >= 2).length;
  const rerender = () => renderMapBody(body);
  const ctl = h('div.mapctl',
    h('div.row.wrap', h('span.label', 'Group by'), segmented(GROUP_MODES, MAP.group, v => { MAP.group = v; MAP.isolate = null; store.set('mapGroup', v); rerender(); }, 'sm'),
      h('span.label', { style: 'margin-left:8px' }, 'View'), segmented([['graph', 'Graph'], ['list', 'List']], MAP.view, v => { MAP.view = v; store.set('mapView', v); render(); }, 'sm')),
    h('div.row.wrap',
      h('div.search', { style: 'flex:1 1 160px;min-width:140px;position:relative' }, icon('search'), h('input.input', { type: 'search', placeholder: 'Search nodes…', value: MAP.q, 'aria-label': 'Search nodes', oninput: debounce(e => { MAP.q = e.target.value; if (MAP.view === 'graph' && FG) { FG.setActive(mapActiveSet(g, groups)); refreshLegend(); } else rerender(); }, 120) })),
      MAP.view === 'graph' ? [h('span.label', 'Edges'), segmented([['sim', 'Similar'], ['related', 'Citations'], ['all', 'All']], MAP.edges, v => { MAP.edges = v; store.set('mapEdges', v); rerender(); }, 'sm')] : null,
      h('label.row.small', { style: 'gap:6px;margin-left:auto' }, switchEl(MAP.inter, v => { MAP.inter = v; rerender(); }, 'Intersections only'), `Intersections only`, h('span.faint.xs', `(${multi})`))));
  const legend = h('div.legend2');
  const legendBox = h('details.legendbox', { open: innerWidth > 720 }, h('summary', `Legend · ${groups.order.length} groups`, MAP.isolate ? h('span.chip.accent', { style: 'margin-left:8px' }, 'Isolated') : null), legend);
  function refreshLegend() {
    legend.replaceChildren(...groups.order.map(id => { const m = groups.meta[id]; const act = active ? m.members.filter(x => active.has(x)).length : m.members.length; return h('button.lg', { class: MAP.isolate === id ? 'on' : MAP.isolate ? 'off' : '', title: m.desc || m.label, onclick: () => { MAP.isolate = MAP.isolate === id ? null : id; rerender(); } }, h('i', { style: `background:${m.color}` }), h('span.ellip', m.label), h('small', active && act !== m.members.length ? `${act}/${m.members.length}` : m.members.length)); }));
  }
  refreshLegend();
  const view = MAP.view === 'graph' ? mapGraphView(g, groups, active) : mapListView(g, groups, active);
  body.replaceChildren(ctl, legendBox, view);
}

/* ---- group list view */
function mapListView(g, groups, active) {
  const sections = groups.order.filter(id => !MAP.isolate || id === MAP.isolate).map(id => {
    const m = groups.meta[id];
    const ps = m.members.filter(x => !active || active.has(x)).map(paperById).filter(Boolean);
    if (!ps.length && active) return null;
    return h('details.card.mapsec', { open: true, style: `--gc:${m.color}` }, h('summary', h('i.gdot'), h('b', m.label), h('span.badge', ps.length), m.desc ? h('span.desc.ellip', m.desc) : null),
      h('div', { style: 'padding:0 12px' }, ps.length ? h('div.plist', ps.map(p => paperRow(p, { extraChips: nodeGroups(g.nodes.find(n => n.id === p.id) || {}, MAP.group).filter(x => x !== id).map(x => chip(groups.meta[x] ? groups.meta[x].label : x, 'outline')) }))) : h('div.faint.small', { style: 'padding:10px 0' }, 'No matching papers.')));
  }).filter(Boolean);
  const inter = g.nodes.filter(n => nodeGroups(n, MAP.group).length >= 2 && (!active || active.has(n.id)));
  const interSec = h('details.card.mapsec.inter', { open: true }, h('summary', h('i.gdot', { style: 'background:var(--accent)' }), h('b', 'Intersection'), h('span.badge', inter.length), h('span.desc', 'Papers in two or more groups')),
    h('div', { style: 'padding:0 12px' }, inter.length ? h('div.plist', inter.map(n => paperRow(paperById(n.id), { extraChips: nodeGroups(n, MAP.group).map(x => h('span.chip', { style: `color:${(groups.meta[x] || {}).color};background:color-mix(in oklab,${(groups.meta[x] || {}).color || 'var(--accent)'} 14%,transparent)` }, (groups.meta[x] || {}).label || x)) }))) : h('div.faint.small', { style: 'padding:10px 0' }, 'No intersections with this grouping.')));
  return h('div.col', { style: 'gap:12px' }, sections.length ? sections : emptyState('No matching papers.', null, 'search'), interSec);
}

/* ---- force-directed canvas graph */
let FG = null;
const POS = new Map();
function hash32(s) { let hh = 2166136261; for (let i = 0; i < s.length; i++) { hh ^= s.charCodeAt(i); hh = Math.imul(hh, 16777619); } return hh >>> 0; }
function mapGraphView(g, groups, active) {
  if (!FG) FG = new ForceGraph();
  const edges = g.edges.filter(e => MAP.edges === 'all' || e.kind === MAP.edges);
  FG.setData(g.nodes, edges, groups, MAP.group);
  FG.setActive(active);
  const box = h('div.mapcanvas', FG.el, FG.tip, h('div.maphint.faint.xs', 'Scroll to zoom · drag to pan · drag nodes · click to open'));
  requestAnimationFrame(() => FG.mount());
  return box;
}
class ForceGraph {
  constructor() {
    this.el = h('canvas', { 'aria-label': 'Knowledge map', role: 'img' }); this.tip = h('div.maptip', { hidden: true });
    this.ctx = this.el.getContext('2d'); this.nodes = []; this.edges = []; this.groups = null; this.mode = ''; this.active = null;
    this.k = 1; this.tx = 0; this.ty = 0; this.alpha = 0; this.raf = 0; this.hover = null; this.drag = null; this.pointers = new Map(); this.nonce = 0; this.fitted = false; this.w = 0; this.h = 0;
    this.ro = new ResizeObserver(() => this.resize());
    this.el.addEventListener('pointerdown', e => this.onDown(e)); this.el.addEventListener('pointermove', e => this.onMove(e)); this.el.addEventListener('pointerup', e => this.onUp(e)); this.el.addEventListener('pointercancel', e => this.onUp(e)); this.el.addEventListener('pointerleave', () => { if (!this.drag) this.setHover(null); });
    this.el.addEventListener('wheel', e => { e.preventDefault(); const f = Math.pow(1.0015, -e.deltaY); this.zoomAt(e.offsetX, e.offsetY, f); }, { passive: false });
    this.el.addEventListener('dblclick', () => this.fit(true));
  }
  mount() { if (!this.el.isConnected) return; this.ro.observe(this.el.parentElement); this.resize(); if (!this.fitted) { this.fit(); this.autoFit = true; } this.start(); }
  resize() {
    const p = this.el.parentElement; if (!p) return; const dpr = devicePixelRatio || 1, w = p.clientWidth, hgt = p.clientHeight; if (!w || !hgt) return;
    if (w !== this.w || hgt !== this.h) { const cx = this.w ? (this.w / 2 - this.tx) / this.k : 0, cy = this.h ? (this.h / 2 - this.ty) / this.k : 0; this.w = w; this.h = hgt; this.el.width = Math.round(w * dpr); this.el.height = Math.round(hgt * dpr); this.el.style.width = w + 'px'; this.el.style.height = hgt + 'px'; if (cx || cy) { this.tx = w / 2 - cx * this.k; this.ty = hgt / 2 - cy * this.k; } }
    this.draw();
  }
  setData(nodes, edges, groups, mode) {
    const regroup = mode !== this.mode || !this.groups || groups.order.join() !== this.groups.order.join();
    this.groups = groups; this.mode = mode;
    const G = groups.order.length, total = groups.order.reduce((a, id) => a + Math.sqrt(groups.meta[id].members.length), 0) || 1;
    const R = clamp(90 * Math.sqrt(G) + 10 * Math.sqrt(nodes.length), 160, 520); let ang = -Math.PI / 2; this.anchors = {};
    for (const id of groups.order) { const share = Math.sqrt(groups.meta[id].members.length) / total; const a = ang + Math.PI * share; this.anchors[id] = G === 1 ? { x: 0, y: 0 } : { x: Math.cos(a) * R, y: Math.sin(a) * R }; ang += 2 * Math.PI * share; }
    const byId = new Map(this.nodes.map(n => [n.id, n]));
    this.nodes = nodes.map(n => {
      const gs = nodeGroups(n, mode), ax = gs.reduce((a, id) => a + (this.anchors[id] || { x: 0 }).x, 0) / gs.length, ay = gs.reduce((a, id) => a + (this.anchors[id] || { y: 0 }).y, 0) / gs.length;
      const old = byId.get(n.id) || POS.get(n.id); const hv = hash32(n.id + ':' + this.nonce), r = clamp(5 + 3 * Math.log10(1 + (n.citations || 0)), 5, 16);
      const o = old ? { x: old.x, y: old.y, vx: 0, vy: 0 } : { x: ax + ((hv % 1000) / 1000 - .5) * 120, y: ay + (((hv >> 10) % 1000) / 1000 - .5) * 120, vx: 0, vy: 0 };
      return Object.assign(o, { id: n.id, short: n.short, title: n.title, year: n.year, tier: n.tier, status: n.status, citations: n.citations, keywords: n.keywords, gs, r, ax, ay, degree: n.degree || 0, color: (groups.meta[gs[0]] || {}).color || cssVar('--accent'), fixed: false });
    });
    this.index = new Map(this.nodes.map(n => [n.id, n]));
    this.edges = edges.map(e => ({ a: this.index.get(e.a), b: this.index.get(e.b), w: e.w, kind: e.kind })).filter(e => e.a && e.b);
    this.alpha = regroup ? 1 : Math.max(this.alpha, .4);
    if (regroup) { this.fitted = false; this.autoFit = true; }
  }
  setActive(set) { this.active = set; this.draw(); }
  shuffle() { this.nonce++; for (const n of this.nodes) { const hv = hash32(n.id + ':' + this.nonce); n.x = n.ax + ((hv % 1000) / 1000 - .5) * 120; n.y = n.ay + (((hv >> 10) % 1000) / 1000 - .5) * 120; n.vx = n.vy = 0; } this.alpha = 1; this.fitted = false; this.autoFit = true; this.start(); }
  tick() {
    const ns = this.nodes, a = this.alpha; if (!ns.length) return 0;
    const sx = this.w && this.h ? Math.min(1, this.w / this.h) : 1, sy = this.w && this.h ? Math.min(1, this.h / this.w) : 1;
    for (const n of ns) { n.fx = (n.ax * sx - n.x) * .028 - n.x * .001; n.fy = (n.ay * sy - n.y) * .028 - n.y * .001; }
    // repulsion via uniform grid
    const cell = 90, grid = new Map(); const key = (cx, cy) => cx * 73856093 ^ cy * 19349663;
    for (const n of ns) { const cx = Math.floor(n.x / cell), cy = Math.floor(n.y / cell); n.cx = cx; n.cy = cy; const kk = key(cx, cy); let arr = grid.get(kk); if (!arr) grid.set(kk, arr = []); arr.push(n); }
    for (const n of ns) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const arr = grid.get(key(n.cx + dx, n.cy + dy)); if (!arr) continue;
      for (const m of arr) { if (m === n || m.id < n.id) continue; let ddx = n.x - m.x, ddy = n.y - m.y; let d2 = ddx * ddx + ddy * ddy; if (d2 < 1) { ddx = (hash32(n.id) % 7 - 3) * .1 || .1; ddy = .1; d2 = ddx * ddx + ddy * ddy; } const d = Math.sqrt(d2); const min = n.r + m.r + 10; let f = 1800 / d2; if (d < min) f += (min - d) * .6; const ux = ddx / d * f, uy = ddy / d * f; n.fx += ux; n.fy += uy; m.fx -= ux; m.fy -= uy; }
    }
    for (const e of this.edges) { const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, rest = e.a.r + e.b.r + 40 + (1 - clamp(e.w, 0, 1)) * 60, kf = (e.kind === 'related' ? .05 : .02 + .05 * clamp(e.w, 0, 1)) * (e.a.gs[0] === e.b.gs[0] ? 1 : .3) * (d - rest); const ux = dx / d * kf, uy = dy / d * kf; e.a.fx += ux; e.a.fy += uy; e.b.fx -= ux; e.b.fy -= uy; }
    let energy = 0;
    for (const n of ns) { if (n.fixed) { n.vx = n.vy = 0; continue; } n.vx = (n.vx + n.fx * a) * .5; n.vy = (n.vy + n.fy * a) * .5; const sp = Math.hypot(n.vx, n.vy); if (sp > 12) { n.vx *= 12 / sp; n.vy *= 12 / sp; } n.x += n.vx; n.y += n.vy; energy += n.vx * n.vx + n.vy * n.vy; POS.set(n.id, { x: n.x, y: n.y }); }
    this.alpha *= .975; return energy / ns.length;
  }
  start() {
    if (reducedMotion()) { let i = 0; while (this.alpha > .01 && i++ < 500) this.tick(); this.alpha = 0; if (this.autoFit) this.fit(); this.draw(); return; }
    if (this.raf) return; const loop = () => { const e = this.tick(); this.draw(); if (this.alpha > .012 && (e > .02 || this.alpha > .3)) this.raf = requestAnimationFrame(loop); else { this.raf = 0; this.alpha = 0; if (this.autoFit) this.fit(); } }; this.raf = requestAnimationFrame(loop);
  }
  bounds() { if (!this.nodes.length) return { x0: -100, y0: -100, x1: 100, y1: 100 }; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const n of this.nodes) { x0 = Math.min(x0, n.x - n.r); y0 = Math.min(y0, n.y - n.r); x1 = Math.max(x1, n.x + n.r); y1 = Math.max(y1, n.y + n.r); } return { x0, y0, x1, y1 }; }
  fit(force) { this.autoFit = false; if (!this.w) return; const b = this.bounds(), pad = 56; const k = clamp(Math.min((this.w - pad * 2) / Math.max(1, b.x1 - b.x0), (this.h - pad * 2) / Math.max(1, b.y1 - b.y0)), .2, 1.6); this.k = k; this.tx = this.w / 2 - (b.x0 + b.x1) / 2 * k; this.ty = this.h / 2 - (b.y0 + b.y1) / 2 * k; this.fitted = true; this.draw(); }
  zoomAt(sx, sy, f) { this.autoFit = false; const nk = clamp(this.k * f, .15, 4); f = nk / this.k; this.tx = sx - (sx - this.tx) * f; this.ty = sy - (sy - this.ty) * f; this.k = nk; this.draw(); }
  toWorld(sx, sy) { return { x: (sx - this.tx) / this.k, y: (sy - this.ty) / this.k }; }
  hit(sx, sy) { const p = this.toWorld(sx, sy); let best = null, bd = 1e9; for (const n of this.nodes) { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < n.r + 4 / this.k && d < bd) { best = n; bd = d; } } return best; }
  onDown(e) {
    try { this.el.setPointerCapture(e.pointerId); } catch { } this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (this.pointers.size === 2) { const [p1, p2] = [...this.pointers.values()]; this.pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), k: this.k }; this.drag = null; return; }
    const n = this.hit(e.offsetX, e.offsetY);
    this.drag = { node: n, sx: e.offsetX, sy: e.offsetY, tx: this.tx, ty: this.ty, moved: false };
    if (n) { n.fixed = true; this.el.style.cursor = 'grabbing'; }
  }
  onMove(e) {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (this.pinch && this.pointers.size === 2) { const [p1, p2] = [...this.pointers.values()]; const d = Math.hypot(p1.x - p2.x, p1.y - p2.y), mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2; this.zoomAt(mx, my, (this.pinch.k * d / this.pinch.d) / this.k); return; }
    if (this.drag) {
      const dx = e.offsetX - this.drag.sx, dy = e.offsetY - this.drag.sy; if (Math.abs(dx) + Math.abs(dy) > 3) this.drag.moved = true;
      if (this.drag.node) { const p = this.toWorld(e.offsetX, e.offsetY); this.drag.node.x = p.x; this.drag.node.y = p.y; this.drag.node.vx = this.drag.node.vy = 0; this.alpha = Math.max(this.alpha, .25); if (!reducedMotion()) this.start(); else this.draw(); }
      else { this.autoFit = false; this.tx = this.drag.tx + dx; this.ty = this.drag.ty + dy; this.draw(); }
      return;
    }
    this.setHover(this.hit(e.offsetX, e.offsetY), e.offsetX, e.offsetY);
  }
  onUp(e) {
    this.pointers.delete(e.pointerId); if (this.pointers.size < 2) this.pinch = null;
    if (!this.drag) return;
    const d = this.drag; this.drag = null; this.el.style.cursor = '';
    if (d.node) { d.node.fixed = false; POS.set(d.node.id, { x: d.node.x, y: d.node.y }); if (!d.moved) { this.setHover(null); openDrawer(d.node.id); } }
  }
  setHover(n, sx, sy) {
    if (n !== this.hover) { this.hover = n; this.draw(); this.el.style.cursor = n ? 'pointer' : ''; }
    if (!n) { this.tip.hidden = true; return; }
    const gl = n.gs.map(id => (this.groups.meta[id] || {}).label || id).join(', ');
    this.tip.replaceChildren(h('b', n.short), h('div', n.title), h('div.faint', `${n.year || ''}${n.citations ? ` · ${n.citations.toLocaleString()} citations` : ''} · ${STATUS_ZH[n.status] || n.status}`), h('div', { style: `color:${n.color}` }, gl));
    this.tip.hidden = false; const tw = this.tip.offsetWidth, th = this.tip.offsetHeight; this.tip.style.left = clamp(sx + 14, 4, this.w - tw - 4) + 'px'; this.tip.style.top = clamp(sy + 14, 4, this.h - th - 4) + 'px';
  }
  hull(pts) { if (pts.length < 3) return pts; pts = [...pts].sort((a, b) => a.x - b.x || a.y - b.y); const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); const lo = [], up = []; for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } lo.pop(); up.pop(); return lo.concat(up); }
  draw() {
    const ctx = this.ctx, dpr = devicePixelRatio || 1; if (!this.w) return;
    const fg = cssVar('--fg'), bg = cssVar('--bg'), fg2 = cssVar('--fg-2'), fg3 = cssVar('--fg-3'), surface = cssVar('--surface'), font = cssVar('--font-sans'), dark = currentDark();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.el.width, this.el.height);
    ctx.setTransform(dpr * this.k, 0, 0, dpr * this.k, dpr * this.tx, dpr * this.ty);
    const k = this.k, act = this.active, dimOf = n => act && !act.has(n.id);
    const toS = (x, y) => ({ x: x * k + this.tx, y: y * k + this.ty });
    const overlap = (a, b) => !(a.x1 < b.x0 || a.x0 > b.x1 || a.y1 < b.y0 || a.y0 > b.y1);
    const placed = [];
    // blobs + group labels (nudged vertically so they never overlap each other)
    const glabels = [];
    if (this.groups) for (const id of this.groups.order) {
      const m = this.groups.meta[id]; const pts = m.members.map(x => this.index.get(x)).filter(Boolean); if (!pts.length) continue;
      const pad = 18, hull = this.hull(pts.map(p => ({ x: p.x, y: p.y }))); const dimG = MAP.isolate && MAP.isolate !== id;
      ctx.beginPath(); if (hull.length === 1) ctx.arc(hull[0].x, hull[0].y, pad, 0, Math.PI * 2); else { ctx.moveTo(hull[0].x, hull[0].y); for (const p of hull.slice(1)) ctx.lineTo(p.x, p.y); ctx.closePath(); }
      ctx.lineJoin = 'round'; ctx.lineWidth = pad * 2; ctx.strokeStyle = ctx.fillStyle = m.color; ctx.globalAlpha = dimG ? .03 : (dark ? .13 : .10); ctx.stroke(); ctx.fill(); ctx.globalAlpha = 1;
      let top = hull[0]; for (const p of hull) if (p.y < top.y) top = p;
      const cx = hull.reduce((a, p) => a + p.x, 0) / hull.length, s = toS(cx, top.y);
      glabels.push({ text: `${m.label} · ${m.members.length}`, color: m.color, dim: dimG, sx: s.x, sy: s.y - pad * k - 4 });
    }
    const gfs = 12; ctx.font = `600 ${gfs / k}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    for (const gl of glabels) {
      const w = ctx.measureText(gl.text).width * k, hgt = gfs * 1.3;
      const box = { x0: gl.sx - w / 2 - 2, x1: gl.sx + w / 2 + 2, y0: gl.sy - hgt, y1: gl.sy };
      let guard = 0; while (guard++ < 20) { const hit = placed.find(b => overlap(box, b)); if (!hit) break; const dy = box.y1 - hit.y0 + 2; box.y0 -= dy; box.y1 -= dy; }
      placed.push(box);
      ctx.fillStyle = gl.color; ctx.globalAlpha = gl.dim ? .25 : .9; ctx.fillText(gl.text, (gl.sx - this.tx) / k, (box.y1 - this.ty) / k); ctx.globalAlpha = 1;
    }
    // edges
    for (const e of this.edges) { const dim = dimOf(e.a) || dimOf(e.b); const hl = this.hover && (e.a === this.hover || e.b === this.hover); ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.strokeStyle = e.kind === 'related' ? cssVar('--accent') : fg3; ctx.globalAlpha = dim ? .04 : hl ? .9 : e.kind === 'related' ? .45 : .12 + .35 * clamp(e.w, 0, 1); ctx.lineWidth = (hl ? 2 : e.kind === 'related' ? 1.4 : .8 + e.w) / Math.sqrt(k); if (e.kind === 'related') ctx.setLineDash([4 / k, 3 / k]); ctx.stroke(); ctx.setLineDash([]); }
    ctx.globalAlpha = 1;
    // nodes
    const STC = { unread: fg3, queued: cssVar('--warn'), reading: cssVar('--accent'), read: cssVar('--ok'), deep: cssVar('--ok'), skipped: 'transparent' };
    for (const n of this.nodes) {
      const dim = dimOf(n), hov = n === this.hover; ctx.globalAlpha = dim ? .15 : 1;
      if (n.gs.length > 1) { const seg = Math.PI * 2 / n.gs.length; n.gs.forEach((id, i) => { ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 3.5, i * seg - Math.PI / 2, (i + 1) * seg - Math.PI / 2); ctx.strokeStyle = (this.groups.meta[id] || {}).color || n.color; ctx.lineWidth = 3; ctx.stroke(); }); }
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fillStyle = n.color; ctx.fill();
      ctx.lineWidth = n.tier === 1 ? 2.5 : 1; ctx.strokeStyle = hov ? fg : (n.tier === 1 ? (dark ? '#fff' : '#111214') : bg); ctx.globalAlpha = dim ? .15 : (n.tier === 1 ? .85 : 1); ctx.stroke();
      ctx.beginPath(); ctx.arc(n.x + n.r * .72, n.y + n.r * .72, 3, 0, Math.PI * 2); ctx.fillStyle = STC[n.status] || fg3; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = n.status === 'skipped' ? fg3 : bg; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // labels: greedy, collision-free in screen space (priority: forced > tier 1 > citations > degree)
    const fs = 11, lpad = 2, dragNode = this.drag && this.drag.node, emph = !!(MAP.q.trim() || MAP.isolate);
    const forced = n => n === this.hover || n === dragNode || (emph && act && act.has(n.id));
    const circles = this.nodes.map(n => { const s = toS(n.x, n.y); return { n, x: s.x, y: s.y, r: n.r * k + (n.gs.length > 1 ? 5 : 1) }; });
    const circleHits = (box, self) => circles.some(c => c.n !== self && (() => { const px = clamp(c.x, box.x0, box.x1), py = clamp(c.y, box.y0, box.y1); return (px - c.x) ** 2 + (py - c.y) ** 2 < c.r * c.r; })());
    const cand = this.nodes.filter(n => !dimOf(n)).sort((a, b) => (forced(b) - forced(a)) || ((b.tier === 1) - (a.tier === 1)) || (b.citations - a.citations) || (b.degree - a.degree));
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const n of cand) {
      const f = forced(n); ctx.font = `${f ? 600 : 500} ${fs / k}px ${font}`;
      const s = toS(n.x, n.y), w = ctx.measureText(n.short).width * k, hgt = fs * 1.3, lx = s.x + n.r * k + 4;
      const box = { x0: lx - lpad, y0: s.y - hgt / 2 - lpad, x1: lx + w + lpad, y1: s.y + hgt / 2 + lpad };
      if (box.x1 < 0 || box.x0 > this.w || box.y1 < 0 || box.y0 > this.h) continue;
      if (!f && (placed.some(b => overlap(box, b)) || circleHits(box, n))) continue;
      placed.push(box);
      ctx.globalAlpha = .7; ctx.fillStyle = surface; ctx.fillRect((box.x0 - this.tx) / k, (box.y0 - this.ty) / k, (box.x1 - box.x0) / k, (box.y1 - box.y0) / k); ctx.globalAlpha = 1;
      ctx.fillStyle = f || n === this.hover ? fg : fg2; ctx.fillText(n.short, (lx - this.tx) / k, n.y);
    }
  }
}

/* ============================================================ mascot */
const MASCOT_LINES = ['Let’s read a little today.', 'One paper, one small step.', 'Stuck? Just the abstract and the figures for now.', 'Don’t forget a one-line summary in your own words.', 'You know a bit more than yesterday’s you.', 'Not getting it is normal. A second pass helps.', 'Rest is part of research too.', 'Idea flashed by? Write it down.', 'Read the conclusion first, then the method. Saves time.', 'Every great researcher started with paper one.', 'Today’s you is building tomorrow’s intuition.', 'That paper in the queue is waiting for you.', 'Head pat received. Keep going.', 'Sip some water, rest your eyes.', 'Write the question down; the answer tends to surface.'];
const SLEEPY_LINES = ['Hoo… it’s late. Read tomorrow.', 'At this hour the brain won’t keep much.', 'Good night. The heatmap can light up tomorrow.'];
function initMascot() {
  const m = $('#mascot'), pupils = $$('.pupil', m), bubble = $('#bubble');
  let bubbleTimer = null, blinkTimer = null;
  const base = pupils.map(p => ({ x: +p.getAttribute('cx'), y: +p.getAttribute('cy') }));
  document.addEventListener('mousemove', e => {
    if (reducedMotion()) return;
    const r = m.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy) || 1, k = Math.min(2, d / 120);
    pupils.forEach(p => p.style.transform = `translate(${dx / d * k}px, ${dy / d * k}px)`);
  }, { passive: true });
  const blink = () => { if (!reducedMotion()) { m.classList.add('blink'); setTimeout(() => m.classList.remove('blink'), 140); } blinkTimer = setTimeout(blink, 4000 + Math.random() * 3000); };
  blinkTimer = setTimeout(blink, 2500);
  const sleepy = () => { m.classList.toggle('sleepy', isLate() || new Date().getHours() < 5); m.classList.toggle('idle', !reducedMotion()); };
  sleepy(); setInterval(sleepy, 60000);
  const say = text => { bubble.textContent = text; bubble.classList.add('show'); clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 3200); };
  const poke = () => {
    S.mascotClicks++;
    m.classList.remove('bounce'); void m.offsetWidth; m.classList.add('bounce');
    blip(600 + Math.random() * 200, 300, .07, .12);
    const lines = m.classList.contains('sleepy') ? SLEEPY_LINES : MASCOT_LINES;
    say(lines[Math.floor(Math.random() * lines.length)]);
    if (Math.random() < 1 / 6) tinyConfetti(m);
    if (S.mascotClicks === 20) { chord(); celebrateConfetti(false); toast({ kind: 'ok', icon: 'owl', title: 'Secret badge: Head pats', text: `You patted ${persona()} 20 times. This badge lives only in your heart today.`, timeout: 8000 }); }
  };
  m.addEventListener('click', poke);
  m.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(); } });
  window.mascotSay = text => { if (playful()) say(text); };
}

/* ============================================================ attach PDFs (drag & drop anywhere, or pick from papers/) */
async function uploadPdf(p, file, { thenRead = false } = {}) {
  if (!file || !/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { toast({ kind: 'warn', text: `“${file ? file.name : ''}” is not a PDF.` }); return false; }
  const t = toast({ text: `Attaching “${file.name}” to ${p.short || p.title}…`, timeout: 60000 });
  try {
    const r = await fetch(`/api/upload?paper=${encodeURIComponent(p.id)}&name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: file });
    const j = await r.json().catch(() => ({ ok: false, error: 'bad response' }));
    if (!j.ok) throw new Error(j.error || `HTTP ${r.status}`);
    blip(440, 660, .08);
    await reload({ briefing: true });
    const fresh = paperById(p.id) || p;
    if (thenRead) { startReading(fresh); return true; }
    toast({ kind: 'ok', title: 'PDF attached', text: `${fresh.short || fresh.title} · ${j.pdf.replace(/^papers\//, '')}`, action: { label: 'Start reading', fn: () => startReading(fresh) }, timeout: 8000 });
    return true;
  } catch (e) { errToast(e); return false; }
}
function guessPaperForFile(name) {
  const n = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const cands = S.L.papers.filter(p => !p.pdf);
  const score = p => {
    const keys = [p.id, (p.arxiv || '').replace(/^.*arxiv\.org\/(abs|pdf)\//, ''), p.short].map(k => (k || '').toLowerCase().replace(/[^a-z0-9]+/g, '')).filter(k => k.length >= 5);
    if (keys.some(k => n.includes(k))) return 3;
    const t = (p.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (t.length >= 20 && (n.includes(t.slice(0, 24)) || (n.length >= 20 && t.includes(n.slice(0, 20))))) return 2;
    return 0;
  };
  const best = cands.map(p => [score(p), p]).filter(x => x[0]).sort((a, b) => b[0] - a[0])[0];
  if (best) return best[1];
  if (S.drawerId && paperById(S.drawerId)) return paperById(S.drawerId);
  const next = nextToRead();
  return next && !next.pdf ? next : (cands[0] || null);
}
function pickPaperDialog(file, { preselect } = {}) {
  return new Promise(resolve => {
    const cands = [...S.L.papers].sort((a, b) => (a.pdf ? 1 : 0) - (b.pdf ? 1 : 0) || ((S.L.queue || []).indexOf(a.id) + 1 || 999) - ((S.L.queue || []).indexOf(b.id) + 1 || 999));
    const sel = h('select.select', { style: 'width:100%' }, cands.map(p => h('option', { value: p.id, selected: preselect && p.id === preselect.id }, `${p.short || p.title}${p.pdf ? ' · already has a PDF' : ''}`)));
    const dlg = openDialog({ title: 'Attach this PDF to which paper?', cls: 'sm', body: h('div.col', { style: 'gap:10px' }, h('div.small.muted', { style: 'word-break:break-all' }, icon('pdf'), ' ', file.name, ` · ${Math.round(file.size / 1024 / 102.4) / 10} MB`), h('div.field', h('label', 'Paper'), sel), preselect ? h('div.faint.xs', `Guessed from the file name: ${preselect.short || preselect.title}`) : null),
      onClose: () => resolve(null),
      actions: [{ el: h('button.btn', { onclick: () => { dlg.closeDlg(); resolve(null); } }, 'Cancel') }, { el: h('button.btn.btn-primary', { onclick: () => { const p = paperById(sel.value); dlg.closeDlg(); resolve(p || null); } }, icon('upload'), 'Attach') }] });
    setTimeout(() => sel.focus(), 50);
  });
}
async function handleDroppedFiles(files, target) {
  const pdfs = Array.from(files || []).filter(f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
  if (!pdfs.length) { toast({ kind: 'warn', text: 'Drop PDF files to attach them to a paper.' }); return; }
  for (const f of pdfs) {
    let p = target || null;
    if (!p) {
      const guess = guessPaperForFile(f.name);
      p = await pickPaperDialog(f, { preselect: guess });
      if (!p) continue;
    }
    if (p.pdf && !(await confirmDialog(`${p.short || p.title} already has “${p.pdf.replace(/^papers\//, '')}”. Replace it with “${f.name}”?`, { ok: 'Replace' }))) continue;
    await uploadPdf(p, f);
  }
}
function attachPdfDialog(p, { thenRead = false } = {}) {
  if (!p) return;
  const inp = h('input', { type: 'file', accept: 'application/pdf,.pdf', style: 'display:none', onchange: async e => { const f = e.target.files[0]; if (!f) return; dlg.closeDlg(); await uploadPdf(p, f, { thenRead }); } });
  const list = h('div.col', { style: 'gap:6px' }, skeletonRows(2));
  const dlg = openDialog({ title: `Attach a PDF to “${p.short || p.title}”`, body: h('div.col', { style: 'gap:12px' },
    h('div.dropbox', { onclick: () => inp.click() }, icon('upload'), h('div', h('b', 'Drag the PDF file anywhere onto this window'), h('div.small.muted', 'or click here to choose a file. It is copied into papers/ and linked to this paper.')), inp),
    p.arxiv ? h('button.btn.btn-sm', { onclick: async () => { try { await api.post('/api/download', { id: p.id }); dlg.closeDlg(); toast({ text: 'Downloading from arXiv…' }); } catch (e) { errToast(e); } } }, icon('download'), 'Fetch from arXiv instead') : null,
    h('div.field', h('label', 'PDFs already in papers/ that no paper uses'), list)),
    actions: [{ el: h('button.btn', { onclick: () => dlg.closeDlg() }, 'Close') }] });
  S.attachTarget = p; dlg.addEventListener('close', () => { if (S.attachTarget === p) S.attachTarget = null; });
  api.get('/api/pdf/unlinked').then(r => {
    const files = r.files || [];
    if (!files.length) { list.replaceChildren(h('div.faint.small', 'None right now. Files you download elsewhere can also be dropped straight onto the window.')); return; }
    list.replaceChildren(files.slice(0, 12).map(f => h('div.row.between.ufile', h('div.col', { style: 'gap:1px;min-width:0' }, h('span.ellip', { title: f.name }, f.name), h('span.faint.xs', `${Math.round(f.size / 1024 / 102.4) / 10} MB · ${relWhen(f.mtime)}${f.match ? ` · looks like ${f.match.short || f.match.title}` : ''}`)),
      h('button.btn.btn-sm', { class: f.match && f.match.id === p.id ? 'btn-primary' : '', onclick: async e => { e.currentTarget.disabled = true; try { await api.post('/api/pdf/link', { id: p.id, file: f.file }); dlg.closeDlg(); blip(440, 660, .08); await reload({ briefing: true }); const fresh = paperById(p.id) || p; if (thenRead) startReading(fresh); else toast({ kind: 'ok', title: 'PDF attached', text: fresh.short || fresh.title, action: { label: 'Start reading', fn: () => startReading(fresh) } }); } catch (err) { errToast(err); e.currentTarget.disabled = false; } } }, 'Use this'))));
  }).catch(e => list.replaceChildren(h('div.faint.small', `Could not list papers/: ${e.message}`)));
}
(function initDrop() {
  let depth = 0, overlay = null;
  const show = () => { if (!overlay) { overlay = h('div.dropoverlay', h('div.box', icon('upload'), h('b', 'Drop the PDF to attach it'), h('span.small', S.attachTarget ? `to ${S.attachTarget.short || S.attachTarget.title}` : (S.drawerId && paperById(S.drawerId) ? `to ${paperById(S.drawerId).short || paperById(S.drawerId).title}` : 'you’ll pick the paper next')))); document.body.append(overlay); } };
  const hide = () => { depth = 0; if (overlay) { overlay.remove(); overlay = null; } };
  const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  document.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); depth++; show(); });
  document.addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  document.addEventListener('dragleave', e => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) hide(); });
  document.addEventListener('drop', e => {
    if (!hasFiles(e)) return; e.preventDefault();
    const row = e.target && e.target.closest ? e.target.closest('.prow[data-id]') : null;
    const target = S.attachTarget || (row ? paperById(row.dataset.id) : null) || (S.drawerId ? paperById(S.drawerId) : null);
    hide();
    handleDroppedFiles(e.dataTransfer.files, target);
  });
  window.addEventListener('blur', hide);
})();

/* ============================================================ reading sessions (PDF on the second screen + Claude) */
const APP_TITLE = 'Paper Assistant';
function readingElapsed() {
  if (!S.R) return '00:00';
  const now = Date.now() / 1000 - (S.clockSkew || 0); // server clock: the laptop's clock may be off by minutes
  const sec = Math.max(0, Math.floor(now - (S.R.ts || now)));
  return sec >= 3600 ? `${Math.floor(sec / 3600)}:${pad2(Math.floor(sec % 3600 / 60))}:${pad2(sec % 60)}` : mmss(sec);
}
function nextToRead() {
  if (!S.L) return null;
  const B = S.B || {};
  const cands = [...(B.reading || []), ...(B.today_papers || []), ...(B.queue_top || [])].map(x => paperById(x.id)).filter(Boolean).filter(p => !DONE.has(p.status));
  if (cands.length) return cands[0];
  return S.L.papers.find(p => p.status === 'reading') || (S.L.queue || []).map(paperById).find(p => p && !DONE.has(p.status)) || S.L.papers.find(p => !DONE.has(p.status)) || null;
}
function readButton(p, { sm = false, lg = false } = {}) {
  const live = S.R && S.R.paper === p.id;
  const cls = `${sm ? 'btn-sm' : ''} ${lg ? 'btn-lg' : ''}`.trim();
  if (live) return h('button.btn.btn-read.live', { class: cls, title: 'Reading now - click to end the session', 'aria-label': 'End reading session', onclick: e => { e.stopPropagation(); openReadingDialog(); } }, h('span.livedot'), h('span.t', { 'data-rlive': '1' }, readingElapsed()), lg ? 'Reading' : null);
  const again = DONE.has(p.status);
  return h('button.btn.btn-read', { class: `${cls} ${again ? 'again' : ''}`, title: again ? 'Open the PDF again (time is still recorded)' : 'Open the PDF on your reading screen, start the clock and the assistant', 'aria-label': 'Start reading', onclick: e => { e.stopPropagation(); startReading(p, e.currentTarget); } }, icon('play'), again ? 'Read again' : (lg ? 'Start reading' : 'Read'));
}
async function startReading(p, el, { page } = {}) {
  if (!p) return;
  if (S.R) {
    if (S.R.paper === p.id) { openReadingDialog(); return; }
    if (!await confirmDialog(`End the current session on “${S.R.short || S.R.title}” and start “${p.short || p.title}”?`, { ok: 'Switch paper', title: 'Already reading' })) return;
    try { await api.post('/api/reading/stop', {}); } catch (e) { if (!/No reading session/i.test(String(e.message))) { errToast(e); return; } S.R = null; } // it had already ended; carry on
  }
  const btn = el && el.classList && el.classList.contains('btn-read') ? el : null;
  const win = REMOTE ? window.open('about:blank', '_blank') : null; // opened inside the click so popup blockers allow it
  if (btn) { btn.disabled = true; btn.classList.add('busy'); btn.replaceChildren(h('span.spin'), p.pdf ? 'Opening…' : 'Fetching PDF…'); }
  try {
    const body = { id: p.id }; if (page) body.page = Math.max(1, +page || 1); if (REMOTE) body.viewer = 'browser';
    const r = await api.post('/api/reading/start', body);
    S.R = r.reading; blip(440, 660, .08); render();
    if (REMOTE && r.reading.url) {
      const url = r.reading.url;
      if (win && !win.closed) win.location.href = url; else window.open(url, '_blank');
      toast({ kind: 'ok', icon: 'pdf', title: `Reading “${p.short || p.title}”`, text: 'The PDF opened in a new browser window. Press End session here when you are done to record the time.', timeout: 9000, action: { label: 'Open PDF', fn: () => window.open(url, '_blank') } });
      return;
    }
    const withAI = settings().reading_assistant !== false;
    toast({ kind: 'ok', icon: 'pdf', title: `Reading “${p.short || p.title}”`, text: withAI ? 'PDF on your reading screen, Claude opening in a terminal here. Close the PDF window to end and record the session.' : 'Close the PDF window to end and record the session.', timeout: 7000 });
    if (window.mascotSay) window.mascotSay(withAI ? 'Read on the right, think out loud on the left. I’ll keep the clock.' : 'Clock is running. Enjoy the paper.');
  } catch (e) {
    if (win && !win.closed) win.close();
    render();
    if (/^NO_PDF:/.test(String(e && e.message || ''))) attachPdfDialog(p, { thenRead: true }); else errToast(e);
  }
}
async function stopReading() {
  try { await api.post('/api/reading/stop', {}); }
  catch (e) { if (/No reading session/i.test(String(e.message))) { S.R = null; document.title = APP_TITLE; toast({ text: 'That session had already ended.' }); reload(); } else errToast(e); }
}
function liveCard() {
  const R = S.R; if (!R) return null;
  const p = paperById(R.paper) || { short: R.short, title: R.title };
  return h('div.livecard', h('span.livedot.big'), h('div.grow', h('div.lbl', 'Reading now'), h('div.ttl', p.short || p.title), h('div.sub', R.viewer === 'browser' ? 'Reading in a browser window - ends by itself a few minutes after the PDF tab is closed, or end it here' : REMOTE ? 'Open on the library computer’s screen - end it here if it was left open there' : R.mode === 'manual' ? 'External viewer - end the session here when you close it' : 'Close the PDF window to end the session')),
    h('div.big', { 'data-rlive': '1' }, readingElapsed()),
    h('div.col', { style: 'gap:6px' }, R.viewer === 'browser' || REMOTE ? [R.url ? h('button.btn.btn-sm', { title: 'Re-open the PDF in a browser window', onclick: () => window.open(R.url, '_blank') }, icon('ext'), 'Open PDF') : null,
      R.viewer === 'browser' ? h('button.btn.btn-sm', { title: 'Open the reading assistant for this paper in a console here (Explain / Ask in the PDF window use the same one)', onclick: () => openAssistantFor(paperById(R.paper) || { id: R.paper, short: R.short, title: R.title }) }, icon('terminal'), 'Claude') : null]
      : h('button.btn.btn-sm', { title: 'Open or re-open the Claude terminal for this paper', onclick: () => api.post('/api/reading/assistant', {}).then(() => toast({ text: 'Assistant terminal opened.' })).catch(errToast) }, icon('terminal'), 'Assistant'),
      h('button.btn.btn-sm.btn-primary', { onclick: stopReading }, icon('check'), 'End session')));
}
async function openAssistantConsole(pid) {
  try {
    const cols = Math.max(80, Math.min(220, Math.floor((Math.min(window.innerWidth, 1400) - 80) / 8))), rows = Math.max(18, Math.floor((window.innerHeight - 190) / 17));
    const r = await api.post('/api/reading/assistant', { id: pid, console: true, cols, rows });
    await refreshTerms();
    const info = (S.terms || []).find(t => t.id === r.console) || { id: r.console, alive: true, title: 'Claude' };
    openConsole(info);
  } catch (e) { errToast(e); }
}
function openReadingDialog() {
  const R = S.R; if (!R) return;
  if (document.querySelector('dialog[open]')) return;
  const p = paperById(R.paper);
  const dlg = openDialog({ title: 'Reading session', cls: 'sm', body: h('div.col', { style: 'gap:10px' },
    h('div.rsess', h('div.big', { 'data-rlive': '1' }, readingElapsed()), h('div.col', h('b', R.short || R.title), h('span.small.muted', `Started ${fmtTime(R.started)} · ${R.viewer === 'browser' ? 'browser window' : REMOTE ? 'on the library computer' : R.viewer === 'system' ? 'system viewer' : 'built-in reader'}${R.viewer === 'browser' ? ' · ends by itself after the PDF tab closes' : R.mode === 'manual' ? ' · end it here when done' : ''}`))),
    h('div.row.wrap', R.viewer === 'browser' || REMOTE ? [R.url ? h('button.btn.btn-sm', { onclick: () => window.open(R.url, '_blank') }, icon('ext'), 'Open PDF') : null, R.viewer === 'browser' ? h('button.btn.btn-sm', { onclick: () => { dlg.closeDlg(); openAssistantFor(paperById(R.paper) || { id: R.paper, short: R.short, title: R.title }); } }, icon('terminal'), 'Claude') : null] : h('button.btn.btn-sm', { onclick: () => api.post('/api/reading/assistant', {}).then(() => toast({ text: 'Assistant terminal opened.' })).catch(errToast) }, icon('terminal'), 'Open assistant'),
      R.viewer === 'browser' || REMOTE ? null : h('button.btn.btn-sm', { onclick: () => api.post('/api/reading/notes', {}).catch(errToast) }, icon('note'), 'Open notes'),
      p ? h('button.btn.btn-sm', { onclick: () => { dlg.closeDlg(); if (S.page !== 'library') go('library'); openDrawer(p.id); } }, icon('book'), 'Details') : null)),
    actions: [{ el: h('button.btn', { onclick: () => dlg.closeDlg() }, 'Keep reading') }, { el: h('button.btn.btn-primary', { onclick: () => { dlg.closeDlg(); stopReading(); } }, icon('check'), 'End session') }] });
}
function onReadingEvent(d) {
  if (!d || !d.state) return;
  if (d.state === 'started' || d.state === 'updated') {
    const { state, ...rest } = d; S.R = rest; render();
    if (d.state === 'updated' && d.mode === 'manual') toast({ kind: 'warn', title: 'Can’t watch that viewer', text: 'Your PDF viewer was already open, so the window can’t be tracked. End the session from the sidebar when you’re done.', timeout: 10000 });
    return;
  }
  if (d.state === 'ended') {
    const prev = S.R; S.R = null; document.title = APP_TITLE;
    const p = paperById(d.paper);
    const fg = !document.hidden; // the other computer's window gets the toast only, not chimes, confetti or a modal to dismiss later
    const finish = async () => {
      await reload({ briefing: true });
      if (d.recorded) {
        if (fg) blip(440, 660, .08);
        const xpv = d.xp || d.minutes;
        toast({ kind: d.capped ? 'warn' : 'ok', icon: 'check', title: playful() ? `${d.minutes} min recorded (+${xpv} XP)` : `${d.minutes} min recorded`, text: d.capped ? `The session was left open for ${fmtMin(d.raw_minutes || d.minutes)}; only ${fmtMin(d.minutes)} were recorded.` : p ? `${p.short || p.title} · ${fmtMin(p.minutes_read || 0)} in total` : '', timeout: d.capped ? 12000 : undefined });
        if (fg) floatXP($('#timerMini'), xpv);
        (d.events || []).forEach(ev => { if (ev.type === 'goal') { if (fg) chord(); toast({ kind: 'ok', title: 'Daily goal reached', text: 'The ring is closed. Nicely done.' }); if (fg) celebrateConfetti(false); } });
        if (fg && p && !DONE.has(p.status) && d.minutes >= 5) setTimeout(() => askFinished(p), 700);
      } else if (prev) toast({ text: 'Under a minute - not recorded.' });
    };
    finish();
  }
}
setInterval(() => { if (!document.hidden && (S.page === 'explore' || S.page === 'assistant' || S.page === 'expert')) refreshTerms(); }, 30000); // terminal windows open/close without an event
setInterval(() => {
  if (!S.R) return;
  const t = readingElapsed();
  $$('[data-rlive]').forEach(el => { el.textContent = t; });
  if (!T.running) document.title = `▶ ${t} · ${S.R.short || APP_TITLE}`;
}, 1000);

/* ============================================================ focus timer */
const T = Object.assign({ paper: null, duration: 25 * 60, startAt: 0, pausedAt: 0, pausedTotal: 0, running: false, finishedHandled: false }, store.get('timer', {}));
let timerTick = null, timerDlg = null;
const persistTimer = () => store.set('timer', T);
function timerElapsed() { if (!T.startAt) return 0; const end = T.pausedAt || Date.now(); return Math.max(0, Math.floor((end - T.startAt - T.pausedTotal) / 1000)); }
function timerRemaining() { return Math.max(0, T.duration - timerElapsed()); }
const mmss = sec => `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`;
function sessionsToday() { const t = todayStr(); return (S.L ? S.L.sessions : []).filter(x => (x.end || '').slice(0, 10) === t).length; }
function startTimer(paperId, minutes) {
  Object.assign(T, { paper: paperId || null, duration: (minutes || settings().pomodoro_minutes || 25) * 60, startAt: Date.now(), pausedAt: 0, pausedTotal: 0, running: true, finishedHandled: false });
  persistTimer(); blip(440, 660, .08); runTick();
  const p = paperId ? paperById(paperId) : null;
  if (p && p.status !== 'reading' && !DONE.has(p.status)) op({ op: 'paper.status', id: p.id, status: 'reading' }, { silent: true });
}
function pauseTimer() { if (!T.running || T.pausedAt) return; T.pausedAt = Date.now(); persistTimer(); renderTimer(); }
function resumeTimer() { if (!T.pausedAt) return; T.pausedTotal += Date.now() - T.pausedAt; T.pausedAt = 0; persistTimer(); runTick(); }
function resetTimer() { Object.assign(T, { startAt: 0, pausedAt: 0, pausedTotal: 0, running: false, finishedHandled: false }); persistTimer(); clearInterval(timerTick); timerTick = null; document.title = APP_TITLE; renderTimerMini(); renderTimer(); }
async function finishTimer({ natural = false } = {}) {
  const mins = Math.floor(timerElapsed() / 60), paper = T.paper, startISO = new Date(T.startAt).toISOString().slice(0, 19);
  const start = (() => { const d = new Date(T.startAt); return `${localISO(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; })();
  resetTimer();
  if (mins < 1) { toast({ text: 'Under a minute - not recorded.' }); return; }
  try {
    const r = await op({ op: 'session.add', paper, start, end: nowISO(), minutes: mins, kind: 'focus' }, { el: $('#timerMini') });
    const stage = Math.min(4, sessionsToday());
    toast({ kind: 'ok', title: playful() ? `${mins} min done. The sapling grew a notch.` : `${mins} min done.`, text: natural ? 'Take a 5-minute break.' : 'Focus session recorded.' });
    const p = paper ? paperById(paper) : null;
    if (p && !DONE.has(p.status)) setTimeout(() => askFinished(p), 600);
  } catch (e) { }
}
function askFinished(p) {
  if (!p || DONE.has(p.status) || document.querySelector('dialog[open]')) return;
  const dlg = openDialog({ title: 'Mark this paper as finished?', cls: 'sm', body: h('p.muted', `${p.short || p.title} · ${fmtMin(p.minutes_read || 0)} read in total`), actions: [
    { el: h('button.btn', { onclick: () => dlg.closeDlg() }, 'Later') },
    { el: h('button.btn', { onclick: () => { dlg.closeDlg(); toast({ text: 'Kept as “reading”.' }); } }, 'Still reading') },
    { el: h('button.btn.btn-primary', { onclick: e => { dlg.closeDlg(); setStatus(p, 'read', e.currentTarget); } }, 'Finished') }] });
}
function runTick() {
  clearInterval(timerTick);
  timerTick = setInterval(tick, 500); tick();
}
function tick() {
  if (!T.running) return;
  const rem = timerRemaining();
  document.title = T.pausedAt ? `⏸ ${mmss(rem)} · ${APP_TITLE}` : `${mmss(rem)} · ${APP_TITLE}`;
  renderTimerMini(); renderTimer();
  if (rem <= 0 && !T.finishedHandled) { T.finishedHandled = true; persistTimer(); chord(); setTimeout(chord, 350); finishTimer({ natural: true }); }
}
function renderTimerMini() {
  const el = $('#timerMini'); if (!el) return;
  if (S.R && !T.running) {
    el.classList.add('running', 'reading'); el.onclick = () => openReadingDialog();
    el.replaceChildren(h('span.ic', h('span.livedot')), h('span.t', { 'data-rlive': '1' }, readingElapsed()), h('span.p.grow', S.R.short || S.R.title || 'Reading'));
    return;
  }
  el.classList.remove('reading');
  const p = T.paper ? paperById(T.paper) : null;
  el.classList.toggle('running', T.running);
  el.onclick = () => openTimer();
  if (T.running) el.replaceChildren(h('span.t', mmss(timerRemaining())), h('span.p.grow', T.pausedAt ? 'Paused' : (p ? (p.short || p.title) : 'Free reading')), h('span.ic', icon(T.pausedAt ? 'pause' : 'play')));
  else el.replaceChildren(h('span.ic', icon('play')), h('span.t', mmss((settings().pomodoro_minutes || 25) * 60)), h('span.p.grow', 'Start focus'));
}
function plantSVG(stage) {
  const el = s('svg', { class: 'plant', viewBox: '0 0 100 100', 'data-stage': stage, role: 'img', 'aria-label': `Sapling stage ${stage}` });
  el.innerHTML = `<path class="pot" d="M30 70h40l-4 24H34z"/><rect class="soil" x="30" y="66" width="40" height="6" rx="2"/>
  <path class="stem" data-s="1" d="M50 66 V54"/><ellipse class="leaf" data-s="1" cx="44" cy="56" rx="6" ry="3.5" transform="rotate(-25 44 56)"/>
  <path class="stem" data-s="2" d="M50 54 V40"/><ellipse class="leaf" data-s="2" cx="57" cy="44" rx="7" ry="4" transform="rotate(25 57 44)"/>
  <path class="stem" data-s="3" d="M50 40 V26"/><ellipse class="leaf" data-s="3" cx="42" cy="31" rx="8" ry="4.5" transform="rotate(-25 42 31)"/><ellipse class="leaf" data-s="3" cx="58" cy="28" rx="8" ry="4.5" transform="rotate(25 58 28)"/>
  <circle class="flower" data-s="4" cx="50" cy="20" r="5"/><circle class="flower" data-s="4" cx="44" cy="17" r="3"/><circle class="flower" data-s="4" cx="56" cy="17" r="3"/>`;
  return el;
}
function openTimer(paperId) {
  if (timerDlg && timerDlg.isConnected) { if (paperId && !T.running) T.paper = paperId; renderTimer(); return; }
  if (paperId && !T.running) T.paper = paperId;
  if (!T.paper && !T.running) { const r = S.L.papers.find(p => p.status === 'reading'); const q = (S.L.queue || []).map(paperById).find(p => p && !DONE.has(p.status)); T.paper = (r || q || {}).id || null; }
  const body = h('div.timer');
  timerDlg = openDialog({ title: 'Focus', cls: 'sm', body, onClose: () => { timerDlg = null; } });
  renderTimer();
}
function renderTimer() {
  if (!timerDlg || !timerDlg.isConnected) return;
  const body = $('.timer', timerDlg); if (!body) return;
  const p = T.paper ? paperById(T.paper) : null, stage = Math.min(4, sessionsToday() + (T.running ? 0 : 0));
  if (T.running) {
    const rem = timerRemaining(), pct = 100 - rem / T.duration * 100;
    const existing = $('.ring .center b', body);
    if (existing && body.dataset.mode === 'run') { existing.textContent = mmss(rem); $('.ring .bar', body).setAttribute('stroke-dasharray', `${pct} 100`); $('.pausebtn', body).replaceChildren(icon(T.pausedAt ? 'play' : 'pause'), T.pausedAt ? 'Resume' : 'Pause'); return; }
    body.dataset.mode = 'run';
    body.replaceChildren(h('div.small.muted', p ? `“${p.short || p.title}”` : 'Free reading'), ring(pct, { size: 220, center: [h('b', mmss(rem)), h('small', T.pausedAt ? 'Paused' : `${Math.round(T.duration / 60)} min focus`)] }),
      playful() ? h('div.row', plantSVG(stage), h('div.col', { style: 'gap:2px' }, h('span.plantlbl', `Focus session ${sessionsToday() + 1} today`), h('span.plantlbl', 'The sapling grows a notch when you finish'))) : h('span.plantlbl', `Focus session ${sessionsToday() + 1} today`),
      h('div.ctl', h('button.btn.pausebtn', { onclick: () => T.pausedAt ? resumeTimer() : pauseTimer() }, icon(T.pausedAt ? 'play' : 'pause'), T.pausedAt ? 'Resume' : 'Pause'), h('button.btn.btn-primary', { onclick: () => finishTimer() }, icon('check'), 'Finish & record'), h('button.btn.btn-ghost', { onclick: async () => { if (timerElapsed() < 60 || await confirmDialog('Abandon this session? It won’t be recorded.', { ok: 'Abandon', danger: true })) resetTimer(); } }, 'Abandon')));
    return;
  }
  body.dataset.mode = 'pick';
  const minsDefault = settings().pomodoro_minutes || 25;
  let mins = T.duration / 60 || minsDefault;
  const custom = h('input.input', { type: 'number', min: 1, max: 240, value: mins, style: 'max-width:80px', onchange: e => { mins = clamp(+e.target.value || minsDefault, 1, 240); segs.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === mins))); } });
  const segs = h('div.seg', [15, 25, 45, 60].map(v => h('button', { 'data-v': v, 'aria-pressed': String(v === mins), onclick: () => { mins = v; custom.value = v; segs.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === v))); } }, `${v} min`)));
  const cands = S.L.papers.filter(x => !DONE.has(x.status)).sort((a, b) => (a.status === 'reading' ? -1 : 0) - (b.status === 'reading' ? -1 : 0) || ((S.L.queue || []).indexOf(a.id) + 1 || 999) - ((S.L.queue || []).indexOf(b.id) + 1 || 999));
  const sel = h('select.select', { onchange: e => { T.paper = e.target.value || null; persistTimer(); } }, h('option', { value: '' }, 'Free reading (no paper)'), cands.slice(0, 60).map(x => h('option', { value: x.id, selected: x.id === T.paper }, `${x.short || x.title}${x.status === 'reading' ? ' (reading)' : (S.L.queue || []).includes(x.id) ? ' (queued)' : ''}`)));
  body.replaceChildren(playful() ? h('div.row', plantSVG(stage), h('div.col', { style: 'gap:2px' }, h('span.plantlbl', `${sessionsToday()} focus ${sessionsToday() === 1 ? 'session' : 'sessions'} done today`), h('span.plantlbl', stage >= 4 ? 'The sapling is blooming.' : 'Each session grows the sapling a notch.'))) : h('span.plantlbl', `${sessionsToday()} focus ${sessionsToday() === 1 ? 'session' : 'sessions'} done today`),
    h('div.pick', h('div.field', h('label', 'Paper'), sel), h('div.field', h('label', 'Length'), h('div.row.wrap', segs, custom, h('span.small.muted', 'min')))),
    h('div.ctl', h('button.btn.btn-primary.btn-lg', { onclick: () => { startTimer(sel.value || null, mins); } }, icon('play'), 'Start')));
}

/* ============================================================ command palette */
function paletteItems() {
  const items = [];
  PAGES.forEach(([id, label, ic]) => items.push({ sec: 'Pages', t: `Go to ${label}`, k: id === 'expert' ? 'g x' : id === 'gaps' ? 'g d' : `g ${id[0]}`, ic, run: () => go(id) }));
  const acts = [
    ['Start reading (next in queue)', 'pdf', () => { const p = nextToRead(); p ? startReading(p) : toast({ text: 'Nothing to read yet - add a paper to the queue.' }); }, 'r'],
    ['Start focus', 'play', () => openTimer(), 'f'], ['Add paper', 'plus', () => openAddPaper(), 'n'], ['Toggle theme', 'moon', toggleTheme, 't'],
    ['Toggle density', 'queue', () => { applyDensity(store.get('density', 'comfortable') === 'compact' ? 'comfortable' : 'compact'); render(); }],
    ['New reminder', 'bell', () => reminderForm()], ['Auto-schedule queue', 'sparkles', () => { go('plan'); setTimeout(autoSchedule, 100); }],
    [`Ask ${persona()} to survey`, 'owl', () => { go('explore'); setTimeout(() => { const ta = $('#page textarea'); ta && ta.focus(); }, 100); }],
    ['New expert discussion', 'expert', () => { if (S.page !== 'expert') go('expert'); setTimeout(newExpertDialog, 100); }],
    ['New daily gap brief', 'bulb', () => { if (S.page !== 'gaps') go('gaps'); generateGap(); }],
    ['Jot a question (Trail)', 'note', () => { go('explore'); S.exploreView = 'trail'; store.set('exploreView', 'trail'); render(); setTimeout(() => { const ta = $('.trjot'); ta && ta.focus(); }, 100); }],
    ['Open Trail', 'explore', () => { go('explore'); setExploreView('trail'); }],
    ['Re-analyse Trail', 'sparkles', () => { if (S.page !== 'explore') go('explore'); setExploreView('trail'); analyzeTrail(); }],
    ['Export JSON', 'download', () => { const a = h('a', { href: '/api/export', download: `library-${todayStr()}.json` }); document.body.appendChild(a); a.click(); a.remove(); }],
    ['Keyboard shortcuts', 'help', helpSheet, '?'], ['Toggle sidebar', 'back', toggleSidebar, '['],
  ];
  if (S.drawerId && paperById(S.drawerId)) acts.push(['Copy highlights of current paper', 'copy', () => copyHighlights(paperById(S.drawerId))]);
  acts.forEach(([t, ic, run, k]) => items.push({ sec: 'Actions', t, ic, run, k }));
  S.L.papers.forEach(p => items.push({ sec: 'Papers', t: p.short || p.title, sub: p.title, ic: 'book', id: p.id, run: () => { if (S.page !== 'library') go('library'); openDrawer(p.id); } }));
  return items;
}
function fuzzy(q, text) {
  if (!q) return 1; text = text.toLowerCase(); q = q.toLowerCase();
  if (text.includes(q)) return 100 - text.indexOf(q) / 10;
  let ti = 0, score = 0, streak = 0;
  for (const ch of q) { const idx = text.indexOf(ch, ti); if (idx < 0) return 0; streak = idx === ti ? streak + 1 : 0; score += 1 + streak * 2 - (idx - ti) * .05; ti = idx + 1; }
  return score;
}
function openPalette() {
  const dlg = $('#palette'); if (dlg.open) return;
  closePop();
  const items = paletteItems(), recents = store.get('palRecents', []);
  const input = h('input', { role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pallist', 'aria-autocomplete': 'list', placeholder: 'Search papers, pages, actions…', autocomplete: 'off', spellcheck: 'false' });
  const list = h('div.pallist#pallist', { role: 'listbox' });
  let sel = 0, shown = [];
  const mark = (t, q) => { if (!q) return t; const i = t.toLowerCase().indexOf(q.toLowerCase()); return i < 0 ? t : [t.slice(0, i), h('mark', t.slice(i, i + q.length)), t.slice(i + q.length)]; };
  function update() {
    const q = input.value.trim();
    let res;
    if (!q) { const rec = recents.map(t => items.find(i => i.t === t)).filter(Boolean); res = [...rec.map(i => ({ ...i, sec: 'Recent' })), ...items.filter(i => i.sec !== 'Papers' && !rec.includes(i)), ...items.filter(i => i.sec === 'Papers').slice(0, 6)]; }
    else res = items.map(i => ({ i, s: Math.max(fuzzy(q, i.t), i.sub ? fuzzy(q, i.sub) * .9 : 0, i.id ? fuzzy(q, i.id) * .8 : 0) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 40).map(x => x.i);
    shown = res; sel = 0;
    list.replaceChildren();
    if (!res.length) { list.appendChild(h('div.palempty', `Nothing matches “${q}”.`)); return; }
    let lastSec = null;
    res.forEach((it, idx) => {
      if (it.sec !== lastSec) { list.appendChild(h('div.palsec', it.sec)); lastSec = it.sec; }
      list.appendChild(h('div.palitem', { role: 'option', id: `pal-${idx}`, 'aria-selected': String(idx === sel), onclick: () => run(it), onmousemove: () => setSel(idx) }, h('span.ic', icon(it.ic || 'chev')), h('span.t', mark(it.t, q), it.sub ? h('small', it.sub) : null), it.k ? h('span.k', it.k.split(' ').map(k => h('kbd', k))) : null));
    });
    input.setAttribute('aria-activedescendant', 'pal-0');
  }
  function setSel(i) { sel = clamp(i, 0, shown.length - 1); $$('.palitem', list).forEach((el, j) => el.setAttribute('aria-selected', String(j === sel))); const el = $(`#pal-${sel}`, list); el && el.scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', `pal-${sel}`); }
  function run(it) { if (!it) return; const r = recents.filter(t => t !== it.t); r.unshift(it.t); store.set('palRecents', r.slice(0, 5)); close(); it.run(); }
  function close() { dlg.close(); dlg.replaceChildren(); }
  input.addEventListener('input', update);
  input.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(sel + 1); } else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(sel - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); run(shown[sel]); } else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Home') { setSel(0); } else if (e.key === 'End') { setSel(shown.length - 1); }
  });
  dlg.replaceChildren(h('div.dlg', h('div.palin', icon('search'), input), list, h('div.palfoot', h('span', h('kbd', '↑'), h('kbd', '↓'), ' select'), h('span', h('kbd', '↵'), ' run'), h('span', h('kbd', 'esc'), ' close'))));
  dlg.onclick = e => { if (e.target === dlg) close(); };
  dlg.oncancel = e => { e.preventDefault(); close(); };
  update(); dlg.showModal(); input.focus();
}

/* ============================================================ keyboard */
let chordG = 0;
function isTyping(e) { const t = e.target; return e.isComposing || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)); }
document.addEventListener('keydown', e => {
  if (CONSOLE || (e.target && e.target.closest && e.target.closest('.termwrap'))) return; // keys belong to the Claude console (even when focus slipped off it)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
  if (!S.L) return;
  if (e.key === 'Escape' && !isTyping(e)) { if (POP) return closePop(); if (document.querySelector('dialog[open]')) return; if (S.drawerId) { closeDrawer(); return; } }
  if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  const k = e.key;
  if (chordG && Date.now() - chordG < 900) { chordG = 0; const map = { t: 'today', l: 'library', m: 'map', p: 'plan', e: 'explore', a: 'assistant', x: 'expert', d: 'gaps', s: 'stats', ',': 'settings' }; if (map[k]) { e.preventDefault(); go(map[k]); return; } }
  if (k === 'g') { chordG = Date.now(); return; }
  if (k === '?') { e.preventDefault(); helpSheet(); return; }
  if (k === '/') { e.preventDefault(); const si = $('#libSearch') || $('#trsearch'); if (si) { si.focus(); si.select(); } else openPalette(); return; }
  if (k === 'f') { e.preventDefault(); openTimer(); return; }
  if (k === 'r' && !(S.page === 'library' && S.lib.view === 'list')) { e.preventDefault(); if (S.R) { openReadingDialog(); return; } const p = S.drawerId ? paperById(S.drawerId) : nextToRead(); if (p) startReading(p); return; }
  if (k === 'n') { e.preventDefault(); openAddPaper(); return; }
  if (k === 't') { e.preventDefault(); toggleTheme(); return; }
  if (k === '[') { e.preventDefault(); toggleSidebar(); return; }
  if (S.page === 'library' && S.lib.view === 'list') {
    const rows = $$('#libList .prow');
    if (k === 'j' || k === 'k') { e.preventDefault(); S.focusIdx = clamp(S.focusIdx + (k === 'j' ? 1 : -1), 0, rows.length - 1); rows.forEach((r, i) => r.classList.toggle('focused', i === S.focusIdx)); const r = rows[S.focusIdx]; if (r) { r.focus({ preventScroll: true }); r.scrollIntoView({ block: 'nearest' }); } return; }
    const cur = rows[S.focusIdx] || (document.activeElement && document.activeElement.closest && document.activeElement.closest('.prow'));
    const p = cur ? paperById(cur.dataset.id) : (S.drawerId ? paperById(S.drawerId) : null);
    if (!p) return;
    if (k === 'Enter') { e.preventDefault(); openDrawer(p.id); } else if (k === 'r') { e.preventDefault(); startReading(p, cur && cur.querySelector('.btn-read')); } else if (k === 'e') { e.preventDefault(); setStatus(p, DONE.has(p.status) ? 'unread' : 'read', cur); } else if (k === 'q') { e.preventDefault(); addToQueue(p, cur); } else if (k === 's') { e.preventDefault(); const btn = cur ? cur.querySelector('[title="Schedule"],[title="Reschedule"]') : null; datePopover(btn || cur || document.body, p.planned, d => setPlanned(p, d)); }
  }
});
function helpSheet() {
  if (document.querySelector('dialog[open]')) return;
  const K = (keys, label) => h('div', h('span', label), h('span.k', keys.split(' ').map(x => h('kbd', x))));
  openDialog({ title: 'Keyboard shortcuts', body: h('div.keys', K('⌘ K', 'Command palette'), K('/', 'Search'), K('g t', 'Today'), K('g l', 'Library'), K('g m', 'Map'), K('g p', 'Plan'), K('g e', 'Explore'), K('g a', 'Assistant'), K('g x', 'Expert'), K('g d', 'Daily gap'), K('g s', 'Stats'), K('g ,', 'Settings'), K('r', 'Start reading (PDF + assistant)'), K('f', 'Start focus'), K('n', 'Add paper'), K('t', 'Toggle theme'), K('[', 'Collapse sidebar'), K('j k', 'Library: move up / down'), K('↵', 'Library: open details'), K('e', 'Library: mark as read'), K('q', 'Library: add to queue'), K('s', 'Library: schedule'), K('esc', 'Close drawer / dialog'), K('?', 'This help')) });
}
function toggleSidebar() { const c = $('#app').classList.toggle('collapsed'); store.set('sidebarCollapsed', c); const b = $('#collapseBtn'); b.title = c ? 'Expand sidebar' : 'Collapse sidebar'; b.setAttribute('aria-label', b.title); }

/* ============================================================ router / render */
const RENDERERS = { today: renderToday, library: renderLibrary, map: renderMap, plan: renderPlan, explore: renderExplore, assistant: renderAssistant, expert: renderExpert, gaps: renderGaps, stats: renderStats, settings: renderSettings };
function go(page) {
  if (!RENDERERS[page]) page = 'today';
  if (page === S.page && S.loaded) { render(); return; }
  S.page = page; S.focusIdx = -1; store.set('lastPage', page);
  if (location.hash !== '#' + page) history.pushState(null, '', `${location.pathname}${location.search}#${page}`);
  $('#content').scrollTop = 0;
  if (page === 'explore' || page === 'assistant' || page === 'expert') refreshTerms();
  if (page === 'today') loadBriefing().then(render); else render();
}
function render() {
  { const m = $('#mascot'); if (m) { m.title = persona(); m.setAttribute('aria-label', persona()); } }
  if (!S.L) return;
  if (typingInProgress()) { deferRender(); return; }
  const content = $('#content'), top = content.scrollTop;
  const active = document.activeElement, focusKey = active && active.closest('#page') ? (active.dataset.id || active.id || null) : null;
  $('#app').classList.toggle('plain', !playful());
  renderNav();
  const pageEl = $('#page');
  const node = RENDERERS[S.page]();
  pageEl.replaceChildren(node);
  content.scrollTop = top;
  if (focusKey) { const el = pageEl.querySelector(`[data-id="${CSS.escape(focusKey)}"]`) || document.getElementById(focusKey); el && el.focus && el.focus({ preventScroll: true }); }
  renderDrawer();
  document.title = T.running ? document.title : APP_TITLE;
}
function routeFromHash() { const raw = decodeURIComponent(location.hash.replace('#', '')), [p, sub] = raw.split('/'); if (p === 'explore' && (sub === 'trail' || sub === 'survey')) { S.exploreView = sub; store.set('exploreView', sub); } if (p && p !== S.page) go(p || 'today'); else if (p === 'explore' && sub && S.L) render(); if (p === 'library' && sub && S.L) openDrawer(sub); }
window.addEventListener('hashchange', routeFromHash);
$('#collapseBtn').addEventListener('click', toggleSidebar);
$('.brand .logo').addEventListener('click', () => { if ($('#app').classList.contains('collapsed')) toggleSidebar(); });
$('#searchBtn').addEventListener('click', openPalette);
if (store.get('sidebarCollapsed', false)) { $('#app').classList.add('collapsed'); $('#collapseBtn').title = 'Expand sidebar'; $('#collapseBtn').setAttribute('aria-label', 'Expand sidebar'); }
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(store.get('theme', 'auto'), { persist: false }));
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyMotion);

/* ============================================================ boot */
(async function boot() {
  const [hashPage, hashSub] = decodeURIComponent(location.hash.replace('#', '')).split('/');
  S.page = RENDERERS[hashPage] ? hashPage : (store.get('lastPage', 'today'));
  if (!RENDERERS[S.page]) S.page = 'today';
  if (hashPage === 'explore' && (hashSub === 'trail' || hashSub === 'survey')) { S.exploreView = hashSub; store.set('exploreView', hashSub); }
  initMascot();
  renderTimerMini();
  try {
    await loadLibrary();
    if (S.page === 'today') await loadBriefing();
    api.get('/api/health').then(hh => { S.health = hh; }).catch(() => { });
    render();
    if (hashPage === 'library' && hashSub) openDrawer(hashSub);
    if (!new URLSearchParams(location.search).has('nosse')) connectSSE();
    if (T.running) { runTick(); }
    // greeting from the mascot once per day
    const key = 'greeted', last = store.get(key, '');
    if (last !== todayStr() && playful() && window.mascotSay) { store.set(key, todayStr()); setTimeout(() => window.mascotSay(`${greetingWord()}! ${S.D.streak ? `${S.D.streak}-day streak and counting.` : 'Read a little today.'}`), 1200); }
  } catch (e) {
    setOffline(true);
    $('#page').replaceChildren(h('div.empty', { style: 'padding:60px 16px' }, h('div.ill', icon('x')), h('div', 'Can’t reach the server. Make sure app/server.py is running.'), h('div.faint.xs', String(e.message)), h('button.btn', { onclick: () => location.reload() }, 'Retry')));
    setTimeout(() => location.reload(), 8000);
  }
})();
