# pipeline.md — stage details, thresholds, rubric, stopping rules

Companion to SKILL.md. Numbers here are defaults; the probe prints its raw signals so you can override.

## Contents
1. Query analysis & reformulation
2. Breadth probe: signals, thresholds, overrides
3. Narrowing: building directions, recursion, budget
4. Focused retrieval: sources, dedupe, seeds
5. Snowballing
6. Relevance judging rubric
7. Selection: survey-first, era balance, tiers, reading order
8. Stopping rules
9. Credits & rate-limit budget
10. Failure modes and what to do

---

## 1. Query analysis & reformulation

Extract a structured object before touching any script (Asta Paper Finder "query analyzer"):

```
intent:        topic-set (default) | specific-paper ("the LIME paper") | metadata (author/venue/year)
topic_en:      "prompt-based class-incremental learning with pre-trained ViT"
sub_criteria:  ["class-incremental", "prompt tuning", "frozen pre-trained ViT"]   # judged separately later
constraints:   {years: 2019-2026, venue: null, must_have_code: false}
modifiers:     recent | classic | central | beginner | theory | applied | with-code
target_n:      8 (5–12)
```

Reformulations (Undermind prompt, verbatim spirit): "generate 5 unique keyword searches … no boolean
operators … some broad and some narrow, some very short, some slightly longer". Always include:
* one short head term (`explainable AI`)
* one survey-seeking query (`explainable AI survey`, `interpretability review`) — PaSa's "preferably surveys"
* one narrow/technical phrasing using field vocabulary (`post-hoc feature attribution saliency`)
* optionally one synonym set (`interpretable machine learning`, `XAI`)

For arXiv the script ANDs tokens on `all:`; quoting a query (`"\"concept bottleneck models\""`) makes
it a phrase on title/abstract. OpenAlex `title_and_abstract.search` does stemming; keep queries ≤ 8 words.

Specific-paper intent → skip probe; run `search.py` with the title as a quoted query and return that
paper plus its 2–3 most co-cited neighbours from `snowball.py`.

## 2. Breadth probe

`probe.py` signals and the verdict rule (any → `broad`):

| signal | source | broad if |
|---|---|---|
| `count` | OpenAlex `title_and_abstract.search` count | > 3000 |
| `topics_ge_5pct` | `group_by=primary_topic.id` | ≥ 4 topics with share ≥ 5 % |
| `disjoint_recent_surveys` | surveys (title regex) in the 100 most-cited, last 4 years, pairwise title-token Jaccard < 0.2 | ≥ 3 |
| whole-topic match | `/autocomplete/topics` hit with `works_count` > 20 000 | yes |

`narrow` if count < 400 and ≤ 2 topics ≥ 5 % and ≤ 1 recent survey; otherwise `borderline`.

Overrides you should make:
* Request names a specific method/setting/dataset/model family (e.g. "DualPrompt-style methods",
  "CLIP continual learning on DomainNet") → treat as narrow even if `borderline`.
* `count` is inflated by a common phrase (e.g. "attention" , "transfer") → look at `primary_topics`:
  if ≥ 60 % sits in one topic the field is coherent; use `borderline` behaviour.
* The user explicitly asked for a broad overview ("我想了解整個領域") → still show directions, but
  offer 「給我跨方向的總覽書單」 as an extra option; then select 1 survey per direction + 2 seminal.

Live reference points (2026-10-08): "explainable AI" 2018–2026 → 102 431 works, 31 surveys among the
top 100, arXiv 5 974 hits, trend rising → `broad`. "class-incremental learning pre-trained vision
transformer prompt" 2020–2026 → 25 works, 1 topic (96 %), 0 surveys → `narrow`.

## 3. Narrowing (broad → directions)

Inputs, in order of trust:
1. Section headings of the 1–2 most-cited recent surveys with arXiv ids (`toc.py`). Level-1/2 headings
   under "Methods/Approaches/Taxonomy" are the field's own taxonomy (SurveyForge: human survey outlines
   are the best structural prior).
2. OpenAlex `topics[]` (name, description paragraph, keywords, works_count) and `openalex.keywords`.
3. `primary_topics` shares — tell you where the mass is, and which neighbours are *applications*
   (healthcare, education, security) rather than research directions.

Build 4–7 directions. Good directions are **mutually exclusive, each with ≥ 1 representative paper in
the results, and phrased as something one can work on** ("post-hoc attribution for vision models"),
not as a theme ("ethics"). Merge directions whose keyword sets overlap > 50 %. Prefer method-level
directions over application domains unless `settings.profile` is domain-specific (a clinician gets
"XAI for medical imaging").

