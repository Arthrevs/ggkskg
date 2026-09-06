"""
Simulated decentralized baseline scheduling algorithm (Manual mode).

Disclaimer: This is a synthetic scheduling baseline intended for 
demonstrating the differences between manual planning and optimized 
planning. It does NOT represent the actual operational algorithms or 
procedures used by Indian Railways.
"""

from typing import Any

from app.models.request import MaintenanceRequest
from app.models.block_window import BlockWindow


def calculate_priority(request: MaintenanceRequest) -> int:
    """
    Calculate an integer priority score for a request.
    Higher score = scheduled first.
    """
    severity_weights = {
        "critical": 1000,
        "high": 500,
        "medium": 200,
        "low": 50
    }
    base = severity_weights.get(request.severity.lower(), 0)
    # Add weight for overdue days to prevent starvation of older low-priority requests
    return base + (request.overdue_days * 10)


def generate_manual_schedule(
    requests: list[MaintenanceRequest],
    block_windows: list[BlockWindow]
) -> dict[str, Any]:
    """
    Generate a manual baseline schedule.
    
    Rules:
    1. Sort requests by priority (descending).
    2. A request can be assigned at most once.
    3. Request must belong to the same section as the window.
    4. Request duration must fit entirely within the window.
    5. Manual baseline uses EXACTLY ONE request per window (no co-location).
    """
    sorted_requests = sorted(requests, key=calculate_priority, reverse=True)
    
    assignments = []
    scheduled_request_ids = set()
    windows_used = set()
    total_scheduled_minutes = 0
    
    for req in sorted_requests:
        # Find the first available suitable window for this request
        for w in block_windows:
            if w.id in windows_used:
                continue
                
            if req.section_id == w.section_id and req.duration_minutes <= w.duration_minutes:
                # Assign the request to this window
                assignments.append({
                    "request": req,
                    "window": w
                })
                scheduled_request_ids.add(req.id)
                windows_used.add(w.id)
                total_scheduled_minutes += req.duration_minutes
                break
                
    unscheduled = [r for r in requests if r.id not in scheduled_request_ids]
    critical_unscheduled = [r for r in unscheduled if r.severity == "critical"]
    
    return {
        "assignments": assignments,
        "unscheduled_requests": unscheduled,
        "windows_used": len(windows_used),
        "total_scheduled_hours": round(total_scheduled_minutes / 60.0, 2),
        "critical_requests_unscheduled": len(critical_unscheduled)
    }
