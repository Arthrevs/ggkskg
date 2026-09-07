from sqlalchemy import String, Integer, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.department import Department
    from app.models.request import MaintenanceRequest
class WorkType(Base):
    __tablename__ = "work_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    department_id: Mapped[int] = mapped_column(
        ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    
    requires_traffic_block: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_power_block: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_ohe_isolation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_signal_disconnection: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    department: Mapped["Department"] = relationship("Department")
    requests: Mapped[list["MaintenanceRequest"]] = relationship("MaintenanceRequest", back_populates="work_type")
