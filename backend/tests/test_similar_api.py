from fastapi.testclient import TestClient
import pytest

from app.llm.fake_provider import FakeLLMProvider
from app.main import create_app
from app.retrieval import cache
from app.schemas.analysis import AnalysisContent
from app.schemas.retrieval import SimilarResponse
from app.services import analysis_service
from app.services.analysis_service import AnalysisService, get_analysis_service
from app.services.similar_problem_service import get_similar_service

QUERY = "Find inclusive interval sums for many queries on a fixed signed array."


def test_standalone_search_is_independent_of_invalid_provider_settings(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "invalid")
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/similar", json={"statement": "  " + QUERY + " ", "k": 3})
    assert response.status_code == 200
    result = SimilarResponse.model_validate(response.json())
    assert result.query == QUERY and len(result.matches) == 3
    assert result.matches[0].problem_id == "ledger_ranges"
    assert result.query_source == "raw_statement" and result.retrieval_method == "tfidf"
    assert all(item.source_url is None for item in result.matches)


@pytest.mark.parametrize("body", [{}, {"statement": ""}, {"statement": "short"}, {"statement": 4}, {"statement": "x" * 20001}, *[{"statement": QUERY, "k": k} for k in [0, 21, True, "5", 2.5]]])
def test_similar_validation(body):
    with TestClient(create_app()) as client:
        assert client.post("/api/v1/similar", json=body).status_code == 422


def test_default_and_large_k_empty_matches_and_cors():
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/similar", json={"statement": QUERY}, headers={"Origin": "http://localhost:5173"})
        large = client.post("/api/v1/similar", json={"statement": QUERY, "k": 20})
        empty = client.post("/api/v1/similar", json={"statement": "zzzzxyz " * 4})
    assert response.status_code == large.status_code == empty.status_code == 200
    assert len(response.json()["matches"]) == 5 and len(large.json()["matches"]) <= 20
    assert empty.json()["matches"] == []
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_semantic_missing_model_fallback_is_honest(monkeypatch):
    monkeypatch.setenv("RETRIEVAL_METHOD", "semantic")
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/similar", json={"statement": QUERY})
    assert response.status_code == 200
    data = response.json()
    assert data["requested_method"] == "semantic" and data["retrieval_method"] == "tfidf"
    assert any("No model was downloaded" in warning for warning in data["warnings"])


def test_semantic_mock_mode_has_semantic_labels(monkeypatch):
    class MockEncoder:
        def encode(self, sentences, **kwargs):
            return [[1, 0] for _ in sentences]
    cache.clear_cache()
    monkeypatch.setenv("RETRIEVAL_METHOD", "semantic")
    monkeypatch.setattr(cache, "load_local_encoder", lambda *_: MockEncoder())
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/similar", json={"statement": QUERY})
    assert response.status_code == 200
    assert response.json()["retrieval_method"] == "semantic"
    assert all(row["retrieval_method"] == "semantic" for row in response.json()["matches"])
    cache.clear_cache()


def test_safe_retrieval_error_does_not_expose_exception():
    class Broken:
        def search(self, *_):
            raise RuntimeError("Private local path and secret sentinel")
    app = create_app()
    app.dependency_overrides[get_similar_service] = Broken
    with TestClient(app) as client:
        response = client.post("/api/v1/similar", json={"statement": QUERY})
    assert response.status_code == 503 and response.json()["detail"]["code"] == "retrieval_unavailable"
    assert "sentinel" not in response.text


def test_integrated_raw_query_never_uses_fake_simplification_and_one_provider_call():
    class CountingFake(FakeLLMProvider):
        calls = 0
        async def analyze(self, statement):
            self.calls += 1
            return await super().analyze(statement)
    provider = CountingFake()
    app = create_app()
    app.dependency_overrides[get_analysis_service] = lambda: AnalysisService(provider)
    with TestClient(app) as client:
        combined = client.post("/api/v1/analyze", json={"statement": QUERY})
        client.post("/api/v1/similar", json={"statement": QUERY})
    assert combined.status_code == 200 and provider.calls == 1
    assert combined.json()["similar_problems"]["query"] == QUERY
    assert combined.json()["similar_problems"]["query_source"] == "raw_statement"
    assert len(combined.json()["hints"]) == 3
    assert combined.json()["deterministic"]["source"] == "deterministic"


@pytest.mark.parametrize("uncertain", [True, False])
def test_existing_ai_simplification_reused_only_when_no_reported_uncertainty(uncertain):
    class StubAI(FakeLLMProvider):
        name = "groq"
        model = "fixture"
        async def analyze(self, statement):
            content = await super().analyze(statement)
            return content.model_copy(update={"simplified_problem": "Find maximum sum over two distinct sorted array positions under a budget.", "uncertainties": ["Missing meaning"] if uncertain else []})
    app = create_app()
    app.dependency_overrides[get_analysis_service] = lambda: AnalysisService(StubAI())
    with TestClient(app) as client:
        response = client.post("/api/v1/analyze", json={"statement": QUERY})
    assert response.status_code == 200
    result = response.json()["similar_problems"]
    assert result["query_source"] == ("raw_statement" if uncertain else "ai_simplification")
    assert (result["query"] == QUERY) == uncertain


def test_retrieval_failure_preserves_successful_analysis(monkeypatch):
    class Broken:
        def search(self, *_):
            raise RuntimeError("private error")
    monkeypatch.setattr(analysis_service, "get_similar_service", Broken)
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/analyze", json={"statement": QUERY})
    assert response.status_code == 200
    assert response.json()["similar_problems"] is None
    assert response.json()["retrieval_warning"] and len(response.json()["hints"]) == 3
    assert "private" not in response.text


def test_generation_schema_still_excludes_retrieval():
    properties = AnalysisContent.model_json_schema()["properties"]
    assert "similar_problems" not in properties and "retrieval_warning" not in properties


def test_retrieval_deadline_preserves_analysis(monkeypatch):
    async def slow_search(*_args, **_kwargs):
        raise TimeoutError("private timing details")
    monkeypatch.setattr(analysis_service, "run_in_threadpool", slow_search)
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/analyze", json={"statement": QUERY})
    assert response.status_code == 200 and response.json()["retrieval_warning"]
    assert len(response.json()["hints"]) == 3
