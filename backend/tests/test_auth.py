import pytest

def test_login_success(client):
    res = client.post("/api/auth/login", data={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_failure(client):
    res = client.post("/api/auth/login", data={"username": "admin", "password": "wrongpassword"})
    assert res.status_code == 401

def test_get_me(client):
    res_login = client.post("/api/auth/login", data={"username": "admin", "password": "admin123"})
    token = res_login.json()["access_token"]
    
    res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_me.status_code == 200
    assert res_me.json()["username"] == "admin"
    assert res_me.json()["role"] == "planner_admin"
