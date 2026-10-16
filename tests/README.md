# Regression harness (developer tool)

These scripts drive a **test copy** of the app in headless Chrome over the DevTools protocol and check the behaviours that are easy to break and hard to test by hand: remote mode, in-app consoles, the Assistant and Expert pages, and the Trail view. They never touch a real library.

Requirements: Linux, Python ≥ 3.12, Google Chrome or Chromium (`CHROME=/path/to/chrome` overrides the lookup), free ports 18764–18766 and 9333, no `claude` needed (a stub stands in for it). Knobs: `PA_TEST_XDG` (the test server's runtime dir, default `/tmp/pa-test-xdg-<uid>`) and `PA_TEST_PAPERS` (three comma-separated paper ids that exist in the copy with PDFs; default `1706.03762,1512.03385,1810.04805`).

## Setup

1. `python3 tests/mktest.py` creates or refreshes the copy at `tests/libcopy/`: it copies this repository's `app/` (Python files, UI files, `ui/vendor/`, `ui/fonts/`) and `tests/claude-stub.sh` into it and applies the test knobs: `claude` → the stub (a shell when run bare, otherwise it prints its arguments and echoes input), short grace periods, a 4 s console size lease, a 300 KB client queue, terminal windows disabled.
2. Give the copy a library: start it once (`cd tests/libcopy && python3 app/server.py --port 18766 --no-scheduler`, which creates an empty `library.json`), add the three papers named by `PA_TEST_PAPERS` through `POST /api/op` (`paper.add`, then `POST /api/download` fetches their arXiv PDFs into `tests/libcopy/papers/`, or copy any PDF there and link it with `POST /api/pdf/link`), and stop it. Re-running `mktest.py` later keeps that library.
3. `python3 tests/harness.py start-all` starts the copy's server on 18766 with its own `XDG_RUNTIME_DIR` (`PA_TEST_XDG`, so its bridge sockets never mix with a real instance), two forwarders (`fwd2.py 18765 18766 sshd-session` imitates an SSH tunnel, so the server reports `via_ssh`; `fwd2.py 18764 18766` is a plain one) and headless Chrome with CDP on 9333. `stop-all` ends them, `restart-server` restarts only the server, `cleanup-bridges` removes stale sockets from that test runtime dir.

## Suites

| Script | Checks | Covers |
|---|---|---|
| `edge2.py` | 53 | token-gated heartbeats, concurrent Read, remote Explain/Ask routing, console size leases, stalled-client detach, minute cap, stale live card resync, keyboard guard, Go-to-page routing, viewer banner + Resume, BroadcastChannel relay, console input / lease / idle kill, double-open, Cancel, settings, restart recovery and auto-reload |
| `edge3.py` | 17 | Explain / Ask from a remote PDF tab: side console panel, one assistant console per paper with later questions pasted in, Hide/End, the live card's Claude button sharing the console, the desktop path left unchanged |
| `edge4.py` | 15 | Assistant page: nav entry, the paper being read first, remote Open → console panel, picker, local Open → terminal route, terminal-vs-console guards, End, `g a` |
| `edge5.py` | 52 | Expert page: dialog, remote New → console with the brief as first prompt, attach instead of a second Claude, validation and title derivation, End / Transcript / Continue (`--resume`), guards, rename, delete, `g x`, palette, settings, re-entry prompt, transcript copies, `Origin: null` refused, over-long brief, server restart survival, export/import, notes.md |
| `trail_check.py [port]` | screenshots + checks | Explore → Trail: hash route, strip cells/lanes/links, insights panel, selection, finder. Needs headless Chrome on 9333 (`harness.py start-all` launches one) and a copy on 18799 started by hand (`python3 app/server.py --port 18799 --no-scheduler`) whose journal holds at least 9 non-cancelled entries across 5+ threads and a finished Trail analysis (run **Re-analyse Trail** once with a real `claude`; the stub cannot produce one). The two finder checks run only when the journal contains an entry with the word `capacity` and two with `記憶`; otherwise they are skipped. |

`cdplib.py` is the tiny CDP client the suites share. Each suite prints `PASS`/`FAIL` per check and exits non-zero on any failure.

## Notes

- The suites assume the copy has the three `PA_TEST_PAPERS` papers with PDFs and were last updated for server 2.5–2.7.
- `tests/libcopy/`, `tests/chrome_cdp/`, screenshots and logs are git-ignored.
- To test a change on real data without risk, prefer a plain copy: `rsync -a --exclude .backups <root>/ /tmp/pa-test/ && cd /tmp/pa-test && python3 app/server.py --port 18799 --no-scheduler`, and set `notifications` to false in that copy's `library.json` before enabling its scheduler.
