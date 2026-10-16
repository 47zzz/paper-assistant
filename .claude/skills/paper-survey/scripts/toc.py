#!/usr/bin/env python3
"""Section headings of an arXiv paper (taxonomy prior from a survey's table of contents).

Usage: python3 -I toc.py 2302.00487 [--max 80] [--no-pdf]

1. Verifies the id via the arXiv API (free) → title/year; exits 1 with {"exists": false} if unknown.
2. Tries https://arxiv.org/html/<id> (checks for a real <article>), then ar5iv, then (optional) the PDF via
   `pdftotext` with a numbered-heading regex. Output: {arxiv_id, exists, title, year, source, headings[]}.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from html.parser import HTMLParser

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

SKIP = re.compile(r"^(references|bibliography|acknowledg|appendix$|abstract|contents|table of contents|author contributions|ethics statement|reproducibility|instructions for reporting|report issue)", re.I)
NUM_RE = re.compile(r"^((?:\d+(?:\.\d+)*\.?)|(?:[IVXLC]+(?:-[A-Z](?:\d+)?)?\.?)|(?:[A-Z](?:\.\d+)*\.?))\s+(?=\S)(.*)$")


class Headings(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list = []
        self._cur = None
        self._buf: list = []
        self.has_article = False

    def handle_starttag(self, tag, attrs):
        if tag == "article":
            self.has_article = True
        if tag in ("h2", "h3", "h4") and self._cur is None:
            cls = dict(attrs).get("class") or ""
            self._cur = (tag, cls)
            self._buf = []

    def handle_endtag(self, tag):
        if self._cur and tag == self._cur[0]:
            text = " ".join("".join(self._buf).split())
            tag_, cls = self._cur
            self._cur = None
            if not text or len(text) > 160:
                return
            if "ltx_title" in cls or "ltx_title" in cls or not cls or "section" in cls.lower():
                m = NUM_RE.match(text)
                num, title = (m.group(1), m.group(2)) if m and len(m.group(2)) > 1 else ("", text)
                self.out.append({"level": int(tag_[1]) - 1, "number": num.rstrip("."), "title": title, "cls": cls})

    def handle_data(self, data):
        if self._cur is not None:
            self._buf.append(data)


def parse_html(html: str) -> tuple[bool, list]:
    p = Headings()
    try:
        p.feed(html)
    except Exception:
        pass
    heads = [{k: h[k] for k in ("level", "number", "title")} for h in p.out if not SKIP.search(h["title"])]
    return p.has_article and len(heads) >= 3, heads


def pdf_headings(aid: str, max_n: int) -> list:
    if not shutil.which("pdftotext"):
        return []
    d = os.path.join(C.CACHE_DIR, "pdf")
    os.makedirs(d, exist_ok=True)
    pdf = os.path.join(d, aid.replace("/", "_") + ".pdf")
    if not os.path.exists(pdf):
        raw, _, _ = C.http("https://arxiv.org/pdf/%s" % aid, cache=False, headers={"Accept": "application/pdf"})
        with open(pdf, "wb") as f:
            f.write(raw)
    try:
        txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True, timeout=120).stdout
    except Exception as e:
        C.log("pdftotext failed: %s" % e)
        return []
    heads = []
    for line in txt.splitlines():
        m = re.match(r"^\s{0,4}(\d{1,2}(?:\.\d{1,2}){0,2})\.?\s+([A-Z][A-Za-z0-9 ,:&/\-()']{2,80}?)\s*$", line)
        if m and not SKIP.search(m.group(2)) and not re.search(r"\d\s*$", m.group(2)):
            num = m.group(1)
            heads.append({"level": num.count(".") + 1, "number": num, "title": m.group(2).strip()})
    # keep monotone-ish numbering only (drop table rows etc.)
    out, last_top = [], 0
    for h in heads:
        top = int(h["number"].split(".")[0])
        if top < last_top or top > last_top + 2:
            continue
        last_top = max(last_top, top)
        out.append(h)
        if len(out) >= max_n:
            break
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("arxiv_id")
    ap.add_argument("--max", type=int, default=80)
    ap.add_argument("--no-pdf", action="store_true", help="skip the pdftotext fallback")
    C.add_common_args(ap)
    a = ap.parse_args()
    C.apply_common_args(a)
    aid = C.arxiv_id_from(a.arxiv_id) or a.arxiv_id.strip()
    meta = {}
    try:
        ents = C.arxiv_by_ids([aid])
        if ents:
            meta = ents[0]
    except C.HTTPFail as e:
        C.log("arXiv lookup failed: %s" % e)
    if not meta:
        C.emit({"arxiv_id": aid, "exists": False, "headings": [], "source": "none"})
        sys.exit(1)
    out = {"arxiv_id": aid, "exists": True, "title": meta["title"], "year": int(meta["published"][:4]), "is_survey": C.is_survey_title(meta["title"]),
           "source": "none", "headings": []}
    for src, url in (("arxiv-html", "https://arxiv.org/html/%s" % aid), ("ar5iv", "https://ar5iv.labs.arxiv.org/html/%s" % aid)):
        try:
            html = C.http_text(url, headers={"Accept": "text/html"})
        except C.HTTPFail as e:
            C.log("%s failed: %s" % (src, str(e)[:100]))
            continue
        ok, heads = parse_html(html)
        if ok:
            out["source"], out["headings"] = src, heads[: a.max]
            break
        C.log("%s: no converted article (%d headings)" % (src, len(heads)))
    if not out["headings"] and not a.no_pdf:
        heads = pdf_headings(aid, a.max)
        if heads:
            out["source"], out["headings"] = "pdf", heads
    out["n"] = len(out["headings"])
    out["top_level"] = [h["title"] for h in out["headings"] if h["level"] == 1]
    C.emit(out)


if __name__ == "__main__":
    main()
