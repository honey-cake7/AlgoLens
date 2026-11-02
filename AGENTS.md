# AlgoLens AI contributor guidance

Follow the user's global guidance at `C:\Users\anike\.codex\RTK.md` when available. Prefix shell commands with `rtk`; `rtk proxy` can run commands without filtering.

- Stage 3 is the current scope: offline constraint extraction and heuristic growth assessment alongside the existing provider analysis. Do not silently implement later stages.
- Keep changes small, focused, understandable, and limited to the requested behavior. Preserve user work.
- Read README.md and the relevant docs before changes. Read docs/ARCHITECTURE.md and docs/DECISIONS.md before modifying architecture; record material decisions there.
- Test changed behavior, including failure cases where relevant. Run backend pytest for API changes and frontend typecheck/build for frontend changes. Add targeted behavior tests as features grow.
- Explain nontrivial code and design choices in clear language; prefer straightforward modules to speculative abstractions.
- Summarize changed files, actual test results, and any checks that could not run. Never fabricate results.
- Never hardcode credentials or expose backend secrets through frontend variables. Keep local .env files ignored and examples free of secrets.
- Budget is ₹0. No paid APIs, hosting, infrastructure, automatic provider fallback, or quota retries. Live Groq calls may occur only with explicit Groq configuration and a user analysis submission; never during startup, installation, builds, or tests.
- Tests must force FakeLLMProvider or mock the SDK transport, ignore real credentials, and block external network access. Never expose raw SDK errors, keys, prompts, or authorization headers in logs or API errors.
- Stage 3 must add no model calls or dependencies. Preserve original evidence, distinguish values from size parameters, expose ambiguous/unsupported input, and never equate growth units with runtime or promise AC/TLE. Test aggregate bounds and large-number safety.
- Do not introduce a database, authentication, scraping, ML training, retrieval, paid infrastructure, or Ollama implementation.
- Do not generate fake algorithmic analysis or invent problem identifiers or URLs. Future mocks must be explicitly labeled.
- Do not commit, create a remote, or push unless explicitly requested.

The expected API entry point is backend/app/main.py. The browser entry point is frontend/src/main.tsx. Keep HTTP contracts in backend/app/schemas and frontend/src/types; network calls belong in frontend/src/services.
