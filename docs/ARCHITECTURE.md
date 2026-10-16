# Paper Assistant (formerly 論文書房) — Architecture Contract

Status: v2 design, 2026-10-08. This file is the single source of truth shared by the
server, the desktop wrapper, the HTML UI, and the `paper-survey` Claude Code skill.
Anything that touches `library.json` must follow the schema here.

## 0. Naming

| thing | value |
|---|---|
| technical id | `paper-assistant` (folder/unit names); desktop & Wayland app id `io.github._47zzz.PaperAssistant` |
| display name | Paper Assistant (zh-TW: 論文書房, kept as `Name[zh_TW]` in the .desktop file) |
| assistant persona default name | Yan (was 小研; configurable in `settings.persona_name`) |
| library root | the folder this repository is cloned into (any path without spaces, e.g. `~/papers/`); every data file lives next to `app/` |
| server | `http://127.0.0.1:8765` (stdlib only, Python ≥ 3.12) |
| skill | `.claude/skills/paper-survey/` (ships with the repository as a project skill; a copy in `~/.claude/skills/` takes precedence) invoked as `/paper-survey <natural-language request>` |

## 1. Folder layout

```
<library root>/
├── library.json            ← THE database (schema v2 below). UTF-8, 2-space indent.
├── library.lock            ← flock taken by the skill's file mode (§4)
├── .backups/               ← rotating backups written by the server before each save (keep 30)
├── papers/                 ← PDFs, filename = <arxivId>_<Short>.pdf (existing files untouched)
├── notes/                  ← one markdown note per paper, <paperId>.md
├── .reading/<id>/          ← reading-session context, transcripts (§8–9); .reading-state.json = the active session
├── .expert/<id>/           ← Expert transcript copies and notes.md (§10)
├── .gaps/                  ← Daily gap briefs and chats as Markdown (§11)
├── .trail/                 ← trail.md mirror and analyze.log (§12)
├── .scheduler-state.json · .radar-cache.json · *.log   ← server state (all of the above are git-ignored)
├── app/
│   ├── server.py           ← HTTP API + static files + SSE + reminder scheduler, reading sessions, consoles, Expert, Daily gap, Trail (stdlib only)
│   ├── reader.py           ← PDF reader window (PDF.js + ui/reader-ext.js) for reading sessions
│   ├── graph.py            ← knowledge map (TF-IDF similarity + clustering)
│   ├── assistant_bridge.py ← pty proxy so Explain / Ask can type into the reading terminal
│   ├── desktop.py          ← native window: PyGObject + WebKit2GTK 4.1; falls back to chrome --app
│   ├── notify.py           ← desktop notifications (notify-send with actions) + briefing text
│   ├── xp.py               ← pure functions: streak, xp, level, badges (imported by server)
│   ├── migrate.py          ← writes an empty schema-v2 library on first start (never overwrites one)
│   ├── install.sh          ← installs .desktop, icon, systemd --user service; uninstall with --remove
│   ├── paper-assistant.desktop
│   ├── paper-assistant-server.service
│   ├── icon.svg / icon-*.png
│   └── ui/
│       ├── index.html      ← single-page app (vanilla JS, no build step)
│       ├── app.css, app.js ← the UI, served statically
│       ├── reader-ext.js/.css ← injected into the PDF.js viewer: highlights, Note / Explain / Ask, heartbeats (§9)
│       ├── fonts/          ← InterVariable-latin*.woff2, JetBrainsMono-Regular.woff2 (offline)
│       └── vendor/         ← pdfjs/ (PDF.js viewer), xterm/ (xterm.js), canvas-confetti.min.js (all offline)
├── start.sh                ← `./start.sh` = desktop app; `./start.sh --server` = server only; `--browser` = open in browser
├── docs/ARCHITECTURE.md    ← this file; docs/UI-SPEC.md (interface spec), docs/REMOTE-ACCESS.md (SSH-tunnel use)
├── .claude/skills/paper-survey/ ← the /paper-survey skill, shipped as a project skill
├── tests/                  ← headless-Chrome regression harness (developer tool)
├── CLAUDE.md               ← three rules for Claude sessions started in this folder
└── README.md               ← setup guide written for an agent
```

## 2. `library.json` schema v2

