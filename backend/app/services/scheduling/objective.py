from ortools.sat.python import cp_model


def get_severity_weight(severity: str) -> int:
    """Configurable severity weights."""
    weights = {
        "critical": 4,
        "high": 3,
        "medium": 2,
        "low": 1
    }
    return weights.get(severity.lower(), 0)


def apply_objective(model: cp_model.CpModel, assign_vars: dict, window_used_vars: dict, requests: list, block_windows: list):
    """
    Objective:
    1. Maximize priority-weighted scheduled requests.
    2. Prefer fewer opened windows (secondary objective).
    
    Priority formula: severity_weight * 100 + overdue_days * 2
    
    Scale the objective into integers to avoid floating point issues.
    We multiply the primary priority component by 10 and subtract 1 per window used.
    """
    
    request_dict = {req.id: req for req in requests}
    
    priority_terms = []
    
    for (req_id, w_id), var in assign_vars.items():
        req = request_dict[req_id]
        
        # Calculate raw priority
        base_weight = get_severity_weight(req.severity) * 100
        overdue_bonus = req.overdue_days * 2
        priority = base_weight + overdue_bonus
        
        # Scale to integer coefficient (e.g. * 10)
        scaled_priority = int(priority * 10)
        priority_terms.append(var * scaled_priority)
        
    # Penalty for opening windows
    window_penalties = []
    for w_id, w_var in window_used_vars.items():
        # -1 for every window opened
        window_penalties.append(w_var * -1)
        
    model.Maximize(sum(priority_terms) + sum(window_penalties))
