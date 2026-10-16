# Paper Assistant (論文書房)

> 給人類的一句話：這份 README 是寫給 AI agent（例如 Claude Code）看的。clone 之後，請你的 agent 讀這個檔案並照著做；它會先和你討論幾個設定，然後完成安裝。
> For humans: this README is written for an AI agent. Clone the repository, then ask your agent to read `README.md` and follow it. It will discuss a few settings with you and finish the installation.

Paper Assistant is a local-first paper-reading workspace for one researcher: a shelf, a plan with reminders, a PDF reader with highlights and notes, and Claude Code wired in as the research partner (one chat per paper, a literature expert, a daily research-gap brief, a journal of every question asked). Everything is one folder on the user's computer, one JSON file as the database, a zero-dependency Python server and a vanilla HTML UI. There is no account, no cloud and no telemetry.

---

## 0. Instructions for the agent reading this

You are setting this up for the person who cloned the repository (called "the user" below). Work through §2 → §3 → §4 in order and report what you did at the end. Rules:

1. **Ask before you configure.** §4 lists questions whose answers change the setup. Ask them in the user's language, then apply the answers. Do not guess a research profile, a target venue or reminder times.
2. **Remote access is optional and never automatic.** Only if the user says they want to use the library from another computer, read `docs/REMOTE-ACCESS.md` and discuss it with them (§5). Never expose the server to a network to make that work.
3. **The clone is the library.** All data files are created next to `app/` and are git-ignored. Do not move `app/` elsewhere, do not run the server from another checkout, and never hand-edit `library.json` while the server runs. Never run `git clean` with `-x`/`-X` or `git stash --all` in this folder: they delete ignored files, i.e. the user's library.
4. **AI features cost Claude usage.** Reading sessions, the Expert page, the Daily gap brief (one background Claude run per day) and the Trail analysis all run through the user's own Claude Code login and count toward their plan. Say so when you enable them (§4, question 6).
5. **Do not** publish, copy or upload anything from `library.json`, `papers/`, `notes/`, `.reading/`, `.expert/`, `.gaps/`, `.trail/` or `.backups/`. They are the user's private research data.

What is in the repository:

```
<library root>/                ← the clone; after first start also the user's library
├── README.md                  ← this file
├── CLAUDE.md                  ← three rules for any Claude session started in this folder
├── start.sh                   ← launcher: desktop window / server only / browser / --install
├── app/                       ← the application (Python 3 stdlib server + vanilla HTML UI)
│   ├── server.py              ← HTTP API, SSE, scheduler, reading sessions, consoles, Expert, Daily gap, Trail
│   ├── desktop.py             ← GTK 3 + WebKit2GTK 4.1 window (falls back to a Chrome app window / browser)
│   ├── reader.py              ← PDF reader window for reading sessions (PDF.js + highlights, Explain, Ask)
│   ├── notify.py · xp.py · graph.py · migrate.py · assistant_bridge.py
│   ├── install.sh · paper-assistant.desktop · paper-assistant-server.service · icon.*
│   └── ui/                    ← index.html, app.js, app.css, reader-ext.js/css, fonts/, vendor/ (PDF.js, xterm.js, confetti)
├── .claude/skills/paper-survey/ ← the `/paper-survey` Claude Code skill (project skill, auto-discovered here)
├── docs/ARCHITECTURE.md       ← data model, HTTP API, app ↔ skill contract (read before changing code)
├── docs/UI-SPEC.md            ← interface spec
├── docs/REMOTE-ACCESS.md      ← optional: using the library from another computer over an SSH tunnel
├── tests/                     ← headless-Chrome regression harness (developer tool, optional)
├── CHANGELOG.md · LICENSE · THIRD_PARTY_NOTICES.md · .gitignore
```

After the first start the folder also contains `library.json` (the database), `papers/` (PDFs), `notes/` (one Markdown note per paper), `.backups/` (30 rotating copies of the database), `.reading/`, `.expert/`, `.gaps/`, `.trail/` (Markdown copies of sessions, discussions, briefs and the journal analysis) and a few state files. All of these are in `.gitignore`.

