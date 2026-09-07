import pytest
from app.models.request import MaintenanceRequest
from app.models.block_window import BlockWindow
from app.services.scheduling.baseline import generate_manual_schedule, calculate_priority

def test_priority_calculation():
    req1 = MaintenanceRequest(severity="critical", overdue_days=0)
    req2 = MaintenanceRequest(severity="high", overdue_days=0)
    req3 = MaintenanceRequest(severity="medium", overdue_days=10) # 200 + 100 = 300
    req4 = MaintenanceRequest(severity="low", overdue_days=30) # 50 + 300 = 350
    
    assert calculate_priority(req1) == 1000
    assert calculate_priority(req2) == 500
    assert calculate_priority(req3) == 300
    assert calculate_priority(req4) == 350
    # Sort order should be: req1, req2, req4, req3
    sorted_reqs = sorted([req4, req3, req1, req2], key=calculate_priority, reverse=True)
    assert sorted_reqs == [req1, req2, req4, req3]


def test_generate_manual_schedule_basic():
    # Setup windows (all in section 1)
    w1 = BlockWindow(id=1, section_id=1, duration_minutes=180)
    w2 = BlockWindow(id=2, section_id=1, duration_minutes=120)
    w3 = BlockWindow(id=3, section_id=2, duration_minutes=240)
    windows = [w1, w2, w3]
    
    # Setup requests
    r1 = MaintenanceRequest(id=1, section_id=1, severity="critical", overdue_days=0, duration_minutes=60)
    r2 = MaintenanceRequest(id=2, section_id=1, severity="low", overdue_days=0, duration_minutes=90)
    r3 = MaintenanceRequest(id=3, section_id=2, severity="high", overdue_days=0, duration_minutes=300) # Won't fit w3
    r4 = MaintenanceRequest(id=4, section_id=1, severity="high", overdue_days=10, duration_minutes=120) # Priority 600
    r5 = MaintenanceRequest(id=5, section_id=1, severity="medium", overdue_days=0, duration_minutes=60)
    
    # Priorities: r1(1000), r4(600), r2(50), r3(500, but diff sec/wont fit), r5(200)
    requests = [r1, r2, r3, r4, r5]
    
    result = generate_manual_schedule(requests, windows)
    
    assert result["windows_used"] == 2
    assert len(result["assignments"]) == 2
    
    assigned_request_ids = [a["request"].id for a in result["assignments"]]
    # Should assign r1 and r4 (highest priority in sec 1 that fit)
    assert 1 in assigned_request_ids
    assert 4 in assigned_request_ids
    assert 2 not in assigned_request_ids
    assert 5 not in assigned_request_ids
    
    # Check total hours: r1(60) + r4(120) = 180 min = 3.0 hours
    assert result["total_scheduled_hours"] == 3.0
    
    # Unscheduled
    unscheduled_ids = [r.id for r in result["unscheduled_requests"]]
    assert 2 in unscheduled_ids
    assert 3 in unscheduled_ids
    assert 5 in unscheduled_ids
    
    assert result["critical_requests_unscheduled"] == 0


def test_generate_manual_schedule_one_per_window():
    # Verify manual mode only puts 1 request per window even if more fit
    w1 = BlockWindow(id=1, section_id=1, duration_minutes=180)
    
    r1 = MaintenanceRequest(id=1, section_id=1, severity="high", overdue_days=0, duration_minutes=30)
    r2 = MaintenanceRequest(id=2, section_id=1, severity="high", overdue_days=0, duration_minutes=30)
    
    result = generate_manual_schedule([r1, r2], [w1])
    
    assert result["windows_used"] == 1
    assert len(result["assignments"]) == 1
    assert len(result["unscheduled_requests"]) == 1
