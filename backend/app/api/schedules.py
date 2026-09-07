from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.schedule import ScheduleRunRequest, ScheduleRunResponse, ScheduleComparisonResponse
from app.services.scheduling.runner import run_schedule, get_schedule, get_comparison
from app.api.deps import RequireRole, get_current_user
from app.models.user import User


router = APIRouter(prefix="/api/schedule", tags=["schedule"])


@router.post("/run", response_model=ScheduleRunResponse, status_code=status.HTTP_201_CREATED)
def trigger_schedule_run(
    req: ScheduleRunRequest, 
    db: Session = Depends(get_db)
):
    """Run the scheduler and persist the assignments."""
    try:
        result = run_schedule(db, req.week_start_date, req.mode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An error occurred during scheduling")
        
    db_run = result["run"]
    
    # Construct response
    response_data = db_run.__dict__.copy()
    response_data["assignments"] = result["assignments"]
    response_data["explanations"] = result["explanations"]
    response_data["map_data"] = result.get("map_data", [])
    
    return response_data


@router.get("/compare", response_model=ScheduleComparisonResponse)
def compare_schedules(
    week_start_date: date = Query(..., description="The week start date to compare"),
    db: Session = Depends(get_db)
):
    """Return the manual and optimized runs for the specified week side-by-side."""
    comp = get_comparison(db, week_start_date)
    
    response = {}
    if comp["manual"]:
        manual_data = comp["manual"]["run"].__dict__.copy()
        manual_data["assignments"] = comp["manual"]["assignments"]
        manual_data["map_data"] = comp["manual"].get("map_data", [])
        response["manual"] = manual_data
        
    if comp["optimized"]:
        opt_data = comp["optimized"]["run"].__dict__.copy()
        opt_data["assignments"] = comp["optimized"]["assignments"]
        opt_data["map_data"] = comp["optimized"].get("map_data", [])
        response["optimized"] = opt_data
        
    return response


@router.get("/{week_start_date}", response_model=ScheduleRunResponse | None)
def get_schedule_details(
    week_start_date: date,
    mode: str = Query("optimized", description="Must be 'manual' or 'optimized'"),
    db: Session = Depends(get_db)
):
    """Retrieve an existing schedule run. Returns null if not found."""
    if mode not in ["manual", "optimized"]:
        raise HTTPException(status_code=400, detail="Invalid mode")
        
    result = get_schedule(db, week_start_date, mode)
    if not result:
        return None
        
    db_run = result["run"]
    response_data = db_run.__dict__.copy()
    response_data["assignments"] = result["assignments"]
    response_data["explanations"] = result["explanations"]
    response_data["map_data"] = result.get("map_data", [])
    
    return response_data
