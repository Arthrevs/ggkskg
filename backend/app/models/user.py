"""User models for authentication."""

import datetime as dt
from sqlalchemy import (
    String, Integer, ForeignKey, DateTime, CheckConstraint, Boolean
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

class User(Base):
    """User account with role-based access control."""
    __tablename__ = "users"
    
    __table_args__ = (
        CheckConstraint(
            "role IN ('department_requester', 'planner_admin', 'viewer')",
            name="ck_user_role_valid"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # Optional link to department for 'department_requester'
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    department = relationship("Department")
