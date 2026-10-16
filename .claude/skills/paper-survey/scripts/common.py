#!/usr/bin/env python3
"""Shared helpers for the paper-survey skill scripts (stdlib only, runs under `python3 -I`).

Provides: HTTP with retry/backoff/jitter + per-host pacing + 24 h disk cache, User-Agent built from the
library settings, OpenAlex credit ledger, arXiv Atom parsing, OpenAlex abstract reconstruction, title
normalisation, arXiv-id detection, candidate normalisation and de-duplication, and library-root helpers.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

VERSION = "0.1"
CACHE_DIR = os.path.expanduser(os.environ.get("PAPER_SURVEY_CACHE") or "~/.cache/paper-survey")
CACHE_TTL = 24 * 3600
DEFAULT_API = "http://127.0.0.1:8765"
FRESH = False          # set by --fresh to bypass the cache
VERBOSE = False

# per-host minimum spacing in seconds (arXiv ToU: 1 request / 3 s; S2 and Crossref 1 rps)
HOST_GAP = {
    "export.arxiv.org": 3.0, "arxiv.org": 3.0, "ar5iv.labs.arxiv.org": 3.0, "ar5iv.org": 3.0,
    "api.semanticscholar.org": 1.1, "api.crossref.org": 1.0, "api.openalex.org": 0.25,
    "huggingface.co": 0.6,
}
OPENALEX_KEY = os.environ.get("OPENALEX_API_KEY", "").strip()
S2_KEY = os.environ.get("S2_API_KEY", "").strip()


# ----------------------------------------------------------------------------- logging / output
def log(msg: str):
    sys.stderr.write("[%s] %s\n" % (time.strftime("%H:%M:%S"), msg))
    sys.stderr.flush()


def vlog(msg: str):
    if VERBOSE:
        log(msg)


def emit(obj, indent: int = 1):
    json.dump(obj, sys.stdout, ensure_ascii=False, indent=indent)
    sys.stdout.write("\n")
    sys.stdout.flush()


def die(msg: str, code: int = 2):
    log("ERROR: " + msg)
    sys.exit(code)


def add_common_args(ap):
    ap.add_argument("--root", default=None, help="library root (default: $PAPER_LIBRARY_ROOT, else the library this skill ships inside, else the current folder when it is a library)")
    ap.add_argument("--fresh", action="store_true", help="bypass the 24 h HTTP cache")
    ap.add_argument("-v", "--verbose", action="store_true", help="log every HTTP call to stderr")


_ROOT: str | None = None   # resolved once by apply_common_args; library_root(None) then returns it, so settings()/user_agent() follow --root


def apply_common_args(a):
    global FRESH, VERBOSE, _ROOT
    FRESH = bool(getattr(a, "fresh", False))
    VERBOSE = bool(getattr(a, "verbose", False))
    try:
        _ROOT = library_root(getattr(a, "root", None))
    except FileNotFoundError as e:
        die(str(e))
    return _ROOT


# ----------------------------------------------------------------------------- library root / settings
def _is_library(d: str) -> bool:
    return os.path.isfile(os.path.join(d, "library.json")) or os.path.isfile(os.path.join(d, "app", "server.py"))


def library_root(opt: str | None = None) -> str:
    """--root, else the root already resolved from --root, else $PAPER_LIBRARY_ROOT (the app server sets it for every Claude
    session it starts), else the current folder when it is a library (the server runs the skill with cwd = library root), else
    the library this skill ships inside (<library>/.claude/skills/paper-survey/scripts, resolved through symlinks).
    Raises FileNotFoundError otherwise."""
    r = opt or _ROOT or os.environ.get("PAPER_LIBRARY_ROOT")
    if not r:
        here = os.path.dirname(os.path.realpath(__file__))
        shipped = os.path.abspath(os.path.join(here, "..", "..", "..", ".."))
        if _is_library(os.getcwd()):
            r = os.getcwd()
        elif _is_library(shipped):
            r = shipped
        else:
            raise FileNotFoundError("library root not found: run from the library folder, set PAPER_LIBRARY_ROOT, or pass --root")
    return os.path.abspath(os.path.expanduser(r))


def read_library(root: str) -> dict:
    with open(os.path.join(root, "library.json"), encoding="utf-8") as f:
        return json.load(f)


_SETTINGS: dict | None = None


def settings(root: str | None = None) -> dict:
    """Read-only peek at library settings (never raises)."""
    global _SETTINGS
    if _SETTINGS is None:
        try:
            _SETTINGS = read_library(library_root(root)).get("settings") or {}
        except Exception:
            _SETTINGS = {}
    return _SETTINGS


def user_agent(root: str | None = None) -> str:
    mail = (settings(root).get("user_email") or "").strip() or "paper-assistant@localhost"
    return "paper-assistant/%s (mailto:%s)" % (VERSION, mail)


# ----------------------------------------------------------------------------- cache + pacing
def _cache_path(key: str) -> str:
    os.makedirs(CACHE_DIR, exist_ok=True)
    return os.path.join(CACHE_DIR, hashlib.sha1(key.encode()).hexdigest() + ".json")


def cache_get(key: str, ttl: float = CACHE_TTL):
    if FRESH:
        return None
    p = _cache_path(key)
    try:
        with open(p, encoding="utf-8") as f:
            rec = json.load(f)
        if time.time() - rec.get("ts", 0) <= ttl:
            return rec
    except Exception:
        pass
    return None


def cache_put(key: str, rec: dict):
    rec["ts"] = time.time()
    tmp = _cache_path(key) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(rec, f)
    os.replace(tmp, _cache_path(key))


def _pace(host: str):
    gap = HOST_GAP.get(host, 0.0)
    if gap <= 0:
        return
    d = os.path.join(CACHE_DIR, "pace")
    os.makedirs(d, exist_ok=True)
    stamp = os.path.join(d, host)
    try:
        last = os.path.getmtime(stamp)
    except OSError:
        last = 0.0
    wait = gap - (time.time() - last)
    if wait > 0:
        vlog("pacing %s: sleep %.1fs" % (host, wait))
        time.sleep(wait)
    with open(stamp, "a"):
        os.utime(stamp, None)


# ----------------------------------------------------------------------------- OpenAlex credit ledger
LEDGER = os.path.join(CACHE_DIR, "openalex-ledger.json")
RUN_CREDITS = {"calls": 0, "credits": 0, "cached": 0, "remaining": None}


def _ledger_add(credits: int, remaining):
    RUN_CREDITS["calls"] += 1
    RUN_CREDITS["credits"] += credits
    RUN_CREDITS["remaining"] = remaining
    try:
        led = {}
        if os.path.exists(LEDGER):
            with open(LEDGER, encoding="utf-8") as f:
                led = json.load(f)
        day = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
        e = led.setdefault(day, {"credits": 0, "calls": 0, "remaining": None})
        e["credits"] += credits
        e["calls"] += 1
        e["remaining"] = remaining
        with open(LEDGER, "w", encoding="utf-8") as f:
            json.dump(led, f, indent=1)
    except Exception as e:  # ledger is best-effort
        vlog("ledger: %s" % e)


def openalex_usage() -> dict:
    out = dict(RUN_CREDITS)
    try:
        with open(LEDGER, encoding="utf-8") as f:
            led = json.load(f)
        day = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
        out["today_total"] = (led.get(day) or {}).get("credits", 0)
    except Exception:
        out["today_total"] = None
    return out


# ----------------------------------------------------------------------------- HTTP
class HTTPFail(Exception):
    pass


def http(url: str, *, data=None, headers: dict | None = None, tries: int = 5, timeout: int = 60,
         ttl: float = CACHE_TTL, cache: bool = True, root: str | None = None) -> tuple[bytes, dict, bool]:
    """GET (or POST json when data is not None). Returns (body, headers, from_cache).

    Retries 429/5xx with exponential backoff + jitter (honours Retry-After), paces per host, caches 24 h.
    """
    host = urllib.parse.urlsplit(url).hostname or ""
    hdrs = {"User-Agent": user_agent(root), "Accept": "application/json, application/atom+xml, text/html;q=0.9, */*;q=0.5"}
    if host == "api.openalex.org" and OPENALEX_KEY:
        hdrs["Authorization"] = "Bearer " + OPENALEX_KEY
    if host == "api.semanticscholar.org" and S2_KEY:
        hdrs["x-api-key"] = S2_KEY
    hdrs.update(headers or {})
    body = json.dumps(data).encode() if data is not None else None
    if body is not None:
        hdrs["Content-Type"] = "application/json"
    key = "%s %s %s" % ("POST" if body else "GET", url, body.decode() if body else "")
    if cache:
        rec = cache_get(key, ttl)
        if rec is not None:
            vlog("cache hit %s" % url[:120])
            if host == "api.openalex.org":
                RUN_CREDITS["cached"] += 1
            return rec["body"].encode("utf-8", "surrogatepass") if isinstance(rec["body"], str) else bytes(rec["body"]), rec.get("headers") or {}, True
    last_err = None
    for attempt in range(tries):
        _pace(host)
        req = urllib.request.Request(url, data=body, headers=hdrs, method="POST" if body else "GET")
        try:
            vlog("GET/POST %s" % url[:160])
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read()
                rh = {k.lower(): v for k, v in r.headers.items()}
            if host == "api.openalex.org":
                try:
                    _ledger_add(int(rh.get("x-ratelimit-credits-used") or 0), rh.get("x-ratelimit-remaining"))
                except Exception:
                    pass
            if cache:
                try:
                    cache_put(key, {"body": raw.decode("utf-8"), "headers": {k: rh[k] for k in rh if k.startswith(("content-type", "x-ratelimit"))}})
                except Exception as e:
                    vlog("cache write failed: %s" % e)
            return raw, rh, False
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (429, 500, 502, 503, 504) and attempt < tries - 1:
                ra = e.headers.get("Retry-After") if e.headers else None
                wait = float(ra) if ra and ra.isdigit() else min(60.0, (2 ** attempt) + random.random() * 2)
                log("HTTP %d from %s; retry in %.1fs (%d/%d)" % (e.code, host, wait, attempt + 1, tries))
                time.sleep(wait)
                continue
            try:
                detail = e.read(300).decode("utf-8", "replace")
            except Exception:
                detail = ""
            raise HTTPFail("HTTP %d %s %s" % (e.code, url[:140], detail))
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_err = e
            if attempt < tries - 1:
                wait = min(30.0, (2 ** attempt) + random.random())
                log("network error %s; retry in %.1fs" % (e, wait))
                time.sleep(wait)
                continue
    raise HTTPFail("gave up on %s: %s" % (url[:140], last_err))


def http_json(url: str, **kw):
    raw, _, _ = http(url, **kw)
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception as e:
        raise HTTPFail("non-JSON response from %s: %s" % (url[:120], e))


def http_text(url: str, **kw) -> str:
    raw, _, _ = http(url, **kw)
    return raw.decode("utf-8", "replace")


# ----------------------------------------------------------------------------- text helpers
STOP = set("a an the of for in on and or to with by from via into using based towards toward vs versus is are be as at its their it this that these those we our new novel approach approaches method methods".split())
ARXIV_RE = re.compile(r"(?<![\d.])(\d{4}\.\d{4,5})(?:v\d+)?(?![\d.])")
OLD_ARXIV_RE = re.compile(r"\b([a-z\-]+(?:\.[A-Z]{2})?/\d{7})(?:v\d+)?\b")
SURVEY_RE = re.compile(r"\b(survey|review|overview|systematic literature|state of the art|tutorial|taxonomy|primer|roadmap)\b", re.I)


def norm_title(t: str) -> str:
    t = (t or "").lower()
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    return " ".join(t.split())


def tokens(t: str, drop_stop: bool = True) -> set:
    ws = norm_title(t).split()
    return set(w for w in ws if not drop_stop or (w not in STOP and len(w) > 1))


def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / float(len(a | b))


def norm_keywords(ks, cap: int = 12) -> list:
    """lowercase, trimmed, deduped, ≤ cap; arXiv categories (cs.LG) keep their case."""
    out = []
    for k in ks or []:
        k = " ".join(str(k or "").split())
        if not k:
            continue
        if not re.match(r"^[a-z\-]+\.[A-Z]{2}$", k):
            k = k.lower()
        if len(k) > 40 or k in out:
            continue
        out.append(k)
        if len(out) >= cap:
            break
    return out


def is_survey_title(t: str) -> bool:
    return bool(SURVEY_RE.search(t or ""))


def arxiv_id_from(s: str | None) -> str:
    if not s:
        return ""
    m = ARXIV_RE.search(s)
    if m:
        return m.group(1)
    m = OLD_ARXIV_RE.search(s)
    return m.group(1) if m else ""


def year_range(spec: str | None) -> tuple[int, int]:
    y = dt.date.today().year
    if not spec:
        return (y - 8, y)
    m = re.match(r"^\s*(\d{4})\s*[-–:]\s*(\d{4})\s*$", spec)
    if m:
        return (int(m.group(1)), int(m.group(2)))
    m = re.match(r"^\s*(\d{4})\s*$", spec)
    if m:
        return (int(m.group(1)), y)
    die("bad --years %r (use YYYY-YYYY)" % spec)


# ----------------------------------------------------------------------------- arXiv
ARXIV_NS = {"a": "http://www.w3.org/2005/Atom", "os": "http://a9.com/-/spec/opensearch/1.1/", "ax": "http://arxiv.org/schemas/atom"}


def arxiv_query_string(text: str, cats: list | None = None) -> str:
    """Natural text → arXiv fielded query. Quoted text → phrase on ti/abs; else AND of all: tokens."""
    text = text.strip()
    if text.startswith('"') and text.endswith('"') and len(text) > 2:
        ph = text.strip('"')
        q = '(ti:"%s" OR abs:"%s")' % (ph, ph)
    else:
        toks = [w for w in re.sub(r"[^A-Za-z0-9\- ]+", " ", text).split() if w.lower() not in STOP]
        if not toks:
            toks = text.split()
        q = " AND ".join("all:%s" % w for w in toks)
    if cats:
        q = "(%s) AND (%s)" % (q, " OR ".join("cat:%s" % c for c in cats))
    return q


def arxiv_search(query: str, start: int = 0, max_results: int = 25, years: tuple | None = None,
                 sort: str = "relevance", cats: list | None = None) -> tuple[int, list]:
    q = arxiv_query_string(query, cats)
    if years:
        q = "(%s) AND submittedDate:[%d01010000 TO %d12312359]" % (q, years[0], years[1])
    enc = urllib.parse.quote(q.replace(" ", "+"), safe=':+()[]"*')
    url = ("https://export.arxiv.org/api/query?search_query=%s&start=%d&max_results=%d&sortBy=%s&sortOrder=descending"
           % (enc, start, max_results, sort))
    raw, _, _ = http(url)
    return parse_arxiv_atom(raw)


def arxiv_by_ids(ids: list) -> list:
    """Fetch metadata for explicit arXiv ids (also used to verify existence). ≤ 100 ids per call."""
    out = []
    ids = [i for i in ids if i]
    for i in range(0, len(ids), 100):
        chunk = ids[i:i + 100]
        url = "https://export.arxiv.org/api/query?id_list=%s&max_results=%d" % (",".join(chunk), len(chunk))
        raw, _, _ = http(url)
        _, entries = parse_arxiv_atom(raw)
        out.extend(entries)
    return out


def parse_arxiv_atom(raw: bytes) -> tuple[int, list]:
    root = ET.fromstring(raw)
    total = int(root.findtext("os:totalResults", namespaces=ARXIV_NS) or 0)
    out = []
    for e in root.findall("a:entry", ARXIV_NS):
        idt = e.findtext("a:id", namespaces=ARXIV_NS) or ""
        title = " ".join((e.findtext("a:title", namespaces=ARXIV_NS) or "").split())
        if title == "Error" or "/abs/" not in idt:
            continue
        aid_v = idt.rsplit("/abs/", 1)[1]
        aid = re.sub(r"v\d+$", "", aid_v)
        pc = e.find("ax:primary_category", ARXIV_NS)
        out.append({
            "arxiv_id": aid, "version": aid_v, "title": title,
            "abstract": " ".join((e.findtext("a:summary", namespaces=ARXIV_NS) or "").split()),
            "published": e.findtext("a:published", namespaces=ARXIV_NS) or "",
            "updated": e.findtext("a:updated", namespaces=ARXIV_NS) or "",
            "authors": [a.findtext("a:name", namespaces=ARXIV_NS) or "" for a in e.findall("a:author", ARXIV_NS)],
            "primary_category": pc.get("term") if pc is not None else "",
            "categories": [c.get("term") for c in e.findall("a:category", ARXIV_NS)],
            "comment": e.findtext("ax:comment", namespaces=ARXIV_NS) or "",
            "journal_ref": e.findtext("ax:journal_ref", namespaces=ARXIV_NS) or "",
            "doi": e.findtext("ax:doi", namespaces=ARXIV_NS) or "",
        })
    return total, out


# ----------------------------------------------------------------------------- OpenAlex
OA = "https://api.openalex.org"
OA_WORK_SELECT = "id,doi,title,display_name,publication_year,publication_date,type,cited_by_count,primary_topic,keywords,authorships,primary_location,locations,open_access,abstract_inverted_index,referenced_works_count,ids,indexed_in"


def oa_abstract(inv) -> str:
    if not inv:
        return ""
    pos = sorted((p, w) for w, ps in inv.items() for p in ps)
    return " ".join(w for _, w in pos)


def oa_arxiv_id(work: dict) -> str:
    for loc in (work.get("locations") or []):
        for k in ("landing_page_url", "pdf_url"):
            u = loc.get(k) or ""
            if "arxiv.org" in u:
                a = arxiv_id_from(u)
                if a:
                    return a
    doi = (work.get("doi") or "")
    if "10.48550/arxiv." in doi.lower():
        return arxiv_id_from(doi)
    return ""


def oa_venue(work: dict) -> str:
    pl = work.get("primary_location") or {}
    src = (pl.get("source") or {}).get("display_name") or ""
    if src and src.lower() != "arxiv (cornell university)":
        return src
    for loc in work.get("locations") or []:
        s = (loc.get("source") or {}).get("display_name") or ""
        if s and "arxiv" not in s.lower():
            return s
    return "arXiv" if oa_arxiv_id(work) else ""


def oa_list(path: str, params: dict) -> dict:
    """GET /works etc. with params; returns parsed JSON. Caller is responsible for credit budgeting."""
    qs = urllib.parse.urlencode(params, safe=":,|*()!<>", quote_via=urllib.parse.quote)
    return http_json("%s%s?%s" % (OA, path, qs))


def oa_filter_search(query: str, years: tuple | None) -> str:
    q = query.replace(",", " ").replace("|", " ").strip()
    f = "title_and_abstract.search:%s" % q
    if years:
        f += ",publication_year:%d-%d" % years
    return f


# ----------------------------------------------------------------------------- Semantic Scholar
S2 = "https://api.semanticscholar.org/graph/v1"
S2_FIELDS = "title,abstract,year,venue,publicationVenue,citationCount,influentialCitationCount,externalIds,publicationDate,publicationTypes,tldr,authors,fieldsOfStudy"


def s2_batch(ids: list, fields: str = S2_FIELDS) -> list:
    """POST /paper/batch (works unauthenticated); returns list aligned with ids (None for misses). Never raises."""
    out: list = []
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        try:
            res = http_json("%s/paper/batch?fields=%s" % (S2, fields), data={"ids": chunk})
            if isinstance(res, list):
                out.extend(res + [None] * (len(chunk) - len(res)))
            else:
                out.extend([None] * len(chunk))
        except HTTPFail as e:
            log("S2 batch failed (%s); continuing without S2 enrichment" % str(e)[:120])
            out.extend([None] * len(chunk))
    return out


# ----------------------------------------------------------------------------- candidate schema
def new_candidate() -> dict:
    return {"id": "", "arxiv_id": "", "title": "", "authors": [], "year": 0, "venue": "", "abstract": "",
            "arxiv": "", "doi": "", "url": "", "citations": 0, "citations_per_year": 0.0, "influential_citations": 0,
            "is_survey": False, "tldr": "", "openalex_id": "", "primary_topic": "", "keywords": [], "sources": [], "queries": [], "hits": 0}


def cand_from_arxiv(e: dict, query: str = "") -> dict:
    c = new_candidate()
    c.update({"id": e["arxiv_id"], "arxiv_id": e["arxiv_id"], "title": e["title"], "authors": e["authors"],
              "year": int((e.get("published") or "0000")[:4] or 0), "abstract": e["abstract"],
              "arxiv": "https://arxiv.org/abs/%s" % e["arxiv_id"], "doi": e.get("doi") or "",
              "venue": _venue_from_arxiv(e), "keywords": [k for k in (e.get("categories") or []) if k][:4],
              "sources": ["arxiv"], "queries": [query] if query else [], "hits": 1})
    c["is_survey"] = is_survey_title(c["title"])
    return c


def _venue_from_arxiv(e: dict) -> str:
    jr = (e.get("journal_ref") or "").strip()
    if jr:
        return jr[:80]
    cm = (e.get("comment") or "")
    m = re.search(r"\b(NeurIPS|NIPS|ICML|ICLR|CVPR|ICCV|ECCV|ACL|EMNLP|NAACL|AAAI|IJCAI|KDD|SIGIR|WWW|TPAMI|JMLR|TMLR|COLM|AISTATS|UAI|COLING|WACV|ACM|IEEE)\b[^.;,]*", cm)
    if m:
        return m.group(0).strip()[:60]
    return "arXiv %s" % (e.get("published") or "")[:4]


def cand_from_openalex(w: dict, query: str = "") -> dict:
    c = new_candidate()
    aid = oa_arxiv_id(w)
    doi = (w.get("doi") or "").replace("https://doi.org/", "")
    oid = (w.get("id") or "").rsplit("/", 1)[-1]
    c.update({"arxiv_id": aid, "title": w.get("title") or w.get("display_name") or "",
              "authors": [((a.get("author") or {}).get("display_name") or "") for a in (w.get("authorships") or [])][:12],
              "year": int(w.get("publication_year") or 0), "venue": oa_venue(w), "abstract": oa_abstract(w.get("abstract_inverted_index")),
              "arxiv": ("https://arxiv.org/abs/%s" % aid) if aid else "", "doi": doi,
              "url": ((w.get("primary_location") or {}).get("landing_page_url") or ""),
              "citations": int(w.get("cited_by_count") or 0), "openalex_id": oid,
              "primary_topic": ((w.get("primary_topic") or {}).get("display_name") or ""),
              "keywords": norm_keywords([k.get("display_name") for k in (w.get("keywords") or [])] + [((w.get("primary_topic") or {}).get("display_name") or "")]),
              "sources": ["openalex"], "queries": [query] if query else [], "hits": 1})
    c["id"] = aid or ("doi:" + doi if doi else "oa:" + oid)
    c["is_survey"] = is_survey_title(c["title"]) or (w.get("type") == "review")
    return c


def cand_from_s2(p: dict, query: str = "") -> dict:
    c = new_candidate()
    ext = p.get("externalIds") or {}
    aid = ext.get("ArXiv") or ""
    doi = ext.get("DOI") or ""
    c.update({"arxiv_id": aid, "title": p.get("title") or "", "authors": [a.get("name") or "" for a in (p.get("authors") or [])][:12],
              "year": int(p.get("year") or 0), "venue": (p.get("venue") or ((p.get("publicationVenue") or {}).get("name")) or ("arXiv" if aid else "")),
              "abstract": p.get("abstract") or "", "arxiv": ("https://arxiv.org/abs/%s" % aid) if aid else "", "doi": doi,
              "citations": int(p.get("citationCount") or 0), "influential_citations": int(p.get("influentialCitationCount") or 0),
              "tldr": ((p.get("tldr") or {}).get("text") or ""), "keywords": norm_keywords(p.get("fieldsOfStudy") or []),
              "sources": ["s2"], "queries": [query] if query else [], "hits": 1})
    c["id"] = aid or ("doi:" + doi if doi else "s2:" + (p.get("paperId") or ""))
    c["is_survey"] = is_survey_title(c["title"]) or ("Review" in (p.get("publicationTypes") or []))
    return c


def finish_candidate(c: dict):
    y = dt.date.today().year
    age = max(1, y - int(c.get("year") or y) + 1)
    c["citations_per_year"] = round(float(c.get("citations") or 0) / age, 1)
    c["is_survey"] = bool(c.get("is_survey")) or is_survey_title(c.get("title") or "")
    if c.get("arxiv_id") and not c.get("arxiv"):
        c["arxiv"] = "https://arxiv.org/abs/%s" % c["arxiv_id"]
    if c.get("arxiv_id"):
        c["id"] = c["arxiv_id"]
    return c


def merge_into(pool: list, c: dict):
    """Merge candidate c into pool (dedupe by arXiv id, DOI, OpenAlex id, or title Jaccard ≥ 0.9)."""
    ct = tokens(c.get("title") or "", drop_stop=False)
    for p in pool:
        same = ((c.get("arxiv_id") and c["arxiv_id"] == p.get("arxiv_id"))
                or (c.get("doi") and c["doi"].lower() == (p.get("doi") or "").lower())
                or (c.get("openalex_id") and c["openalex_id"] == p.get("openalex_id"))
                or (ct and jaccard(ct, tokens(p.get("title") or "", drop_stop=False)) >= 0.9))
        if same:
            for k in ("arxiv_id", "doi", "openalex_id", "url", "tldr", "primary_topic", "venue"):
                if not p.get(k) and c.get(k):
                    p[k] = c[k]
            if len(c.get("abstract") or "") > len(p.get("abstract") or ""):
                p["abstract"] = c["abstract"]
            if len(c.get("authors") or []) > len(p.get("authors") or []):
                p["authors"] = c["authors"]
            if not p.get("year") and c.get("year"):
                p["year"] = c["year"]
            p["citations"] = max(int(p.get("citations") or 0), int(c.get("citations") or 0))
            p["influential_citations"] = max(int(p.get("influential_citations") or 0), int(c.get("influential_citations") or 0))
            p["is_survey"] = bool(p.get("is_survey") or c.get("is_survey"))
            for k in ("sources", "queries", "keywords"):
                p.setdefault(k, [])
                for v in c.get(k) or []:
                    if v not in p[k]:
                        p[k].append(v)
            p["hits"] = int(p.get("hits") or 0) + int(c.get("hits") or 1)
            for k, v in c.items():
                if k not in p and v not in (None, "", [], 0):
                    p[k] = v
            if p.get("arxiv_id"):
                p["id"] = p["arxiv_id"]
                p["arxiv"] = "https://arxiv.org/abs/%s" % p["arxiv_id"]
            return p
    pool.append(c)
    return c


def enrich_with_s2(pool: list) -> int:
    """Attach S2 citation counts / tldr / influential counts via batch lookup. Returns number enriched."""
    ids, idx = [], []
    for i, c in enumerate(pool):
        if c.get("arxiv_id"):
            ids.append("ARXIV:" + c["arxiv_id"]); idx.append(i)
        elif c.get("doi"):
            ids.append("DOI:" + c["doi"]); idx.append(i)
    if not ids:
        return 0
    res = s2_batch(ids)
    n = 0
    for i, p in zip(idx, res):
        if not p:
            continue
        c = pool[i]
        c["citations"] = max(int(c.get("citations") or 0), int(p.get("citationCount") or 0))
        c["influential_citations"] = max(int(c.get("influential_citations") or 0), int(p.get("influentialCitationCount") or 0))
        if not c.get("tldr") and (p.get("tldr") or {}).get("text"):
            c["tldr"] = p["tldr"]["text"]
        if not c.get("abstract") and p.get("abstract"):
            c["abstract"] = p["abstract"]
        ext = p.get("externalIds") or {}
        if not c.get("doi") and ext.get("DOI"):
            c["doi"] = ext["DOI"]
        if not c.get("arxiv_id") and ext.get("ArXiv"):
            c["arxiv_id"] = ext["ArXiv"]
        ven = p.get("venue") or ((p.get("publicationVenue") or {}).get("name")) or ""
        if ven and (not c.get("venue") or c["venue"].lower().startswith("arxiv")):
            c["venue"] = ven
        if "s2" not in c["sources"]:
            c["sources"].append("s2")
        if "Review" in (p.get("publicationTypes") or []):
            c["is_survey"] = True
        for k in norm_keywords(p.get("fieldsOfStudy") or []):
            if k not in c.setdefault("keywords", []):
                c["keywords"].append(k)
        n += 1
    return n


def rank_key(c: dict):
    return (-int(c.get("hits") or 0), -float(c.get("citations_per_year") or 0), -int(c.get("citations") or 0))


def trim_for_output(c: dict, abstract_chars: int = 1200) -> dict:
    c = dict(c)
    if abstract_chars and len(c.get("abstract") or "") > abstract_chars:
        c["abstract"] = c["abstract"][:abstract_chars].rsplit(" ", 1)[0] + " …"
    return c


# ============================================================================= library store (API-first, file fallback)
import fcntl  # noqa: E402  (Linux only; the app itself is Linux-only)
import shutil  # noqa: E402
import uuid  # noqa: E402

PAPER_FIELDS = {
    "short": str, "title": str, "authors": list, "year": int, "venue": str, "abstract": str, "arxiv": str, "doi": str, "url": str,
    "pdf": str, "note": str, "topic": str, "subtopic": str, "phase": str, "tier": int, "order": int,
    "why": str, "tldr": str, "tags": list, "citations": int, "difficulty": int, "est_minutes": int,
    "status": str, "rating": int, "planned": str, "started": str, "finished": str, "added": str, "source": str,
    "progress": int, "quick_note": str, "questions": list, "highlights": list, "claims": list, "minutes_read": int, "last_opened": str,
    "topics": list, "surveys": list, "keywords": list, "related": list, "interest": str,
}
PAPER_DEFAULTS = {
    "short": "", "title": "", "authors": [], "year": 0, "venue": "", "abstract": "", "arxiv": "", "doi": "", "url": "",
    "pdf": "", "note": "", "topic": "", "subtopic": "", "phase": "", "tier": 2, "order": 0,
    "why": "", "tldr": "", "tags": [], "citations": 0, "difficulty": 2, "est_minutes": 60,
    "status": "unread", "rating": 0, "planned": "", "started": "", "finished": "", "added": "", "source": "manual",
    "progress": 0, "quick_note": "", "questions": [], "highlights": [], "claims": [], "minutes_read": 0, "last_opened": "",
    "topics": [], "surveys": [], "keywords": [], "related": [], "interest": "",
}
REQUEST_FIELDS = {"text", "created", "status", "survey", "note"}


def app_module(root: str, name: str):
    """Import <root>/app/<name>.py (xp.py for stats, server.py for the field whitelist). Returns None on failure."""
    try:
        import importlib.util
        p = os.path.join(root, "app", name + ".py")
        if not os.path.exists(p):
            return None
        appdir = os.path.join(root, "app")
        if appdir not in sys.path:
            sys.path.insert(0, appdir)
        spec = importlib.util.spec_from_file_location("pa_" + name, p)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    except Exception as e:
        vlog("could not import app/%s.py: %s" % (name, e))
        return None


def sync_field_whitelist(root: str):
    """Prefer the server's own PAPER_FIELDS/DEFAULTS when available so the whitelist never drifts."""
    srv = app_module(root, "server")
    if srv is not None and isinstance(getattr(srv, "PAPER_FIELDS", None), dict):
        PAPER_FIELDS.clear(); PAPER_FIELDS.update(srv.PAPER_FIELDS)
        PAPER_DEFAULTS.clear(); PAPER_DEFAULTS.update(srv.PAPER_DEFAULTS)
        return True
    return False


