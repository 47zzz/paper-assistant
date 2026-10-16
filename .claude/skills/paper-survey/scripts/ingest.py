#!/usr/bin/env python3
"""Validate a survey JSON and write it into the 論文書房 library (survey.add, status `proposed`).

Usage: python3 -I ingest.py --json survey.json [--root DIR] [--api URL] [--dry-run] [--no-verify] [--no-auto-plan]

Checks before writing (fail = exit 2, nothing written):
  * required blocks: topic{id,name,zh,emoji,color}, direction{name,primer,chosen_from[]}, summary, lineage,
    query, candidates[≥1]; `request` optional (id of the originating request)
  * every candidate: id, title, year, arxiv or doi (or oa:/doi: id), short, why (English), interest (the one-line note:
    繁中 by default, English when settings.assistant_language is `en`), tier 1–3,
    difficulty 1–3, est_minutes; unknown paper fields are DROPPED with a warning (server would 400)
  * no duplicate ids; plan[] only references selected candidates and uses YYYY-MM-DD ≥ today
  * arXiv ids are verified against the arXiv API (one free call) and the API title must resemble the
    candidate title (token Jaccard ≥ 0.5) — catches hallucinated / mistyped ids
  * if plan[] is missing, generates one: selected papers in reading order, 1 paper per 2–3 days on work days
  * `keywords` are lowercased / deduped / capped at 12; `related` is filled from citation edges
    (`--edges snow.json`, repeatable; files from snowball.py) restricted to ids that are in the candidate
    list or already in the library, then the edge count is appended to `lineage`
Then POSTs survey.add (+ request.update) to the server if it is up and serves the same root; otherwise edits
library.json under fcntl.flock exactly like the server would. Prints JSON {ok, mode, survey_id, …}.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def fail(msg):
    C.die("invalid survey: " + msg)


def auto_plan(selected: list, work_days: list, start: dt.date | None = None) -> list:
    """1 paper every 2–3 days on work days, starting the next work day; ≤ 1 paper per day."""
    wd = set(int(x) for x in (work_days or [1, 2, 3, 4, 5]))
    d = (start or dt.date.today()) + dt.timedelta(days=1)
    plan, gap_cycle, i = [], (2, 3), 0
    step = 2 if len(selected) > 8 else None
    for p in selected:
        while d.isoweekday() not in wd:
            d += dt.timedelta(days=1)
        plan.append({"paper": p["id"], "planned": d.isoformat()})
        d += dt.timedelta(days=step or gap_cycle[i % 2])
        i += 1
    return plan


def load_edges(paths: list) -> list:
    edges = []
    for path in paths or []:
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        for e in d.get("edges") or []:
            if e.get("a") and e.get("b"):
                edges.append(e)
        # candidates' `links` carry the same information for files produced before --edges existed
        if not d.get("edges"):
            for c in d.get("candidates") or []:
                for l in c.get("links") or []:
                    edges.append({"a": l.get("seed"), "b": c.get("id"), "rel": l.get("rel"), "doi": c.get("doi") or ""})
    return edges


def fill_related(cands: list, edges: list, library: dict, warnings: list) -> int:
    """related[] = other candidate ids or library paper ids connected by a citation edge. Returns #edges used."""
    lib_papers = library.get("papers") or []
    known = {c["id"] for c in cands} | {p.get("id") for p in lib_papers if p.get("id")}
    doi_to_id = {}
    for p in list(cands) + lib_papers:
        if p.get("doi"):
            doi_to_id[p["doi"].lower()] = p["id"]
    def canon(x: str, doi: str = "") -> str:
        if x in known:
            return x
        if doi and doi.lower() in doi_to_id:
            return doi_to_id[doi.lower()]
        if x.startswith("doi:") and x[4:].lower() in doi_to_id:
            return doi_to_id[x[4:].lower()]
        return ""
    rel: dict = {c["id"]: set(c.get("related") or []) for c in cands}
    used = 0
    for e in edges:
        a, b = canon(str(e["a"])), canon(str(e["b"]), e.get("doi") or "")
        if not a or not b or a == b:
            continue
        used += 1
        if a in rel:
            rel[a].add(b)
        if b in rel:
            rel[b].add(a)
    for c in cands:
        before = c.get("related") or []
        bad = [r for r in before if r not in known]
        if bad:
            warnings.append("%s: dropped related ids not in candidates/library: %s" % (c["id"], ", ".join(bad)))
        c["related"] = sorted(r for r in rel[c["id"]] if r in known and r != c["id"])
    return used


