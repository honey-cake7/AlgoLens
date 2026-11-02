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

## Stage 1 — Mock application workflow (2026-11-02)

Goal: submit a statement through the real browser/API boundary and render typed, explicitly labeled demo analysis without a model.

Concepts introduced:

- Request schemas and runtime validation: strict strings, whitespace normalization, inclusive size boundaries, and standard HTTP 422 errors.
- Nested response models and TypeScript counterparts: both sides agree on names and shapes; the browser still validates network data at runtime.
- Route/service separation: the route coordinates HTTP, while the mock service owns the use case and returns a typed object.
- Async UI states: loading, error, retry, timeout, and prevention of duplicate submissions; preserving text on failure and removing stale output after edits.
- Progressive disclosure: React reveals one hint at a time; all demo hints are already in JSON, so this is a UI behavior rather than a secrecy boundary.
- CORS preflight: JSON POST requests between different origins need the permitted origin, method, and Content-Type header.
- End-to-end checks: actual browser requests prove more than an isolated build; fault interception exercises error handling reproducibly.

Trace to study: ProblemInput → App state → analyzeProblem → HTTP POST → FastAPI/Pydantic → analyze route → analysis_service → AnalyzeResponse → JSON → browser runtime check/TypeScript type → AnalysisResult.

Decisions: minimum 20 and maximum 20,000 trimmed Unicode code points; no mock confidence scores; a single fixed example independent of the input; no keyword inference. Sequential hints and repeated demo warnings are implemented without introducing future model-generation behavior.

Actual verification:

| Check | Observed result |
| --- | --- |
| Backend pytest suite | 18 passed in 1.27s; one existing Starlette/httpx TestClient deprecation warning |
| Frontend production build | Passed TypeScript checking and Vite build (34 modules transformed) |
| Playwright desktop and 390px viewport suite | 18 passed in 30.9s; real API round trip, all five result sections, loading/duplicate protection, validation, sequential hints/reset, HTTP/network errors and retry, malformed responses, health recovery |
| Local server startup | Uvicorn and Vite started successfully under Playwright and were stopped by its test lifecycle |
| Screenshot inspection | Reviewed desktop and mobile full-page results; no horizontal overflow in automated checks |
| npm dependency installation | Passed; audit reported 0 vulnerabilities at installation time |

The browser runner emitted a NO_COLOR/FORCE_COLOR environment warning that did not affect results. Tests use the installed Edge browser; a narrow viewport is not a separate physical mobile-device test.

Environment lesson: the project had been renamed to C:\Coding\AlgoLens, but Python's editable install retained the old path. Refreshing it with pip's normal isolated build corrected the import mapping. An initial `--no-build-isolation` attempt failed because setuptools was absent in the virtual environment; the normal build succeeded without changing runtime dependencies. The session's old NLP writable root required authorized escalated commands for edits and verification in AlgoLens. Active setup instructions now use the new path; the Stage 0 notes above remain a historical record.

Suggested exercises: submit a custom statement and inspect the Network panel; compare two responses to verify the fixed fixture; stop the API and test retry; trace a 422 response in `/docs`; explain why hints being hidden in React does not remove them from network data.

Next authorized milestone: none beyond Stage 1. Stage 2 is the planned next task, adding backend-only LLM problem simplification, explicit real/mock contract changes, and semantic evaluation.

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
