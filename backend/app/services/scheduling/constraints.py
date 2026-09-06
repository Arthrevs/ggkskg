from ortools.sat.python import cp_model


def apply_capacity_constraints(model: cp_model.CpModel, assign_vars: dict, requests: list, block_windows: list):
    """
    Applies the core railway scheduling constraints.
    1. Each request can be scheduled at most once.
    2. Each window can only take up to its slot_capacity requests.
    """
    
    # 1. Each request at most once
    for req in requests:
        req_vars = [assign_vars[(req.id, w.id)] for w in block_windows if (req.id, w.id) in assign_vars]
        if req_vars:
            model.AddAtMostOne(req_vars)
            
    # 2. Window capacity
    for w in block_windows:
        win_vars = [assign_vars[(req.id, w.id)] for req in requests if (req.id, w.id) in assign_vars]
        if win_vars:
            model.Add(sum(win_vars) <= w.slot_capacity)
