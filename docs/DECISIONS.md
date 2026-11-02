# Architectural decisions

## 001 — One repository, modular monolith

Keep frontend and backend together with separate dependency environments. This makes changes easy to review and avoids network boundaries between backend feature modules. Use the existing workspace as the root rather than nesting another repository; the root directory is now AlgoLens. Microservices, queues, and production infrastructure add no value for initialization.

## 002 — FastAPI and Pydantic

FastAPI provides concise Python routes and generated OpenAPI docs. Python also provides a direct path to future NLP experiments. Pydantic validates runtime contracts, including future structured LLM outputs. Type correctness and schema correctness cannot prove semantic correctness, so model evaluation remains a separate requirement. Uvicorn serves the API locally.

## 003 — React, TypeScript, Vite, Tailwind

React supports incremental components and stateful interactions. TypeScript catches mismatched contracts during development. Vite keeps local feedback fast and creates production bundles; Tailwind provides consistent responsive styling without a component framework. Use Tailwind's Vite plugin and CSS import. Keep a single page in App.tsx until routing is necessary.

## 004 — LLM-first, beginning in Stage 2

Start with an existing model to learn what representations and evaluations the product needs before spending effort training a dedicated model. Stage 1 established the mock interface. Stage 2 adds the provider boundary and structured output with Groq Free, replacing the original paid-OpenAI integration plan to respect the explicit ₹0 budget. No OpenAI API SDK or paid service is integrated.

## 005 — Explicit configuration and minimal dependencies

Backend CORS origins come from environment configuration; frontend API location is public configuration. Local defaults make first startup straightforward. Ignore .env and document examples. Keep credentials out of source and browser bundles. Use a frontend lockfile; Python uses compatible bounded dependency ranges for this stage, with a Python lock strategy deferred until reproducible deployment or collaboration requires one.

## 006 — Deferred until justified

No database, pgvector, Redis, PyTorch, Sentence Transformers, MLflow, Docker production setup, authentication, billing, scraping, retrieval implementation, or training code. Stage 2 authorized provider-based analysis. Stage 3 separately authorizes the local constraint/growth engine; it does not authorize those other systems or Ollama.

## 007 — Honest deterministic mock contract

Stage 1 established a strict statement string of 20–20,000 Unicode code points after trimming. Keep those bounds in Stage 2; the frontend mirrors them for guidance while Pydantic remains authoritative. Invalid input and malformed JSON use standard HTTP 422 responses.

The original nested mock contract established a clearly unrelated fixed example without confidence scores or keyword rules. Stage 2 extends that contract and keeps honest demo labeling through server-owned metadata.

## 008 — Local state and explicit failure states

Use React state for input, loading, errors, results and sequential hint reveal. Disable editing during a pending request, prevent duplicate submission with an immediate request reference, abort on unmount, and preserve input on failure. Clear stale results on edits and reset hints on each new response. Stage 2 increases the browser deadline to 45 seconds, above the backend's bounded provider deadline. All hints are delivered together; client reveal is not a security guarantee.

## 009 — Real browser workflow checks

Playwright is development-only and uses installed Microsoft Edge. Its local servers run the actual application; the main round trip verifies browser POST through CORS to FastAPI. Explicit interception tests failures and delayed responses without adding fake backend modes. Stage 2 runs twelve scenarios at desktop and narrow viewports, pins fake mode and empty credentials, and blocks external page requests. No UI, state-management, routing or animation library was introduced.

## 010 — Zero-budget provider selection

Default to FakeLLMProvider, which is deterministic, clearly unrelated to the submitted statement, and works without a key or network. Groq requires explicit backend configuration and an analysis submission. A small Protocol supports later local Ollama inference without provider-specific code in routes or components. No LangChain, LlamaIndex, training library, or orchestration framework is needed.

Use the current official async Groq SDK, with GPT-OSS 120B as default and a deliberate 20B alternative. The known model allowlist avoids silently switching to another model. Model availability and account billing status are not probed at startup; account Free access must be checked manually. If it is unavailable, fake mode keeps the project usable for ₹0.

## 011 — One strict request, then runtime validation

Use Chat Completions with strict JSON Schema. Generate the schema from semantic AnalysisContent, with required closed objects and explicit nullable values. Python validators add text and exact hint-order checks without complex generation-schema constructs. Pydantic validates the returned JSON; truncated or malformed output is rejected without a repair call. Provider metadata is assigned by the server, never the model.

Keep the system policy in its own module and serialize untrusted problem text separately. Explicitly preserve operation counts, contiguity, graph direction and other task semantics. The prompt asks for short educational justifications, not hidden reasoning or complete solutions. Reject fenced code blocks as a limited guard; semantic fidelity and hint restraint still need review.