def now_iso() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


def today() -> str:
    return dt.date.today().isoformat()


def new_id(prefix: str) -> str:
    return "%s_%s_%s" % (prefix, dt.datetime.now().strftime("%Y%m%d"), uuid.uuid4().hex[:6])


def slugify(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")
    return s or "topic"


def api_url(opt: str | None = None) -> str:
    return (opt or os.environ.get("PAPER_ASSISTANT_API") or DEFAULT_API).rstrip("/")


def server_health(api: str, timeout: float = 1.5) -> dict | None:
    try:
        req = urllib.request.Request(api + "/api/health", headers={"User-Agent": user_agent()})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            h = json.loads(r.read().decode("utf-8"))
        return h if h.get("ok") else None
    except Exception:
        return None


def choose_mode(root: str, api_opt: str | None) -> tuple[str, str, dict | None]:
    """Return (mode, api, health). API is used only when the server is up AND serves the same root
    (so a test copy never writes into the real library through a running server, and vice versa)."""
    api = api_url(api_opt)
    h = server_health(api)
    if not h:
        return "file", api, None
    sroot = os.path.realpath(h.get("root") or "")
    if sroot and sroot != os.path.realpath(root):
        if api_opt:
            die("server at %s serves %s but --root is %s; refusing to mix libraries" % (api, sroot, root))
        log("server at %s serves a different root (%s); using file mode for %s" % (api, sroot, root))
        return "file", api, None
    return "api", api, h


def api_op(api: str, op: dict, timeout: float = 30) -> dict:
    req = urllib.request.Request(api + "/api/op", data=json.dumps(op, ensure_ascii=False).encode("utf-8"),
                                 headers={"Content-Type": "application/json", "User-Agent": user_agent()}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            return {"ok": False, "error": "HTTP %d" % e.code}


def api_get(api: str, path: str, timeout: float = 10) -> dict:
    req = urllib.request.Request(api + path, headers={"User-Agent": user_agent()})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


class FileStore:
    """Read-modify-write library.json under fcntl.flock(library.lock), mirroring the server's save()."""

    def __init__(self, root: str):
        self.root = root
        self.path = os.path.join(root, "library.json")
        self.lockpath = os.path.join(root, "library.lock")
        self.data: dict = {}
        self._fh = None
        self.xp = app_module(root, "xp")

    def __enter__(self):
        if not os.path.exists(self.path):
            die("library.json not found at %s" % self.path)
        self._fh = open(self.lockpath, "a+")
        fcntl.flock(self._fh.fileno(), fcntl.LOCK_EX)
        with open(self.path, encoding="utf-8") as f:
            self.data = json.load(f)
        if (self.data.get("meta") or {}).get("version") != 2:
            die("library.json is not schema v2")
        for k, default in (("topics", []), ("papers", []), ("queue", []), ("reminders", []), ("sessions", []), ("activity", []), ("ideas", []), ("requests", []), ("surveys", []), ("messages", []), ("settings", {}), ("stats", {})):
            self.data.setdefault(k, default)
        return self

    def __exit__(self, *exc):
        try:
            fcntl.flock(self._fh.fileno(), fcntl.LOCK_UN)
            self._fh.close()
        except Exception:
            pass
        return False

    def add_activity(self, typ: str):
        at = now_iso()
        act = {"date": at[:10], "at": at, "type": typ, "paper": None, "minutes": 0, "xp": 0}
        if self.xp is not None:
            try:
                act["xp"] = int(self.xp.xp_for_activity(act, None))
            except Exception:
                pass
        self.data["activity"].append(act)
        return act

    def message(self, kind: str, text: str):
        msgs = self.data.setdefault("messages", [])
        msgs.append({"at": now_iso(), "kind": kind, "text": text})
        del msgs[:-200]

    def save(self):
        if self.xp is not None:
            try:
                self.xp.recompute_stats(self.data)
            except Exception as e:
                log("xp.recompute_stats failed (%s); stats left as-is" % e)
        meta = self.data.setdefault("meta", {})
        meta["updated"] = now_iso()
        meta["rev"] = int(meta.get("rev") or 0) + 1
        bdir = os.path.join(self.root, ".backups")
        os.makedirs(bdir, exist_ok=True)
        try:
            shutil.copyfile(self.path, os.path.join(bdir, "library-%s.json" % dt.datetime.now().strftime("%Y%m%dT%H%M%S%f")))
            baks = sorted(f for f in os.listdir(bdir) if f.startswith("library-") and f.endswith(".json"))
            for old in baks[:-30]:
                os.remove(os.path.join(bdir, old))
        except Exception as e:
            log("backup failed: %s" % e)
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, self.path)
        return meta["rev"]


def normalize_paper(raw: dict) -> tuple[dict, list]:
    """Server-compatible paper normalisation (whitelist + defaults). Returns (paper, dropped_keys)."""
    if not raw.get("id"):
        raise ValueError("paper.id required")
    p = dict(PAPER_DEFAULTS)
    dropped = []
    for k, v in raw.items():
        if k == "id":
            continue
        if k not in PAPER_FIELDS:
            dropped.append(k)
            continue
        typ = PAPER_FIELDS[k]
        if typ is int:
            if isinstance(v, bool):
                raise ValueError("field %s must be int" % k)
            try:
                v = int(v) if v not in (None, "") else 0
            except Exception:
                raise ValueError("field %s must be int (got %r)" % (k, v))
        elif typ is str:
            v = "" if v is None else str(v)
        elif typ is list:
            if not isinstance(v, list):
                raise ValueError("field %s must be list" % k)
        elif typ is bool:
            v = bool(v)
        p[k] = v
    p["id"] = str(raw["id"])
    if p["status"] not in {"unread", "queued", "reading", "read", "deep", "skipped"}:
        p["status"] = "unread"
    p["added"] = p.get("added") or today()
    if p.get("arxiv") and not p["arxiv"].startswith("http"):
        p["arxiv"] = "https://arxiv.org/abs/" + p["arxiv"]
    return p, dropped
