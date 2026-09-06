"""Department model — the three railway maintenance departments."""

from sqlalchemy import CheckConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = (
        CheckConstraint("length(name) > 0", name="ck_department_name_nonempty"),
        CheckConstraint("length(short_code) > 0", name="ck_department_short_code_nonempty"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    short_code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)

    # Relationships
    requests: Mapped[list["MaintenanceRequest"]] = relationship(
        "MaintenanceRequest", back_populates="department"
    )

    def __repr__(self) -> str:
        return f"<Department(id={self.id}, name='{self.name}', short_code='{self.short_code}')>"
