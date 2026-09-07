import pytest
from app.models.request import MaintenanceRequest
from app.models.block_window import BlockWindow
from app.services.scheduling.types import OptimizationResult, ScheduledAssignment
from app.services.scheduling.explanations import explain_schedule


def test_explain_schedule():
    # Setup windows
    w1 = BlockWindow(id=1, section_id=1, duration_minutes=180, slot_capacity=1)
    w2 = BlockWindow(id=2, section_id=2, duration_minutes=60, slot_capacity=1)
    
    # Setup requests
    r1 = MaintenanceRequest(id=1, section_id=1, severity="critical", overdue_days=0, duration_minutes=60, department_id=1)
    r2 = MaintenanceRequest(id=2, section_id=3, severity="low", overdue_days=0, duration_minutes=60, department_id=1)
    r3 = MaintenanceRequest(id=3, section_id=2, severity="medium", overdue_days=0, duration_minutes=120, department_id=1)
    r4 = MaintenanceRequest(id=4, section_id=1, severity="low", overdue_days=0, duration_minutes=30, department_id=1)
    
    # Mock assignments
    # r1 is scheduled in w1
    # r2 unscheduled (no section window)
    # r3 unscheduled (duration too long)
    # r4 unscheduled (w1 is occupied, priority conflict)
    
    a1 = ScheduledAssignment(request=r1, window=w1)
    
    opt_result = OptimizationResult(
        status="OPTIMAL",
        objective_value=4000,
        best_bound=4000,
        solve_time_ms=10,
        scheduled_count=1,
        unscheduled_count=3,
        windows_used=1,
        critical_requests_unscheduled=0,
        assignments=[a1],
        unscheduled_requests=[r2, r3, r4]
    )
    
    result = explain_schedule([r1, r2, r3, r4], [w1, w2], opt_result)
    
    explanations = result["explanations"]
    assert len(explanations) == 4
    
    # Check r1 (Scheduled)
    exp1 = next(e for e in explanations if e["request_id"] == 1)
    assert exp1["status"] == "scheduled"
    assert exp1["priority_score"] == 400
    assert "fits within the block window" in exp1["why_eligible"]
    assert "maximize overall priority" in exp1["why_selected_window_valid"]
    
    # Check r2 (No section window)
    exp2 = next(e for e in explanations if e["request_id"] == 2)
    assert exp2["status"] == "unscheduled"
    assert exp2["reason_code"] == "NO_VALID_SECTION_WINDOW"
    
    # Check r3 (Duration too long)
    exp3 = next(e for e in explanations if e["request_id"] == 3)
    assert exp3["status"] == "unscheduled"
    assert exp3["reason_code"] == "DURATION_TOO_LONG"
    
    # Check r4 (Priority conflict)
    exp4 = next(e for e in explanations if e["request_id"] == 4)
    assert exp4["status"] == "unscheduled"
    assert exp4["reason_code"] == "PRIORITY_OR_COMPATIBILITY_CONFLICT"