def validate(sv: dict, root: str, verify: bool, do_auto_plan: bool, edge_files: list | None = None) -> tuple[dict, list]:
    warnings: list = []
    lang_en = (C.settings(root).get("assistant_language") or "").strip() == "en"   # the per-paper note follows the app's assistant language
    if not isinstance(sv, dict):
        fail("top level must be an object")
    t = sv.get("topic") or {}
    for k in ("id", "name", "emoji", "color"):
        if not str(t.get(k) or "").strip():
            fail("topic.%s required" % k)
    if not str(t.get("zh") or "").strip():
        if lang_en:
            t["zh"] = ""
        else:
            fail("topic.zh required (the Traditional Chinese label; leave it empty only when settings.assistant_language is en)")
    t["id"] = C.slugify(t["id"])
    if not HEX.match(t["color"]):
        warnings.append("topic.color %r is not #rrggbb; using #0ea5e9" % t["color"]); t["color"] = "#0ea5e9"
    d = sv.get("direction") or {}
    if not str(d.get("name") or "").strip() or not str(d.get("primer") or "").strip():
        fail("direction.name and direction.primer required")
    d.setdefault("chosen_from", [])
    if not isinstance(d["chosen_from"], list):
        fail("direction.chosen_from must be a list")
    for k in ("summary", "lineage", "query"):
        if not str(sv.get(k) or "").strip():
            fail("%s required" % k)
    if sv.get("request") is not None and not isinstance(sv["request"], str):
        fail("request must be a string id or null")
    cands = sv.get("candidates")
    if not isinstance(cands, list) or not cands:
        fail("candidates[] required")
    out_c, ids, dropped_all = [], set(), set()
    for i, raw in enumerate(cands):
        if not isinstance(raw, dict):
            fail("candidates[%d] not an object" % i)
        cid = str(raw.get("id") or "").strip()
        if not cid:
            fail("candidates[%d].id missing" % i)
        if cid in ids:
            fail("duplicate candidate id %s" % cid)
        ids.add(cid)
        extra = {"score": raw.get("score"), "selected": raw.get("selected"), "reason": raw.get("reason")}
        body = {k: v for k, v in raw.items() if k not in ("score", "selected", "reason")}
        aid = C.arxiv_id_from(cid) if not cid.startswith(("doi:", "oa:")) else ""
        if aid and aid != cid:
            fail("candidate id %r should be the bare arXiv id %r" % (cid, aid))
        if aid and not body.get("arxiv"):
            body["arxiv"] = "https://arxiv.org/abs/" + aid
        if cid.startswith("doi:") and not body.get("doi"):
            body["doi"] = cid[4:]
        if not (body.get("arxiv") or body.get("doi") or cid.startswith("oa:")):
            fail("candidate %s has neither arxiv nor doi" % cid)
        try:
            p, dropped = C.normalize_paper(body)
        except ValueError as e:
            fail("candidate %s: %s" % (cid, e))
        dropped_all.update(dropped)
        kws = C.norm_keywords(p.get("keywords") or [], cap=12)
        if len(p.get("keywords") or []) > 12:
            warnings.append("%s: keywords truncated to 12" % cid)
        p["keywords"] = kws
        if not kws:
            warnings.append("%s: no keywords (fill from OpenAlex keywords / arXiv categories / abstract)" % cid)
        p["related"] = [str(x) for x in (p.get("related") or []) if x]
        for k in ("topics", "surveys"):
            p[k] = []   # server fills memberships on accept
        sel = True if extra["selected"] is None else bool(extra["selected"])
        if not p["title"].strip():
            fail("candidate %s: title required" % cid)
        if sel:
            for k in ("short", "why"):
                if not p.get(k, "").strip():
                    fail("selected candidate %s: %s required" % (cid, k))
            if p["tier"] not in (1, 2, 3):
                fail("candidate %s: tier must be 1–3" % cid)
            if p["difficulty"] not in (1, 2, 3):
                fail("candidate %s: difficulty must be 1–3" % cid)
            if p["est_minutes"] <= 0:
                p["est_minutes"] = 60; warnings.append("%s: est_minutes defaulted to 60" % cid)
            if not (p.get("interest") or "").strip():
                warnings.append("%s: no `interest` (the one-line note, %s); the app will infer one on accept" % (cid, "English" if lang_en else "繁中"))
            elif lang_en:
                if len(p["interest"].split()) > 18:
                    warnings.append("%s: `interest` is longer than 18 words (settings.assistant_language is en)" % cid)
            elif not re.search(r"[一-鿿]", p["interest"]):
                warnings.append("%s: `interest` has no Chinese characters (should be 繁中 unless settings.assistant_language is en)" % cid)
        if not p.get("year"):
            fail("candidate %s: year required" % cid)
        p["topic"] = t["id"]
        p["status"] = "unread"
        p["source"] = "survey"
        try:
            score = float(extra["score"]) if extra["score"] is not None else (0.9 if sel else 0.4)
        except Exception:
            fail("candidate %s: score must be a number" % cid)
        p.update({"score": max(0.0, min(1.0, score)), "selected": sel, "reason": str(extra["reason"] or p.get("why") or "")})
        out_c.append(p)
    if dropped_all:
        warnings.append("dropped non-schema paper fields: %s" % ", ".join(sorted(dropped_all)))
    selected = [c for c in out_c if c["selected"]]
    if not selected:
        fail("no selected candidates")
    selected.sort(key=lambda c: (int(c.get("order") or 0), int(c.get("tier") or 2)))
    # ---- arXiv verification (one free call)
    if verify:
        axs = [c["id"] for c in out_c if C.arxiv_id_from(c["id"]) == c["id"]]
        if axs:
            found = {e["arxiv_id"]: e for e in C.arxiv_by_ids(axs)}
            missing = [a for a in axs if a not in found]
            if missing:
                fail("arXiv ids not found on arXiv: %s" % ", ".join(missing))
            for c in out_c:
                e = found.get(c["id"])
                if not e:
                    continue
                j = C.jaccard(C.tokens(c["title"], False), C.tokens(e["title"], False))
                if j < 0.5:
                    fail("arXiv %s title mismatch: candidate %r vs arXiv %r (Jaccard %.2f)" % (c["id"], c["title"][:60], e["title"][:60], j))
                if not c.get("abstract"):
                    c["abstract"] = e["abstract"]
                if not c.get("authors"):
                    c["authors"] = e["authors"]
    # ---- plan
    plan = sv.get("plan") or []
    sel_ids = {c["id"] for c in selected}
    if plan:
        for pl in plan:
            if not isinstance(pl, dict) or pl.get("paper") not in sel_ids:
                fail("plan entry %r must reference a selected candidate" % (pl,))
            if not DATE_RE.match(str(pl.get("planned") or "")) or pl["planned"] < C.today():
                fail("plan entry %r needs planned=YYYY-MM-DD not in the past" % (pl,))
    elif do_auto_plan:
        plan = auto_plan(selected, (C.settings(root).get("work_days") or [1, 2, 3, 4, 5]))
        warnings.append("plan auto-generated (%d entries)" % len(plan))
    # ---- related (citation edges among candidates + library papers)
    try:
        library = C.read_library(root)
    except Exception:
        library = {}
    edges = load_edges(edge_files or [])
    used = fill_related(out_c, edges, library, warnings)
    n_rel = sum(1 for c in out_c if c["related"])
    lineage = str(sv["lineage"]).rstrip()
    lineage += " | related: %d citation edges → %d/%d candidates linked" % (used, n_rel, len(out_c))
    sv["lineage"] = lineage
    if edge_files and used == 0:
        warnings.append("no usable edges in %s (ids not among candidates/library)" % ", ".join(edge_files))
    sid = sv.get("id") or "sv_%s_%s" % (dt.datetime.now().strftime("%Y%m%d"), (C.slugify(t["id"])[:20] + "-" + C.uuid.uuid4().hex[:4]))
    for c in out_c:
        c["source"] = "survey:%s" % sid
    clean = {"id": sid, "request": sv.get("request"), "created": sv.get("created") or C.now_iso(), "query": str(sv["query"]), "status": "proposed",
             "topic": {k: str(t[k]) for k in ("id", "name", "zh", "emoji", "color")},
             "direction": {"name": str(d["name"]), "primer": str(d["primer"]), "chosen_from": d["chosen_from"]},
             "summary": str(sv["summary"]), "candidates": out_c, "plan": plan, "lineage": str(sv["lineage"])}
    for k in sv:
        if k not in clean:
            clean[k] = sv[k]  # preserve unknown extra keys (schema rule)
    return clean, warnings


