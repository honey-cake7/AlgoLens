# Architectural decisions

## 001 — One repository, modular monolith

Keep frontend and backend together with separate dependency environments. This makes changes easy to review and avoids network boundaries between backend feature modules. Use the existing NLP workspace as the root rather than nesting another repository. Microservices, queues, and production infrastructure add no value for initialization.

## 002 — FastAPI and Pydantic

FastAPI provides concise Python routes and generated OpenAPI docs. Python also provides a direct path to future NLP experiments. Pydantic validates runtime contracts, including future structured LLM outputs. Type correctness and schema correctness cannot prove semantic correctness, so model evaluation remains a separate requirement. Uvicorn serves the API locally.

## 003 — React, TypeScript, Vite, Tailwind

React supports incremental components and stateful interactions. TypeScript catches mismatched contracts during development. Vite keeps local feedback fast and creates production bundles; Tailwind provides consistent responsive styling without a component framework. Use Tailwind's Vite plugin and CSS import. Keep a single page in App.tsx until routing is necessary.

## 004 — LLM-first, beginning in Stage 2

Start with an existing model to learn what representations and evaluations the product needs before spending effort training a dedicated model. Stage 1 uses clearly labeled mocks to establish the interface. Stage 2 will add a backend provider boundary and validated output. Do not add an unused SDK or abstraction now.

## 005 — Explicit configuration and minimal dependencies

Backend CORS origins come from environment configuration; frontend API location is public configuration. Local defaults make first startup straightforward. Ignore .env and document examples. Keep credentials out of source and browser bundles. Use a frontend lockfile; Python uses compatible bounded dependency ranges for this stage, with a Python lock strategy deferred until reproducible deployment or collaboration requires one.

## 006 — Deferred until justified

No database, pgvector, Redis, PyTorch, Sentence Transformers, MLflow, Docker production setup, authentication, billing, scraping, retrieval implementation, or training code. There are no generated feature stubs beyond the basic package boundaries. Stage 0 must be understood and verified before Stage 1 begins.
