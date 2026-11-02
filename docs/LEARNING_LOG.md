# Learning log

## Stage 0 — Foundation (2026-11-02)

The goal is a small working client/server system you can trace end to end. A health request teaches HTTP without involving AI, persistence, or dataset complexity.

Concepts introduced:

- Repository hygiene: ignored environments, dependency manifests, example configuration, no committed secrets.
- Python packaging and virtual environments: project dependencies remain isolated from the machine's global Python.
- HTTP contracts: GET + path identifies an endpoint; status codes and JSON shape define its result.
- FastAPI routers: versioning groups endpoints while keeping handlers separate from application wiring.
- Pydantic: runtime response validation; future structured model outputs will require semantic checks too.
- Browser origins and CORS: protocol, hostname, and port form an origin; access must be explicitly allowed.
- React state and forms: typing updates state, submission changes visible feedback, refreshing loses local state.
- TypeScript versus runtime checks: compile-time contracts cannot guarantee what arrives over HTTP.
- Vite and Tailwind: development serving, production builds, responsive utility styles.
- Testing: endpoint and CORS assertions are repeatable checks; a build and a real server smoke check answer different questions.

Suggested exercise: trace `HealthIndicator` → `getHealth` → `/api/v1/health` → `HealthResponse` → connection status. Then stop the backend and use Recheck to observe the failure state.

Verification performed on 2026-11-02:

| Check | Observed result |
| --- | --- |
| Backend editable install with dev dependencies | Passed in backend/.venv on Python 3.13.5 |
| `python -m pytest backend/tests -q` using that environment | 3 passed; 1 upstream Starlette TestClient deprecation warning about its httpx integration |
| `npm.cmd install` | Passed; npm audit reported 0 vulnerabilities at installation time |
| `npm.cmd run build` | Passed TypeScript checking and Vite production build |
| Uvicorn startup and actual GET `/api/v1/health` | Passed; HTTP 200 and exact expected JSON |
| Live health request with frontend Origin header | Passed; correct access-control-allow-origin response header |
| Vite development startup and GET `/` | Passed; HTTP 200 and AlgoLens HTML entry point |
| Browser visual and interaction verification | Could not run: browser tool kernel failed with `windows sandbox failed: helper_unknown_error: setup refresh had errors` |

The upstream test-client warning does not fail tests; revisit that dependency integration when upgrading backend tooling. UI layout, mobile rendering, and button interactions still need the manual checks in README.md; HTTP serving and build checks do not verify those interactions.

Observed versions: Node 24.18.0; React/React DOM 19.3.1; TypeScript 5.9.3; Vite 7.3.7; Tailwind and its Vite plugin 4.3.3; React Vite plugin 5.2.0. Backend: FastAPI 0.162.0, Pydantic 2.14.2, Uvicorn 0.54.0, python-dotenv 1.2.4, pytest 9.2.0, httpx 0.28.1, Starlette 1.10.0. The frontend lockfile records the complete npm resolution; these backend versions are observations rather than a lockfile.

Environment lessons: PowerShell blocked npm.ps1, so npm.cmd worked without changing execution policy. Initial sandbox commands failed before execution; authorized escalated commands completed installation and verification. Git's cross-account ownership check required a command-local `-c safe.directory=C:/Coding/NLP` for inspection under the escalated account; no global Git settings were changed. A nested PowerShell smoke-check command had a quoting error; corrected checks used curl directly and returned the successful HTTP results above.

## Template for future entries

### Date / stage / feature

- Goal:
- Concepts studied:
- Files traced and their responsibilities:
- Decision and reason:
- What I expected:
- What actually happened:
- Checks run and actual results:
- Mistakes or open questions:
- Small exercise to reinforce learning:
- Next authorized milestone:
