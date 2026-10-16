#!/usr/bin/env python3
"""Pure functions for streaks, XP, levels and badges.

Everything here is deterministic and side-effect free so the server, the notifier and tests
can all agree on the numbers. See docs/ARCHITECTURE.md §2 "Derived rules".
"""
from __future__ import annotations

import datetime as _dt
import math

ACTIVE_TYPES = {"finish", "deep", "session", "note", "highlight"}

XP_RULES = {
    "session_minute": 1,
    "note": 10,
    "idea": 5,
    "finish": 40,
    "deep": 80,
    "tier1_bonus": 20,
    "goal": 30,
    "survey": 15,
    "highlight": 3,
}

BADGES = [
    ("first-finish", "First paper", "Finish your first paper"),
    ("streak-7", "7-day streak", "Reading activity on 7 consecutive days"),
    ("streak-30", "30-day streak", "Reading activity on 30 consecutive days"),
    ("papers-10", "Ten down", "Finish 10 papers in total"),
    ("papers-25", "Twenty-five", "Finish 25 papers in total"),
    ("deep-5", "Deep reader", "Complete 5 deep reads"),
    ("idea-20", "Idea machine", "Write down 20 ideas or questions"),
    ("topic-done", "Topic mastered", "Finish every core paper of a topic"),
    ("night-owl", "Night owl", "End a focus session after 23:00"),
    ("early-bird", "Early bird", "Finish a focus session before 08:00"),
    ("survey-first", "First survey", "Accept your first reading list from Yan"),
]
BADGE_INFO = {b[0]: {"id": b[0], "name": b[1], "desc": b[2]} for b in BADGES}


def today_str(now: _dt.datetime | None = None) -> str:
    return (now or _dt.datetime.now()).strftime("%Y-%m-%d")


def xp_for_activity(act: dict, paper: dict | None = None) -> int:
    t = act.get("type")
    if t == "session":
        return int(max(0, act.get("minutes") or 0)) * XP_RULES["session_minute"]
    if t in ("finish", "deep"):
        base = XP_RULES[t]
        if paper and str(paper.get("tier")) == "1":
            base += XP_RULES["tier1_bonus"]
        return base
    if t in ("note", "idea", "goal", "survey", "highlight"):
        return XP_RULES[t]
    return 0


def level_for_xp(xp: int) -> int:
    return int(math.floor(math.sqrt(max(0, xp) / 120.0))) + 1


def xp_threshold(level: int) -> int:
    """XP needed to *reach* `level` (level 1 → 0)."""
    return 120 * (level - 1) ** 2


def active_days(activity: list[dict], frozen=()) -> set[str]:
    return {a["date"] for a in activity if a.get("type") in ACTIVE_TYPES and a.get("date")} | set(frozen)


def _parse_day(s: str):
    try:
        return _dt.date.fromisoformat((s or "")[:10])
    except Exception:
        return None


def compute_streak(activity: list[dict], freezes_available: int = 0, today: str | None = None, frozen=()) -> tuple[int, list[str]]:
    """Return (streak, newly_frozen_days). Walks back from today (or yesterday when today has nothing
    yet). Days in `frozen` count as active (already-consumed freezes), so the result is deterministic
    across repeated calls. A gap day may consume one available freeze if the day before it was active."""
    today = today or today_str()
    days = active_days(activity, frozen)
    if not days:
        return 0, []
    d = _dt.date.fromisoformat(today)
    if today not in days:
        d = d - _dt.timedelta(days=1)
    streak, newly = 0, []
    while True:
        key = d.isoformat()
        if key in days:
            streak += 1
        elif freezes_available > 0 and (d - _dt.timedelta(days=1)).isoformat() in days:
            freezes_available -= 1
            newly.append(key)
            streak += 1
        else:
            break
        d = d - _dt.timedelta(days=1)
    return streak, newly


def best_streak(activity: list[dict]) -> int:
    days = sorted(active_days(activity))
    best = cur = 0
    prev = None
    for s in days:
        d = _parse_day(s)
        if d is None:
            continue
        if prev is not None and (d - prev).days == 1:
            cur += 1
        else:
            cur = 1
        best = max(best, cur)
        prev = d
    return best


def compute_badges(lib: dict, streak: int) -> list[str]:
    papers = lib.get("papers", [])
    done = [p for p in papers if p.get("status") in ("read", "deep")]
    deep = [p for p in papers if p.get("status") == "deep"]
    ideas = lib.get("ideas", [])
    earned = set()
    if done:
        earned.add("first-finish")
    if streak >= 7:
        earned.add("streak-7")
    if streak >= 30:
        earned.add("streak-30")
    if len(done) >= 10:
        earned.add("papers-10")
    if len(done) >= 25:
        earned.add("papers-25")
    if len(deep) >= 5:
        earned.add("deep-5")
    if len(ideas) >= 20:
        earned.add("idea-20")
    for t in lib.get("topics", []):
        core = [p for p in papers if p.get("topic") == t.get("id") and str(p.get("tier")) == "1"]
        if core and all(p.get("status") in ("read", "deep") for p in core):
            earned.add("topic-done")
    for s in lib.get("sessions", []):
        end = s.get("end") or ""
        try:
            hh = _dt.datetime.fromisoformat(end).hour
        except Exception:
            continue
        if True:
            if hh >= 23:
                earned.add("night-owl")
            if hh < 8:
                earned.add("early-bird")
    if any(sv.get("status") == "accepted" for sv in lib.get("surveys", [])):
        earned.add("survey-first")
    return sorted(earned)


