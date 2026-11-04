# RAG quality report

**Date:** 2026-11-04 · **Command:** `npm run db:start && npm run eval` · **Generated numbers:** [evals/RAG_REPORT.md](evals/RAG_REPORT.md), [evals/results/rag-latest.json](evals/results/rag-latest.json)

## Pipeline audited
| Stage | Implementation | Finding |
| --- | --- | --- |
| PDF parsing | `unpdf`, page by page; magic bytes, 10 MB, 50 pages; encrypted, scanned and truncated files rejected | OK (`rag.test.ts`, `documents.spec.ts`) |
| Page metadata | Each chunk stores `page_start`/`page_end` from the page it came from | OK: page attribution correct in every retrieved result |
| Chunking | Page-faithful chunks of about 600 tokens with overlap | OK for these fixtures (one chunk per page) |
| Embeddings | OpenAI `text-embedding-3-small` only when an OpenAI key exists | **Not active**: no key, so retrieval is lexical only |
| Retrieval | `search_course_chunks` (SECURITY INVOKER, RLS and owner filter): lexical rank and coverage, fused with vector similarity (RRF) when embeddings exist; evidence threshold, else abstain | Measured below |
| Answer generation | Structured answer: facts with source ids, kept separate from suggestions | Live model **not measured** (no key) |
| Citation check | **New:** a fact is kept only if its cited, unflagged passage supports it ([claim-support.ts](src/lib/rag/claim-support.ts)) | Measured below |
| Source rendering | Signed 120 s link to the exact page, issued after an ownership lookup | OK (E2E) |

