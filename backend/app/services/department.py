from sqlalchemy.orm import Session
from app.models.department import Department


def get_departments(db: Session) -> list[Department]:
    """Retrieve all departments."""
    return db.query(Department).all()
