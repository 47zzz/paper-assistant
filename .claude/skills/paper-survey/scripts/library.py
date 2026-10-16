#!/usr/bin/env python3
"""Talk to the 論文書房 library: list requests, dump context, add / update requests.

Usage:
  python3 -I library.py health
  python3 -I library.py context                       # settings.profile, topics, paper ids, open requests, surveys
  python3 -I library.py requests [--status open]      # open | working | done | cancelled | all
  python3 -I library.py request-add "我最近想做 explainable AI" [--claim]   # dedupes against open/working requests
  python3 -I library.py request-update q_2026… --status working [--survey sv_…] [--note "…"]

API-first (GET/POST http://127.0.0.1:8765, override with --api or $PAPER_ASSISTANT_API); when the server is
down or serves a different root, edits library.json directly under fcntl.flock(library.lock).
"""
from __future__ import annotations

import argparse
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402


def load(root: str, mode: str, api: str) -> dict:
    if mode == "api":
        try:
            lib = C.api_get(api, "/api/library")
            return lib
        except Exception as e:
            C.log("GET /api/library failed (%s); reading file" % e)
    return C.read_library(root)


def cmd_requests(a, root, mode, api):
    lib = load(root, mode, api)
    st = None if a.status == "all" else a.status
    rs = [r for r in lib.get("requests") or [] if not st or r.get("status") == st]
    C.emit({"ok": True, "mode": mode, "status": a.status, "requests": rs})


def cmd_context(a, root, mode, api, health):
    lib = load(root, mode, api)
    s = lib.get("settings") or {}
    papers = lib.get("papers") or []
    topics = []
    for t in lib.get("topics") or []:
        ps = [p for p in papers if p.get("topic") == t.get("id")]
        topics.append({"id": t.get("id"), "name": t.get("name"), "zh": t.get("zh"), "emoji": t.get("emoji"), "color": t.get("color"), "status": t.get("status"),
                       "description": (t.get("description") or "")[:300], "subtopics": [x.get("name") for x in t.get("subtopics") or []],
                       "papers": len(ps), "read": sum(1 for p in ps if p.get("status") in ("read", "deep"))})
    out = {
        "ok": True, "mode": mode, "api": api, "root": root,
        "server": {"up": mode == "api", "rev": (health or {}).get("rev"), "version": (health or {}).get("version")},
        "today": C.today(),
        "settings": {k: s.get(k) for k in ("persona_name", "user_name", "user_email", "profile", "work_days", "weekly_goal_papers", "daily_goal_minutes", "assistant_language")},
        "topics": topics,
        "paper_ids": {p.get("id"): (p.get("short") or p.get("title", "")[:40]) for p in papers},
        "paper_topics": {p.get("id"): (p.get("topics") or ([p["topic"]] if p.get("topic") else [])) for p in papers},
        "paper_dois": {p["doi"].lower(): p.get("id") for p in papers if p.get("doi")},
        "queue_len": len(lib.get("queue") or []),
        "open_requests": [r for r in lib.get("requests") or [] if r.get("status") in ("open", "working")],
        "recent_surveys": [{k: sv.get(k) for k in ("id", "query", "status", "created")} | {"topic": (sv.get("topic") or {}).get("id"), "direction": (sv.get("direction") or {}).get("name"), "n": len(sv.get("candidates") or [])}
                           for sv in (lib.get("surveys") or [])[-10:]],
        "stats": {k: (lib.get("stats") or {}).get(k) for k in ("xp", "level", "streak")},
    }
    C.emit(out)


def cmd_request_add(a, root, mode, api):
    text = " ".join(a.text).strip()
    if not text:
        C.die("text required")
    lib = load(root, mode, api)
    norm = " ".join(text.lower().split())
    for r in lib.get("requests") or []:
        if r.get("status") in ("open", "working") and " ".join((r.get("text") or "").lower().split()) == norm:
            if a.claim and r.get("status") != "working":
                _update(root, mode, api, r["id"], {"status": "working"})
                r["status"] = "working"
            C.emit({"ok": True, "mode": mode, "existing": True, "request": r})
            return
    if mode == "api":
        res = C.api_op(api, {"op": "request.add", "text": text})
        if not res.get("ok"):
            C.die("request.add failed: %s" % res.get("error"))
        r = (res.get("result") or {}).get("request") or {"id": (res.get("result") or {}).get("ids", [None])[0], "text": text, "status": "open"}
    else:
        with C.FileStore(root) as st:
            r = {"id": C.new_id("q"), "text": text, "created": C.now_iso(), "status": "open", "survey": None, "note": ""}
            st.data["requests"].append(r)
            st.save()
    if a.claim:
        _update(root, mode, api, r["id"], {"status": "working"})
        r["status"] = "working"
    C.emit({"ok": True, "mode": mode, "existing": False, "request": r})


def _update(root, mode, api, rid, fields: dict):
    bad = set(fields) - C.REQUEST_FIELDS
    if bad:
        C.die("unknown request fields: %s" % ", ".join(sorted(bad)))
    if mode == "api":
        res = C.api_op(api, {"op": "request.update", "id": rid, "fields": fields})
        if not res.get("ok"):
            C.die("request.update failed: %s" % res.get("error"))
        return
    with C.FileStore(root) as st:
        r = next((x for x in st.data["requests"] if x.get("id") == rid), None)
        if not r:
            C.die("no such request: %s" % rid)
        r.update(fields)
        st.save()


def cmd_request_update(a, root, mode, api):
    fields = {}
    if a.status:
        if a.status not in ("open", "working", "done", "cancelled"):
            C.die("bad status")
        fields["status"] = a.status
    if a.survey is not None:
        fields["survey"] = a.survey or None
    if a.note is not None:
        fields["note"] = a.note
    if not fields:
        C.die("nothing to update")
    _update(root, mode, api, a.id, fields)
    C.emit({"ok": True, "mode": mode, "id": a.id, "fields": fields})


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", default=None, help="server base URL (default $PAPER_ASSISTANT_API or %s)" % C.DEFAULT_API)
    ap.add_argument("--file", action="store_true", help="force direct file access even if the server is up")
    C.add_common_args(ap)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("health")
    sub.add_parser("context")
    p = sub.add_parser("requests"); p.add_argument("--status", default="open")
    p = sub.add_parser("request-add"); p.add_argument("text", nargs="+"); p.add_argument("--claim", action="store_true", help="mark it `working` right away")
    p = sub.add_parser("request-update"); p.add_argument("id"); p.add_argument("--status"); p.add_argument("--survey"); p.add_argument("--note")
    a = ap.parse_args()
    root = C.apply_common_args(a)
    mode, api, health = ("file", C.api_url(a.api), None) if a.file else C.choose_mode(root, a.api)
    if a.cmd == "health":
        C.emit({"ok": True, "mode": mode, "api": api, "root": root, "server": health, "library_exists": os.path.exists(os.path.join(root, "library.json"))})
    elif a.cmd == "requests":
        cmd_requests(a, root, mode, api)
    elif a.cmd == "context":
        cmd_context(a, root, mode, api, health)
    elif a.cmd == "request-add":
        cmd_request_add(a, root, mode, api)
    elif a.cmd == "request-update":
        cmd_request_update(a, root, mode, api)


if __name__ == "__main__":
    main()