## Dataset
Synthetic, committed and reproducible: [scripts/make-rag-fixtures.ts](scripts/make-rag-fixtures.ts) creates a six-page biology lecture,
an errata sheet that **contradicts** two of its facts, and a red-team document. [evals/rag/gold.json](evals/rag/gold.json) has 18
questions with every answering page listed: 8 direct, 2 paraphrased, 1 multi-page, 2 conflicting, 1 ambiguous and 4 that must abstain
(one of them is answered in the student's *other* course, so it tests course scoping).

## Results (lexical retrieval, k = 3)
| Metric | Value |
| --- | --- |
| Recall@1 / Recall@3 (single-answer questions) | **90.9% / 90.9%** (10 of 11) |
| Precision@3 (answerable questions) | 0.75 |
| MRR | 0.909 |
| Multi-page and conflicting: every required page in the top 3 | 2 of 3 |
| Correct abstention (no supporting material) | **4 of 4** |
| False abstentions | 0 |
| Wrong page attributed to a retrieved passage | 0 |
| Another student's course | **0 passages** |
| Deleted document | **0 passages, 0 chunks, 0 stored files** after deletion (1 passage before) |
| Retrieval latency p50 / p95 | 2–4 ms / 3–5 ms (local) |
| Tokens and cost | 0 tokens, $0 (runs in Postgres) |

**Reproducible failures (not tuned away):**
- **G9** "Which organelle is the powerhouse that makes the cell's energy molecules?" shares no words with the mitochondria
  page, so lexical search misses it. Semantic embeddings would be needed to fix this.
- **G11** "Compare cellular respiration with photosynthesis" retrieves the respiration page and the revision page, but not
  the photosynthesis page, whose body never uses the word.

The conflicting cases (G12 ATP yield, G13 test day) retrieve **both** the original page and the errata page, so the
student sees the conflict instead of one silently winning.

## Expanded gold set: 51 questions over three courses (2026-11-05, keyword only so far)
The set grew from 18 to 51 questions ([evals/rag/gold.json](evals/rag/gold.json)): the biology course gained 9, and two
more synthetic courses were added, statistics (8, on the Module 4 notes) and chemistry (16, a new 10-page fixture with a
teacher update that conflicts with its revision guide). By type: 21 direct, 11 paraphrase, 6 multi-page, 4 conflicting,
2 ambiguous, 7 abstain. Each query searches only its own course. The questions were written before the first run and
were not changed after it.

The first run had no embedding key (keyword only), so it went to [evals/RAG_REPORT_LEXICAL.md](evals/RAG_REPORT_LEXICAL.md);
the eval now writes keyword-only runs there so they can't replace the live-embedding report.

| Metric (keyword only, 51 cases) | Value |
| --- | --- |
| Recall@1 / Recall@3 (single-answer cases) | 79.4% / 88.2% |
| Precision@3 | 0.72 |
| MRR | 0.833 |
| Multi-page and conflicting: all required pages in top 3 | 9 / 10 |
| Correct abstention | 7 / 7 |
| By type (correct) | direct 21/21, paraphrase 7/11, multi-page 5/6, conflicting 4/4, ambiguous 2/2, abstain 7/7 |

Misses: G9 and G11 (as before), G31 "If two variables move together, does one cause the other?" and G32 "Is it safe to
predict values far beyond the data I collected?" (both abstained: no shared words with page 3), G42 "when an atom gives up
electrons" (the redox page says "loss"). All five are paraphrases with little word overlap, which is what embeddings are
for; the hybrid run on all 51 is **not run yet** (it needs the embedding quota).

## Results with real embeddings (hybrid: keyword + gemini-embedding-001), 2026-11-04
Same 18 questions, same fixtures, evidence bar 0.6 for Gemini vectors:

| Metric | Keyword only | Hybrid with Gemini embeddings |
| --- | --- | --- |
| Recall@1 / Recall@3 | 90.9% / 90.9% | 90.9% / **100%** |
| Precision@3 | 0.75 | 0.774 |
| MRR | 0.909 | **0.939** |
| Multi-page and conflicting: all required pages in top 3 | 2 / 3 | **3 / 3** |
| Correct abstention | 4 / 4 | **4 / 4** (no false answers at the 0.6 bar) |
| Latency p50 / p95 | 2–4 / 3–5 ms | 520 / 652 ms (one embedding call per search) |

Both reproducible misses are fixed: G9 (the "powerhouse" paraphrase) now finds the mitochondria page at rank 3, and G11 (respiration vs
photosynthesis) retrieves both pages. Embedding calls have their own free-tier quota, separate from the chat model's.

## Claim-to-citation support
A source id appearing in the context is **not** treated as verification. Before an answer is shown, each fact must:
cite only sources retrieved in this run; cite no passage flagged as prompt injection; reproduce any quoted text exactly;
use no number that is missing from the passage; have at least 70% of its content words (stemmed) present, with no
word that the passage negates; and not swap one side of an opposite pair ("double"/"half", "increase"/"decrease",
"raise"/"lower", "high"/"low", "maximize"/"minimize", "identical"/"different", "before"/"after" and 11 more, listed in
`OPPOSITES` in `src/lib/rag/claim-support.ts`) for the other side used in the passage sentence the claim most resembles.

Measured against 30 labelled claims in [evals/rag/claims.json](evals/rag/claims.json) (14 supported, 16 not; labelled by the
developer from the source text, **not yet reviewed by an independent person**):

| | Predicted supported | Predicted unsupported |
| --- | --- | --- |
| Actually supported (14) | 14 | 0 |
| Actually unsupported (16) | 0 | 16 |

Precision 1.0 and recall 1.0 (2026-11-05; before the opposite-word rule: 0.938 / 1.0 on the first 24, with C20 accepted).
Caught: wrong numbers, wrong page, invented facts, fabricated quotes, injected citations, a dropped negation
("Correlation proves causation"), mostly-new wording, and swapped opposites: C20 ("*double* the chromosome number"
against *half*), C25 (raising vs lowering), C26 (low vs high), C27 (maximizes vs minimizing), C28 (mitosis "different"
against "identical", while the next sentence says "different" about meiosis).

Be careful with that score: C25–C30 were written together with the rule, so they show that it works as designed, not
how often it fires on real answers. The rule only knows the listed word pairs; a swap expressed another way ("twice
as many" vs "half as many" works, "gains" vs "gives up" does not) still passes. It compares against the single
best-matching sentence, so a sentence that uses both words of a pair never counts as a contradiction.

What this means: the check is a deterministic structural guard that removes unrelated and invented citations. It does
**not** prove that a claim is a correct reading of its passage. No LLM-as-judge is used, and it would only be a
supplement if added later.

## Improvements made in this phase
1. Claim-support verification in `verifyAnswer` (unit `claim-support`, `runtime-gating`; eval B4).
2. Passages that address an AI ("ignore previous instructions", role spoofing, multilingual or encoded commands, "always
   cite …") are flagged when retrieved, shown to the model with a warning, and can't back a fact or a study item (eval B4).
3. The prompt now asks for facts phrased close to the passage's words, since unsupported facts are removed.

## Limitations and next steps
- Semantic recall now works with Gemini embeddings (see above); the 0.6 evidence bar was checked on this set only and should be re-checked on real course material.
- The 51-question set is still small, synthetic and written by the developer: good for regression checks, not a benchmark.
- Human review of the claim labels and of a sample of live answers is still to do once a model key exists.
