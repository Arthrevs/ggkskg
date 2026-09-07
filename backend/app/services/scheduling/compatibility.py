from sqlalchemy.orm import Session
from itertools import combinations

from app.models.request import MaintenanceRequest
from app.models.compatibility_rule import WorkCompatibilityRule


def get_incompatible_pairs(db: Session, requests: list[MaintenanceRequest]) -> list[tuple[int, int]]:
    """
    Evaluates a list of requests and returns pairs of request IDs that are 
    explicitly marked as incompatible according to the database configuration.
    
    If no rule exists for a pair of work types, they are assumed to be compatible.
    Unverified railway assumptions must not silently become solver constraints.
    """
    
    # We only care about requests that have a work type assigned
    reqs_with_type = [r for r in requests if r.work_type_id is not None]
    
    if len(reqs_with_type) < 2:
        return []
        
    # Get all distinct work type pairs present in these requests
    work_type_ids = set(r.work_type_id for r in reqs_with_type)
    
    # Fetch all explicit incompatibility rules relevant to these work types
    # Rules are symmetric in real life, so we check both (A,B) and (B,A)
    rules = db.query(WorkCompatibilityRule).filter(
        WorkCompatibilityRule.is_compatible == False
    ).all()
    
    incompatible_wt_pairs = set()
    for rule in rules:
        incompatible_wt_pairs.add((rule.work_type_a_id, rule.work_type_b_id))
        incompatible_wt_pairs.add((rule.work_type_b_id, rule.work_type_a_id))
        
    incompatible_request_pairs = []
    
    for r1, r2 in combinations(reqs_with_type, 2):
        if r1.section_id != r2.section_id:
            # We only care about pairs that could physically share a block window (same section)
            continue
            
        if (r1.work_type_id, r2.work_type_id) in incompatible_wt_pairs:
            # Sort IDs so pair is (smaller, larger) for consistency
            pair = tuple(sorted([r1.id, r2.id]))
            incompatible_request_pairs.append(pair)
            
    return list(set(incompatible_request_pairs))
