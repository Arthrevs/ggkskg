from sqlalchemy.orm import Session, joinedload
from sqlalchemy import exc

from app.models.request import MaintenanceRequest
from app.models.section import Section
from app.models.department import Department
from app.schemas.request import MaintenanceRequestCreate, MaintenanceRequestUpdate


def get_requests(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    section_id: int | None = None,
    department_id: int | None = None,
    status: str | None = None,
    severity: str | None = None,
) -> list[MaintenanceRequest]:
    """Retrieve maintenance requests with filtering and pagination."""
    query = db.query(MaintenanceRequest).options(
        joinedload(MaintenanceRequest.section), joinedload(MaintenanceRequest.department)
    )
    
    if section_id is not None:
        query = query.filter(MaintenanceRequest.section_id == section_id)
    if department_id is not None:
        query = query.filter(MaintenanceRequest.department_id == department_id)
    if status is not None:
        query = query.filter(MaintenanceRequest.status == status)
    if severity is not None:
        query = query.filter(MaintenanceRequest.severity == severity)
        
    return query.offset(skip).limit(limit).all()


def get_request(db: Session, request_id: int) -> MaintenanceRequest | None:
    """Retrieve a single maintenance request by ID."""
    return db.query(MaintenanceRequest).options(
        joinedload(MaintenanceRequest.section), joinedload(MaintenanceRequest.department)
    ).filter(MaintenanceRequest.id == request_id).first()


def create_request(db: Session, req_in: MaintenanceRequestCreate) -> MaintenanceRequest:
    """Create a new maintenance request."""
    # Validate section and department existence at the service level
    section = db.query(Section).filter(Section.id == req_in.section_id).first()
    if not section:
        raise ValueError(f"Section with id {req_in.section_id} not found")
        
    department = db.query(Department).filter(Department.id == req_in.department_id).first()
    if not department:
        raise ValueError(f"Department with id {req_in.department_id} not found")

    db_req = MaintenanceRequest(**req_in.model_dump())
    db.add(db_req)
    try:
        db.commit()
        db.refresh(db_req)
    except exc.IntegrityError as e:
        db.rollback()
        raise ValueError(f"Database integrity error: {str(e)}")
        
    return db_req


def update_request(db: Session, request_id: int, req_in: MaintenanceRequestUpdate) -> MaintenanceRequest | None:
    """Update an existing maintenance request."""
    db_req = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == request_id).first()
    if not db_req:
        return None
        
    update_data = req_in.model_dump(exclude_unset=True)
    
    if "section_id" in update_data:
        section = db.query(Section).filter(Section.id == update_data["section_id"]).first()
        if not section:
            raise ValueError(f"Section with id {update_data['section_id']} not found")
            
    if "department_id" in update_data:
        department = db.query(Department).filter(Department.id == update_data["department_id"]).first()
        if not department:
            raise ValueError(f"Department with id {update_data['department_id']} not found")

    for key, value in update_data.items():
        setattr(db_req, key, value)
        
    db.commit()
    db.refresh(db_req)
    return db_req


def delete_request(db: Session, request_id: int) -> bool:
    """Delete a maintenance request."""
    db_req = db.query(MaintenanceRequest).filter(MaintenanceRequest.id == request_id).first()
    if not db_req:
        return False
        
    db.delete(db_req)
    db.commit()
    return True
