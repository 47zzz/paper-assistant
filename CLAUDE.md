# Paper Assistant

This folder holds the Paper Assistant code and, after the first start, the owner's paper library (data files next to `app/`).

- Setting it up or operating it: follow `README.md` (written for an agent). The data model and HTTP API contract: `docs/ARCHITECTURE.md`; the interface spec: `docs/UI-SPEC.md`.
- Never hand-edit `library.json` while the server runs. Change the library through `POST http://127.0.0.1:8765/api/op` or `python3 -I .claude/skills/paper-survey/scripts/library.py`.
- `library.json`, `papers/`, `notes/`, `.reading/`, `.expert/`, `.gaps/`, `.trail/` and `.backups/` are the owner's private data and are git-ignored; do not copy them anywhere or commit them. Never run `git clean` with `-x`/`-X` or `git stash --all` here: they delete ignored files, i.e. the library.
