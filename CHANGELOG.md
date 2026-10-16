# Changelog

## 2.7.0 — 2026-10-16 — first public release

The app as used by its author since 2026-10-08, extracted from a private library folder:

- Everything personal removed; data files are created on first start and git-ignored.
- Desktop/Wayland app id `io.github._47zzz.PaperAssistant`.
- New settings: `gap_venue` (the venue the Daily gap briefs aim at); the per-paper note, its labels and the few prompts the UI
  writes for Claude follow `assistant_language` (`en` → English).
- First start creates an empty library (`app/migrate.py`); the `/paper-survey` skill ships as a project skill in
  `.claude/skills/` and finds the library it lives in (or the current folder, or `PAPER_LIBRARY_ROOT`).
- `README.md` written for an agent that installs the app; `docs/REMOTE-ACCESS.md` describes the optional SSH-tunnel setup.

Version numbers follow `VERSION` in `app/server.py`.
