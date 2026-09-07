from typing import TypedDict, Any
from pydantic import BaseModel, ConfigDict

from app.models.request import MaintenanceRequest
from app.models.block_window import BlockWindow


class ScheduledAssignment(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    request: MaintenanceRequest
    window: BlockWindow


class OptimizationResult(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    status: str
    objective_value: float
    best_bound: float
    solve_time_ms: int
    scheduled_count: int
    unscheduled_count: int
    windows_used: int
    critical_requests_unscheduled: int
    assignments: list[ScheduledAssignment]
    unscheduled_requests: list[MaintenanceRequest]
