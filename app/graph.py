#!/usr/bin/env python3
"""Knowledge map for the library: TF-IDF similarity graph + community clustering (stdlib only).

build(lib, k) → {
  "nodes": [{id, short, title, year, tier, status, topic, topics, subtopic, surveys, citations, keywords, cluster, degree}],
  "edges": [{a, b, w, kind}]            # kind: sim (text similarity, kNN) | related (citation link reported by the skill)
  "clusters": [{id, label, terms, size, members}],
  "groupings": {"topic": {...}, "survey": {...}, "subtopic": {...}, "year": {...}}  # id → display meta for the UI legend
}
The clustering is deterministic (sorted ids, fixed iteration order) so the map is stable between reloads.
"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict

STOP = set("""a an the of and or in on for to with by from as at is are was were be been this that these those it its into via
we our their they them than then there here which who whose what when where while can could may might will would should
not no nor but also both each other such using use used uses based towards toward over under between among without within
paper papers propose proposed proposes approach approaches method methods model models learning learn learned learns
results result show shows shown study studies work works problem problems task tasks data dataset datasets novel new
performance state art existing however present presents recent recently well one two three large small more most less
first second further new different several many various all any some only also very much new large""".split())
GENERIC = {"neural", "network", "networks", "deep", "training", "trained", "train", "framework", "experiments", "experimental",
           "benchmark", "benchmarks", "evaluation", "analysis", "algorithm", "algorithms", "setting", "settings", "arxiv", "survey"}


def tokens(text: str) -> list[str]:
    out = []
    for w in re.findall(r"[a-z][a-z0-9\-]+", (text or "").lower()):
        w = w.strip("-")
        if len(w) < 3 or w in STOP or w.isdigit():
            continue
        # crude stemming: plural / -ing / -ed (leave hyphenated compounds alone)
        for suf in (() if "-" in w else ("ing", "ies", "es", "s", "ed")):
            if len(w) > 5 and w.endswith(suf):
                w = w[: -len(suf)] + ("y" if suf == "ies" else "")
                break
        out.append(w)
    return out


def paper_text(p: dict) -> str:
    kw = " ".join((p.get("keywords") or []) * 3)  # keywords count more
    tags = " ".join(p.get("tags") or [])
    return " ".join([(p.get("title") or "") * 2, p.get("abstract") or "", p.get("tldr") or "", kw, tags, p.get("subtopic") or ""])


def tfidf(papers: list[dict]) -> dict[str, dict[str, float]]:
    docs = {p["id"]: Counter(tokens(paper_text(p))) for p in papers}
    df = Counter()
    for c in docs.values():
        df.update(c.keys())
    n = max(1, len(docs))
    vecs = {}
    for pid, c in docs.items():
        total = sum(c.values()) or 1
        v = {}
        for w, f in c.items():
            if df[w] >= n and n > 3:  # appears everywhere → useless
                continue
            v[w] = (f / total) * math.log((n + 1) / (df[w] + 0.5))
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        vecs[pid] = {w: x / norm for w, x in v.items()}
    return vecs


def cosine(a: dict, b: dict) -> float:
    if len(a) > len(b):
        a, b = b, a
    return sum(x * b.get(w, 0.0) for w, x in a.items())


def knn_edges(vecs: dict[str, dict], k: int, min_sim: float = 0.08) -> dict[tuple[str, str], float]:
    ids = sorted(vecs)
    edges = {}
    for i, a in enumerate(ids):
        sims = []
        for b in ids:
            if a == b:
                continue
            s = cosine(vecs[a], vecs[b])
            if s >= min_sim:
                sims.append((s, b))
        sims.sort(reverse=True)
        for s, b in sims[:k]:
            key = (a, b) if a < b else (b, a)
            edges[key] = max(edges.get(key, 0.0), s)
    return edges


def label_propagation(nodes: list[str], adj: dict[str, dict[str, float]], iters: int = 40) -> dict[str, int]:
    """Deterministic weighted label propagation; returns node → community id (dense ints)."""
    label = {n: i for i, n in enumerate(sorted(nodes))}
    order = sorted(nodes)
    for _ in range(iters):
        changed = 0
        for n in order:
            if not adj.get(n):
                continue
            score = defaultdict(float)
            for m, w in adj[n].items():
                score[label[m]] += w
            best = max(score.items(), key=lambda kv: (kv[1], -kv[0]))[0]
            if best != label[n]:
                label[n] = best
                changed += 1
        if not changed:
            break
    # merge tiny communities (size 1) into the strongest neighbour community
    sizes = Counter(label.values())
    for n in order:
        if sizes[label[n]] == 1 and adj.get(n):
            score = defaultdict(float)
            for m, w in adj[n].items():
                if label[m] != label[n]:
                    score[label[m]] += w
            if score:
                label[n] = max(score.items(), key=lambda kv: (kv[1], -kv[0]))[0]
    dense = {}
    for n in order:
        dense.setdefault(label[n], len(dense))
    return {n: dense[label[n]] for n in nodes}


def cluster_label(members: list[str], vecs: dict, papers: dict) -> tuple[str, list[str]]:
    agg = Counter()
    for m in members:
        for w, x in vecs.get(m, {}).items():
            if w not in GENERIC:
                agg[w] += x
    terms = [w for w, _ in agg.most_common(6)]
    # prefer the shared keywords the skill supplied if they exist
    kw = Counter()
    for m in members:
        kw.update(k.lower() for k in (papers[m].get("keywords") or []))
    shared = [k for k, c in kw.most_common(3) if c >= max(2, len(members) // 3)]
    label = " · ".join(shared[:2] if shared else terms[:3]) or "Unnamed"
    return label, terms


def build(lib: dict, k: int = 4) -> dict:
    papers = [p for p in lib.get("papers", []) if p.get("id")]
    by_id = {p["id"]: p for p in papers}
    vecs = tfidf(papers)
    edges = knn_edges(vecs, k)
    kinds = {key: "sim" for key in edges}
    for p in papers:
        for r in p.get("related") or []:
            if r in by_id and r != p["id"]:
                key = (p["id"], r) if p["id"] < r else (r, p["id"])
                edges[key] = max(edges.get(key, 0.0), 0.6)
                kinds[key] = "related"
    adj: dict[str, dict[str, float]] = defaultdict(dict)
    for (a, b), w in edges.items():
        adj[a][b] = w
        adj[b][a] = w
    comm = label_propagation([p["id"] for p in papers], adj) if papers else {}
    members = defaultdict(list)
    for pid, c in comm.items():
        members[c].append(pid)
    clusters = []
    for cid in sorted(members, key=lambda c: (-len(members[c]), c)):
        label, terms = cluster_label(members[cid], vecs, by_id)
        clusters.append({"id": "c%d" % cid, "label": label, "terms": terms, "size": len(members[cid]), "members": sorted(members[cid])})
    cmap = {m: c["id"] for c in clusters for m in c["members"]}
    nodes = []
    for p in papers:
        nodes.append({
            "id": p["id"], "short": p.get("short") or p.get("title", "")[:40], "title": p.get("title") or "", "year": p.get("year") or 0,
            "tier": p.get("tier") or 2, "status": p.get("status") or "unread", "topic": p.get("topic") or "", "topics": p.get("topics") or ([p["topic"]] if p.get("topic") else []),
            "subtopic": p.get("subtopic") or "", "surveys": p.get("surveys") or [], "citations": p.get("citations") or 0,
            "keywords": (p.get("keywords") or [])[:6], "cluster": cmap.get(p["id"], ""), "degree": len(adj.get(p["id"], {})),
            "added": p.get("added") or "", "difficulty": p.get("difficulty") or 2,
        })
    topics = {t["id"]: {"label": (t.get("zh") or t.get("name") or t["id"]), "name": t.get("name") or t["id"], "emoji": t.get("emoji") or "", "color": t.get("color") or ""} for t in lib.get("topics", []) if t.get("id")}
    surveys = {}
    for sv in sorted(lib.get("surveys", []), key=lambda s: s.get("created") or ""):
        t = sv.get("topic") or {}
        surveys[sv["id"]] = {"label": "%s · %s" % ((sv.get("created") or "")[:10], (sv.get("direction") or {}).get("name") or t.get("zh") or t.get("name") or sv.get("query") or sv["id"]),
                             "query": sv.get("query") or "", "created": sv.get("created") or "", "status": sv.get("status") or "", "topic": t.get("id") or ""}
    subtopics = {}
    for t in lib.get("topics", []):
        for st in t.get("subtopics") or []:
            subtopics[st.get("id") or st.get("name")] = {"label": st.get("name") or st.get("id"), "topic": t["id"]}
    return {"ok": True, "nodes": nodes, "edges": [{"a": a, "b": b, "w": round(w, 3), "kind": kinds[(a, b)]} for (a, b), w in sorted(edges.items())],
            "clusters": clusters, "groupings": {"topic": topics, "survey": surveys, "subtopic": subtopics}, "k": k}


if __name__ == "__main__":
    import json
    import sys
    lib = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "library.json", encoding="utf-8"))
    g = build(lib)
    print(len(g["nodes"]), "nodes", len(g["edges"]), "edges", len(g["clusters"]), "clusters")
    for c in g["clusters"]:
        print(" ", c["id"], c["size"], c["label"], "|", ", ".join(lib_p.get("short", "") for lib_p in lib["papers"] if lib_p["id"] in c["members"][:6]))
