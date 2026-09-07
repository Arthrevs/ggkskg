import random
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.section import Section
from app.models.request import MaintenanceRequest
from app.models.block_window import BlockWindow
from app.models.work_type import WorkType
from app.models.compatibility_rule import WorkCompatibilityRule
from app.db.seed import seed_database


def clear_generated_data(db: Session) -> None:
    """Clear existing requests, block windows, and work type rules."""
    db.query(MaintenanceRequest).delete()
    db.query(BlockWindow).delete()
    db.query(WorkCompatibilityRule).delete()
    db.query(WorkType).delete()
    db.commit()


def generate_mock_data(db: Session, seed: int = 26027, clear_existing: bool = True) -> dict:
    """
    Generate deterministic mock data for testing and demonstrations.
    Note: The distributions are synthetic demo assumptions and do not represent
    real Indian Railway statistics.
    """
    if clear_existing:
        clear_generated_data(db)
        
    # Ensure departments and sections exist
    seed_database(db)
    
    # Initialize deterministic random generator
    rng = random.Random(seed)
    
    departments = db.query(Department).all()
    sections = db.query(Section).all()
    
    if not departments or not sections:
        raise ValueError("Departments or sections failed to initialize.")
    
    # 0. Generate Work Types and Rules
    eng_dept = next((d for d in departments if d.short_code == "ENGG"), departments[0])
    trd_dept = next((d for d in departments if d.short_code == "TRD"), departments[0])
    sig_dept = next((d for d in departments if d.short_code == "SNT"), departments[0])

    wt_track = WorkType(name="Track Renewal", department_id=eng_dept.id, requires_traffic_block=True)
    wt_ohe = WorkType(name="OHE Maintenance", department_id=trd_dept.id, requires_traffic_block=True, requires_power_block=True)
    wt_sig = WorkType(name="Signal Overhaul", department_id=sig_dept.id, requires_traffic_block=True, requires_signal_disconnection=True)
    
    db.add_all([wt_track, wt_ohe, wt_sig])
    db.commit()
    
    # Create explicit rule: Track Renewal and Signal Overhaul are incompatible
    rule1 = WorkCompatibilityRule(work_type_a_id=wt_track.id, work_type_b_id=wt_sig.id, is_compatible=False)
    db.add(rule1)
    db.commit()
    
    work_types_list = [wt_track, wt_ohe, wt_sig]

    # 1. Generate Block Windows (Next 7 days starting from next Monday)
    today = date.today()
    days_ahead = 0 - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    next_monday = today + timedelta(days=days_ahead)
    
    days_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    block_windows_created = 0
    for section in sections:
        # Each section gets 2-4 standard block windows per week
        num_windows = rng.randint(2, 4)
        chosen_days = rng.sample(days_of_week, num_windows)
        
        for day in chosen_days:
            # If the section has a mega day, we might spawn a mega block instead
            is_mega = section.mega_day == day and rng.random() < 0.8
            
            bw = BlockWindow(
                section_id=section.id,
                week_start_date=next_monday,
                day_of_week=day,
                start_minute=section.window_start_hour,
                duration_minutes=(section.mega_duration_hours or section.window_duration_hours) if is_mega else section.window_duration_hours,
                slot_capacity=section.slot_capacity
            )
            db.add(bw)
            block_windows_created += 1
            
    db.commit()
    
    # 2. Generate Maintenance Requests
    # Synthetic Distribution:
    # 50% low, 30% medium, 15% high, 5% critical
    severities = ["low"] * 50 + ["medium"] * 30 + ["high"] * 15 + ["critical"] * 5
    
    tasks_pool = [
        "Track geometry correction", "OHE wire adjustment", "Signaling relay replacement",
        "Point machine overhaul", "Ballast cleaning", "Bridge inspection", 
        "Level crossing gate repair", "Welding of rail joints", "Signal cable mega testing",
        "Isolator replacement", "Traction transformer maintenance", "Track circuit bonding"
    ]
    
    requests_created = 0
    num_requests = rng.randint(150, 250)
    
    for _ in range(num_requests):
        section = rng.choice(sections)
        department = rng.choice(departments)
        
        # Try to pick a work type for this department
        dept_wts = [wt for wt in work_types_list if wt.department_id == department.id]
        work_type = rng.choice(dept_wts) if dept_wts else None
        
        severity = rng.choice(severities)
        
        # Overdue days logic: critical are rarely overdue by much, others vary
        if severity == "critical":
            overdue_days = rng.randint(0, 2)
        elif severity == "high":
            overdue_days = rng.randint(0, 7)
        else:
            # 70% chance it's not overdue, 30% chance it is
            overdue_days = 0 if rng.random() < 0.7 else rng.randint(1, 30)
            
        # Duration: 30 to 180 minutes, in multiples of 30
        duration_minutes = rng.choice([30, 60, 90, 120, 150, 180])
        
        req = MaintenanceRequest(
            section_id=section.id,
            department_id=department.id,
            work_type_id=work_type.id if work_type else None,
            task_description=f"{rng.choice(tasks_pool)} {rng.randint(100, 999)}",
            requested_date=next_monday + timedelta(days=rng.randint(0, 6)),
            severity=severity,
            overdue_days=overdue_days,
            duration_minutes=duration_minutes,
            status="pending"
        )
        db.add(req)
        requests_created += 1
        
    db.commit()
    
    return {
        "status": "success",
        "seed": seed,
        "cleared_existing": clear_existing,
        "counts": {
            "departments": len(departments),
            "sections": len(sections),
            "block_windows": block_windows_created,
            "maintenance_requests": requests_created
        }
    }