Direction card fields (all required): `name_en`, `name_zh`, `primer_zh` (2–3 sentences), `rep_paper`
{id, title, year, citations} from results, `activity` (share of hits or works_count + `arxiv.trend`),
`difficulty` 1–3, `fit_note` (vs. profile). See interaction.md for wording.

Recursion (Knowledge Navigator "subtopic expander"): on 「再細分」 take the chosen direction's keywords
(from topic keywords / survey subsection titles), OR-join 3–5 of them into 2–3 new queries, re-run
`probe.py`, re-classify. Maximum two narrowing rounds in a session; after that pick the best direction
yourself and say so.

## 4. Focused retrieval

`search.py --query q1 --query q2 --query q3 --years Y1-Y2 --max 60`:
* arXiv: 30 per query by relevance (free, 3 s spacing).
* OpenAlex: 50 per query sorted by `cited_by_count:desc` (10 credits); add `--recent` for a second page
  by `publication_date:desc` when the modifier is "recent" (10 more credits per query).
* S2: `POST /paper/batch` enrichment for every arXiv id / DOI (citationCount, influentialCitationCount,
  tldr, venue, publicationTypes). Works keyless; the script backs off on 429 and continues without it.
  `S2 /paper/search` only runs with `S2_API_KEY`.
* Dedupe: arXiv id, DOI, OpenAlex id, or title Jaccard ≥ 0.9 (preprint + published versions merge;
  `hits` counts how many sources/queries found it).
* `--cat cs.LG --cat cs.CV` restricts arXiv categories when a common phrase pulls in other fields.

Pick 2–3 **seeds** for snowballing: the best survey (if any) + the 1–2 most-cited method papers that
are clearly on-direction. Prefer seeds with arXiv ids (S2 edges work best); DOI seeds work too.

## 5. Snowballing

`snowball.py --ids a,b,c --depth 1 --max 40 --exclude-json /tmp/search.json`:
* S2 `/references` + `/citations` (≤ 100 each per seed, keyless OK). Fallback per seed: OpenAlex
  `referenced_works` (+1 credit per 50) and `cites:W…` (1 credit). `--exclude-json` lets the script
  resolve arXiv seeds through the DOI/OpenAlex id it already knows, and flags `already_found`.
* Rank = `seed_links` (how many seeds connect to it: co-citation / bibliographic coupling), then
  `influential_links` (S2 isInfluential), then citations/year. `generic: true` marks infrastructure
  papers (≥ 10k citations, PyTorch/ImageNet) — skip them.
* Backward edges (`ref`) surface foundations/classics; forward edges (`citer`) surface the newest work.
  Use `--depth 2` only for tiny topics (< 15 candidates after search).
* Paper Finder snowballs only from its top two relevance tiers; do the same — seeds must be
  perfectly/highly relevant, never a "somewhat" paper.

## 6. Relevance judging rubric

Per candidate, decision first, then rationale (PaSa selector; Paper Finder 4 tiers). Judge against the
**chosen direction + the user's goal**, per sub-criterion, then combine:

| tier | definition | example (direction: prompt-based CIL on frozen ViT) |
|---|---|---|
| perfectly | satisfies all sub-criteria; a reader of this list must know it | L2P, DualPrompt, CODA-Prompt |
| highly | satisfies the main criterion, misses a minor one, or is the direction's survey | a CIL survey with a prompt section; MoE-view of prompt CL |
| somewhat | adjacent setting (domain-incremental, LoRA instead of prompts) or application | S-Prompts (DIL), PILoRA |
| not | shares words only | "prompt tuning for dialog state tracking" |

Write the rationale in English, ≤ 60 chars, concrete ("first prompt-pool method", "only an application to medical imaging").
Judge from abstract/tldr, not the title. Era balance and venue enter only *after* tiering.

## 7. Selection

Order of operations (Keshav → SurveyForge → Paper Finder, see lineage.md):
1. **Survey first**: 1 survey (2 if the field is big and they differ in angle), tier 1, `order` 0.
   If no survey exists, say so in `summary` and start from the most co-cited seminal paper.
2. **Seminal**: 2–4 papers with the highest `seed_links` / citations-per-year among perfectly-relevant.
3. **Recent core**: top-venue work from the last 2–3 years (perfectly/highly).
4. **Era balance** (SurveyForge temporal reranking): bucket perfectly/highly candidates into 2-year
   windows; allocate slots ≈ proportional to each window's count, min 1 per non-empty window, max
   50 % from any window. Within a window prefer citations/year, then venue.
