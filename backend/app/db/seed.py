"""Database seeder — creates departments and sections if they don't exist.

Section data matches the 15 sections from the frontend mock data exactly.
"""

from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.section import Section
from app.models.user import User
from app.core.security import get_password_hash


DEPARTMENTS = [
    {"name": "Engineering", "short_code": "ENGG"},
    {"name": "S&T", "short_code": "SNT"},
    {"name": "TRD", "short_code": "TRD"},
]

SECTIONS = [
    {
        "code": "sec-1", "name": "Delhi Junction – Agra Cantt",
        "window_start_hour": 60, "window_duration_hours": 180, "slot_capacity": 3,
    },
    {
        "code": "sec-2", "name": "Mumbai CST – Pune Jn",
        "window_start_hour": 30, "window_duration_hours": 240, "slot_capacity": 3,
    },
    {
        "code": "sec-3", "name": "Chennai Central – Bangalore City",
        "window_start_hour": 120, "window_duration_hours": 180, "slot_capacity": 3,
    },
    {
        "code": "sec-4", "name": "Howrah Jn – Kharagpur Jn",
        "window_start_hour": 60, "window_duration_hours": 180, "slot_capacity": 3,
    },
    {
        "code": "sec-5", "name": "Lucknow NR – Varanasi Jn",
        "window_start_hour": 0, "window_duration_hours": 210, "slot_capacity": 3,
    },
    {
        "code": "sec-6", "name": "Jaipur Jn – Ajmer Jn",
        "window_start_hour": 90, "window_duration_hours": 180, "slot_capacity": 3,
    },
    {
        "code": "sec-7", "name": "Secunderabad – Kazipet Jn",
        "window_start_hour": 1380, "window_duration_hours": 240, "slot_capacity": 3,
        "mega_day": "Wednesday", "mega_duration_hours": 360,
    },
    {
        "code": "sec-8", "name": "Patna Jn – Gaya Jn",
        "window_start_hour": 60, "window_duration_hours": 180, "slot_capacity": 3,
    },
    {
        "code": "sec-9", "name": "Bhopal Jn – Itarsi Jn",
        "window_start_hour": 0, "window_duration_hours": 210, "slot_capacity": 3,
    },
    {
        "code": "sec-10", "name": "Visakhapatnam – Vijayawada Jn",
        "window_start_hour": 120, "window_duration_hours": 180, "slot_capacity": 3,
    },
    {
        "code": "sec-11", "name": "Coimbatore Jn – Erode Jn",
        "window_start_hour": 60, "window_duration_hours": 180, "slot_capacity": 3,
    },
    {
        "code": "sec-12", "name": "Kanpur Central – Allahabad Jn",
        "window_start_hour": 30, "window_duration_hours": 240, "slot_capacity": 3,
        "mega_day": "Sunday", "mega_duration_hours": 360,
    },
    {
        "code": "sec-13", "name": "Nagpur Jn – Wardha Jn",
        "window_start_hour": 60, "window_duration_hours": 180, "slot_capacity": 3,
    },
    {
        "code": "sec-14", "name": "Ahmedabad Jn – Vadodara Jn",
        "window_start_hour": 90, "window_duration_hours": 180, "slot_capacity": 3,
    },
    {
        "code": "sec-15", "name": "Guwahati – New Jalpaiguri",
        "window_start_hour": 0, "window_duration_hours": 210, "slot_capacity": 3,
    },
]


def seed_database(db: Session) -> None:
    """Create departments and sections if they don't already exist."""

    # Departments
    existing_depts = db.query(Department).count()
    if existing_depts == 0:
        for d in DEPARTMENTS:
            db.add(Department(**d))
        db.commit()

    # Sections
    existing_sections = db.query(Section).count()
    if existing_sections == 0:
        for s in SECTIONS:
            db.add(Section(**s))
        db.commit()

    # Users
    existing_users = db.query(User).count()
    if existing_users == 0:
        engg_dept = db.query(Department).filter(Department.short_code == "ENGG").first()
        users = [
            User(username="admin", hashed_password=get_password_hash("admin123"), role="planner_admin"),
            User(username="viewer", hashed_password=get_password_hash("view123"), role="viewer"),
        ]
        if engg_dept:
            users.append(User(username="engg_req", hashed_password=get_password_hash("req123"), role="department_requester", department_id=engg_dept.id))
        
        for u in users:
            db.add(u)
        db.commit()
