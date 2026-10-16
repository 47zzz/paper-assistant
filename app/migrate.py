#!/usr/bin/env python3
"""Create an empty Paper Assistant library (library.json, schema v2) in a library root.

server.py runs this on its first start when library.json is missing. It never touches an existing library.json.
Usage: python3 app/migrate.py [--root DIR] [--dry-run]
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import xp  # noqa: E402

DEFAULT_SETTINGS = {
    "persona_name": "Yan", "user_name": "", "theme": "auto",
    "daily_goal_minutes": 45, "weekly_goal_papers": 3,
    "morning_briefing": "09:00", "evening_recap": "21:30", "streak_nudge": "20:00",
    "notifications": True, "sounds": True, "reduced_motion": False,
    "work_days": [1, 2, 3, 4, 5], "pomodoro_minutes": 25, "accent": "violet", "profile": "",
}
STATUSES = [["unread", "Unread"], ["queued", "Queued"], ["reading", "Reading"], ["read", "Read"], ["deep", "Deep read"], ["skipped", "Skipped"]]
TIERS = {"1": "Core", "2": "Advanced", "3": "Extension / frontier"}

def empty_library(created: str) -> dict:
    return {
        "meta": {"version": 2, "app": "paper-assistant", "created": created, "updated": dt.datetime.now().isoformat(timespec="seconds"), "rev": 0},
        "settings": dict(DEFAULT_SETTINGS),
        "tiers": dict(TIERS),
        "statuses": [list(s) for s in STATUSES],
        "topics": [], "papers": [], "queue": [], "reminders": [], "sessions": [], "activity": [],
        "ideas": [], "requests": [], "surveys": [], "radar": {},
        "stats": {"xp": 0, "level": 1, "streak": 0, "best_streak": 0, "last_active": "", "freezes": 1, "badges": []},
        "messages": [],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.dirname(HERE))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    root = os.path.abspath(a.root)
    lib_path = os.path.join(root, "library.json")
    if os.path.exists(lib_path):
        print("library.json already exists at %s — nothing to do." % lib_path)
        return 0
    lib = empty_library(dt.date.today().isoformat())
    if a.dry_run:
        print(json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in lib.items() if k not in ("settings",)}, ensure_ascii=False, indent=1))
        return 0
    tmp = lib_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(lib, f, ensure_ascii=False, indent=2)
    os.replace(tmp, lib_path)
    print("created an empty library → %s" % lib_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
