"""Section model — railway track sections with block-window configuration."""

from sqlalchemy import CheckConstraint, Index, String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Section(Base):
    __tablename__ = "sections"
    __table_args__ = (
        CheckConstraint("length(code) > 0", name="ck_section_code_nonempty"),
        CheckConstraint("length(name) > 0", name="ck_section_name_nonempty"),
        CheckConstraint(
            "window_start_hour >= 0 AND window_start_hour < 1440",
            name="ck_section_window_start_hour_range",
        ),
        CheckConstraint(
            "window_duration_hours > 0 AND window_duration_hours <= 1440",
            name="ck_section_window_duration_range",
        ),
        CheckConstraint("slot_capacity > 0", name="ck_section_slot_capacity_positive"),
        CheckConstraint(
            "mega_duration_hours IS NULL OR mega_duration_hours > 0",
            name="ck_section_mega_duration_positive",
        ),
        Index("ix_section_code", "code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # Normal nightly block window config (stored as minutes from midnight)
    window_start_hour: Mapped[int] = mapped_column(
        Integer, nullable=False, default=60,
        comment="Minutes from midnight for nightly window start (e.g. 60 = 01:00)",
    )
    window_duration_hours: Mapped[int] = mapped_column(
        Integer, nullable=False, default=180,
        comment="Window duration in minutes (e.g. 180 = 3 hours)",
    )

    # Extended weekly block (mega block), nullable
    mega_day: Mapped[str | None] = mapped_column(String(10), nullable=True)
    mega_duration_hours: Mapped[int | None] = mapped_column(
        Integer, nullable=True,
        comment="Mega block duration in minutes",
    )

    # Max concurrent department crews per window
    slot_capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    # Relationships
    requests: Mapped[list["MaintenanceRequest"]] = relationship(
        "MaintenanceRequest", back_populates="section"
    )
    block_windows: Mapped[list["BlockWindow"]] = relationship(
        "BlockWindow", back_populates="section"
    )

    def __repr__(self) -> str:
        return f"<Section(id={self.id}, code='{self.code}', name='{self.name}')>"
