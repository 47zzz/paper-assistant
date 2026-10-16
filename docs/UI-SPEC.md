# Paper Assistant — UI Spec (app/ui/index.html)

> Status (2026-10-16): this is the design-time spec of 2026-10-08, kept as the design reference. Where it differs from the
> shipped UI (`app/ui/`) or `docs/ARCHITECTURE.md` §7–13 (all microcopy is English now, the title is "Paper Assistant",
> `GET /api/arxiv` exists, Settings cover reading sessions, Assistant, Expert, Daily gap and Trail, the Map / Assistant /
> Expert / Daily gap pages and the Trail view were added later) the code is right.

Companion to `docs/ARCHITECTURE.md` (read §2 schema, §3 API, §5 pages first). The UI is a single
page, vanilla HTML/CSS/JS, **no build step, no CDN at runtime** (fonts + confetti are local under
`app/ui/fonts/` and `app/ui/vendor/`). It runs inside a WebKitGTK window (Linux) or Chrome/Firefox.
UI language: English (concise, sentence case; buttons are short verbs without trailing periods). The assistant
persona is "Yan" by default. Section titles below keep the original zh-TW page names for reference.
File layout: `index.html` (markup + inline `<script>`), `app.css`, `app.js` are all allowed; keep total
under ~250 KB. Target browsers: WebKitGTK 2.54, Chrome 130+, Firefox 130+ (use `color-mix`, `linear()`
easing with a `@supports` fallback, `<dialog>`, CSS nesting is OK).

## 1. Design language (tokens)

Near-achromatic surfaces, hairline borders, ONE accent, flat cards for dense data, glass only on
floating layers (command palette, toasts). Dark mode elevates by lighter surfaces, not shadows.

```css
:root{
  color-scheme: light dark;
  --font-sans:"Inter","Noto Sans CJK TC","Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif,"Apple Color Emoji","Noto Color Emoji";
  --font-mono:"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace;
  --fs-xs:12px;--fs-sm:13px;--fs-base:14px;--fs-md:16px;--fs-lg:20px;--fs-xl:24px;--fs-2xl:32px;
  --lh-ui:1.45;--lh-body:1.75;                 /* CJK body wants tall leading */
  --s-1:4px;--s-2:8px;--s-3:12px;--s-4:16px;--s-5:20px;--s-6:24px;--s-8:32px;--s-10:40px;
  --r-sm:6px;--r-md:12px;--r-lg:16px;--r-pill:9999px;
  --sidebar-w:232px;--rail-w:360px;--content-max:1040px;--gutter:16px;
  /* light */
  --bg:#f7f8f8;--surface:#ffffff;--surface-2:#f1f2f4;--surface-3:#e9eaee;
  --border:#e6e6e6;--border-strong:#d0d6e0;
  --fg:#111214;--fg-2:#5c5f66;--fg-3:#8a8d93;
  --accent:#5e6ad2;--accent-hover:#4f5bc4;--accent-fg:#fff;
  --accent-soft:color-mix(in oklab,var(--accent) 12%,transparent);
  --ok:#1a8f55;--warn:#b8700a;--danger:#c93c3c;--streak:#ff9600;
  --t1:#7c3aed;--t2:#0891b2;--t3:#6b7280;      /* tier colours; soft = color-mix 14% */
  --shadow-1:0 1px 2px rgba(0,0,0,.06),0 0 0 1px rgba(0,0,0,.03);
  --shadow-2:0 12px 32px rgba(0,0,0,.12);
  --ease-spring:linear(0,0.009,0.035 2.1%,0.141,0.281 6.7%,0.723 12.9%,0.938 16.7%,1.017,1.077,1.121,1.149 24.3%,1.159,1.163,1.161,1.154 29.9%,1.129 32.8%,1.051 39.6%,1.017 43.1%,0.991,0.977 51%,0.974 53.8%,0.975 57.1%,0.997 69.8%,1.003 76.9%,1);
  --dur-fast:120ms;--dur-base:200ms;--dur-slow:360ms;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){ /* dark */ } }
:root[data-theme="dark"]{ /* same dark block */ }
/* dark values: --bg:#0f1011;--surface:#191a1b;--surface-2:#222325;--surface-3:#2a2b2e;
   --border:rgba(255,255,255,.08);--border-strong:rgba(255,255,255,.14);
   --fg:#f7f8f8;--fg-2:#9c9c9d;--fg-3:#6a6b6c;--accent:#7170ff;--accent-hover:#8584ff;
   --accent-soft:color-mix(in oklab,var(--accent) 18%,transparent);--ok:#5fcf8f;--warn:#e6b155;--danger:#ef7a74;
   --t1:#a78bfa;--t2:#22d3ee;--t3:#9aa3b2;--shadow-1:0 0 0 1px rgba(255,255,255,.06);--shadow-2:0 16px 40px rgba(0,0,0,.6) */
```
Accent presets (settings.accent): violet `#5e6ad2/#7170ff`, blue `#2563eb/#60a5fa`, green `#15803d/#4ade80`,
rose `#be123c/#fb7185`, amber `#b45309/#fbbf24` → set via `:root[data-accent="blue"]{--accent:…}`.
Fonts: `@font-face` Inter variable (`font-weight:100 900`, `font-display:swap`, `unicode-range` latin /
latin-ext) and JetBrains Mono from `fonts/`. Body: `font-feature-settings:"cv01","ss03","tnum"`.
Headings weight 600, UI weight 500 (`--fw-medium:510` if variable font loads), tracking -0.01em on ≥20px.
Focus ring: `:focus-visible{outline:2px solid var(--accent);outline-offset:2px}`.
Reduced motion: honour `prefers-reduced-motion` AND `settings.reduced_motion` (`html[data-motion="reduce"]`):
transitions → opacity fades only, confetti disabled, mascot idle animation off.

