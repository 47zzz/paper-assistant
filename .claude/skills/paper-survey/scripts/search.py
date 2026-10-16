#!/usr/bin/env python3
"""Focused retrieval: arXiv API + OpenAlex (+ Semantic Scholar batch enrichment) → deduplicated candidates.

Usage: python3 -I search.py --query "..." [--query "..."] [--years 2019-2026] [--max 60] [--cat cs.LG --cat cs.CV]
       [--no-openalex] [--no-s2] [--arxiv-per-query 30] [--oa-per-query 50] [--recent]

Each query costs: 1 arXiv call (free, 3 s pacing) + 1 OpenAlex search (10 credits) [+1 more with --recent].
S2 enrichment uses POST /paper/batch with ARXIV:/DOI: ids, which works without a key; S2 /paper/search
is used only when S2_API_KEY is set. Output: JSON {queries, years, counts, candidates[]} sorted by
(hits across queries/sources, citations/year). Every candidate carries `arxiv` or `doi` (or an oa: id).
"""
from __future__ import annotations

import argparse
import os
import sys
import urllib.parse

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402


def s2_search(query: str, years: tuple, limit: int) -> list:
    if not C.S2_KEY:
        return []
    try:
        r = C.http_json("%s/paper/search?%s" % (C.S2, "query=%s&limit=%d&year=%d-%d&fields=%s" % (
            urllib.parse.quote(query), min(100, limit), years[0], years[1], C.S2_FIELDS)))
        return r.get("data") or []
    except C.HTTPFail as e:
        C.log("S2 search failed: %s" % str(e)[:120])
        return []


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--query", action="append", required=True)
    ap.add_argument("--years", default=None)
    ap.add_argument("--max", type=int, default=60, help="max candidates in output")
    ap.add_argument("--cat", action="append", default=None, help="arXiv category filter (repeatable)")
    ap.add_argument("--arxiv-per-query", type=int, default=30)
    ap.add_argument("--oa-per-query", type=int, default=50)
    ap.add_argument("--recent", action="store_true", help="also fetch an OpenAlex page sorted by publication date (10 more credits/query)")
    ap.add_argument("--no-openalex", action="store_true")
    ap.add_argument("--no-s2", action="store_true")
    ap.add_argument("--no-arxiv", action="store_true")
    ap.add_argument("--abstract-chars", type=int, default=1200, help="truncate abstracts in output (0 = keep)")
    C.add_common_args(ap)
    a = ap.parse_args()
    C.apply_common_args(a)
    years = C.year_range(a.years)
    queries = [q.strip() for q in a.query if q.strip()]
    pool: list = []
    counts: dict = {}

    for q in queries:
        qc = {"arxiv_total": None, "arxiv_got": 0, "openalex_total": None, "openalex_got": 0, "s2_got": 0}
        if not a.no_arxiv:
            try:
                total, entries = C.arxiv_search(q, max_results=a.arxiv_per_query, years=years, cats=a.cat)
                qc["arxiv_total"], qc["arxiv_got"] = total, len(entries)
                for e in entries:
                    C.merge_into(pool, C.cand_from_arxiv(e, q))
            except C.HTTPFail as e:
                C.log("arXiv failed for %r: %s" % (q, e))
        if not a.no_openalex:
            sorts = ["cited_by_count:desc"] + (["publication_date:desc"] if a.recent else [])
            for s in sorts:
                try:
                    r = C.oa_list("/works", {"filter": C.oa_filter_search(q, years), "sort": s, "per-page": min(200, a.oa_per_query), "select": C.OA_WORK_SELECT})
                    qc["openalex_total"] = int((r.get("meta") or {}).get("count") or 0)
                    ws = r.get("results") or []
                    qc["openalex_got"] += len(ws)
                    for w in ws:
                        if (w.get("type") or "") in ("paratext", "erratum", "editorial", "letter"):
                            continue
                        C.merge_into(pool, C.cand_from_openalex(w, q))
                except C.HTTPFail as e:
                    C.log("OpenAlex failed for %r: %s" % (q, e))
        if not a.no_s2:
            for p in s2_search(q, years, 50):
                qc["s2_got"] += 1
                C.merge_into(pool, C.cand_from_s2(p, q))
        counts[q] = qc

    enriched = 0
    if not a.no_s2 and pool:
        enriched = C.enrich_with_s2(pool)
    for c in pool:
        C.finish_candidate(c)
    pool.sort(key=C.rank_key)
    # keep every survey that made it (they anchor the reading list) + top by rank
    keep = pool[: a.max]
    for c in pool[a.max:]:
        if c["is_survey"] and len(keep) < a.max + 10:
            keep.append(c)
    out = {
        "queries": queries, "years": list(years), "counts": counts,
        "funnel": {"merged_unique": len(pool), "returned": len(keep), "s2_enriched": enriched,
                   "with_arxiv": sum(1 for c in keep if c["arxiv_id"]), "surveys": sum(1 for c in keep if c["is_survey"])},
        "candidates": [C.trim_for_output(c, a.abstract_chars) for c in keep],
        "openalex_usage": C.openalex_usage(),
    }
    C.emit(out)


if __name__ == "__main__":
    main()
