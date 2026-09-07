"""Stats API — summary KPIs for the dashboard."""

import datetime as dt
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.db.database import get_db
from app.models.request import MaintenanceRequest
from app.models.assignment import ScheduleAssignment
from app.models.schedule_run import ScheduleRun
from app.schemas.schedule import StatsSummaryOut, DepartmentWorkloadOut, DateCountOut

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/summary", response_model=StatsSummaryOut)
def stats_summary(
    week_start_date: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Get summary stats. Uses the latest optimized run if available."""
    # Find the latest optimized schedule run
    run_query = db.query(ScheduleRun).filter(ScheduleRun.mode == "optimized")
    if week_start_date:
        try:
            wd = dt.date.fromisoformat(week_start_date)
            run_query = run_query.filter(ScheduleRun.week_start_date == wd)
        except ValueError:
            pass
    run = run_query.order_by(ScheduleRun.created_at.desc()).first()

    # All requests
    all_requests = (
        db.query(MaintenanceRequest)
        .options(joinedload(MaintenanceRequest.department))
        .all()
    )

    # Requests by department
    by_dept: dict[str, int] = defaultdict(int)
    for r in all_requests:
        by_dept[r.department.name] += 1

    # Requests by severity
    by_sev: dict[str, int] = defaultdict(int)
    for r in all_requests:
        by_sev[r.severity] += 1

    # Requests over time (last 14 days)
    today = dt.date.today()
    date_counts: dict[str, int] = {}
    for i in range(14):
        d = today - dt.timedelta(days=13 - i)
        date_counts[d.isoformat()] = 0
    for r in all_requests:
        d_str = r.created_at.date().isoformat() if r.created_at else None
        if d_str and d_str in date_counts:
            date_counts[d_str] += 1

    # Department workload
    dept_hours: dict[str, float] = defaultdict(float)
    dept_count: dict[str, int] = defaultdict(int)
    for r in all_requests:
        dept_hours[r.department.name] += r.duration_minutes / 60.0
        dept_count[r.department.name] += 1

    # Co-located blocks
    colocated = 0
    if run:
        assignments = (
            db.query(ScheduleAssignment)
            .filter(
                ScheduleAssignment.week_start_date == run.week_start_date,
                ScheduleAssignment.mode == "optimized",
            )
            .all()
        )
        window_counts: dict[int, int] = defaultdict(int)
        for a in assignments:
            window_counts[a.block_window_id] += 1
        colocated = sum(1 for c in window_counts.values() if c > 1)

    return StatsSummaryOut(
        total_hours_scheduled=run.total_hours if run else 0,
        windows_used=run.total_windows if run else 0,
        colocated_blocks=colocated,
        solver_time_ms=run.solve_time_ms if run else 0,
        requests_by_department=dict(by_dept),
        requests_by_severity=dict(by_sev),
        requests_over_time=[
            DateCountOut(date=d, count=c) for d, c in date_counts.items()
        ],
        department_workload=[
            DepartmentWorkloadOut(
                department=dept,
                hours=round(dept_hours[dept], 1),
                requests=dept_count[dept],
            )
            for dept in dept_hours
        ],
    )