## 2. Shell layout

```
┌ sidebar 232px ───────┬ main (scroll; max 1040px centred; gutter 16px) ────────┬ drawer 360px (paper detail, slides in) ┐
│ ◉ 論文書房           │ [page header: title · subtitle · actions]              │                                        │
│ ⌘K 搜尋…            │ [page content]                                         │                                        │
│ ─ 今天   (badge)     │                                                        │                                        │
│ ─ 書架               │                                                        │                                        │
│ ─ 計畫   (due)       │                                                        │                                        │
│ ─ 探索   (inbox •)   │                                                        │                                        │
│ ─ 統計               │                                                        │                                        │
│ ─ 設定               │                                                        │                                        │
│ ── 主題 ──           │                                                        │                                        │
│  🔁 Continual…  12/40│                                                        │                                        │
│  🔍 XAI          0/8 │                                                        │                                        │
│ [focus timer mini]   │                                                        │                                        │
│ 🦉 mascot · 連讀 🔥3 │                                                        │                                        │
└──────────────────────┴────────────────────────────────────────────────────────┴────────────────────────────────────────┘
```
* Sidebar collapses to 64px icon rail below 1100px and to a bottom tab bar below 720px (phone layout must
  work: 16px gutters, no horizontal scroll). Collapse state in `localStorage`.
* Nav items: 今天 `today` · 書架 `library` · 計畫 `plan` · 探索 `explore` · 統計 `stats` · 設定 `settings`.
  Badges: 計畫 = due/overdue count; 探索 = `inbox_count` as a dot + number.
* Topic list under the nav: emoji + name + progress `done/total`, click → 書架 filtered to that topic.
* Focus-timer mini widget (bottom of sidebar) shows remaining mm:ss + paper short name when running;
  click expands the timer modal.
* Mascot: inline SVG owl (~56px) with eyes that follow the cursor (`mousemove` → translate pupils ≤2px),
  blinks every 4–7 s, a sleepy variant after 23:00, and click reactions (bounce + random one-line
  encouragement from a list of ≥12 zh-TW lines; 1-in-6 clicks triggers a tiny confetti burst). Clicking 20
  times in a session unlocks a hidden「摸摸頭」badge toast (purely local, not persisted). This is the
  "useless but sticky" interaction.
* Theme toggle + sound toggle in the page header right side (icon buttons). Theme stored in `localStorage`
  and mirrored to `settings.theme`.

## 3. Pages

