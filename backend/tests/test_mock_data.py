import pytest
from app.models.request import MaintenanceRequest
from app.models.block_window import BlockWindow

def test_mock_data_generation_deterministic(client, session):
    # 1. Generate first time with seed 26027
    res1 = client.post("/api/mock-data/generate?seed=26027&clear=true")
    assert res1.status_code == 201
    
    # Store snapshot of requests
    reqs1 = session.query(MaintenanceRequest).order_by(MaintenanceRequest.id).all()
    reqs1_data = [(r.section_id, r.department_id, r.severity, r.task_description) for r in reqs1]
    
    bws1 = session.query(BlockWindow).order_by(BlockWindow.id).all()
    bws1_data = [(b.section_id, b.day_of_week, b.start_minute) for b in bws1]
    
    # 2. Generate second time with SAME seed
    res2 = client.post("/api/mock-data/generate?seed=26027&clear=true")
    assert res2.status_code == 201
    
    # Compare
    reqs2 = session.query(MaintenanceRequest).order_by(MaintenanceRequest.id).all()
    reqs2_data = [(r.section_id, r.department_id, r.severity, r.task_description) for r in reqs2]
    
    bws2 = session.query(BlockWindow).order_by(BlockWindow.id).all()
    bws2_data = [(b.section_id, b.day_of_week, b.start_minute) for b in bws2]
    
    assert reqs1_data == reqs2_data
    assert bws1_data == bws2_data
    
    # 3. Generate third time with DIFFERENT seed
    res3 = client.post("/api/mock-data/generate?seed=12345&clear=true")
    assert res3.status_code == 201
    
    reqs3 = session.query(MaintenanceRequest).order_by(MaintenanceRequest.id).all()
    reqs3_data = [(r.section_id, r.department_id, r.severity, r.task_description) for r in reqs3]
    
    assert reqs1_data != reqs3_data
