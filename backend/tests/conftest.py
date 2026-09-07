"""Test configuration — sets up a clean test database before any app modules load."""

import os
import sys

# Must set env BEFORE any app module is imported
_test_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_sih26027.db")

# Clean up any stale test DB
if os.path.exists(_test_db):
    os.remove(_test_db)

os.environ["DATABASE_URL"] = f"sqlite:///{_test_db}"

# Purge any cached app modules so they pick up the new DATABASE_URL
for mod_name in list(sys.modules.keys()):
    if mod_name.startswith("app"):
        del sys.modules[mod_name]


import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal


@pytest.fixture(scope="function")
def session():
    """Yield a database session for test data setup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session")
def client():
    """TestClient as context manager so lifespan events (table creation) fire."""
    with TestClient(app) as c:
        # Auto-login as admin for all legacy tests
        res = c.post("/api/auth/login", data={"username": "admin", "password": "admin123"})
        if res.status_code == 200:
            token = res.json()["access_token"]
            c.headers.update({"Authorization": f"Bearer {token}"})
        yield c


@pytest.fixture(autouse=True, scope="session")
def cleanup():
    yield
    if os.path.exists(_test_db):
        os.remove(_test_db)