### 3.1 今天 (today) — the home bento
Data: `GET /api/briefing` + library. Tiles (CSS grid, 12 columns, bento: tiles span 4/6/8/12; ≥6 tiles):
1. **問候卡** (span 8): `greeting`（早安/午安/晚安 + user_name），一行狀態（「連讀第 N 天 🔥」/「今天還沒開始，讀 10 分鐘就能延續」/ first-day copy），persona 的一句建議（`suggestions[0]`），右側「開始專注」主按鈕 → focus timer with queue top paper.
2. **今日目標環** (span 4): single SVG ring `minutes_today / goal_minutes`, centre「32 / 45 分」, below a 7-day sparkline of session minutes. Ring animates with spring on change. Completed ring → ring turns `--ok`, one-time toast「今日目標達成」.
3. **今天要讀** (span 8): list = due reminders' papers ∪ `today_papers` ∪ `reading` ∪ `queue_top` (deduped, max 6). Row: animated checkbox (SVG stroke-draw; checking = `paper.status read` with confirm-less undo toast), short + title, chips (tier, est_minutes, topic emoji), hover actions: 開始專注 ▶, 筆記 ✎, 改天 📅 (date picker popover with 今天/明天/這週末/移到以後 quick buttons), 開啟 PDF.
   Overdue papers show a soft warn chip「逾期 N 天」and a「重排」button (same popover). Empty state: 「今天還沒安排。從佇列挑一篇？」+ button opens queue picker.
4. **小研的提醒** (span 4): `due_reminders` list with 完成 / 延後 30 分 / 刪除; plus `messages` tail (last 3 assistant messages, muted). Empty: 「目前沒有提醒。」
5. **回憶卡** (span 6): `recall` claims (「《EWC》：Fisher 資訊保護重要參數…」with 記得了 ✓ / 再看一次 → opens paper). If none: show one random `why` from an unread tier-1 paper as「今日一句」.
6. **新論文雷達** (span 6): `GET /api/radar?topic=<active or first topic>` → up to 5 newest arXiv papers (title, authors short, published date, primary category chip), 👍 adds to library (`radar.rate` with `paper` payload, tier 3), 👎 hides, refresh icon (force). Topic selector chips at the top of the tile. Loading skeleton while fetching; error → quiet「雷達暫時離線」.
7. **連讀 & 熱圖** (span 12 on narrow, else 6): streak flame (grey when `!active_today`), 「連續 N 天 · 最佳 M 天 · 暫停券 F」, GitHub-style 365-day heatmap from `activity` (level by xp/minutes), legend 少→多, hover title.
8. **探索收件匣** tile appears only when `inbox_count>0` (span 6): 「小研帶回 N 篇候選」→ go to 探索.

### 3.2 書架 (library)
Header: topic chips (全部 + each topic with emoji/color), search input (`/` focuses), filters (tier, status,
subtopic of selected topic, phase), sort (推薦順序 / 年份 / 狀態 / 評分 / 最近加入 / 引用數), density toggle
(舒適/緊湊), view toggle (清單 / 路線圖). Count line「顯示 12 / 40 篇」.
* **清單 view**: rows (list, not cards) with: status dot (unread grey, queued amber, reading accent, read/deep green), short **bold** + title muted, meta line (authors ≤3 et al. · year · venue · citations if >0), chips (tier colour, subtopic, phase, planned date 📅, rating ★), progress hairline bar at row bottom when `reading`. Hover/focus reveals quick actions: ▶ 專注, ✓ 讀完, 📅 排程, ➕ 加入佇列, ⤴ PDF. Click row → opens the **detail drawer** (right, 360px, slides in; on narrow screens becomes a bottom sheet). Keyboard: `j/k` move focus, `Enter` open, `e` mark read, `q` queue, `s` schedule, `Esc` close drawer.
* **路線圖 view** (per topic): phases as vertical timeline with progress bar per phase, papers listed under each with tier chip and check state (port of the old roadmap tab).
* **Detail drawer** sections (collapsible, Zotero-style): header (short, title, authors, year/venue, links arXiv ↗ / PDF 開啟 (`POST /api/open {path}`) / 下載 PDF if missing (`/api/download`)), 狀態 segmented control (未讀/排入/閱讀中/已讀/精讀/略過) + progress slider (0–100, with quick buttons 略讀 33 / 細讀 67 / 完成 100), 評分 stars (hover preview), 預定閱讀日 date + 預估 est_minutes + 難度 (1–3 dots), 「為何關鍵」 why box (accent-soft), TLDR, 快速筆記 textarea (autosave 600ms debounce → `paper.update quick_note`), 要記住的重點 (claims: list editor, add/remove, max 5; prompted automatically when marking read: a small modal「寫下 1–3 句想記住的重點？」with skip), 問題 / 想法 quick-add (→ `idea.add` with paper), 摘要 (details), 閱讀紀錄 (sessions for this paper, minutes_read), 深度筆記 (`GET /api/note?id=` → textarea editor with 儲存 → `POST /api/note`; shows the markdown raw; a「在外部編輯器開啟」button → `/api/open {path: note}`). Danger zone: 移除 (confirm dialog).
* Add paper: header button「＋ 新增論文」→ modal: paste arXiv id/URL or title; if arXiv id → fetch metadata via `GET /api/radar`-like? No: use a new helper endpoint? **Keep simple**: form fields (id, title, authors comma, year, venue, arxiv url, topic select, tier, why); if the id looks like an arXiv id and the title is empty, call `https://export.arxiv.org/api/query?id_list=<id>` **from the server** via `POST /api/op {op:"paper.add"}` after a client-side `fetch('/api/arxiv?id=')`. → The server exposes `GET /api/arxiv?id=<id>` returning `{ok, paper}` (implementer: add this small endpoint to server.py using the existing radar parser). After add: toast + confetti small.