---

## 1. What the app does

| Page (shortcut) | What it is |
|---|---|
| Today (`g t`) | What to read today, due reminders, the focus timer, the running reading session, today's Daily gap brief and the Trail tile |
| Library (`g l`) | The shelf: search, filter, status, rating, quick notes, remembered claims, highlights, discussion digests, one-line note (註記) under every title; click a paper for the drawer |
| Plan (`g p`) | Drag papers onto days, reorder the queue, set reminders, auto-schedule |
| Map (`g m`) | The whole shelf grouped by topic / survey batch / auto-clustered knowledge map / subtopic / year, as a graph or lists |
| Explore → Survey (`g e`) | Type a research interest, press "Ask Yan to survey": Claude Code runs `/paper-survey` in a console inside the app and the reading list lands in the inbox; Accept files the papers, schedules them and downloads the PDFs |
| Explore → Trail | Every survey request and note ever written, as a research journal over time, analysed by Claude into threads, a north star, open loops and next questions |
| Assistant (`g a`) | One persistent Claude session per paper, preloaded with the paper's full text and the user's notes |
| Expert (`g x`) | A literature expert to argue with: it searches arXiv / OpenAlex / Semantic Scholar first, then discusses critically along the user's direction; it can change the library through the local API when asked |
| Daily gap (`g d`) | One research direction a day, a jump away from the library: frontier, one gap, the problem, one feasible idea with its first experiment, a novelty check, risks and the angle for the target venue; plus a chat about it |
| Stats (`g s`) | Heatmap, weekly minutes, reading log, export / import of the whole library |
| Settings | Name, assistant name, language, goals, reminder times, sounds, accent, research profile, reading-session monitor, models and effort, Daily gap, Trail, playful mode |

**Reading sessions.** The green Read button (`r`) opens the PDF in a reader window on a secondary (preferably portrait) screen, starts the clock, and opens a Claude Code terminal preloaded with the paper (`.reading/<id>/context.md`). In the reader: select text → Note (highlight + comment, saved to the library and painted back next time), Explain (E) and Ask (A) send the selection or a question to that paper's Claude. Closing the window records the minutes and distils the conversation into a discussion digest appended to `notes/<id>.md`. In remote mode (§5) the PDF opens in the browser instead and Claude's answers appear in a side panel.

**The `/paper-survey` skill.** `claude "/paper-survey I want to get into explainable AI"` run in the library folder probes how broad the topic is (live arXiv + OpenAlex data), splits a broad field into directions and asks the user to pick, then retrieves, snowballs citations, judges relevance and writes 5–12 papers (8 by default) with tiers, reading order and "why it matters" into the Explore inbox. It never cites from memory: every paper comes from API results and is re-verified against arXiv before it is written. Details: `.claude/skills/paper-survey/SKILL.md`.

**Plain mode.** XP, levels, badges, the owl mascot and confetti are off by default (Settings → Appearance → Playful mode turns them on). Sessions, minutes, the heatmap and the reading log are always recorded.

---

## 2. Requirements (check these first)

Run the checks and tell the user what is missing before installing anything.

