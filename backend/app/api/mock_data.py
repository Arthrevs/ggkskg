from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.mock_generator import generate_mock_data
from app.api.deps import RequireRole
from app.models.user import User

router = APIRouter(prefix="/api/mock-data", tags=["mock-data"])


@router.post("/generate", status_code=status.HTTP_201_CREATED)
def trigger_generate_mock_data(
    seed: int = Query(42, description="Deterministic random seed"),
    clear: bool = Query(True, description="Clear existing non-reference data first"),
    db: Session = Depends(get_db)
):
    """
    Generate deterministic mock data for testing/demo purposes.
    Spawns requests, block windows, departments, and sections.
    """
    result = generate_mock_data(db, seed=seed, clear_existing=clear)
    return result