### 3.3 計畫 (plan)
* **本週** (default) / 下週 / 月 toggle. Week board: 7 day columns (Mon–Sun, today highlighted, work_days tinted), each column lists papers with `planned` that day (drag & drop between days using HTML5 DnD → `paper.update planned`; also a「＋」per column opens a queue picker). Column footer: planned minutes vs daily goal — over-commit warning (amber) when `sum est_minutes > goal*1.5` (Sunsama-style).
* **佇列** panel (right/below): ordered `queue` list with drag handles (reorder → `queue.set`), remove ✕, and a「自動排程」button: distributes queue papers across upcoming work days by est_minutes against the daily goal (client-side; writes `planned` for each + creates reminders at `morning_briefing` time via `reminder.add`). Show a preview before applying.
* **提醒** panel: all reminders (upcoming first) with title, when (relative + absolute), repeat, done toggle, edit (inline when/title), delete; 「＋ 新提醒」form (title, datetime-local, repeat, optional paper).
* **路線圖/目標**: per-topic `goals` textarea (autosave) and phases editor is NOT required (read-only phases shown in 書架 roadmap).

### 3.4 探索 (explore) — the assistant handoff
* Hero input: big textarea「告訴小研你最近想研究什麼…」placeholder with examples (「我最近想做 explainable AI」「continual learning 裡跟 prompt 有關的最新方法」), submit button「交給小研調查」→ `request.add` then immediately `POST /api/launch-survey {request_id}` → show a card for the request with status (open/working/done), the terminal command in a copyable code block (`command` from the response), and a note: 「小研會在終端機裡跟你確認方向；完成後清單會出現在下方。」 If `launched:false` show「請自行在終端機執行：」.
* Requests list (history) with status chips; cancel button (→ status cancelled).
* **收件匣**: surveys with status `proposed`: card with topic emoji/name/zh, `direction.name` + primer, `summary`, `direction.chosen_from` as small chips (what else was considered), `lineage` muted, candidate list grouped by tier: checkbox (pre-checked by `selected`), short/title/year/venue/citations, `why`, `reason`, est/difficulty chips, link arXiv. Footer: 「自動排程 (plan)」toggle, 「全部接受」/「接受勾選的 N 篇」→ `survey.decide` (+confetti big), 「不需要」→ dismiss (confirm). Accepted/dismissed surveys collapse into a history list.
* Empty state (no surveys, no requests): illustration-free, text「還沒有委託過調查。試試輸入一個方向。」
* The hero also has **Save as a note**: the question is kept in the Trail (status `noted`) without a survey.

### 3.4b Trail (explore, second view; added 2026-10-15)
* Header segmented control `Survey | Trail` (`S.exploreView`, persisted; `#explore/trail` deep link). Trail = every question
  the user ever typed (survey requests, notes, expert briefs), as a research journal over time.
* Regions top to bottom: capture bar (one-line textarea; Enter = save note with Undo toast, Ctrl+Enter = ask Yan to survey,
  Shift+Enter newline) · "Yan suggests" chips (first two `trail.next`) · finder (search, kind facet, Cancelled toggle, stale /
  not-analysed chip, count) · facet chips · the strip card · list + sticky side panel.
