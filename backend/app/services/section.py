from sqlalchemy.orm import Session
from app.models.section import Section


def get_sections(db: Session) -> list[Section]:
    """Retrieve all sections."""
    return db.query(Section).all()