## 012 — Quota and failure safeguards

One normal submission makes one request. Disable the SDK's default retries, including quota retries. Default completion budget is 3,072 tokens (512–4,096 allowed), low reasoning effort, with a total 30-second deadline (at most 40 configurable) and a 45-second browser deadline. All hint reveal is local. No streaming, tools, browsing, model listing, paid fallback, account upgrade or automatic model change is used.

Expose only fixed error codes/messages and never raw provider errors. Keep credentials in SecretStr and backend-only configuration; pin the official API host rather than accepting an environment redirect. Re-read settings per request so a restart/reconfiguration does not require a cache reset. A root .env is optional; process settings win. Never rewrite a real .env.

## 013 — Offline tests and honest completion status

Backend tests force fake defaults, ignore real .env files, block external network connections, and mock the actual SDK's HTTP transport. Browser tests force fake configuration and empty credentials and block external page requests; AI rendering uses an explicit fixture. No test or build consumes inference quota.

Live schema acceptance, account access, and semantic quality cannot be established by mocks. Stage 2 was initially recorded as implemented and verified offline, with live acceptance pending. The user's Stage 3 handoff subsequently reports Stage 2 complete and working. Record that provenance separately from automated evidence; do not claim a new live verification or completed semantic benchmark. EVALUATION.md remains a manual rubric; no live call is automatically initiated to complete it.

## 014 — Bounded numeric grammar and traceable extraction

Use standard-library regular expressions and Decimal for a narrow literal/scientific/power/product grammar. Never use eval/exec, arbitrary Python expressions, or a new parser dependency. Normalize Unicode notation with original-character offsets. Bound expression length, factors, exponents, constraint count, and numeric magnitudes; cap integers at 2^53−1 for exact JSON/browser transport. Reject malformed suffixes rather than extracting a misleading numeric prefix.

Keep numbers, meanings, and scope distinct. Descriptive evidence assigns roles; variable letters alone do not establish size. Preserve every accepted source, intersect conjunctive bounds, retain conflicts, and abstain for conditional/disjunctive meanings. Example sections are conservatively excluded. English patterns are intentionally limited and extended through positive/negative labeled tests. Do not describe regex extraction as complete semantic understanding.

## 015 — Abstract growth and conservative aggregate bounds

Evaluate nine representative functions at a reliable contextual cap. Use log10 for huge exponential/factorial values and lgamma for factorials. Expose finite log magnitude and null numeric work above 10^300. A selected profile needs a unique usable primary size; do not pick an arbitrary convenient bound among multiple arrays.

Use transparent growth bands of 10^6 and 10^8 abstract units for promising/possibly-feasible/likely-infeasible guidance. These are rough pedagogical choices, not measured throughput or universal runtime thresholds. Always expose caveats and distinguish per-instance growth from conservative all-test upper bounds. Resource headers remain context; no unsupported runtime or memory-fit prediction is made.

An aggregate sum(n) <= S overrides naive T·max(n) linear totals. With nonnegative n_i <= U, polynomial totals are bounded by S·U^(p−1). Count-dependent profiles require T, possibly derived from S and a positive explicit lower bound. Do not derive a count from a zero lower bound. Missing/conflicting information and aggregate exponential/factorial totals can remain unavailable. Conditional multi-parameter profiles illustrate possible algorithms without identifying one. See DETERMINISTIC_ANALYSIS.md for assumptions and limitations.

## 016 — Server-owned deterministic results and explicit offline access

Add `deterministic` to AnalyzeResponse, not AnalysisContent. The provider's prompt, strict generation schema, SDK adapter, retries, and one-request behavior remain unchanged. AnalysisService runs the local engine before its existing provider call, combines both results, and optionally adds a tentative wording-based discrepancy. Keep original AI guidance; fake examples are unrelated and must not be compared against the submitted statement.

Expose POST `/api/v1/assess` with the same statement validation and no provider/settings dependency. This makes local analysis accessible even when Groq settings are invalid or its request fails. Preserve safe provider errors from `/analyze`; the UI offers **Assess constraints only** explicitly instead of silently switching providers or manufacturing AI content. Both actions share loading protection and stale-result clearing. Source labels distinguish extracted evidence, deterministic heuristics, AI suggestions, and demo examples.

All Stage 3 tests stay offline; no new dependency, model call, environment-file edit, account change, or paid service is needed. Stage 3 ends after implementation, tests, build, and documentation; later milestones require a new request.
