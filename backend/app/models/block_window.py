"""BlockWindow model — generated time slots for maintenance per section per week.

All time values stored as integer minutes to avoid floating-point drift.
"""

import datetime as dt

from sqlalchemy import CheckConstraint, Index, UniqueConstraint, String, Integer, ForeignKey, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class BlockWindow(Base):
    __tablename__ = "block_windows"
    __table_args__ = (
        CheckConstraint(
            "start_minute >= 0 AND start_minute < 1440",
            name="ck_bw_start_minute_range",
        ),
        CheckConstraint(
            "duration_minutes > 0 AND duration_minutes <= 1440",
            name="ck_bw_duration_range",
        ),
        CheckConstraint("slot_capacity > 0", name="ck_bw_slot_capacity_positive"),
        CheckConstraint(
            "day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')",
            name="ck_bw_day_of_week_valid",
        ),
        UniqueConstraint(
            "section_id", "week_start_date", "day_of_week", "start_minute",
            name="uq_bw_section_week_day_start",
        ),
        Index("ix_bw_section_id", "section_id"),
        Index("ix_bw_week_start_date", "week_start_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[int] = mapped_column(
        ForeignKey("sections.id", ondelete="CASCADE"), nullable=False
    )
    week_start_date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    day_of_week: Mapped[str] = mapped_column(String(10), nullable=False)
    start_minute: Mapped[int] = mapped_column(
        Integer, nullable=False,
        comment="Minutes from midnight (0-1439). E.g. 60 = 01:00, 90 = 01:30",
    )
    duration_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False,
        comment="Window duration in minutes",
    )
    slot_capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    # Relationships
    section: Mapped["Section"] = relationship("Section", back_populates="block_windows")
    assignments: Mapped[list["ScheduleAssignment"]] = relationship(
        "ScheduleAssignment", back_populates="block_window", cascade="all, delete-orphan"
    )

    @property
    def start_time_str(self) -> str:
        """Format start_minute as HH:MM string."""
        h, m = divmod(self.start_minute, 60)
        return f"{h:02d}:{m:02d}"

    @property
    def end_time_str(self) -> str:
        """Format end time as HH:MM string (wraps past midnight)."""
        end = self.start_minute + self.duration_minutes
        h, m = divmod(end % 1440, 60)
        return f"{h:02d}:{m:02d}"

    def __repr__(self) -> str:
        return (
            f"<BlockWindow(id={self.id}, section_id={self.section_id}, "
            f"day='{self.day_of_week}', start={self.start_time_str}, "
            f"duration={self.duration_minutes}min)>"
        )
