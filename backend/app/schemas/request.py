from datetime import datetime, date
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel


class MaintenanceRequestBase(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    section_id: int
    department_id: int
    work_type_id: int | None = None
    task_description: str
    requested_date: date
    severity: str
    overdue_days: int
    duration_minutes: int
    status: str = "pending"


class MaintenanceRequestCreate(MaintenanceRequestBase):
    @field_validator("task_description")
    def description_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Task description cannot be empty")
        return v

    @field_validator("severity")
    def severity_must_be_valid(cls, v: str) -> str:
        valid_severities = {"critical", "high", "medium", "low"}
        if v.lower() not in valid_severities:
            raise ValueError(f"Severity must be one of {valid_severities}")
        return v.lower()

    @field_validator("overdue_days")
    def overdue_days_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Overdue days cannot be negative")
        return v

    @field_validator("duration_minutes")
    def duration_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Duration minutes must be greater than 0")
        return v


class MaintenanceRequestUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    section_id: int | None = None
    department_id: int | None = None
    work_type_id: int | None = None
    task_description: str | None = None
    requested_date: date | None = None
    severity: str | None = None
    overdue_days: int | None = None
    duration_minutes: int | None = None
    status: str | None = None

    @field_validator("task_description")
    def description_must_not_be_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Task description cannot be empty")
        return v

    @field_validator("severity")
    def severity_must_be_valid(cls, v: str | None) -> str | None:
        valid_severities = {"critical", "high", "medium", "low"}
        if v is not None and v.lower() not in valid_severities:
            raise ValueError(f"Severity must be one of {valid_severities}")
        return v.lower() if v else v

    @field_validator("overdue_days")
    def overdue_days_non_negative(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("Overdue days cannot be negative")
        return v

    @field_validator("duration_minutes")
    def duration_positive(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("Duration minutes must be greater than 0")
        return v


class MaintenanceRequestResponse(MaintenanceRequestBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
