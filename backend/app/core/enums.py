from enum import Enum

class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class RequestStatus(str, Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    UNSCHEDULED = "unscheduled"

class ScheduleMode(str, Enum):
    MANUAL = "manual"
    OPTIMIZED = "optimized"
