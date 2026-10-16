# interaction.md — primers, the narrowing question, and a worked example

The narrowing step exists because a newcomer cannot choose between directions they have never heard
of. The primer's job is to give them *just enough* to decide — not to teach the field. Think of a
senior labmate answering "what are people doing in XAI these days?" in 20 seconds per direction.

Language: primers, lead-ins and question options are conversation, so they follow the user's language
(the examples below are 繁中; for an English-speaking user write the same in English, ≤ 60 words). Fields
that are stored in the app (`why`, `tldr`, `reason`, `keywords`, topic `name`, `direction.name`, the stored
`direction.primer`, `summary`) are always English — see SKILL.md.

## 1. Writing a primer (user's language, 2–3 sentences, ≤ 90 characters)

Sentence 1 — **what it is**, concretely (name the artefact: 「對已訓練好的模型事後算每個特徵的貢獻」,
not 「研究可解釋性」). Sentence 2 — **why it matters / who uses it** (one real stake: 醫療審核、除錯、法規).
Sentence 3 — **what a newcomer would actually do** in the first month (重現 SHAP 在表格資料上的結果、
比較 Grad-CAM 和 Integrated Gradients 的 faithfulness…). Optional half-sentence: the open problem.

Style: the user's language (繁體中文 in these examples), technical terms stay in English (SHAP, saliency, counterfactual), no hype words
(「革命性」「至關重要」), no markdown inside the primer. Each primer must mention the representative
paper's contribution implicitly or explicitly so the user can connect the card to the paper.

Direction card (what you compute; the question shows a compressed form):

```
name_en:    Post-hoc feature attribution
name_zh:    事後特徵歸因
primer_zh:  對已訓練好的模型，事後計算每個輸入特徵對單一預測的貢獻（SHAP、LIME、Integrated Gradients、Grad-CAM）。
            是工業界最常用的 XAI 工具，也是法規「解釋權」討論的技術基礎。入門通常從在表格與影像資料上重現 SHAP/Grad-CAM、
            再比較不同方法的 faithfulness 開始。
rep_paper:  Arrieta et al. 2019, "Explainable Artificial Intelligence (XAI): Concepts, taxonomies…" (arXiv 1910.10045, 10 194 cites)   ← from probe output
activity:   keywords SHAP / lime / Grad-CAM all in the top-20; trend rising (arXiv 2 981 hits 2025–26 vs 1 714 in 2023–24)
difficulty: 1
fit_note:   profile 說有 PyTorch 經驗、沒做過 XAI → 最容易上手的一條
```

Representative paper rule: it must be a row in `probe.json` (`openalex.top_sample`, `recent_surveys`) or
in a `search.py` result. If a direction has no representative paper in the results, either run one
`search.py` query for it (10 credits) or drop the direction — never fill the slot from memory.

## 2. The AskUserQuestion

Use the tool once, multi-select, after a 2–3 line lead-in in chat that states the breadth evidence in
numbers (users trust the narrowing more when they see why it is needed):

> 「explainable AI」在 OpenAlex 2018–2026 有約 10 萬篇、arXiv 近兩年 2 981 篇、前 100 名高引用裡就有 31 篇綜述，
> 直接挑 8 篇會很隨機。我先把領域分成 6 個方向，每個附一段入門說明，你選 1–2 個我再往下挖。

Question text (繁中, one line):
`你最想先進入哪個方向？（可選 1–2 個；不確定就選「幫我選最適合入門的」）`

Options — one per direction, label ≤ 12 chars (the 繁中 name), description = primer + one metadata line:

```
label:       事後特徵歸因
description: 對已訓練好的模型事後算每個特徵對預測的貢獻（SHAP/LIME/Grad-CAM）… ｜ 代表作：Arrieta 2019 (10k 引用) ｜ 熱度：高、上升 ｜ 難度 ★☆☆ ｜ 適合你：PyTorch 經驗即可
```

Always append two fixed options:
* `再細分這個方向` — description: 「先選一個方向，我再把它拆成更細的子方向給你挑（最多再一輪）」
* `幫我選最適合入門的` — description: 「我依照熱度、入門難度和你的背景直接決定，並說明理由」

Constraints: 4–7 directions + the two fixed options; `multiSelect: true`; if the user picks > 2
directions, keep the first two and say so. If they pick 「再細分」 together with a direction, recurse on
that direction (OR-join its keywords into new probe queries); if alone, ask which one in a follow-up with
the same options minus the fixed ones.

After the answer, restate the choice in one line and continue without another question unless the
direction is still broad (`probe.py` on the expanded queries says `broad` again) — then one more round
at most. On the second 「再細分」 or a second `broad`, choose yourself and explain.

For `borderline` verdicts use the same tool but with 2–3 directions and the lead-in 「這個題目中等寬，
有兩三條常見路線，你偏哪一條？」; skip entirely if the request already names a method/setting.

When invoked without text, the first question is 「要我調查哪一個？」 with one option per open request
(label = request text truncated to 12 chars, description = full text + created date).