def recompute_stats(lib: dict, today: str | None = None) -> dict:
    """Recompute lib['stats'] in place from activity/papers and return it. Preserves earned-badge
    dates and freezes bookkeeping."""
    today = today or today_str()
    stats = lib.setdefault("stats", {})
    activity = lib.get("activity", [])
    xp = sum(int(a.get("xp") or 0) for a in activity)
    prev_streak = int(stats.get("streak") or 0)
    freezes = int(stats.get("freezes") if stats.get("freezes") is not None else 1)
    frozen = [d for d in (stats.get("frozen_days") or []) if isinstance(d, str)]
    streak, newly = compute_streak(activity, freezes, today, frozen)
    if newly:
        frozen = sorted(set(frozen) | set(newly))[-60:]
        freezes = max(0, freezes - len(newly))
    stats["frozen_days"] = frozen
    # earn one freeze per 7-day streak milestone (bank max 2)
    last_award = int(stats.get("_freeze_awarded_at") or 0)
    if streak >= 7 and streak // 7 > last_award // 7:
        freezes = min(2, freezes + 1)
        stats["_freeze_awarded_at"] = streak
    if streak == 0:
        stats["_freeze_awarded_at"] = 0
    stats.update({
        "xp": xp,
        "level": level_for_xp(xp),
        "streak": streak,
        "best_streak": max(int(stats.get("best_streak") or 0), best_streak(activity), streak),
        "freezes": freezes,
        "last_active": max((a.get("date") or "" for a in activity if a.get("type") in ACTIVE_TYPES), default=""),
    })
    have = {b["id"]: b for b in stats.get("badges", []) if isinstance(b, dict)}
    for bid in compute_badges(lib, streak):
        if bid not in have:
            have[bid] = {"id": bid, "date": today}
    stats["badges"] = list(have.values())
    stats["_prev_streak"] = prev_streak
    return stats


def derived(lib: dict, today: str | None = None) -> dict:
    """Cheap read-only summary for the UI (does not mutate)."""
    today = today or today_str()
    st = lib.get("stats", {})
    level = int(st.get("level") or 1)
    xp = int(st.get("xp") or 0)
    nxt = xp_threshold(level + 1)
    cur = xp_threshold(level)
    minutes_today = sum(int(a.get("minutes") or 0) for a in lib.get("activity", []) if a.get("date") == today and a.get("type") == "session")
    finished_today = [a.get("paper") for a in lib.get("activity", []) if a.get("date") == today and a.get("type") in ("finish", "deep")]
    return {
        "today": today,
        "streak": int(st.get("streak") or 0),
        "best_streak": int(st.get("best_streak") or 0),
        "freezes": int(st.get("freezes") or 0),
        "xp": xp,
        "level": level,
        "level_floor": cur,
        "level_next": nxt,
        "level_progress": 0 if nxt == cur else round((xp - cur) / (nxt - cur), 3),
        "minutes_today": minutes_today,
        "finished_today": finished_today,
        "active_today": today in active_days(lib.get("activity", [])),
        "badges": [dict(BADGE_INFO.get(b.get("id"), {"id": b.get("id"), "name": b.get("id"), "desc": ""}), date=b.get("date", "")) for b in st.get("badges", [])],
        "badge_catalog": [BADGE_INFO[b[0]] for b in BADGES],
    }


if __name__ == "__main__":  # tiny self-test
    acts = [
        {"date": "2026-10-06", "type": "session", "minutes": 20, "xp": 20},
        {"date": "2026-10-07", "type": "finish", "xp": 60},
        {"date": "2026-10-08", "type": "note", "xp": 10},
    ]
    assert compute_streak(acts, 0, "2026-10-08") == (3, [])
    assert compute_streak(acts, 0, "2026-10-09") == (3, [])
    assert compute_streak(acts, 0, "2026-10-10") == (0, [])
    assert compute_streak(acts, 1, "2026-10-10") == (4, ["2026-10-09"])
    assert compute_streak(acts, 0, "2026-10-10", frozen=["2026-10-09"]) == (4, [])
    lib = {"activity": [{"date": "2026-10-05", "type": "session", "minutes": 5, "xp": 5}, {"date": "2026-10-06", "type": "note", "xp": 10}, {"date": "2026-10-08", "type": "note", "xp": 10}], "papers": [], "topics": [], "sessions": [], "ideas": [], "surveys": [], "stats": {"freezes": 1}}
    a = dict(recompute_stats(lib, "2026-10-09")); b = dict(recompute_stats(lib, "2026-10-09"))
    assert a["streak"] == b["streak"] == 4 and a["freezes"] == b["freezes"] == 0, (a, b)
    assert level_for_xp(0) == 1 and level_for_xp(120) == 2 and level_for_xp(479) == 2 and level_for_xp(480) == 3
    assert best_streak(acts) == 3
    print("xp.py self-test ok")
