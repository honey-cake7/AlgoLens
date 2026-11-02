from fastapi.testclient import TestClient

from app.main import create_app


def test_health_contract():
    with TestClient(create_app()) as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "algolens-api"}


def test_cors_allows_configured_origin(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173")
    with TestClient(create_app()) as client:
        response = client.options(
            "/api/v1/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_rejects_unconfigured_origin(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173")
    with TestClient(create_app()) as client:
        response = client.options(
            "/api/v1/health",
            headers={
                "Origin": "https://untrusted.example",
                "Access-Control-Request-Method": "GET",
            },
        )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
