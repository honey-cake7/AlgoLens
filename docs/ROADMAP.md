# Development roadmap

Stage 0 is the current milestone. Later stages describe acceptance targets, not implemented functionality. Complete and review one stage before beginning the next.

| Stage | Scope | Acceptance criteria |
| --- | --- | --- |
| **0 — Current: initialization** | Repository, environments, skeleton, docs | Versioned health endpoint returns the exact contract; CORS tests pass; frontend builds and shows honest placeholder behavior; local startup is documented and checked. |
| 1 — Functional frontend/backend | Mock API and structured UI | Agree on request/response schemas; endpoint returns explicitly labeled deterministic mock data; form calls backend; structured output, loading, empty and error states work; API and frontend behavior tests pass. |
| 2 — Initial LLM integration | Backend-only provider call | Real provider credentials remain server-side; Pydantic validates structured output; story-free representations preserve conditions on a reviewed sample set; malformed output, timeout and provider failure are handled; mocks remain distinguishable. |
| 3 — Constraints and complexity | Extraction and deterministic feasibility estimator | Variables, bounds, summed constraints and available time/memory limits have tests; estimates state assumptions and rough operations; no AC/TLE guarantees; evaluate extraction against labeled examples. |
| 4 — Progressive hints | Three controlled Socratic hints | Reveal observation, stronger direction and high-level approach progressively; review hints for accidental full solution/code disclosure; test reveal behavior and failures. |
| 5 — Data and persistence | Curated dataset and conditional PostgreSQL | Record permitted sources/provenance; validate ingestion and deduplication; introduce PostgreSQL only for a demonstrated persistence need; test data workflows and migrations if added. |
| 6 — Similar-problem retrieval | BM25 or embeddings; optional vector store | Return verified identifiers and URLs from curated data; measure retrieval against an algorithmic relevance benchmark and baseline; use vector infrastructure only when justified. |
| 7 — Dedicated NLP models | Classifiers, CP embeddings, contrastive learning, reranking | Establish train/validation/test separation and leakage controls; record metrics and baselines; independently evaluate model improvements before integration. |
| 8 — Production quality | Security, caching, observability, CI/CD, deployment, UX | Review abuse and secret handling; define measurable reliability goals; validate deployment and rollback; test accessibility, caching correctness and failure monitoring; document operating costs and limitations. |

Immediate next task: Stage 1's schema-first mock endpoint and UI integration. Do not call an LLM or generate apparently real algorithmic conclusions in that stage.
