"""FastAPI application — SIH26027 Automatic Block Planning System.

Wires all routers, CORS, and startup database initialization.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import engine, SessionLocal
from app.db.base import Base
from app.db.seed import seed_database

# Import all models so Base.metadata registers them
import app.models  # noqa: F401

# Import routers
from app.api.requests import router as requests_router
from app.api.sections import router as sections_router
from app.api.departments import router as departments_router
from app.api.block_windows import router as block_windows_router
from app.api.schedules import router as schedules_router
from app.api.stats import router as stats_router
from app.api.mock_data import router as mock_data_router
from app.api.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables and seed reference data on startup."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

# CORS — allow the Vite dev server and common local origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(requests_router)
app.include_router(sections_router)
app.include_router(departments_router)
app.include_router(block_windows_router)
app.include_router(schedules_router)
app.include_router(stats_router)
app.include_router(mock_data_router)
app.include_router(auth_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


from sqlalchemy import text
from fastapi import Depends
from sqlalchemy.orm import Session
from app.db.database import get_db

@app.get("/health/db")
def health_check_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
