"""Tests for SQLAlchemy database models and constraints."""

import datetime as dt
import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.department import Department
from app.models.section import Section
from app.models.request import MaintenanceRequest
from app.models.block_window import BlockWindow
from app.models.assignment import ScheduleAssignment
from app.models.schedule_run import ScheduleRun


from sqlalchemy import event

@pytest.fixture(scope="module")
def engine():
    # Use in-memory SQLite for fast isolated tests
    engine = create_engine("sqlite:///:memory:")
    
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
    
    event.listen(engine, 'connect', set_sqlite_pragma)
    
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)


@pytest.fixture(scope="function")
def session(engine):
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()
    session.close()


def test_department_create(session):
    dept = Department(name="Engineering", short_code="ENG")
    session.add(dept)
    session.commit()
    
    assert dept.id is not None
    assert dept.name == "Engineering"

def test_department_unique_constraints(session):
    session.add(Department(name="Signals", short_code="SIG"))
    session.commit()
    
    # Duplicate name should fail
    dup = Department(name="Signals", short_code="S&T")
    session.add(dup)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()

def test_department_check_constraints(session):
    # Empty name should fail check constraint
    empty = Department(name="", short_code="EMP")
    session.add(empty)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()

def test_section_create(session):
    sec = Section(
        code="DEL-AGR",
        name="Delhi - Agra",
        window_start_hour=60,
        window_duration_hours=180,
        slot_capacity=3
    )
    session.add(sec)
    session.commit()
    assert sec.id is not None

def test_section_check_constraints(session):
    # Invalid negative duration
    sec = Section(
        code="BOM-PUN",
        name="Mumbai - Pune",
        window_start_hour=60,
        window_duration_hours=-10,
        slot_capacity=3
    )
    session.add(sec)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()

def test_maintenance_request_create_and_relations(session):
    dept = Department(name="Traction", short_code="TRD")
    sec = Section(code="SEC-1", name="Section 1", window_start_hour=60, window_duration_hours=120)
    session.add_all([dept, sec])
    session.commit()
    
    req = MaintenanceRequest(
        section_id=sec.id,
        department_id=dept.id,
        task_description="Replace wiring",
        severity="high",
        duration_minutes=90,
    )
    session.add(req)
    session.commit()
    
    assert req.id is not None
    assert req.department.name == "Traction"
    assert req.section.code == "SEC-1"
    assert req.status == "pending" # default value
    assert req.overdue_days == 0 # default value

def test_maintenance_request_invalid_severity(session):
    dept = Department(name="Dept2", short_code="D2")
    sec = Section(code="SEC-2", name="Section 2")
    session.add_all([dept, sec])
    session.commit()
    
    req = MaintenanceRequest(
        section_id=sec.id,
        department_id=dept.id,
        task_description="Test",
        severity="invalid_severity", # should fail check constraint
        duration_minutes=60,
    )
    session.add(req)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()

def test_block_window_create(session):
    sec = Section(code="SEC-3", name="Section 3")
    session.add(sec)
    session.commit()
    
    bw = BlockWindow(
        section_id=sec.id,
        week_start_date=dt.date(2026, 9, 7),
        day_of_week="Monday",
        start_minute=60,
        duration_minutes=180,
    )
    session.add(bw)
    session.commit()
    
    assert bw.id is not None
    assert bw.start_time_str == "01:00"
    assert bw.end_time_str == "04:00"

def test_schedule_assignment_create(session):
    dept = Department(name="Dept3", short_code="D3")
    sec = Section(code="SEC-4", name="Section 4")
    session.add_all([dept, sec])
    session.commit()
    
    req = MaintenanceRequest(
        section_id=sec.id, department_id=dept.id,
        task_description="Task", severity="low", duration_minutes=30
    )
    bw = BlockWindow(
        section_id=sec.id, week_start_date=dt.date(2026, 9, 7),
        day_of_week="Tuesday", start_minute=60, duration_minutes=180
    )
    session.add_all([req, bw])
    session.commit()
    
    assign = ScheduleAssignment(
        request_id=req.id,
        block_window_id=bw.id,
        week_start_date=dt.date(2026, 9, 7),
        mode="optimized"
    )
    session.add(assign)
    session.commit()
    
    assert assign.id is not None
    assert assign.request.task_description == "Task"
    assert assign.block_window.day_of_week == "Tuesday"

def test_schedule_run_create(session):
    run = ScheduleRun(
        week_start_date=dt.date(2026, 9, 7),
        mode="optimized",
        total_hours=5.5,
        total_windows=2,
        co_located_windows=1,
        unscheduled_count=0,
        solve_time_ms=150
    )
    session.add(run)
    session.commit()
    assert run.id is not None

def test_schedule_run_check_constraints(session):
    run = ScheduleRun(
        week_start_date=dt.date(2026, 9, 7),
        mode="optimized",
        total_windows=-5 # should fail constraint
    )
    session.add(run)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
