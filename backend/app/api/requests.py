from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.request import MaintenanceRequestCreate, MaintenanceRequestUpdate, MaintenanceRequestResponse
from app.services import request as request_service
from app.api.deps import RequireRole, get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/requests", tags=["requests"])


@router.post("", response_model=MaintenanceRequestResponse, status_code=status.HTTP_201_CREATED)
def create_request(
    req_in: MaintenanceRequestCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(RequireRole(["department_requester", "planner_admin"]))
):
    """Create a new maintenance request."""
    if current_user.role == "department_requester":
        req_in.department_id = current_user.department_id
    try:
        return request_service.create_request(db, req_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("", response_model=list[MaintenanceRequestResponse], status_code=status.HTTP_200_OK)
def read_requests(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    section_id: int | None = Query(None, alias="sectionId"),
    department_id: int | None = Query(None, alias="departmentId"),
    request_status: str | None = Query(None, alias="status"),
    severity: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all requests with filtering and pagination."""
    if current_user.role == "department_requester":
        department_id = current_user.department_id
    return request_service.get_requests(
        db, skip=skip, limit=limit,
        section_id=section_id, department_id=department_id,
        status=request_status, severity=severity
    )


@router.get("/{request_id}", response_model=MaintenanceRequestResponse, status_code=status.HTTP_200_OK)
def read_request(
    request_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific request by ID."""
    req = request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if current_user.role == "department_requester" and req.department_id != current_user.department_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this request")
    return req


@router.put("/{request_id}", response_model=MaintenanceRequestResponse, status_code=status.HTTP_200_OK)
def update_request(
    request_id: int, 
    req_in: MaintenanceRequestUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(RequireRole(["department_requester", "planner_admin"]))
):
    """Update a request by ID."""
    req = request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    
    if current_user.role == "department_requester":
        if req.department_id != current_user.department_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this request")
        if req_in.department_id is not None and req_in.department_id != current_user.department_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot change department to another department")
            
    try:
        updated_req = request_service.update_request(db, request_id, req_in)
        return updated_req
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_request(
    request_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(RequireRole(["department_requester", "planner_admin"]))
):
    """Delete a request by ID."""
    req = request_service.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if current_user.role == "department_requester" and req.department_id != current_user.department_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this request")
        
    success = request_service.delete_request(db, request_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    return None
