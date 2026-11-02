# Development roadmap

Stages 0–3 are complete. The Stage 3 handoff reports Stage 2 complete and working. Stage 3 is verified with offline unit/integration/browser tests and a production build. Later stages describe acceptance targets, not implemented functionality.

| Stage | Scope | Acceptance criteria |
| --- | --- | --- |
| **0 — Complete: initialization** | Repository, environments, skeleton, docs | Versioned health endpoint returns the exact contract; CORS tests pass; frontend builds; local startup is documented and checked. |
| **1 — Complete: frontend/backend workflow** | Mock API and structured UI | Validated 20–20,000-character requests; typed deterministic mock service; real browser POST; mock warnings, structured output, sequential demo hints, loading, empty and error states; API/browser tests and build pass. |
| **2 — Complete: Groq integration** | Optional Groq Free + offline provider boundary | User reports complete and working. Offline fake default; async SDK; strict JSON/Pydantic; server-owned metadata; structured analysis and three hints; safe errors without retry/fallback; offline tests/build pass. Continued semantic review uses EVALUATION.md; no live call was made during Stage 3. |
| **3 — Complete: constraints and complexity** | Local extraction and heuristic growth engine | Safe notation grammar; contextual sizes/values; original evidence; per-case/test-count/aggregate scopes; time/memory context; nine guarded growth functions; conservative totals; explicit ambiguity; combined and independent offline endpoints; source labels and tentative discrepancies; 171 backend tests, 40 browser tests, build and docs pass. No added model calls or dependencies. |
| 4 — Hint quality and controls | Dedicated evaluation/refinement | Build on Stage 2's generated hints and existing reveal UI; independently review disclosure, pedagogical progression and correctness; refine safeguards based on evidence. No claim that prompt policy alone guarantees restraint. |
| 5 — Data and persistence | Curated dataset and conditional PostgreSQL | Record permitted sources/provenance; validate ingestion and deduplication; introduce PostgreSQL only for a demonstrated persistence need; test data workflows and migrations if added. |
| 6 — Similar-problem retrieval | BM25 or embeddings; optional vector store | Return verified identifiers and URLs from curated data; measure retrieval against an algorithmic relevance benchmark and baseline; use vector infrastructure only when justified. |
| 7 — Dedicated NLP models | Classifiers, CP embeddings, contrastive learning, reranking | Establish train/validation/test separation and leakage controls; record metrics and baselines; independently evaluate model improvements before integration. |
| 8 — Production quality | Security, caching, observability, CI/CD, deployment, UX | Review abuse and secret handling; define measurable reliability goals; validate deployment and rollback; test accessibility, caching correctness and failure monitoring; document operating costs and limitations. |

Stage 1 verification on 2026-11-02: 18 backend tests passed, 18 desktop/mobile browser tests passed, and the frontend production build passed. The real browser round trip verifies local CORS, validated mock JSON, rendering, and progressive reveal. Failure scenarios verify readable errors, input preservation, and retry. No LLM, database, secret, commit, or deployment was introduced.

Stage 2 offline verification on 2026-11-02: 54 backend tests passed, 24 desktop/narrow-viewport browser tests passed, and the frontend production build passed. All provider responses in tests were fake or SDK-transport mocks. No live request, key creation, purchase, account upgrade, paid fallback, commit, or deployment was performed.

Stage 3 verification on 2026-11-03: 171 backend tests passed, 40 desktop/mobile browser tests passed, and the frontend production build passed. All tests ran offline with fake or mocked provider responses. Screenshots of offline aggregate results were inspected at both viewports. The existing progressive-hint checks pass. No live inference, paid service, new dependency, real .env edit, commit, or deployment occurred in this stage. See DETERMINISTIC_ANALYSIS.md for formulas, examples, known limitations, and extension steps.

Stage 3 acceptance is complete for the supported grammar and explicitly heuristic contract. Broader semantic coverage, guaranteed feasibility, and proof of algorithm correctness are not claimed. The user reported Stage 2 working; a new live-provider test was intentionally not performed.

Next, only when requested: Stage 4 hint-quality evaluation and controls. It has not started. Ollama remains a future optional provider. Do not automatically start a later milestone.