| Need | Why | Check |
|---|---|---|
| **Linux desktop** (developed on Fedora 44, GNOME on Wayland) | the desktop window, reader window, notifications, terminal launching and the SSH-tunnel detection are Linux/GNOME features; the server + browser UI alone also work on macOS (no window, no notifications); Windows can only be a remote client (§5) | `uname -a`, `echo $XDG_SESSION_TYPE` |
| **Python ≥ 3.12** | the server and the skill scripts use only the standard library | `python3 --version` |
| **Claude Code CLI** (`claude`, logged in; the author runs 2.1.x) | every AI feature: reading assistant, Expert, Daily gap, Trail, survey skill, note inference. The shelf, plan, reader and highlights work without it | `claude --version`, then `claude -p "say ok" --model sonnet` should answer |
| PyGObject + GTK 3 + WebKit2GTK 4.1 (optional) | the native desktop window and the full-screen reader window. Without them `desktop.py` falls back to a Chrome/Chromium app window, then to the default browser, and reading sessions use the system PDF viewer or the browser | `python3 -c "import gi; gi.require_version('Gtk','3.0'); gi.require_version('WebKit2','4.1'); from gi.repository import Gtk, WebKit2; print('ok')"` — Fedora: `python3-gobject webkit2gtk4.1`; Debian/Ubuntu: `python3-gi gir1.2-webkit2-4.1` |
| A terminal emulator: `ptyxis`, `gnome-terminal`, `kgx`, `konsole` or `xterm` (optional) | the local (non-remote) Claude terminal windows for reading sessions, Assistant and Expert | `command -v ptyxis gnome-terminal kgx konsole xterm` |
| `pdftotext` (poppler-utils, optional) | extracts the paper's text for the reading assistant's context | `command -v pdftotext` |
| `notify-send` (libnotify, optional) | desktop notifications: reminders, morning briefing, evening recap, finished briefs | `command -v notify-send` |
| `systemd --user` (optional) | keeps the server running in the background so reminders fire with the window closed; `./start.sh --install` sets it up | `systemctl --user --version` |
| Google Chrome / Chromium (optional) | fallback app window; also used by `tests/` | `command -v google-chrome chromium` |
| Network access to `arxiv.org` / `export.arxiv.org` (PDFs, abstracts, API), `api.openalex.org`, `api.semanticscholar.org`, `ar5iv.labs.arxiv.org` (HTML of papers) | surveys, radar, PDF downloads, citation checks. No API keys needed; optional `OPENALEX_API_KEY` (free, 10× quota) and `S2_API_KEY` | |

Ports: the server listens on **127.0.0.1:8765** only (override with `PAPER_ASSISTANT_PORT`). It has no authentication, which is why it must never listen on another address.

---

## 3. Installation

### 3.1 Put the clone where the library should live

The clone is the library root: PDFs, notes and the database will be created inside it. A folder in the home directory is best, for example `~/papers`; use a path without spaces (the Claude tool-permission rules the server builds embed the path unquoted). If the user already cloned somewhere else, that is fine; do not move things afterwards without stopping the server.

```bash
git clone <repository url> ~/papers
cd ~/papers
```

### 3.2 First start

Pick one:

```bash
./start.sh --install     # recommended on a GNOME/systemd desktop: app launcher + icons + background server; returns
./start.sh               # desktop window only (starts the server in the background if none runs); blocks until the window closes
./start.sh --browser     # server in the foreground + default browser (no GTK needed); blocks
./start.sh --server      # server in the foreground (Ctrl+C stops it); useful for diagnosing; blocks
```

Only `--install` returns. From a tool call, do not run the blocking forms; without `systemd --user` (macOS, containers, non-systemd Linux) start the server detached instead and verify it:

```bash
nohup python3 app/server.py >> .server.log 2>&1 &     # .server.log is git-ignored
sleep 2
```

The first server start creates an empty `library.json` (via `app/migrate.py`). Then verify:

```bash
curl -s http://127.0.0.1:8765/api/health        # → {"ok": true, "version": "2.7.0", ...}
```

`--install` writes `~/.local/share/applications/io.github._47zzz.PaperAssistant.desktop`, icons under `~/.local/share/icons/hicolor/`, and enables `~/.config/systemd/user/paper-assistant-server.service` (`systemctl --user status paper-assistant-server`). `bash app/install.sh --remove` undoes exactly that and leaves the data alone. If the user wants the server to run while nobody is logged in (needed for remote access and for the 08:00 Daily gap on a machine that is left on), additionally run `loginctl enable-linger $USER` (may need sudo).

### 3.3 The `/paper-survey` skill

