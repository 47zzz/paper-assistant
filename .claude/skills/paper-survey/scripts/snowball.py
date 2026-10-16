#!/usr/bin/env python3
"""Citation snowballing (backward = references, forward = citers) from seed papers.

Usage: python3 -I snowball.py --ids 1602.04938,1705.07874 [--depth 1] [--max 40] [--per-seed 100]
       [--exclude-json search.json] [--no-s2] [--no-openalex]

Seeds may be arXiv ids, doi:..., or oa:W... . Primary source: Semantic Scholar /references and /citations
(work unauthenticated per the API notes; paced ≥1.1 s, backoff on 429). Fallback per seed: OpenAlex
`referenced_works` (free on entity fetch; 1 credit per 50 ids to expand) and `filter=cites:W…` (1 credit).
Candidates are merged across seeds; `seed_links` counts how many seeds connect to each candidate
(co-citation / bibliographic-coupling signal). Depth 2 re-seeds from the top-3 depth-1 hits.

The output also carries `edges[]` = every citation edge fetched ({a: seed, b: id, rel}). To fill the
`related` field of a final list, run it once more over ALL selected ids (`--ids <all> --max 0 --per-seed 300`)
and hand the file(s) to `ingest.py --edges`.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

S2_EDGE_FIELDS = "title,abstract,year,venue,publicationVenue,citationCount,influentialCitationCount,externalIds,publicationTypes,authors,fieldsOfStudy"  # tldr is not allowed on edge endpoints


def s2_id(seed: str) -> str:
    if seed.startswith("doi:"):
        return "DOI:" + seed[4:]
    if seed.startswith("oa:") or seed.startswith("s2:"):
        return ""
    return "ARXIV:" + seed


def s2_edges(seed: str, per_seed: int) -> tuple[list, list] | None:
    sid = s2_id(seed)
    if not sid:
        return None
    try:
        refs = C.http_json("%s/paper/%s/references?fields=%s,isInfluential&limit=%d" % (C.S2, urllib.parse.quote(sid), S2_EDGE_FIELDS, min(1000, per_seed)))
        cits = C.http_json("%s/paper/%s/citations?fields=%s,isInfluential&limit=%d" % (C.S2, urllib.parse.quote(sid), S2_EDGE_FIELDS, min(1000, per_seed)))
    except C.HTTPFail as e:
        C.log("S2 edges failed for %s: %s" % (seed, str(e)[:120]))
        return None
    out_r = [(d.get("citedPaper") or {}, bool(d.get("isInfluential"))) for d in refs.get("data") or []]
    out_c = [(d.get("citingPaper") or {}, bool(d.get("isInfluential"))) for d in cits.get("data") or []]
    return out_r, out_c


LOOKUP: dict = {}   # id → candidate (from --exclude-json) used to resolve arXiv seeds via DOI / OpenAlex id


def oa_resolve(seed: str) -> dict | None:
    hint = LOOKUP.get(seed) or {}
    if not seed.startswith(("doi:", "oa:")):
        if hint.get("openalex_id"):
            seed = "oa:" + hint["openalex_id"]
        elif hint.get("doi"):
            seed = "doi:" + hint["doi"]
    try:
        if seed.startswith("doi:"):
            return C.http_json("%s/works/doi:%s?select=id,referenced_works,cited_by_count" % (C.OA, urllib.parse.quote(seed[4:])))
        if seed.startswith("oa:"):
            return C.http_json("%s/works/%s?select=id,referenced_works,cited_by_count" % (C.OA, seed[3:]))
        r = C.oa_list("/works", {"filter": "locations.landing_page_url:http://arxiv.org/abs/%s" % seed, "select": "id,referenced_works,cited_by_count", "per-page": 1})
        res = r.get("results") or []
        return res[0] if res else None
    except C.HTTPFail as e:
        C.log("OpenAlex resolve failed for %s: %s" % (seed, str(e)[:120]))
        return None


def oa_edges(seed: str, per_seed: int) -> tuple[list, list]:
    w = oa_resolve(seed)
    if not w:
        return [], []
    wid = (w.get("id") or "").rsplit("/", 1)[-1]
    refs: list = []
    ref_ids = [r.rsplit("/", 1)[-1] for r in (w.get("referenced_works") or [])][:min(per_seed, 100)]
    for i in range(0, len(ref_ids), 50):
        try:
            r = C.oa_list("/works", {"filter": "openalex_id:%s" % "|".join(ref_ids[i:i + 50]), "per-page": 50, "select": C.OA_WORK_SELECT})
            refs.extend(r.get("results") or [])
        except C.HTTPFail as e:
            C.log("OpenAlex refs page failed: %s" % str(e)[:120])
    cits: list = []
    try:
        r = C.oa_list("/works", {"filter": "cites:%s" % wid, "sort": "cited_by_count:desc", "per-page": min(200, per_seed), "select": C.OA_WORK_SELECT})
        cits = r.get("results") or []
    except C.HTTPFail as e:
        C.log("OpenAlex citers failed: %s" % str(e)[:120])
    return refs, cits


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ids", required=True, help="comma-separated seed ids (arXiv id | doi:… | oa:W…)")
    ap.add_argument("--depth", type=int, default=1, choices=(1, 2))
    ap.add_argument("--max", type=int, default=40)
    ap.add_argument("--per-seed", type=int, default=100, help="max references / citers fetched per seed")
    ap.add_argument("--exclude-json", default=None, help="search.py output; its candidate ids are flagged `already_found`")
    ap.add_argument("--no-s2", action="store_true")
    ap.add_argument("--no-openalex", action="store_true")
    ap.add_argument("--abstract-chars", type=int, default=800)
    C.add_common_args(ap)
    a = ap.parse_args()
    C.apply_common_args(a)
    seeds = [s.strip() for s in a.ids.split(",") if s.strip()]
    known = set()
    if a.exclude_json:
        with open(a.exclude_json, encoding="utf-8") as f:
            for c in json.load(f).get("candidates") or []:
                known.add(c.get("id"))
                LOOKUP[c.get("id")] = c
    pool: list = []
    edges: list = []          # every citation edge fetched: {"a": seed, "b": other id, "rel": ref|citer}
    seen_seeds: set = set()
    funnel: dict = {"seeds": [], "edges": 0, "s2_seeds": 0, "openalex_seeds": 0, "failed_seeds": []}

    def expand(seed_list: list, level: int):
        for seed in seed_list:
            if seed in seen_seeds:
                continue
            seen_seeds.add(seed)
            funnel["seeds"].append(seed)
            got = None if a.no_s2 else s2_edges(seed, a.per_seed)
            if got is not None:
                funnel["s2_seeds"] += 1
                refs, cits = got
                for rel, items in (("ref", refs), ("citer", cits)):
                    for p, infl in items:
                        if not p or not p.get("title"):
                            continue
                        c = C.cand_from_s2(p)
                        C.finish_candidate(c)
                        edges.append({"a": seed, "b": c["id"], "rel": rel, "doi": c.get("doi") or ""})
                        c["links"] = [{"seed": seed, "rel": rel, "influential": infl, "level": level}]
                        c["sources"] = ["s2-snowball"]
                        m = C.merge_into(pool, c)
                        if m is not c:
                            m.setdefault("links", []).append(c["links"][0])
                        funnel["edges"] += 1
            elif not a.no_openalex:
                refs, cits = oa_edges(seed, a.per_seed)
                if refs or cits:
                    funnel["openalex_seeds"] += 1
                else:
                    funnel["failed_seeds"].append(seed)
                for rel, items in (("ref", refs), ("citer", cits)):
                    for w in items:
                        c = C.cand_from_openalex(w)
                        C.finish_candidate(c)
                        edges.append({"a": seed, "b": c["id"], "rel": rel, "doi": c.get("doi") or ""})
                        c["links"] = [{"seed": seed, "rel": rel, "influential": False, "level": level}]
                        c["sources"] = ["openalex-snowball"]
                        m = C.merge_into(pool, c)
                        if m is not c:
                            m.setdefault("links", []).append(c["links"][0])
                        funnel["edges"] += 1
            else:
                funnel["failed_seeds"].append(seed)

    expand(seeds, 1)
    seed_keys = set(seeds) | {s[4:].lower() for s in seeds if s.startswith("doi:")}
    for c in pool:
        c["seed_links"] = len({l["seed"] for l in c.get("links", [])})
        c["influential_links"] = sum(1 for l in c.get("links", []) if l.get("influential"))
        C.finish_candidate(c)
    pool[:] = [c for c in pool if c["id"] not in seed_keys and (c.get("doi") or "").lower() not in seed_keys]
    if a.depth == 2:
        pool.sort(key=lambda c: (-c["seed_links"], -c["influential_links"], -c["citations_per_year"]))
        next_seeds = [c["id"] for c in pool if c.get("arxiv_id") or c["id"].startswith("doi:")][:3]
        expand(next_seeds, 2)
        for c in pool:
            c["seed_links"] = len({l["seed"] for l in c.get("links", [])})
            c["influential_links"] = sum(1 for l in c.get("links", []) if l.get("influential"))
            C.finish_candidate(c)
        pool[:] = [c for c in pool if c["id"] not in seed_keys]
    for c in pool:
        c["already_found"] = c["id"] in known
        # infrastructure / dataset papers cited by everything (PyTorch, ImageNet, ViT…) are rarely reading-list material
        c["generic"] = int(c.get("citations") or 0) >= 10000 and c["seed_links"] <= 2
    pool.sort(key=lambda c: (-c["seed_links"], -c["influential_links"], -c["citations_per_year"], -c["citations"]))
    keep = pool[: a.max]
    funnel.update({"merged_unique": len(pool), "returned": len(keep), "new_vs_search": sum(1 for c in keep if not c["already_found"]), "edges": len(edges)})
    C.emit({"seeds": seeds, "depth": a.depth, "funnel": funnel, "candidates": [C.trim_for_output(c, a.abstract_chars) for c in keep],
            "edges": edges, "openalex_usage": C.openalex_usage()})


if __name__ == "__main__":
    main()
