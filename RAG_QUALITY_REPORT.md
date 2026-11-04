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
use no number that is missing from the passage; and have at least 70% of its content words (stemmed) present, with no
word that the passage negates.

Measured against 24 labelled claims in [evals/rag/claims.json](evals/rag/claims.json) (12 supported, 12 not; labelled by the
developer from the source text, **not yet reviewed by an independent person**):

| | Predicted supported | Predicted unsupported |
| --- | --- | --- |
| Actually supported (12) | 12 | 0 |
| Actually unsupported (12) | **1 (C20)** | 11 |

Precision 0.938 and recall 1.0. Caught: wrong numbers, wrong page, invented facts, fabricated quotes, injected citations, a
dropped negation ("Correlation proves causation") and mostly-new wording. **Missed:** C20, "gametes with *double* the
chromosome number" against a passage saying *half*; antonyms aren't modelled.

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
- The 18-question set is small and synthetic: good for regression checks, not a benchmark.
- Human review of the claim labels and of a sample of live answers is still to do once a model key exists.
