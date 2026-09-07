import time
from ortools.sat.python import cp_model

from app.models.request import MaintenanceRequest
from app.models.block_window import BlockWindow
from app.services.scheduling.types import OptimizationResult, ScheduledAssignment
from app.services.scheduling.constraints import apply_capacity_constraints
from app.services.scheduling.objective import apply_objective


def solve_schedule(
    requests: list[MaintenanceRequest], 
    block_windows: list[BlockWindow],
    incompatible_pairs: list[tuple[int, int]] | None = None
) -> OptimizationResult:
    """
    Core OR-Tools CP-SAT optimized scheduling engine.
    """
    model = cp_model.CpModel()
    
    # --- 1. Decision Variables ---
    assign_vars = {}
    
    # Create variables only for valid request/window pairs
    for req in requests:
        for w in block_windows:
            # Must be same section and duration must fit
            if req.section_id == w.section_id and req.duration_minutes <= w.duration_minutes:
                assign_vars[(req.id, w.id)] = model.NewBoolVar(f"assign_r{req.id}_w{w.id}")
                
    # Create window_used vars
    window_used_vars = {}
    for w in block_windows:
        # Get all assignment variables linked to this window
        w_assign_vars = [assign_vars[(req.id, w.id)] for req in requests if (req.id, w.id) in assign_vars]
        if w_assign_vars:
            window_used = model.NewBoolVar(f"window_used_{w.id}")
            window_used_vars[w.id] = window_used
            
            # Link them: window_used is True iff at least one request is assigned to it.
            # window_used == max(w_assign_vars)
            model.AddMaxEquality(window_used, w_assign_vars)
            
    # --- 2. Constraints ---
    apply_capacity_constraints(model, assign_vars, requests, block_windows)
    
    # 2b. Compatibility constraints
    if incompatible_pairs:
        for (r1_id, r2_id) in incompatible_pairs:
            for w in block_windows:
                if (r1_id, w.id) in assign_vars and (r2_id, w.id) in assign_vars:
                    # They cannot both be in the same window
                    model.Add(assign_vars[(r1_id, w.id)] + assign_vars[(r2_id, w.id)] <= 1)
    
    # --- 3. Objective ---
    apply_objective(model, assign_vars, window_used_vars, requests, block_windows)
    
    # --- 4. Solve ---
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    
    start_time = time.time()
    status_code = solver.Solve(model)
    solve_time_ms = int((time.time() - start_time) * 1000)
    
    # Map status
    status_map = {
        cp_model.OPTIMAL: "OPTIMAL",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.MODEL_INVALID: "UNKNOWN",
        cp_model.UNKNOWN: "UNKNOWN"
    }
    status_str = status_map.get(status_code, "UNKNOWN")
    
    # --- 5. Extract Results ---
    assignments = []
    scheduled_req_ids = set()
    windows_used_set = set()
    
    request_dict = {req.id: req for req in requests}
    window_dict = {w.id: w for w in block_windows}
    
    if status_code in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for (req_id, w_id), var in assign_vars.items():
            if solver.Value(var) == 1:
                assignments.append(
                    ScheduledAssignment(
                        request=request_dict[req_id],
                        window=window_dict[w_id]
                    )
                )
                scheduled_req_ids.add(req_id)
                windows_used_set.add(w_id)
                
    unscheduled = [req for req in requests if req.id not in scheduled_req_ids]
    critical_unscheduled = [req for req in unscheduled if req.severity.lower() == "critical"]
    
    try:
        objective_value = solver.ObjectiveValue()
        best_bound = solver.BestObjectiveBound()
    except Exception:
        objective_value = 0.0
        best_bound = 0.0

    return OptimizationResult(
        status=status_str,
        objective_value=objective_value,
        best_bound=best_bound,
        solve_time_ms=solve_time_ms,
        scheduled_count=len(scheduled_req_ids),
        unscheduled_count=len(unscheduled),
        windows_used=len(windows_used_set),
        critical_requests_unscheduled=len(critical_unscheduled),
        assignments=assignments,
        unscheduled_requests=unscheduled
    )