All dates are `YYYY-MM-DD`; all timestamps are ISO-8601 local time without timezone
(`2026-10-08T09:30:00`). Ids are strings. Unknown extra keys must be preserved by every writer
(read-modify-write, never drop fields you don't understand).

```jsonc
{
  "meta": { "version": 2, "app": "paper-assistant", "created": "2026-10-05", "updated": "2026-10-08T16:00:00", "rev": 12 },

  "settings": {
    "persona_name": "Yan", "user_name": "",
    "theme": "auto",                       // auto | light | dark
    "daily_goal_minutes": 45,              // focus-timer minutes per day
    "weekly_goal_papers": 3,
    "morning_briefing": "09:00",           // "" disables
    "evening_recap": "21:30",
    "streak_nudge": "20:00",               // fires only if no activity today
    "notifications": true, "sounds": true, "reduced_motion": false,
    "work_days": [1,2,3,4,5],              // ISO weekday numbers used by auto-scheduling
    "pomodoro_minutes": 25,
    "accent": "violet"                     // violet | blue | green | rose | amber (UI accent preset)
  },

  "tiers": { "1": "核心必讀", "2": "進階", "3": "延伸/前沿" },
  "statuses": [["unread","未讀"],["queued","排入計畫"],["reading","閱讀中"],["read","已讀"],["deep","精讀完成"],["skipped","略過"]],

  "topics": [{
    "id": "continual-learning",            // slug, unique
    "name": "Continual Learning", "zh": "持續學習", "emoji": "🔁", "color": "#7c5cff",
    "status": "active",                    // active | paused | done
    "created": "2026-10-05", "description": "一段話說明這個主題與目前目標",
    "origin_query": "",                    // the natural-language request that created it (if any)
    "subtopics": [{ "id": "regularization", "name": "正則化", "description": "" }],
    "phases": [{ "id": "P1", "name": "建立全貌", "weeks": "第 1–2 週", "goal": "..." }],
    "goals": ""                            // free text (was v1 top-level `goals`)
  }],

  "papers": [{
    "id": "1612.00796",                    // arXiv id (no version) when available; else "doi:10.x/..." or "oa:W123"
    "short": "EWC", "title": "...", "authors": ["..."], "year": 2016, "venue": "PNAS 2017",
    "abstract": "...", "arxiv": "https://arxiv.org/abs/1612.00796", "doi": "", "url": "",
    "pdf": "papers/1612.00796_EWC.pdf",   // relative to library root; "" if not downloaded
    "note": "notes/1612.00796.md",
    "topic": "continual-learning", "subtopic": "regularization", "phase": "P2",
    "tier": 1, "order": 0,
    "why": "為何關鍵（繁中，1–2 句）", "tldr": "", "tags": [],
    "citations": 0, "difficulty": 2,       // 1 easy · 2 medium · 3 hard
    "est_minutes": 60,
    "status": "unread", "rating": 0,
    "planned": "", "started": "", "finished": "", "added": "2026-10-05",
    "source": "curated",                   // curated | manual | survey:<surveyId>
    "progress": 0,                         // 0–100 (%)
    "quick_note": "", "questions": [], "highlights": [],
    "minutes_read": 0, "last_opened": ""
  }],

  "queue": ["1706.03762", "1512.03385"],   // ordered "read next" list (paper ids)

  "reminders": [{
    "id": "r_20261008_a1", "title": "讀 EWC", "when": "2026-10-09T09:00:00",
    "paper": "1612.00796", "topic": null,
    "kind": "read",                        // read | review | custom
    "repeat": "none",                      // none | daily | weekly
    "done": false, "notified_at": "", "created": "2026-10-08T16:00:00"
  }],

  "sessions": [{ "id": "s_...", "paper": "1612.00796", "start": "2026-10-08T14:00:00", "end": "2026-10-08T14:25:00", "minutes": 25, "kind": "focus", "note": "" }],

  "activity": [{ "date": "2026-10-08", "at": "2026-10-08T14:25:00", "type": "session", "paper": "1612.00796", "minutes": 25, "xp": 25 }],
  // types: finish | deep | start | session | note | idea | add | survey | goal

  "ideas": [{ "id": "i_...", "text": "...", "created": "...", "paper": null, "topic": null, "kind": "idea", "done": false }],
  // kind: idea | question | todo

  "requests": [{ "id": "q_20261008_7f", "text": "我最近想做 explainable AI", "created": "...", "status": "open", "survey": null, "note": "" }],
  // status: open | working | done | cancelled   (the skill claims open → working → done)

  "surveys": [{
    "id": "sv_20261008_xai", "request": "q_20261008_7f", "created": "...", "query": "我最近想做 explainable AI",
    "status": "proposed",                  // proposed | accepted | dismissed
    "topic": { "id": "explainable-ai", "name": "Explainable AI", "zh": "可解釋 AI", "emoji": "🔍", "color": "#0ea5e9" },
    "direction": { "name": "Post-hoc attribution for vision", "primer": "2–3 句繁中入門說明",
                    "chosen_from": [{ "name": "...", "primer": "...", "count": 1234, "trend": "rising" }] },
    "summary": "繁中 3–5 句：這是什麼方向、為何選這幾篇、建議閱讀順序",
    "candidates": [ { /* full paper object as above, plus */ "score": 0.87, "selected": true, "reason": "一句話" } ],
    "plan": [{ "paper": "1602.04938", "planned": "2026-10-10" }],
    "lineage": "arxiv+openalex, 5 queries, snowball depth 1, 212 candidates → 8"
  }],

  "stats": { "xp": 0, "level": 1, "streak": 0, "best_streak": 0, "last_active": "", "freezes": 1, "badges": [{ "id": "first-finish", "date": "" }] },

  "messages": [{ "at": "...", "kind": "briefing", "text": "早安！今天排了 2 篇..." }]   // assistant log shown in UI, max 200
}
```

### Derived rules (implemented in `app/xp.py`, used by server; UI only displays)

* **Streak**: a day counts if `activity` has any entry of type finish/deep/session/note on that date.
  Streak = consecutive counted days ending today or yesterday. A missing day may consume one
  `stats.freezes` (max 2 banked; one is earned per 7-day streak). `best_streak` is monotonic.
* **XP**: session minute = 1; note written (non-empty quick_note first time) = 10; idea = 5;
  finish = 40 (+20 if tier 1); deep = 80 (+20 if tier 1); daily goal met = 30 (once per day);
  accepting a survey = 15. `level = floor(sqrt(xp / 120)) + 1`; next-level threshold = `120 * level²`.
* **Badges** (id → condition): `first-finish`, `streak-7`, `streak-30`, `papers-10`, `papers-25`,
  `topic-done` (all tier-1 of a topic read), `night-owl` (session ending after 23:00), `early-bird` (before 08:00),
  `deep-5`, `idea-20`, `survey-first`.

### First start (`app/migrate.py`)

* When `library.json` is missing, `server.py` runs `app/migrate.py --root <library root>`, which writes an empty schema-v2
  library (default settings, empty collections). It never overwrites an existing file; `apply_defaults()` fills any newer
  collection on load.

## 3. HTTP API (server.py)

All responses JSON (`Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store`).
Bind 127.0.0.1 only. CORS not needed (same origin).

| method & path | purpose |
|---|---|
| `GET /` | UI (`app/ui/index.html`) |
| `GET /app/ui/...`, `GET /papers/...`, `GET /notes/...` | static files from library root (PDF served inline with `application/pdf`) |
| `GET /api/health` | `{ok:true, rev, version, pid, started, root}` (`root` = absolute library root; the skill scripts compare it with their own root and fall back to file mode when it differs) |
| `GET /api/library` | full library + `"derived": {streak, level, xp_to_next, today:{...}}` |
| `POST /api/op` | apply one mutation (see ops). Body `{op, ...args}`. Returns `{ok, rev, derived}`; on error `{ok:false, error}` with 400 |
| `POST /api/ops` | `{ops:[...]}` applied atomically |
| `GET /api/events` | Server-Sent Events. `event: change` `data: {"rev":n,"reason":"paper.status","ids":[...]}`; `event: assistant` `data: {"kind":"reminder","title":"","text":"","paper":""}`; `: ping` every 25 s |
| `GET /api/briefing` | computed plan for today (also used by notify.py): `{greeting, due_reminders[], today_papers[], overdue[], queue_top[], streak, goal_minutes, minutes_today, suggestions[], inbox_count}` |
| `POST /api/open` | `{path}` (relative to root) or `{url}` → `xdg-open` on the host; returns `{ok}` |
| `POST /api/notify` | `{title, body}` → desktop notification now (test button) |
| `POST /api/download` | `{id}` → downloads arXiv PDF for that paper into `papers/`, sets `pdf`, emits change. Runs in a thread; returns `{ok, started:true}` |
| `POST /api/term/start` | `{kind: survey\|claude\|assistant\|expert, request_id?, cols?, rows?}` → the default survey path: runs `claude "/paper-survey <request text>"` (or a plain `claude`) in an in-app console (pty + xterm.js, §"Yan console" in README) with cwd = library root; marks the request `working` (`runner:"console"`, `console:<id>`); `GET /api/term/list`, `/api/term/stream`, `POST /api/term/input|resize|close` drive it |
| `POST /api/launch-survey` | secondary "System terminal" button (local mode only): `{request_id, launch?:bool}` → opens a terminal window (`ptyxis`, `gnome-terminal`, `kgx`, `konsole` or `xterm`, the first one found) running `claude "/paper-survey <request text>"` in library root; marks the request `working` (`runner:"terminal"`); returns `{ok, launched, command}` (`launched` false when no terminal emulator exists; the UI then shows the command to copy; `launch:false` only returns the command) |
| `GET /api/requests?status=open` | for the skill; same data as library.requests filtered |
| `POST /api/import` | `{library}` replace whole file (after validation) |
| `GET /api/export` | download library.json |

### Ops (`POST /api/op`)

Every op validates ids, stamps `meta.updated`, bumps `meta.rev`, saves atomically (tmp + rename, backup
before), recomputes `stats`, and broadcasts an SSE `change`. Field whitelists: writers may only set
the fields listed in §2 for that object type (unknown fields rejected with 400, so typos surface).

| op | args | side effects |
|---|---|---|
| `paper.update` | `{id, fields}` | plain field set (not `status`) |
| `paper.status` | `{id, status}` | `reading`→sets `started` if empty; `read`/`deep`→sets `finished`=today, `progress`=100, removes from queue, activity `finish`/`deep`, xp, badges; `queued`→adds to queue end |
| `paper.add` | `{paper}` | defaults filled; `added`=today; activity `add`; creates `notes/<id>.md` from template if missing |
| `paper.remove` | `{id}` | removes from queue/reminders; never deletes files |
| `paper.progress` | `{id, progress}` | clamps 0–100 |
| `queue.set` / `queue.add` / `queue.remove` | `{ids}` / `{id, index?}` / `{id}` | |
| `reminder.add` / `reminder.update` / `reminder.remove` | `{reminder}` / `{id, fields}` / `{id}` | |
| `session.add` | `{paper, start, end, minutes, kind, note}` | adds activity `session` (+xp), `papers[].minutes_read += minutes`, daily-goal check |
| `idea.add` / `idea.update` / `idea.remove` | | activity `idea` (+xp) on add |
| `topic.add` / `topic.update` / `topic.remove` | | remove keeps papers (topic set to "") |
| `settings.update` | `{fields}` | |
| `request.add` / `request.update` | `{text}` / `{id, fields}` | |
| `survey.add` | `{survey}` | status forced `proposed`; emits `assistant` SSE "Yan brought back N candidate paper(s)" ; activity `survey` |
| `survey.decide` | `{id, accept:[paperIds], schedule:true}` | accepted candidates → `papers` (dedup by id; existing paper keeps user fields, gains topic/tier if empty), topic created if missing, appended to queue, `plan` entries → `planned` + reminders when `schedule`; status `accepted` (or `dismissed` if accept empty) ; xp 15 |
| `activity.add` | `{type, paper?, minutes?}` | generic (e.g. `note` when quick_note first becomes non-empty — server detects that itself in `paper.update`) |
| `message.add` | `{kind, text}` | assistant log |
| `library.replace` | `{library}` | import |

### File watching & concurrency

* Server keeps the library in memory under a `threading.RLock`. Every save: write `library.json.tmp`,
  copy current to `.backups/library-<ISO>.json` (prune to 30), `os.replace`.
* A watcher thread checks `library.json` mtime every 2 s; if it changed externally (skill wrote
  directly), reload and broadcast `change` with reason `external`.
* The skill's `ingest.py` first tries `POST /api/op` (server up); otherwise edits the file under
  `fcntl.flock` on `library.lock`. Both paths produce identical results.

### Reminder scheduler (thread inside server.py)

Every 30 s: (1) reminders with `when <= now` and `notified_at == ""` and not done → desktop notification
(`notify.py`) + SSE `assistant` event; `repeat` reminders are re-armed (`when += 1 day/7 days`).
(2) `morning_briefing` time → notification with today's plan (`/api/briefing` text); (3) `evening_recap`
→ summary of today's minutes/papers; (4) `streak_nudge` → only if streak > 0 and no activity today.
Each of (2)–(4) fires at most once per day (state in `.scheduler-state.json`). Honors `settings.notifications`.

Notification actions: `open` → launches the app (`gtk-launch io.github._47zzz.PaperAssistant` or `python3 app/desktop.py`);
`later` → snooze 30 min. Implemented with `notify-send -A open="Open Paper Assistant" -A later="Remind me in 30 min" -w`
in a thread (blocking wait), app-name `Paper Assistant`, icon = installed icon path.

## 4. App ↔ Skill handoff

1. User types a natural-language request on the Explore page (e.g. 「我最近想做 explainable AI」) and presses
   "Ask <persona> to survey". UI → `request.add`, then `POST /api/term/start {kind:"survey", request_id}`, which runs
   `claude "/paper-survey <text>"` in an in-app console and marks the request `working`. A request back at `open`
   (console ended early, server restarted) shows "Send <persona>" (same route), a secondary "System terminal" button
   (`/api/launch-survey`, local mode only) and a copy-able command for manual use:
   `cd <library root> && claude "/paper-survey 我最近想做 explainable AI"`.
2. The skill (running inside Claude Code, interactive) claims the request (`request.update status=working`),
   runs probe → (optional) narrowing dialogue with the user in the terminal → focused search → selection,
   then `ingest.py` posts `survey.add` and `request.update status=done survey=<id>`.
3. UI receives SSE `assistant` → toast + badge on 探索 tab; inbox card lists candidates grouped by
   tier with `why`; user toggles selections, optionally「自動排程」, clicks 接受 → `survey.decide`.
4. Accepted papers appear in 書架 under the new topic; PDFs download in the background (`/api/download`
   per paper, triggered by `survey.decide` when `pdf` is empty and an arXiv id exists).

The skill may also be invoked directly in Claude Code without a request; then it creates the request
itself (`request.add`) so the UI history stays complete.

## 5. UI pages (index.html)

Left sidebar navigation (collapsible to icons), content area, optional right drawer for paper detail.
Pages: `today` · `library` · `map` (§7) · `plan` · `explore` (Survey + Trail, §12) · `assistant` (§8–9) · `expert` (§10) · `gaps` (§11) · `stats` · `settings`.
Global: command palette (Ctrl/⌘+K), focus-timer widget (persists across pages), toast stack, confetti,
mascot (SVG, reacts to clicks and cursor), theme toggle, SSE live updates, keyboard shortcuts
(page navigation is a `g` chord: `g t` today, `g l` library, `g m` map, `g p` plan, `g e` explore, `g a` assistant, `g x` expert, `g d` daily gap, `g s` stats; single keys `/` search, `f` focus timer, `r` start reading, `t` toggle theme, `[` sidebar, `?` help; `j`/`k`/`Enter`/`e`/`q` act on the focused row of the library list).

Detailed UI spec: `docs/UI-SPEC.md` (written after design research; the implementer must read it).

## 6. Skill `paper-survey` contract (summary)

* Entry: `/paper-survey <text>` or no text (then it lists open requests from the app and asks which one).
* Scripts are plain Python 3 (stdlib + optional `requests`), run with `python3 -I`, cache HTTP responses under
  `~/.cache/paper-survey/`, send `User-Agent: paper-assistant/<script version> (mailto:<settings.user_email, or paper-assistant@localhost>)`,
  honour arXiv 3-second spacing and OpenAlex polite pool.
* Primary sources: arXiv API (keyword + category), OpenAlex (`title_and_abstract.search`, `group_by`
  for breadth, `referenced_works`/`cited_by_api_url` for snowballing, `/topics` for taxonomy),
  Semantic Scholar only if `S2_API_KEY` is set (unauthenticated calls are usually rate-limited with 429).
* Breadth probe decides narrow vs broad; broad → present 4–7 directions with 2–3 sentence primers in the user's language
  (what / why it matters / representative paper / activity trend / difficulty) and ask with
  AskUserQuestion (multi-select, "再細分" option) — repeat at most twice.
* Final list: 8 papers by default (5–12), tiers assigned, reading order, `why` + `est_minutes` + `difficulty`
  (`why` in English — the app UI is English), plus a 3–5 sentence English `summary`. **Only papers returned by the scripts may be included**
  (no memory-only citations); every candidate carries `arxiv` or `doi`.
* Ingest via `scripts/ingest.py` (API-or-file), which also downloads arXiv PDFs and creates note templates.
* Full details: `.claude/skills/paper-survey/SKILL.md` and its `references/`.

## 7. Many-to-many memberships & knowledge map (added 2026-10-09)

Papers can belong to several topics and several survey batches (overlapping surveys are normal):

| paper field | meaning |
|---|---|
| `topic` | primary topic (legacy, always equals `topics[0]`) |
| `topics[]` | every topic the paper belongs to; `survey.decide` on an existing paper appends the survey's topic |
| `surveys[]` | every survey id that proposed the paper (first = `source` `survey:<id>`); groups papers by *request time* |
| `keywords[]` | ≤20 short English keywords (skill fills from OpenAlex keywords / arXiv categories / its own judgment) |
| `related[]` | ids of other library papers linked by citation (skill fills from snowball edges); drawn as `related` edges |

`sync_memberships()` in server.py keeps these consistent on load, `paper.add`, `paper.update` and `survey.decide`.
`survey.decide` accepts `topic_id` to file the survey under an existing topic instead of the one the skill proposed.

`GET /api/graph?k=4` → `{nodes[], edges[], clusters[], groupings{topic,survey,subtopic}}` (see `app/graph.py`):
TF-IDF over title/abstract/tldr/keywords, cosine kNN edges (`kind:"sim"`) plus `related` edges, deterministic weighted
label propagation into communities with auto labels (shared keywords, else top TF-IDF terms). The UI's 地圖 page offers
groupings: 主題 (`topics`), 調查批次 (`surveys`, ordered by `created`), 知識雲圖 (`cluster`), 子題 (`subtopic`), 年代 (`year`),
rendered either as a force-directed canvas graph or as grouped lists; papers in ≥2 groups are the "交集".

## 8. Reading sessions (added 2026-10-11)

A reading session = the paper's PDF open in a dedicated window, the clock running, and (optionally) a
Claude Code terminal preloaded with the paper. One session at a time; owned by `ReadingSessions` in
`app/server.py`, the window itself is `app/reader.py` (PyGObject + WebKitGTK rendering the PDF).

| method & path | purpose |
|---|---|
| `GET /api/reading` | `{ok, reading}` — the active session (`{paper, short, title, started, ts, last_seen, pid, viewer, mode, assistant, pdf, assistant_opened?}`) or `null` |
| `GET /api/monitors` | `{ok, monitors[]}` — connected displays as reported by `reader.py --list-monitors` (cached 30 s); used by Settings → Reading sessions |
| `POST /api/reading/start` | `{id, assistant?, viewer?}` → opens the PDF (downloads it from arXiv first when missing), marks the paper `reading` if it was `unread`/`queued`, sets `last_opened`, returns `{ok, reading}`. `assistant` (bool) and `viewer` (`builtin`\|`system`) override the settings for this session only. 400 when a session is already running or the paper has no PDF/arXiv id |
| `POST /api/reading/stop` | ends the session from the app (SIGTERM to the window's process group), waits for it to be recorded; `{ok, result, reading:null}` |
| `POST /api/reading/assistant` | `{id?}` → (re)opens the Claude Code terminal for the active paper; `{ok, session, resumed, context}` |
| `POST /api/reading/notes` | `{id?}` → opens `notes/<id>.md` with `xdg-open` (creates it when missing); `{ok, path}` |

**SSE** `event: reading` carries the session object plus `state`:
`started` (window launched), `updated` (e.g. a `system` viewer handed the file to an already-running
instance, so `mode` flips to `manual` and the user ends the session from the app), and `ended`, which
carries `{paper, short, minutes, xp, recorded, events[]}` — `recorded` is true when ≥ 1 minute elapsed and a
`session.add` (kind `reading`) was applied; `events` are the xp/badge events from that op; `error` is set
if recording failed. `/api/library` also includes `derived.reading` for cold starts.

**Assistant terminal.** `POST /api/reading/assistant` (also fired automatically on start when
`reading_assistant` is on) writes `.reading/<id>/context.md` — metadata, the user's notes/questions,
related library papers and the full text extracted from the PDF — then opens a terminal running
`claude --session-id <uuid> --name "Reading: <short>" --append-system-prompt …` the first time and
`claude --resume <uuid> …` afterwards, so the discussion about a paper continues across sessions. The
UUID is stored on the paper as `chat_session` (field in `PAPER_FIELDS`; generated when empty or malformed).

**State file & recovery.** The active session is persisted to `.reading-state.json` (refreshed every
30 s with `last_seen`). On startup `recover()` re-attaches to a window whose pid is still alive (polling it
until it exits), or, if the window is gone, records the missed session using `last_seen` as the end time,
then deletes the file.

**Settings keys** (all optional, in `settings`): `reading_monitor` (`"auto"` = prefer a secondary,
portrait display, or a monitor index as a string), `reading_fullscreen` (bool, default true),
`reading_viewer` (`"builtin"` = `reader.py` window, `"system"` = `papers`/`evince`/`okular`/`zathura`/
`xdg-open`), `reading_assistant` (bool, default true — open the Claude terminal on start).

UI: the green Read button on a paper (shortcut `r`) calls `/api/reading/start`; the sidebar timer shows the
running session; closing the PDF window ends and records it.

## 9. Highlights, discussions, plain mode (added 2026-10-12)

- Collections: `highlights[]` = `{id, paper, page (1-based), quote, note, color (yellow|green|blue|pink), rects:[{x,y,w,h}] fractions of the page box, source, created, updated}`; `discussions[]` = `{id, paper, session (Claude session uuid), date, started, ended, minutes, summary (Markdown), transcript (relative path under .reading/), turns, created}`.
- Ops: `highlight.add/update/remove`, `discussion.add/update/remove` (`discussion.add` is normally called by the server's digest step). `highlight.add` records a `highlight` activity (+3 XP, counts for the streak). `paper.remove` drops the paper's highlights and discussions.
- Reader: `app/reader.py` loads `app/ui/vendor/pdfjs/web/viewer.html?file=/papers/<pdf>&paper=<id>#page=N`; `app/ui/reader-ext.js` (injected into viewer.html) paints highlights per page, captures selections, and listens to SSE `reader` events (`{paper, page}` from `POST /api/reading/goto`). `GET /api/highlights?paper=` feeds it. Static files support HEAD and byte ranges (PDF.js range requests).
- Digest: on session end, if an assistant session was opened, `make_digest()` reads `~/.claude/projects/<encoded ROOT>/<sid>.jsonl`, keeps user/assistant text turns after the session start, writes `.reading/<id>/transcript-<stamp>.md`, runs `claude -p --model sonnet` with `DIGEST_PROMPT`, stores a discussion row and appends "## Discussion notes (date)" to the note. Skipped when the user asked nothing (fewer than 2 user turns). `POST /api/reading/transcript {id}` opens a transcript.
- Settings: `gamification` (bool, default off). The UI hides XP/levels/badges/mascot/confetti/radar/recall when off; sessions, activity and the heatmap are unaffected.
- PDFs by hand (2026-10-12): `POST /api/upload?paper=<id>&name=<file>` with the raw PDF body (max 200 MB, must start with `%PDF`) stores `papers/<arxiv-or-id>_<short>.pdf` and sets `paper.pdf`; `GET /api/pdf/unlinked` lists PDFs in `papers/` not referenced by any paper with a best-guess `match` (id/arXiv id/short in the file name = high, title prefix = medium); `POST /api/pdf/link {id, file}` links (renaming the file to a safe name if needed). `reading/start` auto-links a high-confidence unlinked file before downloading from arXiv and fails with `NO_PDF: …` otherwise, which the UI turns into the attach dialog.
- Assistant model/effort (2026-10-12): settings `assistant_model` (default opus) and `assistant_effort` (default medium) are passed to the reading terminal as `--model`/`--effort`.
- Reader → assistant (2026-10-12): the reading terminal runs `app/assistant_bridge.py --socket $XDG_RUNTIME_DIR/paper-assistant/a-<id>.sock -- claude …` (a pty proxy). `POST /api/reading/ask {id?, mode: explain|ask, text, question?, page?}` types the built prompt into that Claude session as a bracketed paste + Enter; if no bridge socket answers, a new terminal is opened with the prompt as its first message. The PDF.js toolbar has Note (N, toggles select-to-highlight), Explain (E) and Ask (A).

## 10. Expert discussions (added 2026-10-13, server 2.5.0)

- Collection: `experts[]` = `{id (x_YYYYMMDD_xxxxxx), title (≤ 80 chars; derived from the brief's first line when empty), context (the brief, ≤ 8000 chars), session (Claude Code session uuid, always generated by the server), created, last_opened, opened}`. `apply_defaults()` is the single place that fills collection defaults (load, external reload, `library.replace`) and it normalises every expert record (drops entries without an id, regenerates a malformed session uuid, fills missing fields).
- Ops: `expert.add {expert:{title?, context}}`, `expert.update {id, fields:{title}}` (session/context/created are not updatable), `expert.remove {id}` (refused while the discussion runs as a console or terminal window unless `force` is set; only `ExpertManager.new()`'s rollback uses `force`).
- Routes: `POST /api/expert/new {title?, context, console?, cols?, rows?}` → `{chat, id, console|null, started, resumed, session}`; `POST /api/expert/open {id, console?, cols?, rows?}` (attach to a running console, or start one / a terminal window; refuses the other form while one runs); `POST /api/expert/remove {id}`; `GET /api/expert/transcript?id=` → `{turns:[{role, text, ts (local)}], saved, earlier:[{file, text}], notes, notes_text}` (Host-guarded like `/api/term/list`). `GET /api/term/list` also returns `expert_terminals` (discussions whose bridge socket `$XDG_RUNTIME_DIR/paper-assistant/x-<id>.sock` is alive, or that were launched in the last `LAUNCH_GRACE` = 8 s).
- `ExpertManager` (server.py): `open()`/`remove()` run under one lock. `_cmd()` builds `claude --session-id <sid> --name "Expert: <title>" --model --effort --append-system-prompt EXPERT_SYSTEM "<EXPERT_FIRST_PROMPT>"` the first time, `claude --resume <sid> …` afterwards (decided by `~/.claude/projects/<encoded ROOT>/<sid>.jsonl` existing; if that file holds no assistant turn the `EXPERT_REENTRY_PROMPT` is added). Console form: `TERMS.start_cmd("expert", …, expert=<id>)` (TermSession carries `expert`); terminal form: `assistant_bridge.py --socket x-<id>.sock -- claude …` through `launch_terminal`.
- Transcript copies: `ExpertManager.snapshot()` writes `.expert/<id>/<session>.md` (brief + every readable turn, local timestamps) on every resume, on every transcript fetch, when an expert console ends (idle watch) and for all discussions at server start. When the session file has been pruned by Claude Code (30 days by default) but a copy exists, Continue starts a fresh session id with `EXPERT_REOPEN_PROMPT` pointing at the copy; the old copy is then listed under `earlier`. Notes the expert writes on request go to `.expert/<id>/notes.md`. Deleting a discussion removes the record only; the `.expert/<id>/` folder stays.
- Prompt: `EXPERT_SYSTEM` (critical discussion, follow the user's direction, no proactive questions/follow-ups, cite only what the search scripts returned, do not invoke the paper-survey skill), `EXPERT_TOOLS_SKILL` (search.py / snowball.py of the paper-survey skill, `SURVEY_SKILL` = `~/.claude/skills/paper-survey` when present, else `<library root>/.claude/skills/paper-survey`, with the current year filled in; falls back to `EXPERT_TOOLS_WEB` when the skill is absent), `EXPERT_LANG[assistant_language]` (zh-TW default). `--append-system-prompt` is recorded with the conversation, so prompt edits apply to discussions created afterwards.
- Settings: `expert_model` (default: `assistant_model` or opus), `expert_effort` (default high); `assistant_language` also sets the expert's language.
- UI: nav entry Expert (`g x`), `renderExpert` (rows with Running / Terminal open / Ended / Idle, Open|Continue, End, View output, Transcript, Rename, Delete), `newExpertDialog`, `openExpertChat` (remote → console panel, local → terminal window; in-flight guard `EXPERT_BUSY`), `openExpertTranscript`; the console list is refreshed every 30 s on the Explore/Assistant/Expert pages because terminal windows open and close without an event.
- Security: `_same_origin()` now refuses `Origin: null` (a browser's cross-site POST from an https page), which protects every POST route, not only the new ones.

## 11. Daily gap (added 2026-10-15, server 2.6.0)

- Collection: `gaps[]` = `{id (g_YYYYMMDD_xxxxxx), date, status generating|ready|failed, created, finished, reason daily|manual, seed {mode lens|cross|wild, lens, lens_text, papers [ids], labels, topics}, session (Claude session uuid of the run that wrote the brief), chat_session ("" until the first chat message; the chat's own Claude session uuid), title, direction, jump, survey, gap, problem, idea {name, sketch, first_experiment, why_feasible}, novelty, risks, neurips, papers [{title, first_author, year, arxiv, doi, takeaway, verified true|false|null, found_title?}], keywords, unverified, starred, rating -1|0|1, note, chat_turns, last_chat, cost (the CLI's API-equivalent estimate for writing + chat, logged only; not shown in the UI), model, error}`. `apply_defaults()` normalises it like `experts` (drop records without id, regenerate a malformed session uuid, clear a malformed chat_session, unknown status → failed, fill missing fields); `_merge_from_disk` merges it by id.
- Ops: `gap.update {id, fields:{title?, starred?, rating?, note?}}`; `gap.remove {id, force?}` (refused while the brief is being written or its chat is answering). Records are created only by `GapManager.generate()`.
- Routes: `POST /api/gap/generate` → `{id, seed}` (one brief at a time); `POST /api/gap/chat {id, text}` (one turn at a time per brief, `GAP_MAX_CHATS` = 3 overall); `POST /api/gap/stop {id}`; `GET /api/gap/chat?id=` → `{turns:[{role, text, ts}], busy, partial, status, pending, error, earlier:[{file, text}]}` (Host-guarded; consecutive same-role turns are merged); `GET /api/gap/live` and `/api/library` → `gap_live {gen:{id, started, steps[]}|null, chats:{<id>:{partial, status, pending, started}}}`.
- SSE: `gap {id, step, steps}` while writing, `gap {id, done, status}` at the end; `gapchat {id, busy, pending, status, partial}` (partial = the whole answer so far, at most every 0.3 s) and `gapchat {id, busy:false, done, error, stopped}`; `assistant {kind:"gap", title, text, gap}` when a brief is ready (plus a desktop notification for the daily one).
- Writing (`GapManager._gen`): `claude -p --session-id <sid> --model gap_model --effort gap_effort --output-format stream-json --verbose --permission-mode dontAsk --append-system-prompt GAP_SYSTEM --json-schema GAP_SCHEMA --allowedTools WebSearch WebFetch "Read(//<library>/**)" "Read(//~/.claude/projects/<encoded library>/**)" "Bash(python3 -I <skill>/scripts/search.py:*)" "Bash(python3 -I <skill>/scripts/snowball.py:*)"`, prompt (`GAP_PROMPT`: seeds with abstracts and the user's notes, mode, lens, topics, profile, the last 12 briefs to avoid) on stdin. Tool calls become progress steps (`_tool_label`); the result's `structured_output` is the brief. `verify_gap_papers()` checks arXiv ids in one export-API call and DOIs against OpenAlex (title overlap ≥ 0.6). The Markdown copy goes to `.gaps/<id>.md`, Claude's stderr to `.gaps/<id>/generate.log`; a run is killed after `GAP_GEN_TIMEOUT` (40 min). `recover()` marks briefs left `generating` by a restart as failed.
- Seeds (`_pick_seed`): anchor paper weighted by status (deep 5, read/reading 4, queued 2, unread 1.2, skipped 0.3; +2 with highlights or a digest, +1 with claims/quick note; ×0.15 if a seed in the last 6 briefs); mode cross 40 % (second paper from a topic the anchor is not in), lens 38 %, wild 22 %; lens drawn from `GAP_LENSES` minus the last 5 briefs' lenses.
- Chat (`chat_send` / `_chat_run`): its own session, not the writing run's (that one carries ~150k tokens of search output, which made each turn cost about $1.6): `claude -p --session-id <new chat_session>` on the first message, `--resume <chat_session>` afterwards (a fresh one again when Claude Code pruned the file; the old chat copy is then listed under `earlier`) `--model gap_model --effort gap_chat_effort --output-format stream-json --verbose --include-partial-messages --permission-mode dontAsk --append-system-prompt GAP_CHAT_SYSTEM` (brief + tools + local-API recipes) with the read-only tools above plus `curl -s http://127.0.0.1:<port>/api/library`, `/api/note`, `POST /api/op`, `POST /api/download`. Text deltas build `partial`; tool calls set `status`. Each turn is killed after `GAP_CHAT_TIMEOUT` (20 min); Stop kills the process group. After every turn `chat_turns`, `last_chat`, `cost` are updated and the chat is copied to `.gaps/<id>/chat-<session>.md`.
- Scheduler: when `daily_gap` (default on) and the time is past `daily_gap_time` (default 08:00; empty disables) and today has no ready/generating brief, one automatic `generate("daily")` per day (`.scheduler-state.json` key `gap`).
- Settings: `daily_gap`, `daily_gap_time`, `gap_model` (opus), `gap_effort` (high), `gap_chat_effort` (medium); `assistant_language` sets the brief and chat language (zh-TW default, English domain terms).
- UI: nav entry Daily gap (`g d`), `renderGaps` (brief card + sticky chat panel, stacked below 1100 px; history with All/Starred/👍 filter), `gapBriefCard`, `gapChatPanel` / `patchGapChat` (patches only the log so typing is never interrupted; `GC` holds the selected brief's chat state and per-brief drafts), `generateGap`, `addGapPaper` (arXiv lookup → `paper.add` queued, tier 3, `source gap:<id>`), `deepDiveGap` (opens a new Expert discussion pre-filled with the brief); a Today tile shows today's brief.

## 12. Trail (added 2026-10-15, server 2.7.0)

Explore has two views, **Survey** (the existing hero, inbox, consoles, requests) and **Trail**: every question the user ever
handed the app, as a map over time. The idea: each survey request is a research direction the user cared about and tends
to forget, so the requests double as the research journal.

- Journal entries (`trail_entries()`): `requests[]` (survey requests and notes) and `experts[]` (discussion briefs), oldest
  first. `requests[]` gained `kind` survey|note, `tags[]`, `pinned`; a note is a question kept without asking for a survey
  (`request.add {text, kind:"note", tags?}` → status `noted`). Statuses: `open | working | done | cancelled | noted`
  (`REQUEST_STATUS`; `apply_defaults` normalises every request). `request.update` validates status/kind/text/tags/note and
  flips a note to `kind: survey` when its status becomes `open`; `request.remove {id, force?}` is refused while a survey
  console is alive for it.
- Collection `trail` (one object): `{status idle|running|ready|failed, updated, signature, error, north_star,
  north_star_history [{as_of, text}] (≤ 20, server-maintained), story (cites entries as [id]), motifs [str], threads
  [{id (stable slug), name, zh, statement, topic_id, role core|side, entries [ids], color}], items [{id, thread, station
  (≤ 10 chars), gist, intent, keywords [zh + en], question_type}], links [{from, to, kind grew|returns|contrasts|same,
  why}], open_loops [{id, text}], next [{text, why, thread}], model, reason, runs, cost}`. `signature` = sha1 of the
  journal (ids, texts, statuses, survey links); `trail_live.stale` is true when it differs from the current journal.
- `TrailManager` (`TRAIL`): `analyze(reason)` runs one headless `claude -p --tools "" --output-format json --json-schema
  TRAIL_SCHEMA --append-system-prompt TRAIL_SYSTEM --model trail_model --effort trail_effort` (no tools, ~1 min, ≈ $0.2 for
  10 entries) with the profile, topics, the previous threads (ids are reused; a renamed thread inherits the old id when ≥ 60 %
  of its members overlap) and the whole journal on stdin; `_normalize` keeps only known ids, gives every entry exactly one
  thread, keeps the previous station/gist when the model returns none, makes stations unique within a thread, assigns
  colours (topic colour → previous colour → palette), caps links at 60. Markdown mirror `.trail/trail.md` (`trail_markdown`;
  also `GET /api/trail/md[?download=1]`), stderr in `.trail/analyze.log`, killed after `TRAIL_TIMEOUT` (15 min).
  `recover()` turns a `running` record left by a restart into ready/failed.
- Routes: `POST /api/trail/analyze` → `{started, entries}` (one at a time); `POST /api/trail/stop`; `GET /api/trail/live` and
  `/api/library` → `trail_live {running, started, step, reason, stale, status, updated, error}`. SSE `trail {running, step,
  reason}` while running and `trail {running:false, done, status, error?, reason}` at the end (the record itself arrives
  with the `change` event).
- Scheduler: `TrailManager.poll()` every 30 s; when `trail_auto` (default on), the journal's *content* changed
  (`trail_content_signature`: ids, texts, kinds, survey links, cancellations; not the open/working flips or an inbox
  acceptance), it then stayed quiet for `TRAIL_AUTO_QUIET` (150 s) and no request is `working` (a survey in flight), one
  automatic analysis. `trail.failed_for` (persisted) blocks automatic retries after any failure or Stop until the content
  changes again; `trail.content_signature` records what the last run saw, `signature` (full, incl. statuses) drives `stale`.
  `POST /api/trail/stop` ends a run cleanly (status back to ready/idle, no error; SSE `trail {done, status:"stopped"}`).
- Settings: `trail_auto`, `trail_model` (opus), `trail_effort` (medium). `assistant_language` sets the analysis language.
- UI (`renderExplore` → `renderExploreSurvey` / `renderTrail`; `S.exploreView`, `#explore/trail`): capture bar (Enter saves a
  note with an Undo toast, Ctrl+Enter asks for a survey), "Yan suggests" chips, finder (search over text, station, gist,
  intent, keywords, tags, thread, topic, paper titles with a `matched:` line; kind facet; show cancelled; lane chip; stale /
  not-analysed chip), the strip (`trailStrip`: lanes = threads, columns = days → weeks → months, whichever fits the content
  width; gap columns `clamp(10, 8 + 6·log2(1 + skipped), 36)` px with `+3d/+2w/+1mo` labels and slack spread into gaps up to
  96 px; ribbons for each thread's alive span, dashed when dormant > 14 days; branch curves per link kind; stations by kind
  and status with recency opacity; count pills when a lane has several questions in one column; station labels when lanes ≥
  30 px and columns ≥ 44 px; Replay reveals the columns one by one), the list (verbatim, newest day first, older months
  folded; a search gives a flat ranked list) and the side panel (Insights: pinned, north star + history, story with
  clickable station chips, open loops, next questions with Jot/Survey, motifs; Detail: verbatim text, Claude's reading,
  thread, lineage, outcome, tags, note, actions Send to survey / Open console / Open papers / Continue / Discuss / Ask again
  and an overflow with Edit text / Cancel / Archive / Delete). Below 720 px the detail opens in a dialog and Insights folds
  above the list. `trailPatch()` rebuilds only the strip, chips and grid so typing in the capture bar or search is never
  interrupted. Today shows a "Your trail" tile; Settings → Trail; palette: Jot a question, Open Trail, Re-analyse Trail.

## 13. Settings added for the public release (2026-10-16)

- `gap_venue` (str, default `NeurIPS`): the venue the Daily gap briefs and their chat aim at. Formatted into `GAP_SYSTEM`
  / `GAP_CHAT_SYSTEM` as `{venue}`, shown as "<venue> angle" in the brief (the JSON field keeps its historical name
  `neurips`). Settings → Daily gap → Target venue.
- The per-paper note (`interest`, the single line under each title in the Library) follows `assistant_language`: `en` →
  English, one sentence of at most 18 words (`INTEREST_PROMPT_EN`, and `INTEREST_RULE["en"]` in the Expert prompt);
  anything else → Traditional Chinese, at most 30 characters (`INTEREST_PROMPT`). The paper-survey skill reads the same
  setting through `library.py context`.
- First start: when `library.json` is missing, `server.py` runs `app/migrate.py --root <library root>`, which writes an empty
  schema-v2 library (the original tracker's v1 → v2 migration is not part of the public release).
- Each Daily gap brief stores the venue it was written for (`gaps[].venue`); `gap_markdown()` and the UI label the section
  with that value, and `gap_venue()` only when an older brief has none.
- `claude_project_dir()` is the one place that derives Claude Code's session folder (`~/.claude/projects/<root with every
  non-alphanumeric character replaced by '-'>`); the per-paper note's context labels follow the note's language.
- `SURVEY_SKILL`: `~/.claude/skills/paper-survey` when that folder holds `scripts/search.py`, otherwise the project skill
  shipped in `<library root>/.claude/skills/paper-survey`.
