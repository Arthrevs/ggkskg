import pytest
from datetime import date

@pytest.fixture
def auth_headers(client):
    def _get_headers(username, password):
        res = client.post("/api/auth/login", data={"username": username, "password": password})
        if res.status_code != 200:
            raise ValueError(f"Login failed: {res.json()}")
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    return _get_headers

def test_viewer_cannot_run_schedule(client, auth_headers):
    headers = auth_headers("viewer", "view123")
    today = date.today()
    test_date = today.isoformat()
    
    res = client.post(
        "/api/schedule/run", 
        json={"week_start_date": test_date, "mode": "optimized"},
        headers=headers
    )
    assert res.status_code == 403

def test_requester_cannot_compare_schedule(client, auth_headers):
    headers = auth_headers("engg_req", "req123")
    today = date.today()
    test_date = today.isoformat()
    
    res = client.get(
        f"/api/schedule/compare?week_start_date={test_date}", 
        headers=headers
    )
    assert res.status_code == 403

def test_requester_sees_only_own_department(client, auth_headers):
    admin_headers = auth_headers("admin", "admin123")
    # Generate mock data
    client.post("/api/mock-data/generate?seed=1&clear=true", headers=admin_headers)
    
    req_headers = auth_headers("engg_req", "req123")
    res = client.get("/api/requests", headers=req_headers)
    assert res.status_code == 200
    
    me_res = client.get("/api/auth/me", headers=req_headers)
    my_dept = me_res.json()["department_id"]
    
    requests = res.json()
    assert len(requests) > 0
    for req in requests:
        assert req["departmentId"] == my_dept
