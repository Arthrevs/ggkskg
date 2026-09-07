from sqlalchemy import Integer, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.work_type import WorkType
class WorkCompatibilityRule(Base):
    __tablename__ = "work_compatibility_rules"
    __table_args__ = (
        UniqueConstraint("work_type_a_id", "work_type_b_id", name="uq_work_type_pairs"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    work_type_a_id: Mapped[int] = mapped_column(
        ForeignKey("work_types.id", ondelete="CASCADE"), nullable=False
    )
    work_type_b_id: Mapped[int] = mapped_column(
        ForeignKey("work_types.id", ondelete="CASCADE"), nullable=False
    )
    is_compatible: Mapped[bool] = mapped_column(Boolean, nullable=False)

    work_type_a: Mapped["WorkType"] = relationship("WorkType", foreign_keys=[work_type_a_id])
    work_type_b: Mapped["WorkType"] = relationship("WorkType", foreign_keys=[work_type_b_id])