* The strip: one lane per thread (Claude's analysis; survey topics before it exists), one column per day (weeks, then months
  when days no longer fit the content width), quiet stretches as narrow gap columns labelled `+3d / +2w / +1mo`, today
  tinted or a dashed `today` tick; ribbons mark where a thread was alive (dashed when dormant); branch curves show which
  question grew out of which (solid grew, dashed returns, dotted contrasts); stations: filled circle with a hole = surveyed,
  hollow = not sent, dashed hollow = note, diamond = expert, pill with a count = several that day; old stations fade.
  Click a station → detail; click a lane name → isolate the thread; ▶ replays the columns in order with a date caption.
* List: verbatim questions, newest day first, station name + gist above the text, chips for kind/status/topic/papers/tags,
  earlier months folded; a search shows a flat ranked list with `matched: …`.
* Side panel: Insights (nothing selected): pinned, north star (+ history popover), how the focus moved (station chips
  select entries), still-open loops, questions to ask next (Jot / Survey), recurring motifs, footer with Re-analyse / Stop
  and the Markdown download. Detail (selected): `← Insights`, kind + status + time, pin, copy, the original text in full,
  Claude's reading (station, gist, "what you wanted to do", keyword chips), thread, lineage, outcome (survey topic, accepted
  N of M, paper links, console), tags, note, actions.
* Phone: detail opens in a dialog, Insights folds above the list, no lane gutter.

### 3.5 統計 (stats)
Tiles: 總覽數字 (已讀 / 精讀 / 總篇數 / 總分鐘 / 想法數), 等級卡 (Lv N, XP bar to next level, `level_progress`), 徽章牆 (`badge_catalog` with earned ones coloured + date, locked ones greyed with desc), 熱圖 (same component as today), 每週分鐘長條圖 (last 12 weeks, SVG bars), 主題進度 (per topic stacked bar unread/queued/reading/read/deep), 最近完成 list. Export/Import JSON buttons live here too (`/api/export`, `/api/import`).

### 3.6 設定 (settings)
Form bound to `settings.update`: persona_name, user_name, user_email (used in API User-Agent), theme (跟隨系統/淺色/深色), accent swatches, daily_goal_minutes (slider 15–180), weekly_goal_papers, pomodoro_minutes, work_days (7 toggles), morning_briefing / evening_recap / streak_nudge times (empty = off), notifications toggle + 「測試通知」(`/api/notify`), sounds toggle, reduced_motion, celebration mode (每次/偶爾驚喜/關閉, local only), density, profile textarea「我的研究興趣（小研調查時會參考）」. Topics management: list with rename (name/zh/emoji/color/radar_query) + 暫停/完成 status + 刪除. Danger: 重設本機偏好 (localStorage only). Footer: version, library path, link to README.

### 3.7 Daily gap (gaps)
Two columns on wide screens: the brief (title, seed line with links to the seed papers, jump, Frontier, Gap in an accent box, Problem as a pull quote, "A direction to try" box with First experiment / Why feasible, Closest work, Risks | <target venue> angle (`settings.gap_venue`, default NeurIPS), Papers with ✓ checked / "Not found when checked" and Add to library / On your shelf, keywords, a note field) and a sticky chat panel (Discuss with Claude: log, suggestion chips when empty, live "writing…" bubble and a status line with the current tool, composer with Enter to send, Shift+Enter for a new line, Stop). Below 1100 px the chat stacks under the brief. A generating brief shows the seed and a live step list; a failed one shows the error with Try again. Header button: "Today's brief" / "Another one" / "Writing…". History list under it (All / Starred / 👍).

## 4. Global behaviours

