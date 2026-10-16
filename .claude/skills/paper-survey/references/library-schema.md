# library-schema.md — what `ingest.py` expects (and what the server stores)

Source of truth: `<library root>/docs/ARCHITECTURE.md` §2–3 and `app/server.py` (`op_survey_add`,
`op_survey_decide`, `PAPER_FIELDS`). `ingest.py` imports the server's own whitelist when the library root
has `app/server.py`, so the lists below never drift.

## Survey object

```jsonc
{
  "request": "q_20261008_7f",            // id from library.py request-add (or null when none)
  "query":   "我最近想做 explainable AI",   // the user's words
  "topic":   { "id": "explainable-ai", "name": "Explainable AI", "zh": "可解釋 AI", "emoji": "🔍", "color": "#0ea5e9" },
  "direction": {
    "name":   "Post-hoc attribution for vision models",
    "primer": "2–3 English sentences (stored as the topic description in the app): what it is, why it matters, what a newcomer would do",
    "chosen_from": [ { "name": "…", "primer": "…", "count": 1234, "trend": "rising" } ]   // every option shown
  },
  "summary": "English, 3–5 sentences: what the direction is, why these papers, suggested reading order; mention related papers already on the shelf",
  "candidates": [ /* paper objects, see below */ ],
  "plan":    [ { "paper": "1602.04938", "planned": "2026-10-10" } ],   // optional; omitted → auto (1 paper / 2–3 work days)
  "lineage": "arxiv+openalex 4 queries (5974/561/… hits) → 112 unique → snowball 3 seeds (+254) → 61 judged → 8 selected"
}
```

Server-side: `status` is forced to `proposed`, `id` and `created` are generated (`ingest.py` makes a
readable id `sv_<date>_<topic>-<hex4>`), the request is set to `done` with `survey=<id>`, an
`activity` of type `survey` (+15 xp) and a message from Yan are added, and an SSE `assistant` event pops a
toast in the UI. Unknown extra top-level keys are preserved.

## Candidate (paper) object

Copy the object from `search.py` / `snowball.py` output and add the judgment fields. Fields outside the
whitelist (`citations_per_year`, `is_survey`, `sources`, `queries`, `hits`, `links`, `seed_links`,
`openalex_id`, `primary_topic`, `influential_citations`, `already_found`, `generic`) are **dropped** by `ingest.py`
with a warning — the server would reject them with 400.

| field | type | required | notes |
|---|---|---|---|
| `id` | str | yes | bare arXiv id (`1602.04938`, no version) preferred; else `doi:10.…`; else `oa:W…` |
| `title`, `year` | str, int | yes | from script output, never retyped |
| `arxiv` | str | arxiv **or** doi | `https://arxiv.org/abs/<id>` (auto-filled from an arXiv id) |
| `doi` | str | | bare DOI |
| `authors` | list[str] | | |
| `venue` | str | | "CVPR 2022", "NeurIPS 2024", "arXiv 2025" |
| `abstract`, `url`, `tldr` | str | | abstract auto-filled from arXiv during verification if empty |
| `short` | str | selected | "LIME", "Ribeiro 2016", "CODA-Prompt" — becomes the PDF filename suffix |
| `why` | str | selected | English, 1–2 sentences, specific to this user's goal |
| `interest` | str | selected | 註記, 繁體中文, one sentence ≤ 30 characters (English, ≤ 18 words, when `settings.assistant_language` is `en`): the paper's key conclusion / claim / manipulation on the point of the user's request it answers, without restating the request. One line under the title in the Library; the app infers one if it is missing |
| `tier` | int 1–3 | selected | 1 core / must-read · 2 advanced · 3 extension / frontier |
| `order` | int | | reading order, 0-based, across tiers |
| `difficulty` | int 1–3 | selected | |
| `est_minutes` | int | selected | 120 survey · 60 method · 40 short |
| `citations` | int | | from S2/OpenAlex |
| `tags` | list[str] | | optional, e.g. ["survey"], ["theory"] |
| `score` | float 0–1 | | your confidence; default 0.9 selected / 0.4 not |
| `selected` | bool | | default true; keep 2–4 runners-up as false |
| `reason` | str | | one short line for the card; defaults to `why` |
| `subtopic`, `phase`, `tags` | | | optional; `subtopic` defaults to slug(direction.name) on accept |
| `keywords` | list[str] ≤ 12 | yes (warned if empty) | short English terms, lowercase (arXiv categories keep case): script `keywords` (OpenAlex keywords + primary topic, arXiv `cs.*`, S2 fields) + 2–4 judged from the abstract. `ingest.py` lowercases, dedupes, truncates to 12; server caps at 20. Feeds the 知識雲圖 TF-IDF (×3 weight) and cluster labels |
| `related` | list[str] | filled by `ingest.py` | ids of OTHER papers in the candidate list or already in the library, linked by a citation edge (either direction). Computed from `--edges` files (snowball.py output); ids outside candidates ∪ library are dropped with a warning. Drawn as `related` edges in `/api/graph` |
| `topics`, `surveys` | list[str] | never set | memberships; `ingest.py` clears them and the server fills them on accept (`topics += topic.id`, `surveys += survey.id`, `sync_memberships`) |

