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

## Stage 2 — Optional Groq and safe offline default (2026-11-02)

Goal: introduce a provider boundary and structured LLM analysis while keeping the project usable for ₹0. The user explicitly replaced the original paid-OpenAI plan with Groq Free and required all automated checks to stay offline.

What changed: FakeLLMProvider is the default; GroqProvider makes one async SDK call only during a submitted, explicitly configured analysis. AnalysisContent contains semantic fields; AnalysisService owns provider/type/model/demo metadata. The frontend preserves its layout and adds objective, I/O, observations and uncertainties, AI/demo labeling, and safe provider errors. Exactly three ordered hints remain hidden initially.

Concepts to study:

- A Protocol specifies behavior without requiring an inheritance framework. Fake and Groq return the same Pydantic content contract; future Ollama can implement it.
- Async SDK calls avoid blocking the FastAPI event loop; an async context closes connections and a total deadline bounds the request.
- JSON Schema guides model generation through required closed objects and explicit null unions. Pydantic then validates returned JSON plus runtime invariants that are not generation-schema keywords.
- Metadata is a trust boundary: the model cannot choose its own provider label, confidence percentages, or demo/AI status.
- Environment precedence and SecretStr keep machine settings separate from code. The browser bundle is public, so provider keys belong only on the backend.
- Rate limits are controlled failures. Disable SDK retries to avoid hidden quota use; preserve input and let the user decide whether/when to submit again. Hint reveal makes no extra calls.
- External socket/DNS guards, fake defaults and mocked SDK HTTP transport make tests independent of keys, network availability and free-tier quotas.
- Correct JSON is not proof of task equivalence, technique correctness, safe hints, or resistance to prompt injection. Evaluation remains necessary.

Actual verification on 2026-11-02:

| Check | Observed result |
| --- | --- |
| Dependency install | Official groq 1.7.0 installed; distro 1.9.0 and sniffio 1.3.1 added transitively; no new frontend dependency |
| Backend suite | 54 passed in 1.67s; existing Starlette/httpx TestClient deprecation warning |
| SDK contract/failure tests | Actual SDK with mocked transport: both selected model IDs, strict request schema, one request/no retries, missing key, quota, authentication/model access, total/transport timeouts, connection/server failure, malformed/truncated output, safe errors and metadata |
| Browser suite | 24 passed in 28.0s across desktop and a 390px viewport; fake forced even if live settings exist; external page requests blocked |
| Frontend production build | TypeScript and Vite passed; 34 modules transformed, Vite build 1.20s |
| Visual inspection | Reviewed desktop Demo Mode and narrow synthetic AI result screenshots; AI screenshot is a fixture, not a live result |
| Environment ignores | Root .env, backend/.env, backend/.env.local, frontend/.env and frontend/.env.local matched ignore rules |
| Live Groq / semantic evaluation | Not run, as explicitly required; manual account access, schema acceptance and quality review remain pending |

The first provider-success test failed because its mocked async transport tried to prepare fixture content using asyncio.run inside an already running event loop. Preparing that fixture before entering the transport fixed the test; the final suite passes. Playwright's environment color warning remains non-failing.

No key was created/read out through tools, real environment file overwritten, live inference call made, paid account/service introduced, commit created or deployment performed. Package downloads and official documentation lookup were development steps, not inference requests. The root folder remains C:\Coding\AlgoLens.

Status recorded at the end of Stage 2: implementation and offline verification were finished, with live acceptance pending. This historical status is superseded by the user's working-integration report and completed Stage 3 entry below.

## Stage 3 — Offline constraint extraction and growth (2026-11-03)

Goal: add repeatable algorithmic reasoning beyond an LLM wrapper without new dependencies, paid services, or model requests. The user reports Stage 2 complete and working; that status is user-reported, not a new live-provider test performed here.

Implemented a Pydantic evidence/assessment contract, bounded Decimal numeric grammar, Unicode/source-offset normalization, contextual ConstraintParser, and pure-Python ComplexityEngine. AnalysisService attaches actual-statement results beside the unchanged provider schema. An independent `/api/v1/assess` route has no provider/settings dependency. The existing dashboard gains a source-labeled section and **Assess constraints only** action while preserving all provider sections and progressive hints.

Important decisions: no variable-name-only size guesses; nulls for missing facts; retain original evidence and conflicting sources; exclude sample sections conservatively; cap exact integers at 2^53−1; use log-space for giant growth; distinguish aggregate sums from powers; label growth bands as heuristic; retain resource limits without predicting runtime/memory fit; flag possible AI disagreement without adjudicating correctness.

Actual verification on 2026-11-03:

| Check | Observed result |
| --- | --- |
| `backend/.venv/Scripts/python.exe -m pytest backend/tests -q` | 171 passed in 2.51s; one existing Starlette/httpx TestClient deprecation warning |
| `npm.cmd run build` from frontend | Passed TypeScript checking and Vite production build; 36 modules transformed, Vite 1.96s |
| `npm.cmd test` from frontend | 40 passed in 48.9s at desktop and 390px viewport; existing Playwright color warning only |
| Numeric/parser cases | ASCII/Unicode/scientific/powers/commas/whitespace/shared bounds; original evidence; values versus sizes; test counts/aggregates; missing/conflicting/conditional evidence; malformed/large input; resource separation; sample exclusion |
| Engine cases | Nine functions; heuristic labels; finite huge-value serialization; missing/ambiguous parameters; conservative test totals; correct linear/nonlinear aggregate formulas; hypothetical graph dimensions |
| Integration cases | Existing combined/fake workflow and unchanged hints; exactly one mocked provider call; safe provider failures; independent offline endpoint even under invalid settings; tentative source comparison |
| Browser/visual cases | Existing workflows plus combined actual evidence, assess-only endpoint, provider-error recovery without retry, insufficient/ambiguous/value-only/conflicting sizes, synthetic discrepancy; desktop/mobile aggregate screenshots inspected; no page horizontal overflow |
| Live provider / dependencies / environment | No live inference, new dependency, real .env edit, credential readout, paid infrastructure, commit, push, or deployment |

Focused tests initially caught disjunctive bounds being treated as conjunctive conflicts, inline examples being partly consumed, and the phrase `its elements` creating a false size variable. The parser now abstains or excludes these cases, with regression coverage. Final review also found that multiple test-count definitions could stop collecting later sizes; the fixed loop preserves sizes while leaving the count ambiguous. These examples show why nearby negative cases matter as much as happy-path regex tests.

Study and exercises:

- Trace `2 × 10⁵` through offsets, Decimal normalization, ParsedConstraint, and the browser card.
- Compare bare `n <= 200000` with `an array of n integers`: numbers alone do not define size semantics.
- Verify 200000² = 40 billion and n·log2(n) ≈ 3.52 million; explain why neither measures seconds.
- For per-case n <= 1000 and sum(n) <= 2000, derive linear total <= 2000 and quadratic total <= 2 million. Explain why zero-sized cases prevent deriving a test count without a positive lower bound.
- Compare actual deterministic output in Demo Mode with the fixed provider fixture. Explain why fake content cannot meaningfully disagree with a different input.
- Add one new supported phrase with positive, malformed, and ambiguous tests before expanding patterns.

The ten learning concepts, mathematical assumptions, source boundaries, parser limits, and extension workflow are in DETERMINISTIC_ANALYSIS.md. README.md contains startup commands and manual offline examples.

Completion status: Stage 3's supported scope and acceptance checks are complete. Stage 4 hint-quality evaluation is the next planned milestone and has not started. Do not start it automatically.

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
