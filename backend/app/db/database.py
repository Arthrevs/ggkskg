"""
Database engine, session factory, and declarative Base.

Uses SQLite by default for zero-config local development.
Switch DATABASE_URL to a PostgreSQL connection string for deployment.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

from sqlalchemy.pool import NullPool

# SQLite needs check_same_thread=False for FastAPI's threaded usage
connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    echo=settings.debug,
    poolclass=NullPool,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
