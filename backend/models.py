"""
SIH26027 — Pydantic models for API request/response schemas.

These models document the API contract between the FastAPI backend and
the React frontend. They are used for validation and auto-generated
OpenAPI docs at /docs.
"""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


# ── Network (tracks.json) ────────────────────────────────────────────────────

class StationNode(BaseModel):
    id: str
    name: str
    code: str
    km: float
    lat: float
    lng: float
    type: str          # "junction" | "station"
    platforms: int


class TrackEdge(BaseModel):
    id: str
    source: str
    target: str
    direction: str     # "UP" | "DN" | "LOOP"
    distance_km: float
    capacity: int
    line_type: str     # "mainline" | "loop"
    km_start: float
    km_end: float


class NetworkResponse(BaseModel):
    nodes: list[StationNode]
    edges: list[TrackEdge]


# ── Timetable (coa_timetable.json) ───────────────────────────────────────────

class TrainScheduleEntry(BaseModel):
    station_id: str
    station_name: str
    km: float
    arrival_time: Optional[str] = None
    departure_time: Optional[str] = None
    arrival_minutes: Optional[int] = None
    departure_minutes: Optional[int] = None
    delay_minutes: Optional[int] = None


class Train(BaseModel):
    train_id: str
    train_name: str
    source: str
    destination: str
    direction: str           # "UP" | "DN"
    priority: str            # "high" | "medium" | "low"
    priority_weight: int     # 100, 50, or 10
    category: str
    total_travel_minutes: int
    schedule: list[TrainScheduleEntry]
    delay_minutes: Optional[int] = None


class TimetableResponse(BaseModel):
    corridor: str
    date: str
    trains: list[Train]


# ── Defects (defects.json) ───────────────────────────────────────────────────

class Defect(BaseModel):
    defect_id: str
    department: str          # "TMS" | "SMMS" | "TDMS"
    department_full: str
    description: str
    km_location: float
    section_from: str
    section_to: str
    severity: str            # "critical" | "high" | "medium" | "low"
    duration_minutes: int
    equipment_required: list[str]
    crew_size: int
    overdue_days: int


class MegaBlockCluster(BaseModel):
    cluster_id: str
    defect_ids: list[str]
    km_start: float
    km_end: float
    duration_minutes: int
    departments: list[str]
    is_mega_block: bool
    severity: str
    affected_segments: Optional[list[list[str]]] = None


class DefectsResponse(BaseModel):
    defects: list[Defect]
    clusters: list[MegaBlockCluster]


# ── Solver output ────────────────────────────────────────────────────────────

class BlockScheduleEntry(BaseModel):
    cluster_id: str
    defect_ids: list[str]
    km_start: float
    km_end: float
    duration_minutes: int
    departments: list[str]
    is_mega_block: bool
    severity: str
    affected_segments: list[list[str]]
    scheduled_start_minutes: int
    scheduled_end_minutes: int
    scheduled_start_time: str
    scheduled_end_time: str


class SolverStats(BaseModel):
    total_weighted_delay: float
    trains_delayed: int
    trains_unaffected: int
    max_single_delay_minutes: int
    mega_blocks_formed: int
    total_clusters: int
    total_defects: int


class SolverResponse(BaseModel):
    status: str              # "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "UNKNOWN"
    objective_value: Optional[float] = None
    solve_time_seconds: Optional[float] = None
    optimized_timetable: Optional[TimetableResponse] = None
    block_schedule: Optional[list[BlockScheduleEntry]] = None
    clusters: list[MegaBlockCluster]
    stats: Optional[SolverStats] = None
    error: Optional[str] = None
