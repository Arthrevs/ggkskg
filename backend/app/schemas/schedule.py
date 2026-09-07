from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.request import MaintenanceRequestResponse


class ScheduleRunRequest(BaseModel):
    model_config = ConfigDict(alias_generator=None, populate_by_name=True)
    week_start_date: date
    mode: str = Field(description="Must be 'manual' or 'optimized'")


class ScheduleAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: int
    request_id: int
    block_window_id: int
    mode: str
    week_start_date: date


class ScheduleRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: int
    week_start_date: date
    mode: str
    total_hours: float
    total_windows: int
    co_located_windows: int
    unscheduled_count: int
    objective_value: float | None = None
    solve_time_ms: int | None = None
    created_at: datetime
    
    # We will dynamically inject these in the API response
    assignments: list[ScheduleAssignmentResponse] = []
    explanations: list[dict[str, Any]] = []
    map_data: list[dict[str, Any]] = []


class ScheduleComparisonResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    manual: ScheduleRunResponse | None = None
    optimized: ScheduleRunResponse | None = None


from pydantic.alias_generators import to_camel

class DateCountOut(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    date: str
    count: int

class DepartmentWorkloadOut(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    department: str
    hours: float
    requests: int

class StatsSummaryOut(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    total_hours_scheduled: float
    windows_used: int
    colocated_blocks: int
    solver_time_ms: int
    requests_by_department: dict[str, int]
    requests_by_severity: dict[str, int]
    requests_over_time: list[DateCountOut]
    department_workload: list[DepartmentWorkloadOut]
