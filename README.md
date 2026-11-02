# AlgoLens AI

AlgoLens AI is a competitive programming learning assistant under development. Problem statements often mix stories with the operations, conditions, and constraints a student needs to understand. AlgoLens aims to make that underlying problem easier to see while preserving its meaning and letting students reason for themselves.

**Current milestone: Stage 0 — project initialization.** This is a working application skeleton. AI analysis is not implemented.

## Working today

- A responsive React page with a multiline statement input and Analyze button.
- An explicit placeholder after submission; no problem text is sent for analysis or stored persistently.
- A backend connection indicator with timeout and manual recheck.
- `GET /api/v1/health` returning `{"status":"ok","service":"algolens-api"}`.
- A versioned API, local CORS configuration, validated health response, and automated backend tests.

Planned capabilities include problem simplification, constraint extraction, cautious complexity guidance, technique hypotheses, progressive Socratic hints, and curated algorithmic similarity search. Later research will explore canonical representations, embeddings, reranking, and independently evaluated models. See [the roadmap](docs/ROADMAP.md).

## Stack and layout

React, TypeScript, Vite, and Tailwind CSS power the browser. Python 3.11+, FastAPI, Pydantic, and Uvicorn power the API. pytest and httpx support backend tests. This is a modular monolith with no database or external AI dependency.

```text
NLP/                       # repository root (no extra algolens wrapper)
├── frontend/
│   ├── src/
│   │   ├── components/    # reusable UI, currently health indicator
│   │   ├── services/      # browser HTTP requests
│   │   ├── types/         # TypeScript API contracts
│   │   └── App.tsx        # single application page
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── api/routes/    # HTTP endpoint handlers
│   │   ├── core/          # environment configuration
│   │   ├── schemas/       # Pydantic contracts
│   │   ├── services/      # reserved home for future business logic
│   │   └── main.py        # creates and configures FastAPI
│   ├── tests/
│   └── pyproject.toml
├── docs/                  # architecture, roadmap, decisions, learning notes
├── .env.example           # backend configuration example
└── AGENTS.md              # future contributor instructions
```

The single page stays in App.tsx; create a pages directory when additional pages justify it. Future feature modules will be added when implemented.

## Windows PowerShell setup

Prerequisites: Git, Python 3.11 or newer (tested here with 3.13), and a supported Node.js release at least 22.12 (tested here with 24). Run commands from the repository root unless stated otherwise. We use `npm.cmd` because PowerShell execution policy may block `npm.ps1`. Calling the virtual environment's Python directly also avoids activation-policy changes. `rtk` is optional for human setup; future agents follow AGENTS.md.

```powershell
# Backend installation
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -e './backend[dev]'

# Frontend installation (lockfile records the resolved dependency versions)
Set-Location frontend
npm.cmd ci
Set-Location ..

# Optional local settings; defaults work without these copies
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env
```

If Python is not on PATH, install Python 3.11+ and reopen the terminal. The backend dependencies have bounded compatible ranges in pyproject.toml; the observed versions from verification are documented in docs/LEARNING_LOG.md. Python dependencies are not yet locked, so future installs can resolve newer compatible versions.

Run the backend in terminal 1:

```powershell
Set-Location C:\Coding\NLP\backend
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Run the frontend in terminal 2:

```powershell
Set-Location C:\Coding\NLP\frontend
npm.cmd run dev
```

Open <http://127.0.0.1:5173>. API documentation is at <http://127.0.0.1:8000/docs> and health is at <http://127.0.0.1:8000/api/v1/health>. Stop either server with Ctrl+C. Vite uses strict port 5173 so an occupied port produces an actionable error instead of silently invalidating the CORS origin.

## Configuration and request flow

The backend loads the root `.env` independently of the current working directory; existing process environment variables take precedence. `CORS_ORIGINS` is a comma-separated list of exact frontend origins, defaulting to localhost and 127.0.0.1 on port 5173. CORS governs browser access; it is not authentication.

The frontend reads `VITE_API_BASE_URL` from `frontend/.env`, defaulting to `http://127.0.0.1:8000`. Restart Vite after configuration changes; production frontend variables are embedded at build time. Every `VITE_*` variable is public. Future LLM credentials must remain on the backend.

On page load, `HealthIndicator` calls `getHealth`, which uses browser fetch to request the health endpoint. FastAPI routes the request, Pydantic validates the response, and the browser validates its shape before showing connected status. Analyze only changes local React state in Stage 0.

## Verification commands

```powershell
# From repository root
backend/.venv/Scripts/python.exe -m pytest backend/tests -q

Set-Location frontend
npm.cmd run typecheck
npm.cmd run build
# Optional local inspection of the production build
npm.cmd run preview
```

The build includes TypeScript checking. pytest checks the health contract and both allowed and rejected CORS origins. There is no frontend automated behavior suite yet; build success does not prove browser interactions. Manually verify: empty input disables Analyze, entering text enables it, submission displays the integration message, editing clears that message, and Recheck reflects backend availability. Check a narrow mobile viewport as well as desktop.

## Learn the foundation

Read these first: `frontend/src/App.tsx` (UI and state), `frontend/src/services/api.ts` (HTTP), `backend/app/main.py` (application wiring), `backend/app/api/routes/health.py` (endpoint), and `backend/tests/test_health.py` (executable expectations).

- **Frontend versus backend:** browser code handles interactions; the server owns validation, future business logic, and credentials. Separate directories let each use its own language, dependencies, and tooling while remaining one project.
- **FastAPI and endpoints:** FastAPI turns Python route functions into HTTP APIs. An endpoint is a method/path pair such as GET `/api/v1/health`, with a defined request and response contract. Uvicorn runs the application as a server.
- **React, TypeScript, Vite, Tailwind:** React composes UI and updates it from state. TypeScript checks code before it runs. Vite serves development files and bundles production assets. Tailwind provides CSS utilities for consistent styling.
- **Pydantic:** it currently validates the health response. During analysis integration it will validate request and structured model-output schemas at runtime; validation of shape alone does not establish algorithmic correctness.
- **Future LLM boundary:** a backend service will call the provider and return validated data through the API. The browser must never call the provider with a secret key.
- **Environment variables:** they separate machine-specific settings and secrets from source code; examples document names without sharing credentials.

See [architecture](docs/ARCHITECTURE.md), [decisions](docs/DECISIONS.md), and [learning log](docs/LEARNING_LOG.md) for the reasoning behind this structure.

## Limits and next milestone

No analysis, technique prediction, complexity estimator, hints, retrieval, persistence, scraping, authentication, or LLM calls exist. Refreshing the page clears the input. Health reports API process availability, not AI readiness. Nothing has been deployed.

**Next task — Stage 1:** agree on a minimal analysis request/response contract, implement a backend endpoint returning a fixed and explicitly labeled mock response, connect the form to it, and render structured sections with loading, empty, and error states. Add API contract and frontend behavior tests. Keep mock mode visible and do not introduce an LLM until Stage 2.
