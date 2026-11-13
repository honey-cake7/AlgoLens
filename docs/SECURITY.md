# Security and robustness audit

Audit date: 2026-11-14. Scope: the local FastAPI backend, React client, retrieval, and project tooling. Each finding was reproduced against the real app before being fixed, and each fix has a regression test.

## Fixed

| # | Finding | Evidence | Fix | Tests |
|---|---|---|---|---|
| 1 | **Parser CPU blow-up.** Constraint validation copied the whole line prefix/suffix and rescanned it for every candidate match, which is quadratic on long one-line input. | A legal 20,000-character statement of repeated constraints took 4–11 s in `/assess`. | `valid_fragment` now inspects only characters next to the match, uses offset `match()` calls, bisect for overlap and example-word checks, and memoizes per-line and per-word checks. Output is identical to the old parser on 12,000 fuzzed inputs. | `test_parser_stays_fast_on_maximum_length_adversarial_input` (< 2 s; measured about 0.1–0.3 s) |
| 2 | **Event-loop blocking.** `/analyze` ran the CPU-bound parser directly inside its async handler. | One slow statement froze every request, including `/health`. | The parser runs in a worker thread (`asyncio.to_thread`). | Existing `/analyze` tests |
| 3 | **Unbounded request bodies.** The 20,000-character limit is checked only after the full body is read and parsed. | A 30 MB body was fully parsed before rejection. Larger bodies cost proportionally more memory. | `BodySizeLimitMiddleware` rejects bodies over 256 KiB (any valid request fits, even fully escaped) with JSON 413, including chunked bodies without Content-Length. | `test_declared_oversized_body…`, `test_chunked_oversized_body…`, `test_maximum_valid_statement_still_fits_the_limit` |
| 4 | **Free-quota draining.** Nothing limited live Groq calls. Scripts, extra tabs, or LAN clients (if someone binds `0.0.0.0`) could use up the account's free quota. | Code review. CORS is not authentication, and the frontend's duplicate-submit guard protects only one tab. | In Groq mode only, a per-process sliding window allows at most `GROQ_REQUESTS_PER_MINUTE` (default 10) calls. Excess requests get 429 `local_rate_limit` *before* any provider call. Fake mode is unlimited. | `test_live_provider_calls_are_capped…`, `test_rate_limiter_sliding_window`, browser `local live-analysis cap…` |
| 5 | **Non-JSON 500s.** Unhandled errors returned Starlette's plain-text 500, outside the documented error contract. | Code review | A catch-all handler returns the fixed `internal_error` JSON. No exception text or traceback is sent. | `test_unexpected_errors_are_safe_json` |
| 6 | **Missing response hardening headers.** | Code review | API responses carry `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, and a deny-all CSP. `/docs` keeps FastAPI defaults so it still works. | `test_security_headers_on_api_but_not_docs` |
| 7 | **No request trail.** There was no way to correlate a user report with a server event. | Code review | One log line per request: id, method, path, status, duration. Bodies, query strings, and headers are never logged. A client `X-Request-ID` is reused only if it matches `[A-Za-z0-9-]{1,64}`, which blocks log injection. | `test_request_log_has_id_and_never_the_statement`, `test_supplied_request_ids…` |
| 8 | **No automated checks on push.** Tests ran only when someone remembered to. | Repository had no CI | `.github/workflows/ci.yml` runs backend tests (Python 3.11/3.13), a strict catalog check, the frontend build, and Edge browser tests on Windows. No secrets are used. | Runs when pushed (not yet run on GitHub) |
| 9 | **Future external links could be unsafe.** The schema had no rules for external sources, so the first one added would set its own. | Design gap for Stage 6 | External records need https URL, source name, license note, and verified date. Original records may not claim any of these. The browser re-validates and renders links with `rel="noopener noreferrer"`, rejecting `javascript:`, `data:`, and `http:` URLs. | `test_catalog_stage6.py`, browser provenance tests |

## Checked and not a problem

- **Cross-site request forgery via simple requests.** A malicious page can send `text/plain` POSTs without a CORS preflight, but FastAPI rejects non-JSON bodies with 422 on all three POST routes, so no analysis (or Groq call) starts.
- **Secrets in the browser.** Only `VITE_API_BASE_URL` is public. Keys stay in the backend `SecretStr` settings.
- **HTML injection.** React escapes all rendered text. No `innerHTML`, `dangerouslySetInnerHTML`, or `eval` is used. Theme storage access is wrapped in `try/catch`.

## Known limits (accepted, documented)

- **Hints are not secret.** All three hints arrive in one response, so reveal buttons are a learning aid, not access control.
- **Prompt injection.** A statement can contain instructions aimed at the model. The system prompt, strict JSON schema, and code-fence rejection reduce but do not eliminate this.
- **No authentication.** The API is meant for `127.0.0.1`. Binding it to a public interface exposes it to anyone who can reach the port. The rate limit protects the free quota but is not access control.
- **Per-process limits.** The rate limiter and caches are in memory. Multiple workers or restarts each get a fresh window.
- **Unpinned Python dependencies.** `pyproject.toml` uses bounded ranges. A lock file is deferred until deployment needs exact reproducibility.
