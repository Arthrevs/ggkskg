import pytest
from app.models.request import MaintenanceRequest
from app.models.block_window import BlockWindow
from app.services.scheduling.optimizer import solve_schedule


def test_scheduling_compatibility():
    # Setup window: 180 min, capacity 2
    w1 = BlockWindow(id=1, section_id=1, duration_minutes=180, slot_capacity=2)
    w2 = BlockWindow(id=2, section_id=1, duration_minutes=180, slot_capacity=2)
    
    # 2 requests in the same section, both fit in w1 or w2
    # Critical and High priority
    r1 = MaintenanceRequest(id=1, section_id=1, severity="critical", overdue_days=0, duration_minutes=60, work_type_id=1)
    r2 = MaintenanceRequest(id=2, section_id=1, severity="high", overdue_days=0, duration_minutes=60, work_type_id=2)
    
    # SCENARIO 1: Compatible (No rules defined against them)
    # They should both be packed into a single window to minimize the window_used penalty
    res_compatible = solve_schedule([r1, r2], [w1, w2], incompatible_pairs=None)
    assert res_compatible.status == "OPTIMAL"
    assert res_compatible.windows_used == 1
    
    # Check that both were assigned to the same window
    assigned_windows = [a.window.id for a in res_compatible.assignments]
    assert len(set(assigned_windows)) == 1
    
    # SCENARIO 2: Incompatible
    # We pass the pair (r1.id, r2.id) as incompatible
    incompatible_pairs = [(r1.id, r2.id)]
    res_incompatible = solve_schedule([r1, r2], [w1, w2], incompatible_pairs=incompatible_pairs)
    
    assert res_incompatible.status == "OPTIMAL"
    assert res_incompatible.scheduled_count == 2
    # Because they are incompatible, they CANNOT share the same window, so they must use 2 windows
    assert res_incompatible.windows_used == 2
    
    assigned_windows_inc = [a.window.id for a in res_incompatible.assignments]
    # They must have been assigned to different windows
    assert len(set(assigned_windows_inc)) == 2
