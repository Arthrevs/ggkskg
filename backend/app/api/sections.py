from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.section import SectionResponse
from app.services.section import get_sections

router = APIRouter(prefix="/api/sections", tags=["sections"])


@router.get("", response_model=list[SectionResponse])
def read_sections(db: Session = Depends(get_db)):
    """Get all sections."""
    return get_sections(db)
