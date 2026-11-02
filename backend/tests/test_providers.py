import asyncio
import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from groq import AsyncGroq
from pydantic import SecretStr, ValidationError

from app.core import config
from app.core.config import Settings
from app.core.errors import AnalysisError
from app.llm import groq_provider
from app.llm.fake_provider import FakeLLMProvider
from app.llm.groq_provider import GroqProvider
from app.llm.prompts import SYSTEM_PROMPT
from app.main import create_app
from app.schemas.analysis import AnalysisContent, AnalyzeRequest, AnalyzeResponse
from app.services.analysis_service import AnalysisService, get_analysis_service

STATEMENT = "Given an array of integers, process the range queries described below."


def demo_content():
    return asyncio.run(FakeLLMProvider().analyze(STATEMENT)).model_dump()


def completion(content, finish="stop"):
    return {
        "id": "offline-test", "object": "chat.completion", "created": 0,
        "model": "untrusted-model-label",
        "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": finish}],
    }


def install_transport(monkeypatch, handler):
    calls = []
    options = []

    async def record(request):
        calls.append(request)
        result = handler(request)
        return await result if hasattr(result, "__await__") else result

    def factory(**kwargs):
        options.append(kwargs)
        return AsyncGroq(**kwargs, http_client=httpx.AsyncClient(transport=httpx.MockTransport(record)))

    monkeypatch.setattr(groq_provider, "AsyncGroq", factory)
    return calls, options


def groq_app(monkeypatch, handler, **overrides):
    calls, options = install_transport(monkeypatch, handler)
    # Ephemeral random sentinel, never a real key or a committed key fixture.
    sentinel = uuid4().hex
    settings = Settings(llm_provider="groq", groq_api_key=SecretStr(sentinel), **overrides)
    app = create_app()
    app.dependency_overrides[get_analysis_service] = lambda: AnalysisService(GroqProvider(settings))
    return app, calls, options, sentinel


