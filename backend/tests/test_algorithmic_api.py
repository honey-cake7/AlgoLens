import asyncio

import pytest
from fastapi.testclient import TestClient

from app.core.errors import AnalysisError
from app.llm import groq_provider
from app.llm.fake_provider import FakeLLMProvider
from app.main import create_app
from app.schemas.algorithmic import AlgorithmicAssessment
from app.schemas.analysis import AnalyzeResponse, ComplexityGuidance
from app.services.analysis_service import AnalysisService, get_analysis_service

STATEMENT = "Given an array of n integers, process its elements. 1 <= n <= 200000"


def test_combined_fake_output_keeps_true_statement_assessment_separate():
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/analyze", json={"statement": STATEMENT})
    assert response.status_code == 200
    result = AnalyzeResponse.model_validate(response.json())
    assert result.provider == "fake" and result.analysis_type == "mock"
    assert result.deterministic.selected_parameter == "n"
    assert result.deterministic.extraction.size_parameters[0].upper_bound == 200000
    assert any(item.expression == "1 ≤ N ≤ 100,000" for item in result.constraints)
    assert result.deterministic.discrepancies == []  # The unrelated demo is not AI evidence.
    fake = asyncio.run(FakeLLMProvider().analyze(STATEMENT))
    assert result.hints == fake.hints


def test_offline_endpoint_has_no_configuration_or_provider_dependency(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "invalid-selection")
    monkeypatch.setattr(groq_provider, "AsyncGroq", lambda **_: pytest.fail("Offline assessment must never initialize Groq"))
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/assess", json={"statement": STATEMENT})
        bad_provider = client.post("/api/v1/analyze", json={"statement": STATEMENT})
    assert response.status_code == 200
    result = AlgorithmicAssessment.model_validate(response.json())
    assert result.source == "deterministic" and result.selected_parameter == "n"
    assert bad_provider.status_code == 503


@pytest.mark.parametrize("body", [{}, {"statement": ""}, {"statement": "short"}, {"statement": "x" * 20001}, {"statement": 123}])
def test_offline_endpoint_preserves_request_validation(body):
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/assess", json=body)
    assert response.status_code == 422


def test_offline_endpoint_rejects_malformed_json():
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/assess", content="{", headers={"Content-Type": "application/json"})
    assert response.status_code == 422


def test_integration_keeps_one_provider_call():
    class CountingProvider(FakeLLMProvider):
        calls = 0
        async def analyze(self, statement):
            self.calls += 1
            return await super().analyze(statement)
    provider = CountingProvider()
    app = create_app()
    app.dependency_overrides[get_analysis_service] = lambda: AnalysisService(provider)
    with TestClient(app) as client:
        assert client.post("/api/v1/analyze", json={"statement": STATEMENT}).status_code == 200
        assert client.post("/api/v1/assess", json={"statement": STATEMENT}).status_code == 200
    assert provider.calls == 1


def test_provider_failure_still_leaves_offline_assessment_accessible():
    class UnavailableProvider:
        name = "groq"
        model = "openai/gpt-oss-120b"
        calls = 0
        async def analyze(self, _statement):
            self.calls += 1
            raise AnalysisError("rate_limit")
    provider = UnavailableProvider()
    app = create_app()
    app.dependency_overrides[get_analysis_service] = lambda: AnalysisService(provider)
    with TestClient(app) as client:
        failed = client.post("/api/v1/analyze", json={"statement": STATEMENT})
        offline = client.post("/api/v1/assess", json={"statement": STATEMENT})
    assert failed.status_code == 429
    assert failed.json()["detail"]["code"] == "rate_limit"
    assert offline.status_code == 200 and offline.json()["source"] == "deterministic"
    assert provider.calls == 1


@pytest.mark.parametrize("assessment,expected", [("Promising", True), ("Likely infeasible", False)])
def test_ai_discrepancy_is_tentative_and_does_not_replace_guidance(assessment, expected):
    class AIStub:
        name = "groq"
        model = "openai/gpt-oss-120b"
        async def analyze(self, statement):
            content = await FakeLLMProvider().analyze(statement)
            return content.model_copy(update={"complexity_guidance": [ComplexityGuidance(complexity="O(n²)", assessment=assessment, explanation="Fixture suggestion based on a hypothetical algorithm.")]})
    app = create_app()
    app.dependency_overrides[get_analysis_service] = lambda: AnalysisService(AIStub())
    with TestClient(app) as client:
        response = client.post("/api/v1/analyze", json={"statement": STATEMENT})
    assert response.status_code == 200
    data = response.json()
    assert data["complexity_guidance"][0]["assessment"] == assessment
    assert bool(data["deterministic"]["discrepancies"]) is expected
    if expected:
        assert "Potential inconsistency" in data["deterministic"]["discrepancies"][0]
        assert "neither source guarantees" in data["deterministic"]["discrepancies"][0]


def test_offline_assessment_cors_and_no_numeric_size():
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/assess", json={"statement": "Given an array, solve the problem. Values satisfy -100 <= a_i <= 100."}, headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.json()["selected_parameter"] is None
    assert all(item["estimated_work"] is None for item in response.json()["assessments"])


@pytest.mark.parametrize("notation", ["2.10^5", "2 . 10^5", "2⋅10⁵", "2·10^5"])
def test_copied_dot_bounds_reach_the_engine_without_truncation(notation):
    statement = "Given an array of n integers.\n1 <= n <= " + notation
    with TestClient(create_app()) as client:
        response = client.post("/api/v1/assess", json={"statement": statement})
    assert response.status_code == 200
    result = AlgorithmicAssessment.model_validate(response.json())
    assert result.extraction.size_parameters[0].upper_bound == 200_000
    quadratic = next(row for row in result.assessments if row.complexity == "O(n^2)")
    assert quadratic.estimated_work == 40_000_000_000
    assert quadratic.assessment == "likely_infeasible"
