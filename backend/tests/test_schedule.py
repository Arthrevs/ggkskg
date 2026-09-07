from datetime import date, timedelta
import pytest
from app.models.request import MaintenanceRequest
from app.models.block_window import BlockWindow


def test_schedule_run_api(client, session):
    # Calculate next Monday
    today = date.today()
    days_ahead = 0 - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    next_monday = today + timedelta(days=days_ahead)
    test_date = next_monday.isoformat()

    # Setup some basic data
    client.post("/api/mock-data/generate?seed=123&clear=true")
    
    # 1. Run Optimized
    res_opt = client.post("/api/schedule/run", json={"week_start_date": test_date, "mode": "optimized"})
    assert res_opt.status_code == 201
    
    data_opt = res_opt.json()
    assert data_opt["mode"] == "optimized"
    assert "assignments" in data_opt
    assert "explanations" in data_opt
    
    # Check that requests were actually updated in the DB
    assigned_count = session.query(MaintenanceRequest).filter(MaintenanceRequest.status == "scheduled").count()
    assert assigned_count == len(data_opt["assignments"])
    
    # 2. Run Manual
    # We must reset statuses to pending for testing, or we just run it and see if it picks up anything left?
    # Actually, running manual on the same date will delete the optimized run and its assignments, and reset those requests!
    # Let's test that idempotency/replacement works:
    res_man = client.post("/api/schedule/run", json={"week_start_date": test_date, "mode": "manual"})
    assert res_man.status_code == 201
    
    data_man = res_man.json()
    assert data_man["mode"] == "manual"
    
    # 3. Get Schedule
    res_get = client.get(f"/api/schedule/{test_date}?mode=manual")
    assert res_get.status_code == 200
    assert res_get.json()["mode"] == "manual"
    
    # 4. Compare Schedules
    # We need both runs to exist to compare them.
    # Let's run optimized for the same week (it replaces the old optimized run, but wait! The reset logic in runner.py resets requests to 'pending' when ANY run is deleted, which means running optimized will delete the old optimized run, reset requests, and then schedule them).
    # Actually, they have different modes. So manual and optimized runs can exist side-by-side in the DB.
    # But wait, if they share requests, and we update request status... 
    # If we run manual, it updates request to 'scheduled'. Then we run optimized, it only picks up 'pending'. So optimized would schedule 0 things!
    # To compare properly, we usually run on identical datasets. For this test, it's fine if one is empty or we reset the DB.
    
    client.post("/api/schedule/run", json={"week_start_date": test_date, "mode": "optimized"})
    
    res_comp = client.get(f"/api/schedule/compare?week_start_date={test_date}")
    assert res_comp.status_code == 200
    
    comp_data = res_comp.json()
    assert "manual" in comp_data
    assert "optimized" in comp_data
    assert comp_data["manual"]["mode"] == "manual"
    assert comp_data["optimized"]["mode"] == "optimized"


def test_schedule_run_invalid_mode(client):
    today = date.today()
    days_ahead = 0 - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    next_monday = today + timedelta(days=days_ahead)
    test_date = next_monday.isoformat()

    res = client.post("/api/schedule/run", json={"week_start_date": test_date, "mode": "invalid"})
    # Pydantic might fail it before our code, or our code raises ValueError
    # Actually, the schema doesn't strictly enum it, so our code raises 400
    assert res.status_code == 400
