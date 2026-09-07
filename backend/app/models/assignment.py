"""ScheduleAssignment model."""

import datetime as dt

from sqlalchemy import (
    CheckConstraint, Index, UniqueConstraint,
    String, Integer, ForeignKey, Date,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ScheduleAssignment(Base):
    """Maps a request to a block window in a specific schedule run."""

    __tablename__ = "schedule_assignments"
    __table_args__ = (
        CheckConstraint(
            "mode IN ('manual', 'optimized')",
            name="ck_assignment_mode_valid",
        ),
        UniqueConstraint(
            "request_id", "week_start_date", "mode",
            name="uq_assignment_request_week_mode",
        ),
        Index("ix_assignment_request_id", "request_id"),
        Index("ix_assignment_block_window_id", "block_window_id"),
        Index("ix_assignment_week_mode", "week_start_date", "mode"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(
        ForeignKey("maintenance_requests.id", ondelete="CASCADE"), nullable=False
    )
    block_window_id: Mapped[int] = mapped_column(
        ForeignKey("block_windows.id", ondelete="CASCADE"), nullable=False
    )
    week_start_date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    mode: Mapped[str] = mapped_column(String(20), nullable=False)

    # Relationships
    request: Mapped["MaintenanceRequest"] = relationship(
        "MaintenanceRequest", back_populates="assignments"
    )
    block_window: Mapped["BlockWindow"] = relationship(
        "BlockWindow", back_populates="assignments"
    )

    def __repr__(self) -> str:
        return (
            f"<ScheduleAssignment(id={self.id}, request_id={self.request_id}, "
            f"window_id={self.block_window_id}, mode='{self.mode}')>"
        )
