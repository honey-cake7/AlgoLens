# Architectural decisions

## 001 — One repository, modular monolith

Keep frontend and backend together with separate dependency environments. This makes changes easy to review and avoids network boundaries between backend feature modules. Use the existing workspace as the root rather than nesting another repository; the root directory is now AlgoLens. Microservices, queues, and production infrastructure add no value for initialization.

## 002 — FastAPI and Pydantic

FastAPI provides concise Python routes and generated OpenAPI docs. Python also provides a direct path to future NLP experiments. Pydantic validates runtime contracts, including future structured LLM outputs. Type correctness and schema correctness cannot prove semantic correctness, so model evaluation remains a separate requirement. Uvicorn serves the API locally.

## 003 — React, TypeScript, Vite, Tailwind

React supports incremental components and stateful interactions. TypeScript catches mismatched contracts during development. Vite keeps local feedback fast and creates production bundles; Tailwind provides consistent responsive styling without a component framework. Use Tailwind's Vite plugin and CSS import. Keep a single page in App.tsx until routing is necessary.

## 004 — LLM-first, beginning in Stage 2

Start with an existing model to learn what representations and evaluations the product needs before spending effort training a dedicated model. Stage 1 uses clearly labeled mocks to establish the interface. Stage 2 will add a backend provider boundary and validated output. Do not add an unused SDK or abstraction now.

## 005 — Explicit configuration and minimal dependencies

Backend CORS origins come from environment configuration; frontend API location is public configuration. Local defaults make first startup straightforward. Ignore .env and document examples. Keep credentials out of source and browser bundles. Use a frontend lockfile; Python uses compatible bounded dependency ranges for this stage, with a Python lock strategy deferred until reproducible deployment or collaboration requires one.

## 006 — Deferred until justified

No database, pgvector, Redis, PyTorch, Sentence Transformers, MLflow, Docker production setup, authentication, billing, scraping, retrieval implementation, or training code. Stage 1 is limited to mock workflow and UI behavior. Stage 2 requires a separate authorized task.

## 007 — Honest deterministic mock contract

Stage 1 accepts a strict statement string of 20–20,000 Unicode code points after trimming. The limit rejects empty or accidental oversized input while allowing full problem statements. The frontend mirrors the limits for immediate guidance; Pydantic remains authoritative. Invalid input and malformed JSON use standard HTTP 422 responses.

Use nested Pydantic schemas and matching TypeScript interfaces. `analysis_type` is literally `mock`, `demo_notice` explains that every request gets the same unrelated example, and confidence scores are absent. The route delegates to a service rather than holding a large response dictionary. No keyword rules are used. This isolates API/UI learning from model costs and variability.

## 008 — Local state and explicit failure states

Use React state for input, loading, errors, results, and sequential hint reveal. Disable editing during a pending request, prevent duplicate submission with an immediate request reference, abort on unmount, and apply a 15-second request timeout. Preserve input on failure. Clear stale results on edits and reset hints on each new response. All demo hints are delivered together; client reveal is not a security guarantee.

## 009 — Real browser workflow checks

Add Playwright only as a development dependency, using the installed Microsoft Edge channel. Its two local servers run the actual application; the main round-trip test verifies a browser POST through CORS to the real FastAPI service. Explicit network interception tests controlled failure cases and delayed responses without adding fake backend modes. Run the same nine scenarios at desktop and narrow viewports. Avoid UI, state-management, routing, or animation libraries.