* **Data flow**: on load `GET /api/library` → `L` (state); render current page; open `EventSource('/api/events')`; on `change` with rev > local rev → refetch library and re-render the current page **preserving scroll, open drawer, focus and in-progress text inputs** (don't clobber a textarea the user is typing in: skip re-render of focused inputs). Re-renders also wait while a mouse button is held down (`PTR_DOWN`): replacing the page between mousedown and mouseup swallows the click, which made Explore's survey button do nothing (and drop the typed request) whenever a refresh was queued while a survey console ran. The Explore request box keeps its draft in `S.exploreDraft`, and the console poll ignores `last_io` / `clients` when deciding whether to re-render. On `assistant` events → toast with title/text (persist in a small「小研」popover log; 10 s for reminders with 「打開論文」action if `paper`). Reconnect SSE with backoff; offline banner「伺服器離線中…重新連線」when fetch fails; mutations queue is NOT required (just show error toast and keep state consistent by refetch).
* **Mutations**: `api.op(op)` helper → POST `/api/op`; on `ok` apply returned `derived` to state and run `celebrate(result.events)`: each event has `{type, xp}`; show「+40 XP」floating chip near the triggering element; `finish/deep` → checkbox draw + blip + toast「讀完了！今日 N 篇」+ confetti (small always; big on every 5th finish or on new badge); `goal` → ring completes + toast; `session` → plant stage +1 in timer; new badge (compare `derived.badges` length) → badge sheet modal with name/desc + big confetti; level up → toast「升到 Lv N」.
* **Focus timer** (modal + mini widget): pick paper (default queue top / reading), duration (pomodoro default, 15/25/45/60 chips, custom), start → countdown using `Date.now()` deltas, document title shows `mm:ss · Paper Assistant`, growing plant SVG (5 stages, stage = sessions today; never withers), pause/resume, 結束並記錄 (any elapsed ≥1 min) → `session.add {paper, start, end, minutes, kind:"focus"}`; on natural end → blip ×2 + notification via `/api/notify`? No — in-app toast only (desktop notification would be redundant while window open) + prompt「要標記為讀完嗎？」with buttons 讀完 / 繼續閱讀中 / 稍後. Timer survives page switches (state in memory + `localStorage` so a reload restores it).
* **Command palette** (Ctrl/⌘+K, hand-rolled per WAI-ARIA combobox inside `<dialog>`): fuzzy search over pages, actions (開始專注, 新增論文, 切換主題, 匯出, 叫小研調查…), and papers (short/title); `↑↓` navigate, `Enter` run, `Esc` close; ignore Enter while `event.isComposing` (IME!).
* **Keyboard shortcuts**: `?` sheet; `g t/l/p/e/s` go to page; `/` search; `f` focus timer; `n` new paper; `t` theme; `j/k/Enter/e/q/s` in lists. Never trigger while typing in inputs or during IME composition.
* **Sounds**: WebAudio blips (`blip()` recipe: sine 520→220 Hz 60 ms; milestone chord); off when `settings.sounds=false`; AudioContext created on first user gesture.
* **Toasts**: stack ≤3, bottom-right (bottom-center on phone), `role=status aria-live=polite`, 5 s default, 10 s with action, 復原 action where sensible (status change, remove from queue).
* **Confetti**: `confetti.browser.min.js` local; `disableForReducedMotion:true`; colours from accent + streak + white.
* **Persistence of UI prefs** in `localStorage` wrapped in try/catch: theme, sidebar collapsed, density, last page, last topic filter, celebration mode, timer state, palette recents.
* **Greeting/time logic**: `h<5 夜深了 / <11 早安 / <14 午安 / <18 下午好 / 晚安`. After 23:00 the mascot wears a nightcap and the briefing suggests stopping.
* **Catch-up**: if `stats.last_active` is ≥3 days ago, today's greeting card uses the catch-up copy「歡迎回來。這 N 天小研幫你守著書架；要不要從最短的一篇開始？」and offers the shortest est_minutes unread tier-1 paper.
* **Microcopy** (zh-TW, 全形標點, consistent terms): 書架、佇列、提醒、專注、讀完、精讀、略過、排程、小研. Examples: 「讀完了！今日 2 / 3。」「今日目標達成。」「連續 30 天！這是你的一個月徽章。」「25 分鐘完成，小樹長高了一階。休息 5 分鐘吧。」「收件匣清空了。」「找不到符合「{q}」的論文。」

## 5. Components checklist (must exist, each tested in both themes)
ring, sparkline, heatmap, bars, checkbox (SVG draw), chips (tier/status/soft), segmented control, stars,
drawer, modal/dialog, popover (date quick-pick), toast, command palette, timer, plant, mascot, skeleton rows,
empty states, badge sheet, XP float chip, drag & drop (plan + queue), topic chips, density toggle.

## 6. Non-goals
No frameworks, no bundler, no remote requests except `/api/*` (the radar and arXiv fetch go through the
server). No localStorage for library data (server is the source of truth; offline mode just shows the banner).
