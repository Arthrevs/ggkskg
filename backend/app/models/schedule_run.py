"""ScheduleRun model."""

import datetime as dt

from sqlalchemy import (
    CheckConstraint, Index,
    String, Integer, Float, Date, DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class ScheduleRun(Base):
    """Audit record for each solver/manual invocation."""

    __tablename__ = "schedule_runs"
    __table_args__ = (
        CheckConstraint(
            "mode IN ('manual', 'optimized')",
            name="ck_run_mode_valid",
        ),
        CheckConstraint("total_hours >= 0", name="ck_run_total_hours_nonneg"),
        CheckConstraint("total_windows >= 0", name="ck_run_total_windows_nonneg"),
        CheckConstraint("co_located_windows >= 0", name="ck_run_coloc_nonneg"),
        CheckConstraint("unscheduled_count >= 0", name="ck_run_unsched_nonneg"),
        CheckConstraint("solve_time_ms >= 0", name="ck_run_solve_time_nonneg"),
        Index("ix_run_week_mode", "week_start_date", "mode"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    week_start_date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    mode: Mapped[str] = mapped_column(String(20), nullable=False)

    total_hours: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_windows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    co_located_windows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unscheduled_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    objective_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    solve_time_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:
        return (
            f"<ScheduleRun(id={self.id}, week='{self.week_start_date}', "
            f"mode='{self.mode}', windows={self.total_windows})>"
        )
