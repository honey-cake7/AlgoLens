"""Hardening: body limits, safe 500s, headers, provider rate limits, parser cost."""

import asyncio
import time

import pytest
from fastapi.testclient import TestClient

from app.algorithmic.constraints import ConstraintParser
from app.api.routes import analyze as analyze_route
from app.core.config import get_settings
from app.core.errors import AnalysisError
from app.core.security import MAX_BODY_BYTES, ProviderRateLimiter, provider_rate_limiter
from app.llm.fake_provider import FakeLLMProvider
from app.main import create_app
from app.schemas.analysis import AnalyzeRequest
from app.services.analysis_service import AnalysisService, get_analysis_service

ORIGIN = "http://127.0.0.1:5173"
STATEMENT = "Given an array of n integers, determine whether it is sorted. 1 <= n <= 200000"


@pytest.fixture
def client():
    return TestClient(create_app(), raise_server_exceptions=False)


def test_declared_oversized_body_is_rejected_before_parsing_with_cors(client):
    body = b'{"statement": "' + b"a" * (MAX_BODY_BYTES + 10) + b'"}'
    response = client.post("/api/v1/assess", content=body, headers={"Content-Type": "application/json", "Origin": ORIGIN})
    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "request_too_large"
    assert response.headers["access-control-allow-origin"] == ORIGIN


def test_chunked_oversized_body_is_rejected(client):
    def chunks():
        yield b'{"statement": "'
        for _ in range(40):
            yield b"a" * 8192
        yield b'"}'
    response = client.post("/api/v1/similar", content=chunks(), headers={"Content-Type": "application/json"})
    assert response.status_code == 413


def test_maximum_valid_statement_still_fits_the_limit(client):
    # Worst-case escaping: 20,000 non-BMP characters become \ud83d\ude00 pairs in ASCII JSON.
    import json
    body = json.dumps({"statement": "😀" * 20_000}).encode()
    assert len(body) <= MAX_BODY_BYTES
    assert client.post("/api/v1/assess", content=body, headers={"Content-Type": "application/json"}).status_code == 200


def test_security_headers_on_api_but_not_docs(client):
    response = client.get("/api/v1/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["cache-control"] == "no-store"
    assert "default-src 'none'" in response.headers["content-security-policy"]
    assert "content-security-policy" not in client.get("/docs").headers


def test_unexpected_errors_are_safe_json(client, monkeypatch):
    def explode(_statement):
        raise RuntimeError("secret path C:/internal and key gsk_test")
    monkeypatch.setattr(analyze_route, "assess_statement", explode)
    response = client.post("/api/v1/assess", json={"statement": STATEMENT})
    assert response.status_code == 500
    assert response.json()["detail"]["code"] == "internal_error"
    assert "secret" not in response.text and "gsk_" not in response.text


def test_rate_limiter_sliding_window():
    now = [0.0]
    limiter = ProviderRateLimiter(clock=lambda: now[0])
    assert limiter.acquire(2) and limiter.acquire(2)
    assert not limiter.acquire(2)
    now[0] = 59.9
    assert not limiter.acquire(2)
    now[0] = 60.0
    assert limiter.acquire(2)


class CountingProvider(FakeLLMProvider):
    name = "groq"
    model = "openai/gpt-oss-120b"

    def __init__(self):
        self.calls = 0

    async def analyze(self, statement):
        self.calls += 1
        raise AnalysisError("provider_unavailable")


def test_live_provider_calls_are_capped_before_reaching_the_provider():
    provider_rate_limiter.reset()
    provider = CountingProvider()
    service = AnalysisService(provider, requests_per_minute=1)
    with pytest.raises(AnalysisError) as first:
        asyncio.run(service.analyze(AnalyzeRequest(statement=STATEMENT)))
    assert first.value.code == "provider_unavailable"
    with pytest.raises(AnalysisError) as second:
        asyncio.run(service.analyze(AnalyzeRequest(statement=STATEMENT)))
    assert second.value.code == "local_rate_limit" and second.value.status_code == 429
    assert provider.calls == 1
    provider_rate_limiter.reset()


def test_fake_mode_is_not_rate_limited(client):
    provider_rate_limiter.reset()
    assert get_analysis_service().requests_per_minute is None
    for _ in range(12):
        assert client.post("/api/v1/analyze", json={"statement": STATEMENT}).status_code == 200


def test_rate_setting_is_validated(monkeypatch):
    monkeypatch.setenv("GROQ_REQUESTS_PER_MINUTE", "0")
    with pytest.raises(AnalysisError):
        get_settings()


@pytest.mark.parametrize("text", [
    ("1 ≤ n ≤ 2 × 10⁵ " * 1300)[:20000],
    ("n <= 5 or " * 2000)[:20000],
    ("the sum of n over all test cases does not exceed " * 400)[:20000],
    ("1 <= n <= 5\n" * 2000)[:20000],
])
def test_parser_stays_fast_on_maximum_length_adversarial_input(text):
    # Previously several seconds (quadratic per-match scans); now near-linear.
    start = time.perf_counter()
    ConstraintParser().parse(text)
    assert time.perf_counter() - start < 2.0


def test_request_log_has_id_and_never_the_statement(client, caplog):
    secret = "Given an array of n integers, find the PRIVATE-STATEMENT-MARKER count. 1 <= n <= 10"
    with caplog.at_level("INFO", logger="algolens.access"):
        response = client.post("/api/v1/assess?token=QUERY-SECRET", json={"statement": secret}, headers={"Authorization": "Bearer AUTH-SECRET"})
    assert response.status_code == 200 and len(response.headers["x-request-id"]) == 32
    line = " ".join(record.getMessage() for record in caplog.records)
    assert "path=/api/v1/assess" in line and "status=200" in line and response.headers["x-request-id"] in line
    assert "PRIVATE-STATEMENT-MARKER" not in line and "QUERY-SECRET" not in line and "AUTH-SECRET" not in line


@pytest.mark.parametrize("supplied,reused", [("trace-123", True), ("bad id\nINJECTED", False), ("x" * 65, False)])
def test_supplied_request_ids_are_reused_only_when_safe(client, supplied, reused):
    response = client.get("/api/v1/health", headers={"X-Request-ID": supplied})
    assert (response.headers["x-request-id"] == supplied) is reused
