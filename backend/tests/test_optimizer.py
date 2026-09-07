import pytest
from app.models.request import MaintenanceRequest
from app.models.block_window import BlockWindow
from app.services.scheduling.optimizer import solve_schedule


def test_solve_schedule_optimal_colocation():
    # Setup windows
    # Window 1: 180 mins, capacity 2
    w1 = BlockWindow(id=1, section_id=1, duration_minutes=180, slot_capacity=2)
    # Window 2: 120 mins, capacity 1
    w2 = BlockWindow(id=2, section_id=1, duration_minutes=120, slot_capacity=1)
    
    # Setup requests
    # Critical request, 60 mins -> Priority = 400
    r1 = MaintenanceRequest(id=1, section_id=1, severity="critical", overdue_days=0, duration_minutes=60)
    # High request, 120 mins -> Priority = 300
    r2 = MaintenanceRequest(id=2, section_id=1, severity="high", overdue_days=0, duration_minutes=120)
    # Medium request, 60 mins -> Priority = 200
    r3 = MaintenanceRequest(id=3, section_id=1, severity="medium", overdue_days=0, duration_minutes=60)
    
    # In manual mode, r1 goes to w1, r2 goes to w2, r3 is unscheduled.
    # In OPTIMIZED mode:
    # w1 can take r1(60) and r2(120). Both fit since w1 duration is 180, and capacity is 2! Wait, duration of window is total time.
    # The constraint is: request.duration_minutes <= window.duration_minutes.
    # It does NOT say sum(request.duration_minutes) <= window.duration_minutes for co-location!
    # Let's verify the user's constraints:
    # "Create a variable only when: 1. request.section_id == window.section_id, 2. request.duration_minutes <= window.duration_minutes"
    # "CONSTRAINT 1: Each request can be scheduled at most once."
    # "CONSTRAINT 2: Window capacity. sum(assign[r,w]) <= window.slot_capacity"
    # So if w1 has capacity 2, it can take 2 requests, as long as each request is <= 180 mins individually.
    # Because they happen in parallel on different tracks in the same section block!
    
    # With objective: maximize priority (scaled * 10) - window_used (1)
    # If we put r1 and r2 in w1 (Priority 700 * 10 = 7000 - 1 = 6999)
    # If we put r3 in w2 (Priority 200 * 10 = 2000 - 1 = 1999)
    # Total priority = 9000 - 2 = 8998.
    # Wait, can we put r1, r2, r3?
    # w1 takes 2 (capacity 2). Best are r1, r2 (400, 300).
    # w2 takes 1 (capacity 1). Best is r3 (200).
    # All 3 scheduled!
    
    res = solve_schedule([r1, r2, r3], [w1, w2])
    
    assert res.status == "OPTIMAL"
    assert res.scheduled_count == 3
    assert res.unscheduled_count == 0
    assert res.windows_used == 2
    
    # Expected objective value:
    # r1(400) + r2(300) + r3(200) = 900
    # scaled = 9000
    # windows used = 2
    # objective = 8998
    assert res.objective_value == 8998


def test_solve_schedule_prefer_fewer_windows():
    # If priority is tied, solver should use fewer windows.
    w1 = BlockWindow(id=1, section_id=1, duration_minutes=180, slot_capacity=2)
    w2 = BlockWindow(id=2, section_id=1, duration_minutes=180, slot_capacity=2)
    
    # 2 identical requests
    r1 = MaintenanceRequest(id=1, section_id=1, severity="low", overdue_days=0, duration_minutes=60) # Priority 100
    r2 = MaintenanceRequest(id=2, section_id=1, severity="low", overdue_days=0, duration_minutes=60) # Priority 100
    
    res = solve_schedule([r1, r2], [w1, w2])
    
    assert res.status == "OPTIMAL"
    assert res.scheduled_count == 2
    # Should only use 1 window to save penalty!
    assert res.windows_used == 1
    
    # Objective: 2 * 100 = 200. Scaled = 2000. - 1 window = 1999
    assert res.objective_value == 1999


def test_solve_schedule_infeasible():
    # No windows
    r1 = MaintenanceRequest(id=1, section_id=1, severity="high", overdue_days=0, duration_minutes=60)
    res = solve_schedule([r1], [])
    
    # It's technically OPTIMAL to schedule 0 requests and use 0 windows if no windows exist, yielding objective 0.
    assert res.status == "OPTIMAL"
    assert res.scheduled_count == 0
    assert res.unscheduled_count == 1
    assert res.objective_value == 0
