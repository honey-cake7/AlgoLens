# AlgoLens AI contributor guidance

Follow each contributor's global RTK guidance (for example `~/.claude/RTK.md` or `~/.codex/RTK.md`) when available. Prefix shell commands with `rtk`; `rtk proxy` can run commands without filtering.

- Current state: Stages 0–5 complete; Stage 6 provenance groundwork and the local part of Stage 8 (see docs/SECURITY.md) complete; Stage 7 gated (no training). Preserve all of it. Never tune cue rules or weights against the test split; if a test result exposes a bug, report pre-fix numbers as held-out. Labels are assistant-reviewed pending user sign-off (docs/LABEL_REVIEW.md); never call them human-reviewed. Add external records only with human-verified provenance; run `python -m app.retrieval.catalog_check --strict` after catalog edits.
- Keep changes small, focused, understandable, and limited to the requested behavior. Preserve user work.
- Read README.md and the relevant docs before changes. Read docs/ARCHITECTURE.md and docs/DECISIONS.md before modifying architecture; record material decisions there.
- Test changed behavior, including failure cases where relevant. Run backend pytest for API changes and frontend typecheck/build for frontend changes. Add targeted behavior tests as features grow.
- Explain nontrivial code and design choices in clear language; prefer straightforward modules to speculative abstractions.
- Summarize changed files, actual test results, and any checks that could not run. Never fabricate results.
- Never hardcode credentials or expose backend secrets through frontend variables. Keep local .env files ignored and examples free of secrets.
- Budget is ₹0. No paid APIs, hosting, infrastructure, automatic provider fallback, or quota retries. Live Groq calls may occur only with explicit Groq configuration and a user analysis submission; never during startup, installation, builds, or tests.
- Tests must force FakeLLMProvider or mock the SDK transport, ignore real credentials, and block external network access. Never expose raw SDK errors, keys, prompts, or authorization headers in logs or API errors.
- Preserve Stage 3 evidence, ambiguity, safe arithmetic, and heuristic caveats. Retrieval must add no Groq calls; default to TF-IDF and make semantic dependencies optional. Only explicit setup may download a model; runtime loading must be local-only. Tests use fake encoders and block downloads.
- Use original authored practice records. External records require source_url, source_name, license_note, verified_on, all verified by a person; never fabricate contest links. Keep evaluation queries separate, exclude technique labels from retrieval text, and report measured metrics without claiming algorithmic equivalence.
- Do not introduce a database, authentication, scraping, ML training, paid infrastructure, or Ollama implementation.
- Do not generate fake algorithmic analysis or invent problem identifiers or URLs. Future mocks must be explicitly labeled.
- Do not commit, create a remote, or push unless explicitly requested.

The expected API entry point is backend/app/main.py. The browser entry point is frontend/src/main.tsx. Keep HTTP contracts in backend/app/schemas and frontend/src/types; network calls belong in frontend/src/services.