## 3. Worked example — 「我最近想做 explainable AI」 (probe run 2026-10-08)

Probe signals: count 102 431; primary topics XAI 14 %, Ethics & Social Impacts 5 %, AI in Healthcare
4 %, …; keywords: explainable AI, SHAP, explainability, model interpretability, large language models,
lime, algorithmic bias, AI governance, trust in AI, clinical decision support, Grad-CAM; OpenAlex topic
T12026 keywords: counterfactual explanations, post-hoc explanation, feature attribution, neural network
interpretability, black-box models; 31 surveys in the top 100, 14 recent; arXiv trend rising.
Taxonomy prior: `toc.py` on the most-cited arXiv survey in the sample.

Directions (names only here; each needs the full card):

| # | 繁中 | EN | primer gist | rep. paper (from results) | act. | diff |
|---|---|---|---|---|---|---|
| 1 | 事後特徵歸因 | Post-hoc feature attribution | SHAP/LIME/Grad-CAM 式歸因；最常用；先重現再比 faithfulness | Arrieta 2019 survey, 1910.10045 | 高/升 | 1 |
| 2 | 反事實與因果解釋 | Counterfactual & causal explanations | 「改哪些輸入會翻轉預測」；法規與 recourse；跑表格資料反事實生成 | pick from `search.py "counterfactual explanations"` | 中 | 2 |
| 3 | 內在可解釋模型 | Intrinsically interpretable models | concept bottleneck、prototype、稀疏模型；設計上就可讀；重現 CBM | from results | 中/升 | 2 |
| 4 | 機制可解釋性 (LLM) | Mechanistic interpretability | 讀 transformer 內部電路、SAE；LLM 安全熱點；跑開源 SAE 工具 | from results (keywords: LLMs) | 高/升 | 3 |
| 5 | 解釋的評估與人因 | Evaluation & human factors of explanations | 解釋是否真的幫到人；user study + faithfulness 指標 | "Does the Whole Exceed its Parts?" 2006.14779 (717 cites) | 中 | 2 |
| 6 | 領域應用（醫療） | XAI for healthcare | 臨床決策支援的解釋；資料集與審核流程 | from `recent_surveys` (healthcare systematic review) | 高 | 1 |

Lead-in + question as in §2. Suppose the user picks 1 and 4 → say 「好，先以『事後特徵歸因』為主軸，
把 LLM 機制可解釋性的 1–2 篇當延伸」, then Stage 4 with queries like `feature attribution saliency
methods`, `SHAP LIME Integrated Gradients evaluation`, `explainable AI survey attribution`, plus one
`mechanistic interpretability sparse autoencoders` query for the tier-3 extension. Surveys first
(Arrieta 2019 as tier 1), then the method papers the snowball shows as co-cited (LIME, SHAP, Integrated
Gradients, Grad-CAM — *only if they appear in the results*), then 2 recent evaluation/LLM papers for
era balance.

## 4. Report wording (Stage 6; 繁中 example — follow the user's language; `<persona_name>` is `settings.persona_name` from `library.py context`, default Yan)

```
<persona_name> 回來了 — 「事後特徵歸因」書單 8 篇（約 9.5 小時）

| 層級 | 簡稱 | 年份 | 發表 | 為何讀 |
| 1 | Arrieta 2019 | 2019 | Information Fusion | 先用這篇建立 XAI 的分類地圖，之後每篇都能對到位置 |
| 1 | LIME | 2016 | KDD 2016 | … |
…
已送進 論文書房 → 探索 收件匣（survey sv_20261008_explainable-ai-3f2a）。
開啟：<書庫資料夾>/start.sh（或 --browser）→ 探索 → 接受，會自動排程（每 2–3 天一篇）並下載 PDF。
書架上已有的相關論文：無。
```

## 5. Topic placement question (Stage 0, only when (a) vs (b) is unclear)

Lead-in (one line, with the evidence): 「書架上已有主題『Explainable AI』（12 篇，含子題『Attribution methods』）。
這次的『concept-based explanations』看起來是它的子領域，但也可以獨立成主題。」

Question: `這批論文要放在哪裡？`

Options (single-select, exactly two + optional third):
* label `歸入既有主題：Explainable AI` — description 「成為它的子題『Concept-based explanations』；書架上重疊的
  論文（如 TCAV）會同時出現在這個子題，地圖上以交集呈現」
* label `建立新主題：概念式可解釋性` — description 「獨立書架與顏色；重疊的論文會同時屬於兩個主題」
* (if several existing topics could fit) one more `歸入既有主題：…`

Decision defaults when the user doesn't care (「都可以」): sub-area → reuse; overlap → new topic. Record
the choice in `summary` (「主題歸屬：…」). Never ask this when `context.topics` is empty or clearly
unrelated — just create the topic.

Papers already in the library that you keep in the list: say so in the report table (備註 = 已在書架 / "on shelf")
and in `summary`; the app will show them in both topics without duplicating the PDF or notes.
