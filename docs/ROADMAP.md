# Development roadmap

Stages 0 and 1 are complete. Stage 2 — LLM integration — is next and requires a new authorized task. Later stages describe acceptance targets, not implemented functionality. Complete and review one stage before beginning the next.

| Stage | Scope | Acceptance criteria |
| --- | --- | --- |
| **0 — Complete: initialization** | Repository, environments, skeleton, docs | Versioned health endpoint returns the exact contract; CORS tests pass; frontend builds; local startup is documented and checked. |
| **1 — Complete: frontend/backend workflow** | Mock API and structured UI | Validated 20–20,000-character requests; typed deterministic mock service; real browser POST; mock warnings, structured output, sequential demo hints, loading, empty and error states; API/browser tests and build pass. |
| **2 — Next: LLM integration** | Backend-only provider call | Real provider credentials remain server-side; Pydantic validates structured output; story-free representations preserve conditions on a reviewed sample set; malformed output, timeout and provider failure are handled; real, mock and unavailable fields remain distinguishable. |
| 3 — Constraints and complexity | Extraction and deterministic feasibility estimator | Variables, bounds, summed constraints and available time/memory limits have tests; estimates state assumptions and rough operations; no AC/TLE guarantees; evaluate extraction against labeled examples. |
| 4 — Progressive hints | Three controlled generated Socratic hints | Build on Stage 1's demo reveal UI; generate observation, stronger direction and high-level approach; review hints for accidental full solution/code disclosure; test reveal behavior and failures. |
| 5 — Data and persistence | Curated dataset and conditional PostgreSQL | Record permitted sources/provenance; validate ingestion and deduplication; introduce PostgreSQL only for a demonstrated persistence need; test data workflows and migrations if added. |
| 6 — Similar-problem retrieval | BM25 or embeddings; optional vector store | Return verified identifiers and URLs from curated data; measure retrieval against an algorithmic relevance benchmark and baseline; use vector infrastructure only when justified. |
| 7 — Dedicated NLP models | Classifiers, CP embeddings, contrastive learning, reranking | Establish train/validation/test separation and leakage controls; record metrics and baselines; independently evaluate model improvements before integration. |
| 8 — Production quality | Security, caching, observability, CI/CD, deployment, UX | Review abuse and secret handling; define measurable reliability goals; validate deployment and rollback; test accessibility, caching correctness and failure monitoring; document operating costs and limitations. |

Stage 1 verification on 2026-11-02: 18 backend tests passed, 18 desktop/mobile browser tests passed, and the frontend production build passed. The real browser round trip verifies local CORS, validated mock JSON, rendering, and progressive reveal. Failure scenarios verify readable errors, input preservation, and retry. No LLM, database, secret, commit, or deployment was introduced.

Immediate next task: Stage 2's backend-only LLM provider boundary for validated problem simplification, with explicit contract/labeling changes and semantic evaluation examples. No Stage 2 implementation is included in Stage 1.
