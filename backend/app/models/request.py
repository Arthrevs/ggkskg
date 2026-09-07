"""MaintenanceRequest model — individual maintenance work items from departments."""

import datetime as dt
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Index, String, Integer, ForeignKey, DateTime, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.section import Section
    from app.models.department import Department
    from app.models.work_type import WorkType
    from app.models.assignment import ScheduleAssignment


class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"
    __table_args__ = (
        CheckConstraint(
            "severity IN ('critical', 'high', 'medium', 'low')",
            name="ck_request_severity_valid",
        ),
        CheckConstraint(
            "status IN ('pending', 'scheduled', 'unscheduled')",
            name="ck_request_status_valid",
        ),
        CheckConstraint("duration_minutes > 0", name="ck_request_duration_positive"),
        CheckConstraint("overdue_days >= 0", name="ck_request_overdue_nonnegative"),
        CheckConstraint(
            "length(task_description) > 0", name="ck_request_description_nonempty"
        ),
        Index("ix_request_section_id", "section_id"),
        Index("ix_request_department_id", "department_id"),
        Index("ix_request_severity", "severity"),
        Index("ix_request_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[int] = mapped_column(
        ForeignKey("sections.id", ondelete="CASCADE"), nullable=False
    )
    department_id: Mapped[int] = mapped_column(
        ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )

    task_description: Mapped[str] = mapped_column(String(500), nullable=False)
    requested_date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    overdue_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    work_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("work_types.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # Relationships
    section: Mapped["Section"] = relationship("Section", back_populates="requests")
    department: Mapped["Department"] = relationship("Department", back_populates="requests")
    work_type: Mapped["WorkType"] = relationship("WorkType", back_populates="requests")
    assignments: Mapped[list["ScheduleAssignment"]] = relationship(
        "ScheduleAssignment", back_populates="request", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<MaintenanceRequest(id={self.id}, severity='{self.severity}', "
            f"status='{self.status}', duration_minutes={self.duration_minutes})>"
        )
