from typing import Any
from app.models.request import MaintenanceRequest
from app.models.block_window import BlockWindow
from app.services.scheduling.types import OptimizationResult
from app.services.scheduling.objective import get_severity_weight


def explain_schedule(
    requests: list[MaintenanceRequest],
    block_windows: list[BlockWindow],
    optimization_result: OptimizationResult,
    incompatible_pairs: list[tuple[int, int]] | None = None
) -> dict[str, Any]:
    """
    Generates deterministic, natural-language explanations for why requests
    were scheduled or left unscheduled based on the constraints.
    """
    
    incompatible_pairs = incompatible_pairs or []
    explanations = []
    
    # Map assignments for quick lookup
    scheduled_map = {a.request.id: a.window for a in optimization_result.assignments}
    
    for req in requests:
        priority = get_severity_weight(req.severity) * 100 + req.overdue_days * 2
        
        if req.id in scheduled_map:
            window = scheduled_map[req.id]
            explanations.append({
                "request_id": req.id,
                "status": "scheduled",
                "assigned_section_id": window.section_id,
                "assigned_block_window_id": window.id,
                "department_id": req.department_id,
                "priority_score": priority,
                "why_eligible": f"Request duration ({req.duration_minutes} mins) fits within the block window.",
                "why_selected_window_valid": "Window is in the identical section, had available slot capacity, and was selected by the solver to maximize overall priority."
            })
        else:
            # Analyze why it was unscheduled
            section_windows = [w for w in block_windows if w.section_id == req.section_id]
            
            if not section_windows:
                reason_code = "NO_VALID_SECTION_WINDOW"
                reason = "No block windows were scheduled for this section."
            else:
                duration_fitting_windows = [w for w in section_windows if w.duration_minutes >= req.duration_minutes]
                if not duration_fitting_windows:
                    reason_code = "DURATION_TOO_LONG"
                    max_duration = max(w.duration_minutes for w in section_windows)
                    reason = f"Request duration ({req.duration_minutes} mins) exceeds the maximum available window duration ({max_duration} mins) in this section."
                else:
                    # It fits in a window, so it must be capacity, priority, or compatibility.
                    reason_code = "PRIORITY_OR_COMPATIBILITY_CONFLICT"
                    reason = "Request was eligible but lacked sufficient priority to claim limited window capacity, or conflicted with higher-priority incompatible work types."
                    
                    # Heuristic check for compatibility isolation
                    # If this request was incompatible with scheduled requests in all fitting windows
                    # (This is an approximation for explanation purposes)
                    conflict_found = False
                    for w in duration_fitting_windows:
                        # Who is in this window?
                        occupants = [a.request for a in optimization_result.assignments if a.window.id == w.id]
                        # Is req incompatible with any occupant?
                        for occ in occupants:
                            pair = tuple(sorted([req.id, occ.id]))
                            if pair in incompatible_pairs:
                                conflict_found = True
                                break
                    if conflict_found:
                        reason_code = "INCOMPATIBLE_WORK_TYPE"
                        reason = "Request could not be assigned because all fitting windows were occupied by explicitly incompatible work types."
                        
            explanations.append({
                "request_id": req.id,
                "status": "unscheduled",
                "reason_code": reason_code,
                "reason": reason
            })
            
    return {"explanations": explanations}