Nothing to install: the skill ships as a project skill in `.claude/skills/paper-survey/`, and Claude Code discovers project skills in the folder it is started in. Every Claude session the app opens runs in the library folder, so "Ask Yan to survey" works out of the box. Two things worth knowing:

- To use `/paper-survey` from any other folder, link it as a personal skill: `ln -s "$PWD/.claude/skills/paper-survey" ~/.claude/skills/paper-survey`. A personal skill with the same name takes precedence over the project one, and the server uses the personal copy too when it finds one. The scripts resolve the symlink back to the library it points into.
- The skill scripts find the library automatically when they live inside it (or when the current folder is one); from elsewhere set `PAPER_LIBRARY_ROOT=<library root>` or pass `--root`. They cache API responses 24 h under `~/.cache/paper-survey/`.

Quick test (one search, no Claude involved): `python3 -I .claude/skills/paper-survey/scripts/search.py --query "continual learning survey" --years 2022-2026 --max 5`.

### 3.4 Claude Code permissions

The app starts Claude in three forms: interactive terminals / in-app consoles (reading assistant, Expert, survey), where the user approves tools as usual; headless `claude -p --permission-mode dontAsk` runs with an explicit `--allowedTools` list, so nothing in them ever prompts (the Daily gap brief: WebSearch, WebFetch, Read on the library folder and on its Claude Code transcript folder `~/.claude/projects/<encoded library path>/`, plus the two skill search scripts; the Daily gap chat: the same plus `curl` to the local API including `POST /api/op`, so it can change the library when the user asks, and `POST /api/download`; Trail: no tools at all); and short `claude -p --model sonnet` calls without tools (discussion digests, note inference, Expert titles). No settings file is required. If the user has a restrictive `~/.claude/settings.json`, make sure `Bash`, `Read` and `Edit` are not denied for this folder, or the interactive sessions will keep asking.

---

## 4. Configure with the user

Ask these, then apply the answers in the Settings page or with the API (`settings.update` takes any subset of fields; the server rejects unknown ones):

```bash
curl -s -X POST http://127.0.0.1:8765/api/op -H 'Content-Type: application/json' \
  -d '{"op":"settings.update","fields":{"user_name":"...","assistant_language":"en","gap_venue":"ICLR","profile":"..."}}'
```

