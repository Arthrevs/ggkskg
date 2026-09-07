"""Manual (greedy) scheduling baseline.

Represents the "decentralized" / uncoordinated approach: sort requests by priority,
assign each to the first available window for its section, one request per window.
This is intentionally naive — the point is to show how much the solver improves on it.
"""

import time
import datetime as dt
from collections import defaultdict

from sqlalchemy.orm import Session

from app.models.request import MaintenanceRequest
from app.models.block_window import BlockWindow
from app.models.assignment import ScheduleAssignment, ScheduleRun

SEVERITY_WEIGHTS = {"critical": 400, "high": 300, "medium": 200, "low": 100}


def _priority_score(req: MaintenanceRequest) -> float:
    return SEVERITY_WEIGHTS.get(req.severity, 100) + req.overdue_days * 2


def run_manual_schedule(
    db: Session,
    week_start_date: dt.date,
    windows: list[BlockWindow],
    requests: list[MaintenanceRequest],
) -> ScheduleRun:
    """
    Greedy first-come scheduling: one request per window, no co-location.

    Requests are sorted by priority (highest first). Each request is assigned
    to the first matching window for its section with remaining capacity,
    but capacity is treated as 1 (no sharing) to represent uncoordinated planning.
    """
    start_ms = time.monotonic_ns() // 1_000_000

    # Clear any previous manual assignments for this week
    db.query(ScheduleAssignment).filter(
        ScheduleAssignment.week_start_date == week_start_date,
        ScheduleAssignment.mode == "manual",
    ).delete()

    # Sort by priority descending
    sorted_requests = sorted(requests, key=_priority_score, reverse=True)

    # Group windows by section
    section_windows: dict[int, list[BlockWindow]] = defaultdict(list)
    for w in windows:
        section_windows[w.section_id].append(w)

    # Track used windows (manual = one request per window)
    used_windows: set[int] = set()
    assignments: list[ScheduleAssignment] = []

    for req in sorted_requests:
        available = section_windows.get(req.section_id, [])
        for w in available:
            if w.id in used_windows:
                continue
            if req.duration_minutes <= w.duration_minutes:
                assignment = ScheduleAssignment(
                    request_id=req.id,
                    block_window_id=w.id,
                    week_start_date=week_start_date,
                    mode="manual",
                )
                db.add(assignment)
                assignments.append(assignment)
                used_windows.add(w.id)
                break

    elapsed_ms = (time.monotonic_ns() // 1_000_000) - start_ms

    # Count stats
    scheduled_ids = {a.request_id for a in assignments}
    window_ids_used = {a.block_window_id for a in assignments}
    total_hours = sum(r.duration_minutes for r in requests if r.id in scheduled_ids) / 60.0
    critical_unscheduled = sum(
        1 for r in requests if r.severity == "critical" and r.id not in scheduled_ids
    )

    run = ScheduleRun(
        week_start_date=week_start_date,
        mode="manual",
        total_hours=round(total_hours, 1),
        total_windows=len(window_ids_used),
        co_located_windows=0,  # manual never co-locates
        unscheduled_count=len(requests) - len(assignments),
        objective_value=None,
        solve_time_ms=elapsed_ms,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    return run
