# Architecture

AlgoLens remains a modular monolith: one FastAPI backend and one React browser client. Stage 2 adds a small provider contract and an opt-in Groq adapter while preserving offline development and the existing HTTP path. Live account acceptance is pending manual verification.

```mermaid
flowchart LR
    U[React / local input state] -->|POST /api/v1/analyze| V[FastAPI / AnalyzeRequest]
    V --> R[Thin async route]
    R --> S[AnalysisService]
    C[Backend environment / root .env] --> S
    S --> P[LLMProvider protocol]
    P --> F[FakeLLMProvider: default / local]
    P --> G[GroqProvider: explicit opt-in]
    G -->|one async request / no retry| X[Groq Chat Completions]
    X --> A[AnalysisContent validation]
    F --> A
    A --> M[Server-owned metadata / AnalyzeResponse]
    M -->|JSON| B[Browser runtime checks / TypeScript contract]
    B --> D[Result sections / local sequential hint reveal]
    P -. Future only .-> O[OllamaProvider]
```

Health is a separate GET route and never initializes or contacts an LLM client. Imports, application startup, package installation, builds, generated API documentation, and tests make no inference calls.

## Boundaries and lifecycle

- `frontend/src/App.tsx` owns input, result, error, and pending state. An immediate request reference closes the gap before controls become disabled; unmounting aborts a pending browser request. Editing removes stale output.
- `ProblemInput.tsx` shows the same 20–20,000 trimmed Unicode character bounds as the backend. Input and Clear are locked during requests; failures preserve text. Its description explains when text is sent to Groq.
- `AnalysisResult.tsx` renders mode/provider/model, nine semantic sections, null/empty states, uncertainties, and sequential hints. It depends on the shared response rather than SDK objects. All hints arrive at once; reveal buttons make no further requests and do not secure content from browser inspection.
- `services/api.ts` handles all HTTP, public base URL, JSON, a 45-second deadline, shape/metadata checks, and controlled error-code messages. Types disappear at runtime, so network data is checked before rendering. Raw provider messages are not displayed.
- `backend/app/api/routes/analyze.py` declares the contract, uses dependency injection, awaits AnalysisService, and returns AnalyzeResponse. There are no prompts, provider switches, or SDK details in the route.
- `services/analysis_service.py` selects the provider, validates content and creates server-owned metadata. Exceptions cross the API boundary only as safe AnalysisError codes. No automatic fallback or repair request occurs.
- `llm/base.py` is a Protocol: a name/model and an async `analyze(statement) -> AnalysisContent` method. Fake and Groq satisfy it without a class hierarchy or orchestration framework.
- `llm/fake_provider.py` returns a fresh deterministic example, independently of the input. It performs no inference, keyword matching, credential access, or network request.
- `llm/groq_provider.py` lazily creates AsyncGroq inside an analysis call. It fixes the host to the official Groq API, accepts only the two documented GPT-OSS model IDs, sets max_retries=0, applies token and total-time bounds, and closes the SDK client after the call. A configured model is never switched automatically.
- `llm/prompts.py` owns the educational, semantic-preservation, untrusted-input and no-solution policy. The user statement is serialized separately as data; credentials are never included in either message. Prompt instructions and code-fence rejection do not prove semantic correctness or disclosure safety.
- `schemas/analysis.py` separates model-generated AnalysisContent from trusted AnalyzeResponse metadata. Generation objects forbid extras and require every field; unknown semantic values use explicit null. Backend validators enforce nonblank text, no fenced code, and exactly three hints ordered 1–3.
- `core/config.py` merges optional root .env with process environment taking precedence, without mutating os.environ. Fake is the default. SecretStr is excluded from the settings repr. Invalid settings produce a safe configuration error rather than echoing values.
- `core/errors.py` defines fixed public messages; main.py serializes these through one exception handler. No raw SDK error, output body, key, or authorization header is logged by application code.

## Strict generation and response metadata

Groq receives the JSON Schema generated from AnalysisContent using `response_format.type=json_schema` and `strict=true`. All object properties are required and objects are closed, including nested definitions. Nullable values use unions; runtime validators enforce hint count/order and text rules without adding complex schema constructs. The adapter rejects missing/truncated content, malformed JSON, and invalid data instead of retrying or silently dropping validation.

Only semantic fields go to the model. AnalysisService sets `analysis_type`, `provider`, `model`, and `demo_notice`. Fake responses must be `mock/fake/null` with a demo notice; Groq responses must be `ai/groq/configured-model` without one. Pydantic and browser checks enforce that combination. Provider-returned model labels are not trusted as metadata.

Raw constraints, technique suggestions, observations and complexity comments in AI mode are model-generated, preliminary content. There is no symbolic parser, deterministic feasibility engine, retrieval system, or verified algorithm classifier.

## Budget, errors, and local configuration

Default fake mode needs no key or external service after installation. Groq mode requires the user's deliberate backend selection and a submission. There is one non-streaming request, default 3,072 maximum completion tokens with low reasoning effort, and a default 30-second total deadline (configurable up to 40). The browser waits up to 45 seconds. A character limit does not guarantee staying below an account's token quota.

Status mapping: configuration/auth/model-access 503, quota 429, timeout 504, invalid output 502, unavailable 503, unexpected internal error 500. Messages never use raw exceptions. No paid fallback, auto-upgrade, automatic retry, startup model probe, or model-list request is implemented. The app cannot inspect an account's billing plan; manual setup must stay on Groq Free, and fake mode remains available if free access is unavailable.

Exact local CORS origins and GET/POST are retained. Ports 5173 and 8000 are distinct origins; JSON POST uses a preflight. CORS is not authentication. Backend settings stay in the root .env/process environment; frontend VITE_API_BASE_URL is public. No real environment files are overwritten. Existing .gitignore patterns cover nested .env files.

## Offline verification and future work

Backend tests replace .env reads, force fake defaults, block external DNS/socket connections, and exercise the actual Groq SDK with httpx.MockTransport. Browser tests force fake mode and an empty key regardless of local live settings; external page requests are blocked. The AI result branch is tested with an explicit synthetic response. No test requires a live provider, key, or quota.

Manual Groq acceptance and the rubric in EVALUATION.md remain unverified. JSON validation cannot establish factual accuracy, task equivalence, technique correctness, or appropriate hint restraint.

A future OllamaProvider can implement the same protocol and AnalysisContent contract. Adding its metadata to backend/frontend types will not require provider-specific branches in the route or result component. It is not implemented here. Persistence, retrieval, advanced NLP, and deterministic complexity estimation remain later milestones.
