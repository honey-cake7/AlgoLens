"""Small, dependency-free request protections for a local single-process API.

- BodySizeLimitMiddleware rejects oversized bodies while they stream in, before
  JSON parsing. Pydantic's 20,000-character limit only applies after the whole
  body has been read and parsed, so without this a huge body costs memory/CPU.
- SecurityHeadersMiddleware adds conservative headers to every API response.
- ProviderRateLimiter caps live provider calls per minute so a script, another
  tab, or a LAN client (if someone binds 0.0.0.0) cannot drain the free quota.
  It is per process and in memory: a local safeguard, not authentication.
"""

import json
import time
from collections import deque
from threading import Lock

# 20,000 code points can need up to 12 bytes each when JSON-escaped as
# surrogate pairs (😀), about 240 KB; 256 KiB fits any valid request.
MAX_BODY_BYTES = 256 * 1024

SECURITY_HEADERS = [
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"no-referrer"),
    (b"cache-control", b"no-store"),
    (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'"),
]
# FastAPI's interactive docs load their own scripts/styles, so they keep defaults.
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")


def _json_error(status: int, code: str, message: str):
    body = json.dumps({"detail": {"code": code, "message": message}}).encode()
    return status, [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())], body


class BodySizeLimitMiddleware:
    def __init__(self, app, max_bytes: int = MAX_BODY_BYTES):
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        declared = dict(scope.get("headers") or []).get(b"content-length")
        if declared is not None:
            try:
                too_large = int(declared) > self.max_bytes
            except ValueError:
                too_large = True
            if too_large:
                return await self._reject(send)
        received = 0
        rejected = False

        async def limited_receive():
            # Bodies without Content-Length (chunked) are counted as they stream.
            # Past the limit, stop reading and end the body early; the app's
            # resulting parse error is replaced by a 413 in limited_send.
            nonlocal received, rejected
            if rejected:
                return {"type": "http.request", "body": b"", "more_body": False}
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    rejected = True
                    return {"type": "http.request", "body": b"", "more_body": False}
            return message

        async def limited_send(message):
            if not rejected:
                return await send(message)
            if message["type"] == "http.response.start":
                await self._reject(send)
            # Drop the app's own body for a rejected request.

        await self.app(scope, limited_receive, limited_send)

    async def _reject(self, send):
        status, headers, body = _json_error(413, "request_too_large", "The request body is too large. Statements are limited to 20,000 characters.")
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": body})


class SecurityHeadersMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("path", "").startswith(DOCS_PATHS):
            return await self.app(scope, receive, send)

        async def with_headers(message):
            if message["type"] == "http.response.start":
                existing = {name.lower() for name, _ in message.get("headers", [])}
                message["headers"] = list(message.get("headers", [])) + [item for item in SECURITY_HEADERS if item[0] not in existing]
            await send(message)

        await self.app(scope, receive, with_headers)


class ProviderRateLimiter:
    """Sliding one-minute window. `acquire` returns False when the cap is reached."""

    def __init__(self, clock=time.monotonic):
        self.clock, self.calls, self.lock = clock, deque(), Lock()

    def acquire(self, per_minute: int) -> bool:
        now = self.clock()
        with self.lock:
            while self.calls and now - self.calls[0] >= 60:
                self.calls.popleft()
            if len(self.calls) >= per_minute:
                return False
            self.calls.append(now)
            return True

    def reset(self):
        with self.lock:
            self.calls.clear()


provider_rate_limiter = ProviderRateLimiter()
