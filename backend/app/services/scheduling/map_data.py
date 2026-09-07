from datetime import date
from sqlalchemy.orm import Session, joinedload

from app.models.block_window import BlockWindow
from app.models.assignment import ScheduleAssignment
from app.models.request import MaintenanceRequest


def build_map_data(db: Session, week_start_date: date, mode: str) -> list[dict]:
    """
    Build a map-friendly structure for Leaflet integration.
    Groups schedule assignments by Block Window.
    """
    # 1. Fetch assignments for this run
    assignments = db.query(ScheduleAssignment).options(
        joinedload(ScheduleAssignment.request).joinedload(MaintenanceRequest.department)
    ).filter(
        ScheduleAssignment.week_start_date == week_start_date,
        ScheduleAssignment.mode == mode
    ).all()
    
    if not assignments:
        return []
        
    # 2. Extract block window IDs that have assignments
    assigned_window_ids = list({a.block_window_id for a in assignments})
    
    # 3. Fetch only those block windows
    windows = db.query(BlockWindow).filter(
        BlockWindow.id.in_(assigned_window_ids)
    ).all()
    
    # Map assignments by block window id
    bw_assignments = {w.id: [] for w in windows}
    for a in assignments:
        if a.block_window_id in bw_assignments:
            bw_assignments[a.block_window_id].append(a)
            
    map_data = []
    
    for w in windows:
        assigned_list = bw_assignments[w.id]
        departments = list({a.request.department.name for a in assigned_list if a.request and a.request.department})
        request_ids = [a.request_id for a in assigned_list]
        
        # Determine status
        if len(request_ids) >= w.slot_capacity:
            status = "blocked"
        elif len(departments) > 1:
            status = "integrated"
        elif len(departments) == 1:
            status = "scheduled"
        else:
            status = "open"
            
        map_data.append({
            "section_id": w.section_id,
            "status": status,
            "block_window": w.day_of_week,
            "start_time": w.start_time_str,
            "end_time": w.end_time_str,
            "departments": departments,
            "assignments": request_ids
        })
        
    return map_data
