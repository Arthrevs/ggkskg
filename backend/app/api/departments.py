from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.department import DepartmentResponse
from app.services.department import get_departments

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentResponse])
def read_departments(db: Session = Depends(get_db)):
    """Get all departments."""
    return get_departments(db)