5. **Diversity**: ≤ 2 papers per first author/group; ≤ 1 application paper unless the profile is applied.
6. **Already in library** (`paper_ids` from `context`): include when genuinely core to the direction
   (they are the bridges between topics on the 地圖 page); `why` gets "Already on the shelf; also filed under this topic.", the
   summary names them, the report flags `already_in_library`. Don't let them exceed ~1/3 of the list —
   the user asked for new reading, not a re-shelving.
7. Fill to `target_n`; keep 2–4 runners-up as `selected: false`.

Tier assignment: 1 = surveys + foundational (what every paper in the direction cites); 2 = strong
methods/variants a practitioner needs; 3 = frontier (< 12 months, few citations), adjacent, optional.
`order`: tier 1 by chronology, then tier 2 by chronology, then tier 3. `est_minutes`: survey 120, method
60, short/workshop/position 40 (+15 if difficulty 3). `difficulty`: 1 readable with ML basics,
2 needs the direction's vocabulary, 3 heavy theory/proofs or assumes several prior papers.

### Keywords and related (knowledge map inputs)

* `keywords` (≤ 12, lowercase; arXiv categories keep `cs.LG` form): start from the script's merged list
  (OpenAlex `keywords` + `primary_topic`, arXiv categories, S2 `fieldsOfStudy`), then add 2–4 terms you
  judge from the abstract that name the *mechanism* ("prompt pool", "null space projection",
  "counterfactual recourse"). Shared keywords across a batch become the cluster label in the app, so
  prefer field vocabulary over paraphrases, and reuse the same spelling across candidates.
* `related`: run `snowball.py --ids <all selected ids> --max 0 --per-seed 300` once after selection
  (2 S2 calls per paper) and pass that file plus the exploratory snowball output to `ingest.py --edges`.
  `related` only keeps ids that are candidates or library papers; the count goes into `lineage`.

## 8. Stopping rules

* Stop judging when you have ≥ `target_n` perfectly/highly papers **and** have looked at the full
  search output + the top 40 snowball hits — or when ~80 candidates have been judged (Undermind: median
  τ ≈ 80; beyond that discovery flattens).
* One more search round only if < `target_n` perfectly/highly after the first — reformulate from the
  *boundary* papers (highly-relevant papers least similar to the query; Paper Finder follow-up rule).
  Maximum 2 search rounds + 1 snowball per direction.
* Narrowing recursion: ≤ 2 rounds.

## 9. Credits & rate limits

| source | cost | pacing (enforced by common.py) |
|---|---|---|
| arXiv API | free | ≥ 3 s between calls (also across script invocations) |
| OpenAlex search-type (`*.search`, `group_by` on a search) | 10 credits | 0.25 s |
| OpenAlex filtered list / single entity | 1 / 0 credits | |
| Semantic Scholar batch, references, citations | free, keyless | ≥ 1.1 s; backoff 2–16 s on 429 |
| arXiv HTML / ar5iv | free | 3 s |

Keyless OpenAlex budget 1000/day. Typical run: probe 50–60 → search 20–40 → snowball 0–5 ≈ 100.
The scripts print `openalex_usage` (`credits` this run, `remaining`, `today_total`) in every output;
24 h cache (`~/.cache/paper-survey/`) makes repeats free. `--fresh` bypasses the cache.

## 10. Failure modes

| symptom | cause | action |
|---|---|---|
| probe count = 0 | phrase too long / rare words | shorten to 2–4 head words; retry |
| S2 429 all the way | shared anonymous pool saturated | script continues without S2; citation counts come from OpenAlex; for `related`, retry the edge run later or pass `--no-s2` (OpenAlex fallback, 1–3 credits per paper) |
| OpenAlex 429 with `remaining 0` | daily budget spent | `--no-openalex` for search (arXiv only); S2 snowball still works; or set `OPENALEX_API_KEY` |
| survey has no arXiv id | journal-only survey | use `toc.py` on another one, or skip taxonomy prior and rely on topics/keywords |
| `ingest.py` title mismatch | wrong id copied, **or** OpenAlex attached a wrong arXiv location to a work (seen live: W… titled "BNAI, NO-TOKEN…" carrying arXiv 2201.11903, which is actually the chain-of-thought paper) | copy `id`/`title` from script output; prefer candidates whose `sources` include `arxiv` or `s2`; drop OpenAlex-only candidates whose arXiv id you cannot confirm |
| server up but different root | testing against a copy | scripts fall back to file mode automatically; `--api` with a mismatching root refuses |