1. **Name and assistant name.** `user_name` (used in greetings) and `persona_name` (default "Yan", the owl).
2. **Language.** `assistant_language`: `zh-TW` (default; the author writes Traditional Chinese), `en`, or `auto`. `en` makes everything English: Explain/Ask answers, the Expert, the Daily gap briefs and chat, the Trail analysis, the one-line note under each paper title together with its labels in the Library, and the few prompts the UI writes for Claude. `auto` means "answer in the language the question is written in" for Explain/Ask, the Expert, the gap chat and the Trail; the Daily gap brief then follows the language of the research profile, while the per-paper note and its labels stay Traditional Chinese, as under `zh-TW`. The rest of the UI is English in every mode. A user who does not read Chinese must choose `en`.
3. **Research profile.** `profile`: a few sentences on who they are and what they know ("second-year PhD, continual learning and LLMs, prefers method papers with code"). The survey skill, the Expert and the Daily gap all read it. Also `user_email` (optional): the survey scripts put it in the User-Agent (`paper-assistant/<script version> (mailto:<email>)`) of every HTTP request they make (arXiv, ar5iv, OpenAlex, Semantic Scholar and the local server); arXiv and OpenAlex ask for a contact address in exchange for a politer rate limit. Left empty, `paper-assistant@localhost` is sent instead. The app server's own requests never carry it.
4. **Target venue.** `gap_venue` (default "NeurIPS"): the venue the Daily gap briefs and their chat aim at. Any conference or journal name.
5. **Goals and rhythm.** `daily_goal_minutes` (45), `weekly_goal_papers` (3), `work_days` (ISO weekdays, default Mon–Fri), `pomodoro_minutes` (25), reminder times `morning_briefing` (09:00), `evening_recap` (21:30), `streak_nudge` (20:00); an empty string disables a reminder. `notifications` (true), `sounds`.
6. **Claude usage.** `daily_gap` (true): one Opus run with web searches every morning after `daily_gap_time` (08:00), several minutes of usage per day; `gap_model` / `gap_effort` / `gap_chat_effort`. `trail_auto` (true): one short tool-less call a few minutes after the journal changes (`trail_model` Opus, `trail_effort` medium). `assistant_model` / `assistant_effort` for reading sessions (plus `assistant_opening`: `first` = a short orientation only when a paper's session is brand new, the default; `always`; `none`), `expert_model` / `expert_effort` (Opus, high). Explain each cost in one line and let the user decide; turning `daily_gap` off is the usual choice for a light plan.
7. **Screens and reader.** `reading_monitor` (`auto` = a secondary, preferably portrait display; else a monitor index as a string; `GET /api/monitors` lists them), `reading_fullscreen` (true), `reading_viewer` (`builtin` reader window or `system` PDF viewer), `reading_assistant` (open the Claude terminal on every Read, true).
8. **Playful mode.** `gamification` (false): XP, badges, mascot, confetti.
9. **Theme.** `theme` auto/light/dark, `accent` violet/blue/green/rose/amber, `reduced_motion`.

After that, suggest the first real action: the user types a research interest on Explore and presses "Ask Yan to survey", or runs `claude "/paper-survey <interest>"` in the library folder, then accepts the list in the inbox.

---

## 5. Optional: use the library from another computer

The author also uses the app from a laptop: an SSH tunnel forwards the library computer's port 8765 to the laptop's `localhost:8765`, and a browser in app mode opens `http://localhost:8765/?remote=1`. Both machines then work on the same data in real time, the PDF opens in the laptop's browser with highlights, Explain and Ask, and Claude runs on the library computer with its output streamed into a panel. The server notices that a connection arrives through `sshd` and switches that browser into remote mode by itself.

**Do not set this up unless the user asks for it.** If they do, read `docs/REMOTE-ACCESS.md` and go through it with them: it needs an SSH server on the library computer that the other machine can reach (home network, VPN such as Tailscale/WireGuard, or a port forward the user already has), key-based login, `loginctl enable-linger`, an SSH config alias on the other machine and a small launcher script (Windows PowerShell and macOS/Linux versions are in the guide). The guide contains placeholders for the host, port and user name; ask the user for those values, never invent them. The only acceptable transport is an SSH tunnel to `127.0.0.1:8765`: the server has no login, so binding it to another interface, using `ssh -g`, or putting it behind a reverse proxy would expose the user's whole library and their Claude sessions.

---

## 6. Data, privacy and security

- **Everything is local.** `library.json` is the single database (schema in `docs/ARCHITECTURE.md` §2); the server keeps 30 backups in `.backups/` and writes atomically. Stats → Export downloads the whole file; Import restores it. Markdown mirrors of discussions, briefs and the journal analysis sit in the dot-folders so they survive Claude Code's own session pruning.
- **What leaves the machine:** requests to public scholarly APIs, and whatever the user's Claude Code sends to Anthropic in the sessions the app starts (paper text, notes, highlights, the research profile, the journal). Nothing else; there is no analytics. The server itself contacts arXiv and OpenAlex (PDF downloads, metadata lookups, the radar, citation checks of Daily gap briefs) with User-Agent `paper-assistant/<app version> (local desktop app)`; the survey skill's scripts contact arXiv, OpenAlex and Semantic Scholar (and ar5iv for paper HTML) with `paper-assistant/<script version> (mailto:<user_email, or paper-assistant@localhost when unset>)`, which these APIs ask for in exchange for a politer rate limit.
- **The server trusts localhost.** It binds 127.0.0.1, checks the `Host` header on personal routes and refuses cross-site `Origin`s on every POST. There is no password. Do not change the bind address.
- **The Claude sessions can edit the library** through the local API when the user asks them to (add a paper, queue it, set a reminder, save an idea); they are told never to edit `library.json` directly. Deleting papers or topics requires an explicit request.
- **Headless runs are sandboxed by `--allowedTools`** (listed in `docs/ARCHITECTURE.md` §11–12); the interactive terminals use the user's normal Claude Code permission mode.

---

## 7. Updating

```bash
cd <library root>
curl -s http://127.0.0.1:8765/api/term/list     # wait until "sessions" shows nothing alive: a restart kills open consoles
git pull
systemctl --user restart paper-assistant-server   # or just close and reopen the window when not using the service
```

Data files are untracked, so `git pull` never touches them. `apply_defaults()` in the server fills any new fields on load, and `migrate.py` only runs when `library.json` is missing.

---

## 8. Troubleshooting

- **Blank or crashing window** (WebKitGTK with NVIDIA on Wayland): `PAPER_ASSISTANT_WEBKIT_SAFE=1 ./start.sh` (the launcher's right-click menu has "Safe mode"); `=2` disables compositing as well. `./start.sh --browser` always works.
- **No notifications:** `systemctl --user status paper-assistant-server`; Settings → Reminders → Desktop notifications on; `python3 app/notify.py` sends a test one.
- **Port in use:** `PAPER_ASSISTANT_PORT=8777 ./start.sh` for the window; the installed service passes `--port 8765` explicitly, so change it with `systemctl --user edit paper-assistant-server` (override `ExecStart`) and keep the variable set for the window and the skill (`PAPER_ASSISTANT_API=http://127.0.0.1:8777`).
- **"claude CLI not found":** the server looks for `claude` on `PATH` and at `~/.local/bin/claude`; the systemd service inherits a minimal environment, so a `claude` installed elsewhere needs a symlink into `~/.local/bin`.
- **"No terminal emulator found":** install one from the list in §2 or use the in-app consoles (remote mode shows them everywhere).
- **Reader shows nothing on the second screen:** Settings → Reading sessions → monitor; `python3 app/reader.py --list-monitors` prints what GTK sees; `PAPER_ASSISTANT_READER_DEBUG=1 python3 app/reader.py --pdf papers/<file>.pdf` prints the WebKit console.
- **Corrupted data:** stop the server, copy the newest `.backups/library-*.json` over `library.json`, start again.
- **Survey scripts rate-limited:** OpenAlex allows ~1000 keyless calls a day (`OPENALEX_API_KEY` raises it); Semantic Scholar search needs `S2_API_KEY`; responses are cached 24 h, so re-running is free.

---

## 9. Development notes

- Read `docs/ARCHITECTURE.md` before changing anything that touches `library.json`; it is the contract between server, UI and skill (ops whitelist fields, unknown fields are rejected with 400). `docs/UI-SPEC.md` describes the interface.
- No build step, no runtime dependencies, no CDN: the UI is `app/ui/index.html` + `app.js` + `app.css`, fonts and vendor libraries are bundled (`THIRD_PARTY_NOTICES.md`).
- Test on a copy, never on the live library: `rsync -a --exclude .backups <root>/ /tmp/pa-test/ && cd /tmp/pa-test && python3 app/server.py --port 18799 --no-scheduler`. `tests/README.md` explains the headless-Chrome harness (remote mode, consoles, Assistant, Expert, Trail).
- Server version lives in `app/server.py` (`VERSION`); the UI reloads itself when the server restarts. Releases are listed in `CHANGELOG.md`.
- Bugs and ideas: open an issue or a pull request on the repository. For a security problem (the server has no authentication by design, so anything that lets a non-localhost client reach it matters), contact the maintainers privately through the repository's security advisory page rather than a public issue.

License: MIT (`LICENSE`). Bundled components keep their own licenses (`THIRD_PARTY_NOTICES.md`).
