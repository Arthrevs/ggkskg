from datetime import date
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from app.db.database import get_db
from app.services.block_window_generator import generate_weekly_windows

router = APIRouter(prefix="/api/block-windows", tags=["block-windows"])


class GenerateWindowsRequest(BaseModel):
    model_config = ConfigDict(alias_generator=None, populate_by_name=True)
    week_start_date: date


class GenerateWindowsResponse(BaseModel):
    windows_created: int
    section_count: int
    week: str


@router.post("/generate", response_model=GenerateWindowsResponse, status_code=status.HTTP_201_CREATED)
def trigger_generate_windows(req: GenerateWindowsRequest, db: Session = Depends(get_db)):
    """Generate block windows for all sections for a specific week."""
    result = generate_weekly_windows(db, req.week_start_date)
    return result
