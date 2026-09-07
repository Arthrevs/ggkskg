"""CP-SAT constraint solver for optimized block scheduling.

This is the core intellectual contribution of the project — see PRD §6.2.

Decision variable: assign[r, w] = 1 if request r is placed in window w, else 0
Constraints:
  1. Each request scheduled at most once
  2. Window capacity respected
Objective: maximize priority-weighted scheduled work − ε × windows_used
"""

import time
import datetime as dt
from collections import defaultdict

from ortools.sat.python import cp_model
from sqlalchemy.orm import Session

from app.models.request import MaintenanceRequest
from app.models.block_window import BlockWindow
from app.models.assignment import ScheduleAssignment, ScheduleRun

SEVERITY_WEIGHTS = {"critical": 400, "high": 300, "medium": 200, "low": 100}
EPSILON = 1  # Small penalty per window used (integer-scaled)
SOLVER_TIME_LIMIT_SECONDS = 5.0


def _priority_weight(req: MaintenanceRequest) -> int:
    """Integer priority score for the objective function."""
    return SEVERITY_WEIGHTS.get(req.severity, 100) + req.overdue_days * 2


def run_optimized_schedule(
    db: Session,
    week_start_date: dt.date,
    windows: list[BlockWindow],
    requests: list[MaintenanceRequest],
) -> ScheduleRun:
    """
    Solve the block scheduling problem using Google OR-Tools CP-SAT.

    Returns a ScheduleRun record with assignments persisted to the database.
    """
    start_ms = time.monotonic_ns() // 1_000_000

    # Clear any previous optimized assignments for this week
    db.query(ScheduleAssignment).filter(
        ScheduleAssignment.week_start_date == week_start_date,
        ScheduleAssignment.mode == "optimized",
    ).delete()

    model = cp_model.CpModel()

    # ── Build valid (request, window) pairs ───────────────────
    # A pair is valid if same section and request fits in window
    assign = {}
    request_vars: dict[int, list] = defaultdict(list)  # request_id -> [(r_id, w_id)]
    window_vars: dict[int, list] = defaultdict(list)    # window_id -> [(r_id, w_id)]

    for r in requests:
        for w in windows:
            if w.section_id == r.section_id and r.duration_minutes <= w.duration_minutes:
                key = (r.id, w.id)
                assign[key] = model.new_bool_var(f"a_{r.id}_{w.id}")
                request_vars[r.id].append(key)
                window_vars[w.id].append(key)

    # ── Constraint 1: each request scheduled at most once ─────
    for r_id, keys in request_vars.items():
        model.add(sum(assign[k] for k in keys) <= 1)

    # ── Constraint 2: window capacity ─────────────────────────
    window_by_id = {w.id: w for w in windows}
    for w_id, keys in window_vars.items():
        cap = window_by_id[w_id].slot_capacity
        model.add(sum(assign[k] for k in keys) <= cap)

    # ── window_used indicator variables ───────────────────────
    window_used = {}
    for w_id, keys in window_vars.items():
        used_var = model.new_bool_var(f"used_{w_id}")
        window_used[w_id] = used_var
        # used >= each assign variable for this window
        for k in keys:
            model.add(used_var >= assign[k])
        # used <= sum (if nothing assigned, window not used)
        model.add(used_var <= sum(assign[k] for k in keys))

    # ── Objective ─────────────────────────────────────────────
    # Maximize: sum(priority * assign) - epsilon * sum(window_used)
    # All integer-scaled to keep CP-SAT happy
    req_by_id = {r.id: r for r in requests}
    objective_terms = []

    for key, var in assign.items():
        r_id, _ = key
        weight = _priority_weight(req_by_id[r_id])
        objective_terms.append(weight * var)

    for w_id, used_var in window_used.items():
        objective_terms.append(-EPSILON * used_var)

    model.maximize(sum(objective_terms))

    # ── Solve ─────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = SOLVER_TIME_LIMIT_SECONDS
    status = solver.solve(model)

    elapsed_ms = (time.monotonic_ns() // 1_000_000) - start_ms

    # ── Extract solution ──────────────────────────────────────
    assignments: list[ScheduleAssignment] = []
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for key, var in assign.items():
            if solver.value(var) == 1:
                r_id, w_id = key
                assignment = ScheduleAssignment(
                    request_id=r_id,
                    block_window_id=w_id,
                    week_start_date=week_start_date,
                    mode="optimized",
                )
                db.add(assignment)
                assignments.append(assignment)

    # ── Compute stats ─────────────────────────────────────────
    scheduled_ids = {a.request_id for a in assignments}
    window_assignment_count: dict[int, int] = defaultdict(int)
    for a in assignments:
        window_assignment_count[a.block_window_id] += 1

    windows_used_count = len(window_assignment_count)
    co_located = sum(1 for count in window_assignment_count.values() if count > 1)
    total_hours = sum(r.duration_minutes for r in requests if r.id in scheduled_ids) / 60.0

    obj_val = solver.objective_value if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else None

    run = ScheduleRun(
        week_start_date=week_start_date,
        mode="optimized",
        total_hours=round(total_hours, 1),
        total_windows=windows_used_count,
        co_located_windows=co_located,
        unscheduled_count=len(requests) - len(assignments),
        objective_value=obj_val,
        solve_time_ms=elapsed_ms,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    return run
