"""Models package — import all models so Alembic and Base.metadata see them."""

from app.models.department import Department
from app.models.section import Section
from app.models.request import MaintenanceRequest
from app.models.schedule_run import ScheduleRun
from app.models.assignment import ScheduleAssignment
from app.models.block_window import BlockWindow
from app.models.work_type import WorkType
from app.models.compatibility_rule import WorkCompatibilityRule
from app.models.user import User

__all__ = [
    "Department",
    "Section",
    "BlockWindow",
    "MaintenanceRequest",
    "ScheduleAssignment",
    "ScheduleRun",
    "WorkType",
    "WorkCompatibilityRule",
    "User",
]
