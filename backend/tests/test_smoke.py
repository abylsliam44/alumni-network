"""Smoke tests — verify the app boots and basic endpoints respond.

These run in CI as a sanity check that imports and routing aren't broken.
Add more focused tests under backend/tests/ as features stabilize.
"""

from fastapi.testclient import TestClient


def test_app_imports():
    """The FastAPI app must be importable without side effects breaking CI."""
    from app.main import app  # noqa: F401


def test_health_endpoint_returns_ok():
    """GET /api/health should return 200."""
    from app.main import app

    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
