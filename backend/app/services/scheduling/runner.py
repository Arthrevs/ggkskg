from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import exc

from app.models.request import MaintenanceRequest
from app.models.block_window import BlockWindow
from app.models.schedule_run import ScheduleRun
from app.models.assignment import ScheduleAssignment
from app.services.scheduling.baseline import generate_manual_schedule
from app.services.scheduling.optimizer import solve_schedule
from app.services.scheduling.compatibility import get_incompatible_pairs
from app.services.scheduling.explanations import explain_schedule
from app.services.scheduling.types import ScheduledAssignment as InternalAssignment


def run_schedule(db: Session, week_start_date: date, mode: str) -> dict:
    if mode not in ["manual", "optimized"]:
        raise ValueError("Mode must be 'manual' or 'optimized'")
        
    try:
        # Load data
        requests = db.query(MaintenanceRequest).filter(
            MaintenanceRequest.status.in_(["pending", "unscheduled"])
        ).all()
        
        block_windows = db.query(BlockWindow).filter(
            BlockWindow.week_start_date == week_start_date
        ).all()
        
        if not block_windows:
            raise ValueError(f"No block windows found for week {week_start_date}")
            
        incompatible_pairs = get_incompatible_pairs(db, requests)
        
        # Run solver
        if mode == "optimized":
            opt_res = solve_schedule(requests, block_windows, incompatible_pairs)
            internal_assignments = opt_res.assignments
            
            # Map solver output to db fields
            run_metrics = {
                "total_hours": round(sum(a.request.duration_minutes for a in internal_assignments) / 60.0, 2),
                "total_windows": opt_res.windows_used,
                "co_located_windows": 0, # Calculate below
                "unscheduled_count": opt_res.unscheduled_count,
                "objective_value": opt_res.objective_value,
                "solve_time_ms": opt_res.solve_time_ms
            }
        else:
            base_res = generate_manual_schedule(requests, block_windows)
            # Map manual assignments to internal object format
            internal_assignments = [
                InternalAssignment(request=a["request"], window=a["window"]) 
                for a in base_res["assignments"]
            ]
            
            run_metrics = {
                "total_hours": base_res["total_scheduled_hours"],
                "total_windows": base_res["windows_used"],
                "co_located_windows": 0,
                "unscheduled_count": len(base_res["unscheduled_requests"]),
                "objective_value": 0.0,
                "solve_time_ms": 0
            }
            
        # Calculate co-located windows (windows with > 1 request)
        window_counts = {}
        for a in internal_assignments:
            window_counts[a.window.id] = window_counts.get(a.window.id, 0) + 1
        run_metrics["co_located_windows"] = sum(1 for v in window_counts.values() if v > 1)
        
        # --- ATOMIC DATABASE TRANSACTION ---
        
        # 1. Clean up previous runs for this week and mode
        existing_run = db.query(ScheduleRun).filter(
            ScheduleRun.week_start_date == week_start_date,
            ScheduleRun.mode == mode
        ).first()
        
        if existing_run:
            # We must release the requests that were bound to this run
            old_assignments = db.query(ScheduleAssignment).filter(
                ScheduleAssignment.week_start_date == week_start_date,
                ScheduleAssignment.mode == mode
            ).all()
            for oa in old_assignments:
                # Only revert if they are currently marked as scheduled
                # (They could have been manually modified, but for this basic app we just reset them)
                db_req = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == oa.request_id).first()
                if db_req:
                    db_req.status = "pending"
            
            db.delete(existing_run)
            db.flush() # Execute delete immediately
            
        # 2. Create new ScheduleRun
        db_run = ScheduleRun(
            week_start_date=week_start_date,
            mode=mode,
            **run_metrics
        )
        db.add(db_run)
        db.flush() # Get db_run.id
        
        # 3. Create Assignments and update request status
        for a in internal_assignments:
            db_assignment = ScheduleAssignment(
                request_id=a.request.id,
                block_window_id=a.window.id,
                week_start_date=week_start_date,
                mode=mode
            )
            db.add(db_assignment)
            
            # Update request
            db_req = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == a.request.id).first()
            if db_req:
                db_req.status = "scheduled"
                
        # 4. Commit everything
        db.commit()
        
        # 5. Generate explanations dynamically
        if mode == "optimized":
            explanations = explain_schedule(requests, block_windows, opt_res, incompatible_pairs)
        else:
            # Manual mode doesn't strictly have an OptimizationResult format, but we can fake one
            # for the explanation engine to process if needed, or simply return empty/basic for manual.
            explanations = {"explanations": []}
            
        # Reload the run for clean response
        db.refresh(db_run)
        
        map_data = build_map_data(db, week_start_date, mode)
        
        return {
            "run": db_run,
            "assignments": db.query(ScheduleAssignment).filter(
                ScheduleAssignment.week_start_date == week_start_date,
                ScheduleAssignment.mode == mode
            ).all(),
            "explanations": explanations["explanations"],
            "map_data": map_data
        }
        
    except Exception as e:
        db.rollback()
        raise e


from app.services.scheduling.map_data import build_map_data

def get_schedule(db: Session, week_start_date: date, mode: str) -> dict | None:
    db_run = db.query(ScheduleRun).filter(
        ScheduleRun.week_start_date == week_start_date,
        ScheduleRun.mode == mode
    ).first()
    
    if not db_run:
        return None
        
    assignments = db.query(ScheduleAssignment).filter(
        ScheduleAssignment.week_start_date == week_start_date,
        ScheduleAssignment.mode == mode
    ).all()
    
    map_data = build_map_data(db, week_start_date, mode)
    
    return {
        "run": db_run,
        "assignments": assignments,
        "explanations": [], # Simplified for retrieval
        "map_data": map_data
    }


def get_comparison(db: Session, week_start_date: date) -> dict:
    manual = get_schedule(db, week_start_date, "manual")
    optimized = get_schedule(db, week_start_date, "optimized")
    
    return {
        "manual": manual,
        "optimized": optimized
    }
