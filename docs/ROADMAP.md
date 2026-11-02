# Development roadmap

Stages 0 and 1 are complete. Stage 2's fake/Groq implementation is verified offline; live account acceptance and semantic evaluation remain pending manual checks. Stage 2 is not marked complete. Later stages describe acceptance targets, not implemented functionality.

| Stage | Scope | Acceptance criteria |
| --- | --- | --- |
| **0 — Complete: initialization** | Repository, environments, skeleton, docs | Versioned health endpoint returns the exact contract; CORS tests pass; frontend builds; local startup is documented and checked. |
| **1 — Complete: frontend/backend workflow** | Mock API and structured UI | Validated 20–20,000-character requests; typed deterministic mock service; real browser POST; mock warnings, structured output, sequential demo hints, loading, empty and error states; API/browser tests and build pass. |
| **2 — Current: implemented, manual acceptance pending** | Optional Groq Free + offline provider boundary | Offline fake default; official async SDK; strict JSON/Pydantic; server-owned mode metadata; raw constraints, technique hypotheses, preliminary complexity comments and three hints; safe failures without retry/fallback; offline tests/build pass. Pending: user-initiated live free-tier success and semantic review via EVALUATION.md. |
| 3 — Constraints and complexity | Extraction and deterministic feasibility estimator | Variables, bounds, summed constraints and available time/memory limits have tests; estimates state assumptions and rough operations; no AC/TLE guarantees; evaluate extraction against labeled examples. |
| 4 — Hint quality and controls | Dedicated evaluation/refinement | Build on Stage 2's generated hints and existing reveal UI; independently review disclosure, pedagogical progression and correctness; refine safeguards based on evidence. No claim that prompt policy alone guarantees restraint. |
| 5 — Data and persistence | Curated dataset and conditional PostgreSQL | Record permitted sources/provenance; validate ingestion and deduplication; introduce PostgreSQL only for a demonstrated persistence need; test data workflows and migrations if added. |
| 6 — Similar-problem retrieval | BM25 or embeddings; optional vector store | Return verified identifiers and URLs from curated data; measure retrieval against an algorithmic relevance benchmark and baseline; use vector infrastructure only when justified. |
| 7 — Dedicated NLP models | Classifiers, CP embeddings, contrastive learning, reranking | Establish train/validation/test separation and leakage controls; record metrics and baselines; independently evaluate model improvements before integration. |
| 8 — Production quality | Security, caching, observability, CI/CD, deployment, UX | Review abuse and secret handling; define measurable reliability goals; validate deployment and rollback; test accessibility, caching correctness and failure monitoring; document operating costs and limitations. |

Stage 1 verification on 2026-11-02: 18 backend tests passed, 18 desktop/mobile browser tests passed, and the frontend production build passed. The real browser round trip verifies local CORS, validated mock JSON, rendering, and progressive reveal. Failure scenarios verify readable errors, input preservation, and retry. No LLM, database, secret, commit, or deployment was introduced.

Stage 2 offline verification on 2026-11-02: 54 backend tests passed, 24 desktop/narrow-viewport browser tests passed, and the frontend production build passed. All provider responses in tests were fake or SDK-transport mocks. No live request, key creation, purchase, account upgrade, paid fallback, commit, or deployment was performed.

Immediate next task: the user's manual Groq Free activation and semantic review checklist in EVALUATION.md. After those acceptance checks, Stage 3 is raw-constraint normalization and a deterministic, assumption-aware complexity estimator. The LLM's current comments do not implement that estimator. Ollama is a future optional provider, not part of Stage 2. Do not automatically start a later milestone.