Set by the scripts/server, do not set yourself: `topic` (= topic.id), `status` (`unread`), `source`
(`survey:<id>`), `added`, `pdf`, `note`, `planned`, `started`, `finished`, `progress`, `rating`,
`quick_note`, `questions`, `highlights`, `claims`, `minutes_read`, `last_opened`.

`ingest.py` fails (exit 2, nothing written) when: a block/field above is missing; ids duplicate; an
arXiv id does not exist; the arXiv title's token Jaccard with the candidate title is < 0.5; a plan entry
points at an unselected paper or a past date; a selected candidate lacks `short`/`why`/`tier`.

## What happens on Accept (`survey.decide`, done by the app)

Accepted candidates become `papers`. **Existing ids** keep the user's fields, gain tier/why/est_minutes
if empty, get the new topic appended to `topics[]`, the survey appended to `surveys[]`, `keywords` and
`related` merged (dedup), and the new `why` appended as `[Topic] …` — overlapping surveys are expected
(ARCHITECTURE.md §7). The UI may pass `topic_id` to file the survey under a different existing topic.
Otherwise the topic is created if missing (description = direction.primer,
origin_query = query), `direction.name` becomes a subtopic, papers are appended to the queue as
`queued`, plan dates become `planned` + a 09:00 reminder, and PDFs download for every arXiv paper.

## Minimal valid example

```json
{
  "request": null,
  "query": "我想做 prompt-based class-incremental learning",
  "topic": {"id": "continual-learning", "name": "Continual Learning", "zh": "持續學習", "emoji": "🔁", "color": "#7c5cff"},
  "direction": {"name": "Prompt-based CIL with pre-trained ViT", "primer": "Learns a small set of prompts on a frozen pre-trained ViT to absorb new classes without replaying old data; the core question is how prompt selection/composition avoids cross-task interference.", "chosen_from": []},
  "summary": "Starting from L2P, DualPrompt and CODA-Prompt established the two mainstream approaches; after 2024 the line turned theoretical. Read L2P → DualPrompt → CODA-Prompt in order, then pick one 2024 theory paper.",
  "candidates": [
    {"id": "2112.08654", "short": "L2P", "title": "Learning to Prompt for Continual Learning", "authors": ["Zifeng Wang", "Zizhao Zhang"], "year": 2021,
     "venue": "CVPR 2022", "arxiv": "https://arxiv.org/abs/2112.08654", "doi": "10.1109/CVPR52688.2022.00024", "citations": 1440,
     "tier": 1, "order": 0, "difficulty": 2, "est_minutes": 60, "score": 0.95, "selected": true,
     "why": "The first paper to use a prompt pool for rehearsal-free continual learning; every later prompt-based CIL method uses it as the baseline. Already on the shelf; also filed under this topic.", "reason": "Starting point of the direction",
     "tldr": "Learns a pool of prompts selected by a key-query mechanism on a frozen ViT.",
     "keywords": ["cs.CV", "cs.LG", "continual learning", "catastrophic forgetting", "prompt learning", "vision transformer", "prompt pool", "rehearsal-free"]}
  ],
  "lineage": "arxiv+openalex 2 queries (15/124 arXiv, 29/83 OpenAlex) → 92 unique → S2 snowball 2 seeds (254) → 1 selected (example)"
  // ingest.py appends: " | related: 24 citation edges → 6/6 candidates linked"
}
```
