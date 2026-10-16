#!/usr/bin/env python3
"""Breadth probe: is this research interest broad (needs narrowing) or already specific?

Usage: python3 -I probe.py --query "explainable AI" [--query "..."] [--years 2018-2026] [--max-search-calls 6]

Cost: OpenAlex search-type calls cost 10 credits each (keyless budget 1000/day). The first query spends
3 (count+primary topics, keywords, top-100 by citations); each extra query spends 1 (count). Topic details
cost 1 credit; arXiv calls are free (paced 3 s). Everything is cached 24 h under ~/.cache/paper-survey/.

Prints JSON with raw signals AND a computed `breadth.verdict` (broad | borderline | narrow) so the caller
can override with judgment.
"""
from __future__ import annotations

import argparse
import datetime as dt
import itertools
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

BROAD_COUNT = 3000
NARROW_COUNT = 400
TOPIC_SHARE = 0.05
RECENT_YEARS = 4


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--query", action="append", required=True, help="search phrase (repeatable; first = primary)")
    ap.add_argument("--years", default=None, help="YYYY-YYYY (default: last 8 years)")
    ap.add_argument("--max-search-calls", type=int, default=6, help="cap on OpenAlex search-type calls (10 credits each)")
    ap.add_argument("--no-arxiv", action="store_true", help="skip arXiv totals/trend (saves ~3 s per call)")
    ap.add_argument("--top", type=int, default=100, help="size of the citation-sorted sample (≤200, same credit cost)")
    C.add_common_args(ap)
    a = ap.parse_args()
    C.apply_common_args(a)
    years = C.year_range(a.years)
    queries = [q.strip() for q in a.query if q.strip()]
    q0 = queries[0]
    this_year = dt.date.today().year
    out: dict = {"queries": queries, "years": list(years), "openalex": {}, "arxiv": {}, "topics": [], "breadth": {}}
    search_calls = 0

    # ---- 1. primary query: count + primary topics (group_by)
    f0 = C.oa_filter_search(q0, years)
    try:
        g = C.oa_list("/works", {"filter": f0, "group_by": "primary_topic.id"})
        search_calls += 1
        total = int((g.get("meta") or {}).get("count") or 0)
        groups = g.get("group_by") or []
        topics = [{"id": (x.get("key") or "").rsplit("/", 1)[-1], "name": x.get("key_display_name") or "", "count": int(x.get("count") or 0),
                   "share": round(int(x.get("count") or 0) / float(total or 1), 3)} for x in groups[:12]]
    except C.HTTPFail as e:
        C.die("OpenAlex primary probe failed: %s" % e)
    out["openalex"].update({"primary_query": q0, "filter": f0, "count": total, "primary_topics": topics})

    # ---- 2. keywords
    if search_calls < a.max_search_calls:
        try:
            g = C.oa_list("/works", {"filter": f0, "group_by": "keywords.id"})
            search_calls += 1
            out["openalex"]["keywords"] = [{"id": (x.get("key") or "").rsplit("/", 1)[-1], "name": x.get("key_display_name") or "", "count": int(x.get("count") or 0)}
                                           for x in (g.get("group_by") or [])[:20]]
        except C.HTTPFail as e:
            C.log("keywords group_by failed: %s" % e)
            out["openalex"]["keywords"] = []

    # ---- 3. citation-sorted sample (surveys, representative papers, year spread)
    sample = []
    if search_calls < a.max_search_calls:
        try:
            r = C.oa_list("/works", {"filter": f0, "sort": "cited_by_count:desc", "per-page": min(200, max(25, a.top)),
                                     "select": "id,doi,title,publication_year,cited_by_count,type,primary_topic,locations,ids,authorships"})
            search_calls += 1
            for w in r.get("results") or []:
                c = C.cand_from_openalex(w, q0)
                C.finish_candidate(c)
                sample.append({k: c[k] for k in ("id", "arxiv_id", "doi", "openalex_id", "title", "year", "venue", "citations", "citations_per_year", "is_survey", "primary_topic")}
                              | {"first_author": (c["authors"] or [""])[0]})
        except C.HTTPFail as e:
            C.log("top sample failed: %s" % e)
    surveys = [s for s in sample if s["is_survey"]]
    recent_surveys = [s for s in surveys if s["year"] >= this_year - RECENT_YEARS]
    hist: dict = {}
    for s in sample:
        hist[str(s["year"])] = hist.get(str(s["year"]), 0) + 1
    out["openalex"].update({"top_sample": sample, "surveys_in_sample": surveys, "recent_surveys": recent_surveys,
                            "year_hist_sample": dict(sorted(hist.items()))})

    # ---- 4. secondary queries: counts only
    counts = {q0: total}
    for q in queries[1:]:
        if search_calls >= a.max_search_calls:
            counts[q] = None
            continue
        try:
            r = C.oa_list("/works", {"filter": C.oa_filter_search(q, years), "per-page": 1, "select": "id"})
            search_calls += 1
            counts[q] = int((r.get("meta") or {}).get("count") or 0)
        except C.HTTPFail as e:
            C.log("count for %r failed: %s" % (q, e))
            counts[q] = None
    out["openalex"]["counts_per_query"] = counts
    out["openalex"]["search_calls"] = search_calls

    # ---- 5. topic taxonomy (autocomplete = 0 credits; details = 1 credit)
    tids = []
    try:
        ac = C.oa_list("/autocomplete/topics", {"q": q0})
        for x in (ac.get("results") or [])[:8]:
            tid = (x.get("id") or "").rsplit("/", 1)[-1]
            if tid and tid not in tids:
                tids.append(tid)
    except C.HTTPFail as e:
        C.log("topic autocomplete failed: %s" % e)
    for t in topics[:8]:
        if t["id"] and t["id"] not in tids:
            tids.append(t["id"])
    if tids:
        try:
            r = C.oa_list("/topics", {"filter": "id:%s" % "|".join(tids[:40]), "per-page": 50,
                                      "select": "id,display_name,description,keywords,works_count,subfield,field"})
            by_id = {(t.get("id") or "").rsplit("/", 1)[-1]: t for t in r.get("results") or []}
            share = {t["id"]: t["share"] for t in topics}
            for tid in tids:
                t = by_id.get(tid)
                if not t:
                    continue
                out["topics"].append({"id": tid, "name": t.get("display_name") or "", "description": t.get("description") or "",
                                      "keywords": (t.get("keywords") or [])[:15], "works_count": int(t.get("works_count") or 0),
                                      "subfield": ((t.get("subfield") or {}).get("display_name") or ""),
                                      "share_in_query": share.get(tid, 0.0), "matched_by": "autocomplete" if tid in [x for x in tids[:8]] and tid not in share else "group_by"})
        except C.HTTPFail as e:
            C.log("topic details failed: %s" % e)

    # ---- 6. arXiv totals + trend (free)
    if not a.no_arxiv:
        ax: dict = {"totals": {}}
        for q in queries:
            try:
                n, _ = C.arxiv_search(q, max_results=1, years=years)
                ax["totals"][q] = n
            except C.HTTPFail as e:
                C.log("arXiv total for %r failed: %s" % (q, e))
                ax["totals"][q] = None
        try:
            rec, _ = C.arxiv_search(q0, max_results=1, years=(this_year - 1, this_year))
            pri, _ = C.arxiv_search(q0, max_results=1, years=(this_year - 3, this_year - 2))
            ax.update({"recent_2y": rec, "prior_2y": pri})
            ratio = rec / float(pri or 1)
            ax["trend"] = "rising" if ratio > 1.25 else "falling" if ratio < 0.75 else "flat"
        except C.HTTPFail as e:
            C.log("arXiv trend failed: %s" % e)
        out["arxiv"] = ax

    # ---- 7. breadth verdict
    big_topics = [t for t in topics if t["share"] >= TOPIC_SHARE]
    qtok = C.tokens(q0)
    disjoint = 0
    if len(recent_surveys) >= 3:
        toks = [C.tokens(s["title"]) - qtok - {"survey", "review", "overview", "comprehensive", "systematic"} for s in recent_surveys[:12]]
        # count surveys whose focus words overlap little with every other survey
        for i, ti in enumerate(toks):
            if ti and all(C.jaccard(ti, tj) < 0.2 for j, tj in enumerate(toks) if j != i and tj):
                disjoint += 1
    reasons = []
    if total > BROAD_COUNT:
        reasons.append("OpenAlex count %d > %d" % (total, BROAD_COUNT))
    if len(big_topics) >= 4:
        reasons.append("%d primary topics each ≥ %d%% of hits" % (len(big_topics), int(TOPIC_SHARE * 100)))
    if disjoint >= 3:
        reasons.append("%d recent surveys with disjoint focus" % disjoint)
    big_topic_match = [t for t in out["topics"] if t.get("matched_by") == "autocomplete" and t["works_count"] > 20000]
    if big_topic_match:
        reasons.append("matches a whole OpenAlex topic with %d works (%s)" % (big_topic_match[0]["works_count"], big_topic_match[0]["name"]))
    if reasons:
        verdict = "broad"
    elif total < NARROW_COUNT and len(big_topics) <= 2 and len(recent_surveys) <= 1:
        verdict = "narrow"
    else:
        verdict = "borderline"
    out["breadth"] = {
        "verdict": verdict, "reasons": reasons,
        "signals": {"count": total, "topics_ge_5pct": len(big_topics), "recent_surveys": len(recent_surveys), "disjoint_recent_surveys": disjoint,
                    "surveys_in_sample": len(surveys), "arxiv_total": (out.get("arxiv") or {}).get("totals", {}).get(q0),
                    "arxiv_trend": (out.get("arxiv") or {}).get("trend")},
        "thresholds": {"broad_count": BROAD_COUNT, "narrow_count": NARROW_COUNT, "topic_share": TOPIC_SHARE, "recent_years": RECENT_YEARS},
        "hint": {"broad": "classify into 4–7 directions and ask the user (see references/interaction.md)",
                 "borderline": "offer 2–3 directions briefly or proceed if the request already names a method/setting",
                 "narrow": "skip narrowing; go straight to search.py"}[verdict],
    }
    out["openalex_usage"] = C.openalex_usage()
    C.emit(out)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