def write_api(api: str, sv: dict) -> dict:
    res = C.api_op(api, {"op": "survey.add", "survey": sv})
    if not res.get("ok"):
        C.die("survey.add rejected by server: %s" % res.get("error"))
    out = {"rev": res.get("rev")}
    if sv.get("request"):
        try:
            rs = C.api_get(api, "/api/requests").get("requests") or []
            r = next((x for x in rs if x.get("id") == sv["request"]), None)
            if r is None:
                out["request_warning"] = "request %s not found in library" % sv["request"]
            elif r.get("status") != "done" or r.get("survey") != sv["id"]:
                r2 = C.api_op(api, {"op": "request.update", "id": sv["request"], "fields": {"status": "done", "survey": sv["id"]}})
                out["request_updated"] = bool(r2.get("ok"))
        except Exception as e:
            out["request_warning"] = str(e)
    return out


def write_file(root: str, sv: dict) -> dict:
    with C.FileStore(root) as st:
        if any(x.get("id") == sv["id"] for x in st.data["surveys"]):
            C.die("survey exists: %s" % sv["id"])
        st.data["surveys"].append(sv)
        req_ok = None
        if sv.get("request"):
            r = next((x for x in st.data["requests"] if x.get("id") == sv["request"]), None)
            if r is not None:
                r["status"] = "done"; r["survey"] = sv["id"]; req_ok = True
            else:
                req_ok = False
        st.add_activity("survey")
        n = sum(1 for c in sv["candidates"] if c["selected"])
        persona = (st.data.get("settings") or {}).get("persona_name") or "Yan"
        st.message("survey", "%s brought back a survey on \"%s\": %d candidate paper(s) for you to review." % (persona, sv["topic"].get("name") or sv["topic"].get("zh") or sv.get("query") or "", n))
        rev = st.save()
    return {"rev": rev, "request_updated": req_ok}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--json", required=True, help="survey JSON file (see references/library-schema.md)")
    ap.add_argument("--api", default=None)
    ap.add_argument("--file", action="store_true", help="force file mode")
    ap.add_argument("--dry-run", action="store_true", help="validate and print the normalised survey, write nothing")
    ap.add_argument("--no-verify", action="store_true", help="skip the arXiv id existence/title check")
    ap.add_argument("--no-auto-plan", action="store_true")
    ap.add_argument("--edges", action="append", default=None, help="snowball.py output file(s) whose citation edges fill `related` (repeatable)")
    C.add_common_args(ap)
    a = ap.parse_args()
    root = C.apply_common_args(a)
    C.sync_field_whitelist(root)
    with open(a.json, encoding="utf-8") as f:
        try:
            sv = json.load(f)
        except json.JSONDecodeError as e:
            C.die("bad JSON: %s" % e)
    clean, warnings = validate(sv, root, not a.no_verify, not a.no_auto_plan, a.edges)
    n_sel = sum(1 for c in clean["candidates"] if c["selected"])
    if a.dry_run:
        C.emit({"ok": True, "dry_run": True, "survey": clean, "warnings": warnings, "n_candidates": len(clean["candidates"]), "n_selected": n_sel})
        return
    mode, api, _ = ("file", C.api_url(a.api), None) if a.file else C.choose_mode(root, a.api)
    res = write_api(api, clean) if mode == "api" else write_file(root, clean)
    C.emit({"ok": True, "mode": mode, "root": root, "survey_id": clean["id"], "request": clean.get("request"), "topic": clean["topic"]["id"],
            "n_candidates": len(clean["candidates"]), "n_selected": n_sel, "plan": clean["plan"], "lineage": clean["lineage"],
            "related": {c["id"]: c["related"] for c in clean["candidates"] if c["related"]},
            "keywords": {c["id"]: c["keywords"] for c in clean["candidates"]}, "warnings": warnings, **res})


if __name__ == "__main__":
    main()
