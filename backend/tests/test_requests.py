import pytest
from fastapi.testclient import TestClient

from app.models.department import Department
from app.models.section import Section
from app.models.request import MaintenanceRequest

def setup_test_data(session):
    """Setup some base sections and departments for requests."""
    dept = session.query(Department).filter_by(short_code="TEST-DEP").first()
    if not dept:
        dept = Department(name="Test Department", short_code="TEST-DEP")
        session.add(dept)
        
    sec = session.query(Section).filter_by(code="TEST-SEC").first()
    if not sec:
        sec = Section(code="TEST-SEC", name="Test Section", window_start_hour=60, window_duration_hours=180)
        session.add(sec)
        
    session.commit()
    return dept.id, sec.id


def test_create_request(client, session):
    dept_id, sec_id = setup_test_data(session)
    
    payload = {
        "sectionId": sec_id,
        "departmentId": dept_id,
        "taskDescription": "Fix broken rails",
        "severity": "high",
        "overdueDays": 5,
        "durationMinutes": 120
    }
    
    response = client.post("/api/requests", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["taskDescription"] == "Fix broken rails"
    assert data["severity"] == "high"
    assert data["status"] == "pending"


def test_create_request_invalid_input(client, session):
    dept_id, sec_id = setup_test_data(session)
    
    # Missing duration
    payload = {
        "sectionId": sec_id,
        "departmentId": dept_id,
        "taskDescription": "Fix broken rails",
        "severity": "invalid_severity",  # invalid
        "overdueDays": -5,               # invalid
        "durationMinutes": 0             # invalid
    }
    
    response = client.post("/api/requests", json=payload)
    assert response.status_code == 422


def test_create_request_nonexistent_relations(client, session):
    payload = {
        "sectionId": 99999,
        "departmentId": 99999,
        "taskDescription": "Fix broken rails",
        "severity": "high",
        "overdueDays": 5,
        "durationMinutes": 120
    }
    response = client.post("/api/requests", json=payload)
    assert response.status_code == 422


def test_list_requests_and_filtering(client, session):
    dept_id, sec_id = setup_test_data(session)
    
    # Create two requests
    client.post("/api/requests", json={
        "sectionId": sec_id, "departmentId": dept_id, "taskDescription": "Req 1",
        "severity": "low", "overdueDays": 0, "durationMinutes": 60
    })
    client.post("/api/requests", json={
        "sectionId": sec_id, "departmentId": dept_id, "taskDescription": "Req 2",
        "severity": "critical", "overdueDays": 10, "durationMinutes": 180
    })
    
    # List all
    response = client.get("/api/requests")
    assert response.status_code == 200
    assert len(response.json()) >= 2
    
    # Filter by severity
    response = client.get("/api/requests?severity=critical")
    assert response.status_code == 200
    data = response.json()
    assert all(r["severity"] == "critical" for r in data)
    
    # Filter by section
    response = client.get(f"/api/requests?sectionId={sec_id}")
    assert response.status_code == 200


def test_update_request(client, session):
    dept_id, sec_id = setup_test_data(session)
    
    # Create
    create_res = client.post("/api/requests", json={
        "sectionId": sec_id, "departmentId": dept_id, "taskDescription": "Update me",
        "severity": "low", "overdueDays": 0, "durationMinutes": 60
    })
    req_id = create_res.json()["id"]
    
    # Update
    update_res = client.put(f"/api/requests/{req_id}", json={
        "severity": "high",
        "status": "scheduled"
    })
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["severity"] == "high"
    assert data["status"] == "scheduled"
    
    # Read back to verify
    read_res = client.get(f"/api/requests/{req_id}")
    assert read_res.status_code == 200
    assert read_res.json()["severity"] == "high"


def test_delete_request(client, session):
    dept_id, sec_id = setup_test_data(session)
    
    # Create
    create_res = client.post("/api/requests", json={
        "sectionId": sec_id, "departmentId": dept_id, "taskDescription": "Delete me",
        "severity": "low", "overdueDays": 0, "durationMinutes": 60
    })
    req_id = create_res.json()["id"]
    
    # Delete
    del_res = client.delete(f"/api/requests/{req_id}")
    assert del_res.status_code == 204
    
    # Read back (should be 404)
    read_res = client.get(f"/api/requests/{req_id}")
    assert read_res.status_code == 404


def test_nonexistent_request(client):
    res_get = client.get("/api/requests/99999")
    assert res_get.status_code == 404
    
    res_put = client.put("/api/requests/99999", json={"severity": "high"})
    assert res_put.status_code == 404
    
    res_del = client.delete("/api/requests/99999")
    assert res_del.status_code == 404
