"""Minimal request logging: one line per request, no statement text.

Logged fields: request id, method, path, status, duration. Bodies, query
strings, headers (including Authorization), and provider output are never
logged. A client-supplied X-Request-ID is reused only if it is a short safe
token, so it cannot inject fake log lines.
"""

import logging
import re
import time
import uuid

logger = logging.getLogger("algolens.access")
_SAFE_ID = re.compile(r"[A-Za-z0-9-]{1,64}")


class RequestLogMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        supplied = dict(scope.get("headers") or []).get(b"x-request-id", b"").decode("latin-1")
        request_id = supplied if _SAFE_ID.fullmatch(supplied) else uuid.uuid4().hex
        status = 500
        start = time.perf_counter()

        async def with_id(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                message["headers"] = list(message.get("headers", [])) + [(b"x-request-id", request_id.encode())]
            await send(message)

        try:
            await self.app(scope, receive, with_id)
        finally:
            logger.info("request_id=%s method=%s path=%s status=%s duration_ms=%.1f", request_id, scope.get("method"),
                        scope.get("path"), status, (time.perf_counter() - start) * 1000)


def configure_logging():
    """Attach one console handler; uvicorn configures only its own loggers."""
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
