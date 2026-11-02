import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas.analysis import AnalyzeRequest, AnalyzeResponse

VALID_STATEMENT = "Given an array of integers, process the queries described below."


@pytest.fixture
def client():
    with TestClient(create_app()) as test_client:
        yield test_client


def test_valid_analysis_returns_typed_demo(client):
    response = client.post("/api/v1/analyze", json={"statement": VALID_STATEMENT})
    assert response.status_code == 200
    data = response.json()
    assert set(data) == {
        "analysis_type", "demo_notice", "simplified_problem", "constraints",
        "complexity_guidance", "possible_techniques", "hints",
        "provider", "model", "objective", "input_summary", "output_summary",
        "important_observations", "uncertainties",
    }
    result = AnalyzeResponse.model_validate(data)
    assert result.analysis_type == "mock"
    assert result.provider == "fake" and result.model is None
    assert "unrelated to your submission" in result.demo_notice
    assert result.simplified_problem and result.constraints and result.complexity_guidance
    assert [hint.level for hint in result.hints] == [1, 2, 3]
    assert all("confidence" not in technique for technique in data["possible_techniques"])


@pytest.mark.parametrize("body", [
    {}, {"statement": ""}, {"statement": "   \n\t"},
    {"statement": "x" * 19}, {"statement": "x" * 20_001},
    {"statement": None}, {"statement": 123}, {"statement": []},
])
def test_invalid_statements_are_rejected(client, body):
    response = client.post("/api/v1/analyze", json=body)
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "statement"]


@pytest.mark.parametrize("length", [20, 20_000])
def test_trimmed_length_boundaries_are_inclusive(client, length):
    response = client.post("/api/v1/analyze", json={"statement": "  " + "x" * length + " \n"})
    assert response.status_code == 200


def test_request_trims_surrounding_whitespace():
    assert AnalyzeRequest(statement=f" \n{VALID_STATEMENT}\t ").statement == VALID_STATEMENT


def test_malformed_json_is_rejected(client):
    response = client.post(
        "/api/v1/analyze", content='{"statement":',
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422


def test_demo_is_identical_for_different_problems(client):
    first = client.post("/api/v1/analyze", json={"statement": VALID_STATEMENT})
    second = client.post("/api/v1/analyze", json={"statement": "Find a path through a directed graph with weighted edges."})
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()


def test_analysis_cors_preflight_and_actual_response(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173")
    with TestClient(create_app()) as client:
        preflight = client.options("/api/v1/analyze", headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        })
        response = client.post("/api/v1/analyze", json={"statement": VALID_STATEMENT}, headers={"Origin": "http://localhost:5173"})
    assert preflight.status_code == 200
    assert "POST" in preflight.headers["access-control-allow-methods"]
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