def test_fake_is_default_without_key_or_network(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER")
    monkeypatch.delenv("GROQ_API_KEY")
    assert config.get_settings().llm_provider == "fake"
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/analyze", json={"statement": STATEMENT})
    assert response.status_code == 200
    assert response.json()["provider"] == "fake"
    assert response.json()["analysis_type"] == "mock"


def test_settings_process_environment_overrides_dotenv(monkeypatch):
    monkeypatch.setattr(config, "dotenv_values", lambda *_: {"LLM_PROVIDER": "groq", "GROQ_MODEL": "different"})
    assert config.get_settings().llm_provider == "fake"
    assert config.get_settings().groq_model == "openai/gpt-oss-120b"


def test_startup_health_and_docs_never_initialize_groq(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", uuid4().hex)
    def forbidden(**_kwargs):
        pytest.fail("SDK must not initialize during startup/health/docs")
    monkeypatch.setattr(groq_provider, "AsyncGroq", forbidden)
    with TestClient(create_app()) as client:
        assert client.get("/api/v1/health").status_code == 200
        assert client.get("/openapi.json").status_code == 200


@pytest.mark.parametrize("model", ["openai/gpt-oss-120b", "openai/gpt-oss-20b"])
def test_successful_groq_uses_one_strict_request_and_server_metadata(monkeypatch, model):
    # Prepare fixture data before entering the async SDK transport callback.
    content = demo_content()
    app, calls, options, key = groq_app(monkeypatch, lambda _: httpx.Response(200, json=completion(json.dumps(content))), groq_model=model)
    with TestClient(app) as client:
        response = client.post("/api/v1/analyze", json={"statement": "  " + STATEMENT + "  "})
    assert response.status_code == 200
    result = AnalyzeResponse.model_validate(response.json())
    assert (result.analysis_type, result.provider, result.model, result.demo_notice) == ("ai", "groq", model, None)
    assert key not in response.text
    assert len(calls) == 1
    assert str(calls[0].url) == "https://api.groq.com/openai/v1/chat/completions"
    request = json.loads(calls[0].content)
    assert request["model"] == model
    assert request["max_completion_tokens"] == 3072
    assert request["reasoning_effort"] == "low"
    assert request["stream"] is False
    assert request["response_format"]["json_schema"]["strict"] is True
    assert request["messages"][0] == {"role": "system", "content": SYSTEM_PROMPT}
    assert json.loads(request["messages"][1]["content"]) == {"problem_statement": STATEMENT}
    assert key not in json.dumps(request["messages"])
    assert options[0]["max_retries"] == 0
    assert options[0]["timeout"] == 30


@pytest.mark.parametrize("status,code,expected", [
    (429, "rate_limit", 429), (401, "configuration_error", 503),
    (403, "configuration_error", 503), (400, "configuration_error", 503),
    (404, "configuration_error", 503), (500, "provider_unavailable", 503),
    (503, "provider_unavailable", 503),
])
def test_provider_status_errors_are_safe_without_retries_or_fallback(monkeypatch, caplog, status, code, expected):
    sentinel = uuid4().hex
    def forbidden_fake(*_args):
        pytest.fail("Groq errors must not silently fall back to fake mode")
    monkeypatch.setattr(FakeLLMProvider, "analyze", forbidden_fake)
    app, calls, _, key = groq_app(monkeypatch, lambda _: httpx.Response(status, json={"error": {"message": sentinel}}))
    with TestClient(app) as client:
        response = client.post("/api/v1/analyze", json={"statement": STATEMENT})
    assert response.status_code == expected
    assert response.json()["detail"]["code"] == code
    assert len(calls) == 1
    assert sentinel not in response.text and key not in response.text
    assert sentinel not in caplog.text and key not in caplog.text


@pytest.mark.parametrize("error,code,status", [
    (httpx.ReadTimeout, "provider_timeout", 504),
    (httpx.ConnectError, "provider_unavailable", 503),
])
def test_transport_errors(monkeypatch, error, code, status):
    def fail(request):
        raise error("Private transport detail", request=request)
    app, calls, _, _ = groq_app(monkeypatch, fail)
    with TestClient(app) as client:
        response = client.post("/api/v1/analyze", json={"statement": STATEMENT})
    assert response.status_code == status
    assert response.json()["detail"]["code"] == code
    assert "Private transport detail" not in response.text
    assert len(calls) == 1


def test_total_timeout_bounds_slow_provider(monkeypatch):
    async def slow(_request):
        await asyncio.sleep(1)
        return httpx.Response(200, json={})
    app, calls, _, _ = groq_app(monkeypatch, slow, groq_timeout_seconds=0.02)
    with TestClient(app) as client:
        response = client.post("/api/v1/analyze", json={"statement": STATEMENT})
    assert response.status_code == 504
    assert response.json()["detail"]["code"] == "provider_timeout"
    assert len(calls) == 1


@pytest.mark.parametrize("body", [
    completion("{"), completion("{}"), completion(None),
    completion("{}", finish="length"), {"choices": []},
])
def test_malformed_or_truncated_provider_response(monkeypatch, body):
    app, calls, _, _ = groq_app(monkeypatch, lambda _: httpx.Response(200, json=body))
    with TestClient(app) as client:
        response = client.post("/api/v1/analyze", json={"statement": STATEMENT})
    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "invalid_response"
    assert len(calls) == 1


def test_missing_key_returns_configuration_error_without_client(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setattr(groq_provider, "AsyncGroq", lambda **_: pytest.fail("Missing key must not initialize SDK"))
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/analyze", json={"statement": STATEMENT})
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "configuration_error"


def test_unsupported_model_rejected_without_request(monkeypatch):
    app, calls, _, _ = groq_app(monkeypatch, lambda _: pytest.fail("Unsupported model must not be requested"), groq_model="not-an-approved-model")
    with TestClient(app) as client:
        response = client.post("/api/v1/analyze", json={"statement": STATEMENT})
    assert response.status_code == 503 and calls == []


def test_unknown_provider_configuration_is_safe(monkeypatch):
    sentinel = uuid4().hex
    monkeypatch.setenv("LLM_PROVIDER", sentinel)
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/analyze", json={"statement": STATEMENT})
    assert response.status_code == 503
    assert sentinel not in response.text


@pytest.mark.parametrize("levels", [[], [1], [1, 2], [1, 2, 3, 3], [1, 1, 3], [3, 2, 1]])
def test_exactly_three_ordered_hints_are_required(levels):
    data = demo_content()
    data["hints"] = [{"level": level, "text": "A guiding question"} for level in levels]
    with pytest.raises(ValidationError):
        AnalysisContent.model_validate(data)


def test_unknown_semantic_values_use_null_not_invented_text():
    data = demo_content()
    data.update(objective=None, input_summary=None, output_summary=None, constraints=[], possible_techniques=[])
    data["uncertainties"] = ["The statement is incomplete."]
    assert AnalysisContent.model_validate(data).objective is None


@pytest.mark.parametrize("change", [
    {"simplified_problem": " "}, {"objective": 123},
    {"provider": "fake"}, {"simplified_problem": "```python\nprint(1)\n```"},
])
def test_content_rejects_invalid_text_types_code_and_metadata(change):
    with pytest.raises(ValidationError):
        AnalysisContent.model_validate({**demo_content(), **change})


def test_generation_schema_uses_required_closed_objects_and_no_metadata():
    schema = AnalysisContent.model_json_schema()
    def check(node):
        if isinstance(node, dict):
            if node.get("type") == "object":
                assert node.get("additionalProperties") is False
                assert set(node["required"]) == set(node["properties"])
            for value in node.values():
                check(value)
        elif isinstance(node, list):
            for value in node:
                check(value)
    check(schema)
    assert not {"analysis_type", "provider", "model", "demo_notice"} & set(schema["properties"])
    assert "anyOf" in schema["properties"]["objective"]


def test_service_sanitizes_unexpected_internal_errors():
    sentinel = uuid4().hex
    class BrokenProvider:
        name = "fake"
        model = None
        async def analyze(self, _statement):
            raise RuntimeError(sentinel)
    with pytest.raises(AnalysisError) as error:
        asyncio.run(AnalysisService(BrokenProvider()).analyze(AnalyzeRequest(statement=STATEMENT)))
    assert error.value.code == "internal_error"
    assert sentinel not in str(error.value)


