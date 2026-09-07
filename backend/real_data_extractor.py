#!/usr/bin/env python3
"""
SIH26027 — Real Indian Railways Data Extractor (v2)

Reads the actual Indian Railways GeoJSON / schedules dataset and the archive
CSV, then produces solver-ready JSON for the JP → JOB → FL → KSG → AII corridor.

Corrections applied (v2):
  1. DPA dropped — strict linear sequence JP → JOB → FL → KSG → AII.
  2. Midnight-crossing bug fixed — overnight trains get +1440 to maintain
     monotonically increasing timeline for the CP-SAT solver.
  3. Travel times come from real schedule deltas, NOT Haversine/speed.

Source data:
  railways-master/railways-master/stations.json   — GeoJSON FeatureCollection
  railways-master/railways-master/schedules.json   — 417 k schedule entries
  archive/india_railway_stations.csv               — supplementary station data

Outputs (overwrites existing files in data/):
  data/tracks.json         — Topological graph with real coordinates
  data/coa_timetable.json  — Real train schedules (minutes-from-midnight)
  data/defects.json        — 15 synthetic defects mapped to real KM locations
"""

import json
import math
import csv
import random
from pathlib import Path

SEED = 26027
random.seed(SEED)

# ── Paths ─────────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).parent.parent
RAW_DATA = REPO_ROOT / "railways-master" / "railways-master"
ARCHIVE_CSV = REPO_ROOT / "archive" / "india_railway_stations.csv"
OUTPUT_DIR = Path(__file__).parent / "data"

# ── Corridor Definition (Full 19-station linear sequence) ────────────────────
CORRIDOR_ORDER = [
    "JP", "KKU", "DNK", "SHNX", "BOBS", "JOB", "DHND", "HDA", "FL",
    "NRI", "SK", "SALI", "GLTA", "TL", "KSG", "GEK", "LR", "MD", "AII"
]
CORRIDOR_SET = set(CORRIDOR_ORDER)


# ─────────────────────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points on Earth (km)."""
    R = 6371.0
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lon2 - lon1)
    a = math.sin(Δφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def time_to_minutes(t: str) -> int | None:
    """Convert 'HH:MM:SS' to minutes-from-midnight. Returns None for 'None'."""
    if not t or t == "None":
        return None
    parts = t.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def minutes_to_hhmm(m: int) -> str:
    """Convert minutes-from-midnight to 'HH:MM'."""
    return f"{(m // 60) % 24:02d}:{m % 60:02d}"


def classify_priority(train_name: str) -> tuple[str, int]:
    """
    Assign priority tier based on real train name.
    Returns (priority_label, weight).
    """
    name_upper = train_name.upper()
    if any(kw in name_upper for kw in [
        "SHATABDI", "RAJDHANI", "DURONTO", "VANDE BHARAT", "TEJAS",
    ]):
        return ("high", 100)
    if any(kw in name_upper for kw in ["PASSENGER", "MEMU", "DEMU"]):
        return ("low", 10)
    # Express, Mail, Superfast, Jan Shatabdi, etc.
    return ("medium", 50)


def categorize_train(train_name: str) -> str:
    """Derive display category from train name."""
    name = train_name.upper()
    if "PASSENGER" in name:
        return "Passenger"
    if "MAIL" in name:
        return "Mail"
    if "SHATABDI" in name:
        return "Shatabdi"
    if "RAJDHANI" in name:
        return "Rajdhani"
    if "SUPERFAST" in name or "S/F" in name:
        return "Superfast"
    return "Express"


# ─────────────────────────────────────────────────────────────────────────────
# Step 1: Extract & Filter
# ─────────────────────────────────────────────────────────────────────────────

def extract_stations() -> dict[str, dict]:
    """
    Load stations from GeoJSON and supplement with the archive CSV.
    Returns corridor stations keyed by code.
    """
    print("Loading stations.json...")
    raw = json.loads((RAW_DATA / "stations.json").read_text(encoding="utf-8"))

    stations: dict[str, dict] = {}
    for f in raw["features"]:
        code = f["properties"]["code"]
        if code in CORRIDOR_SET:
            coords = f["geometry"]["coordinates"]  # [lng, lat]
            stations[code] = {
                "id": code,
                "name": f["properties"]["name"],
                "code": code,
                "lat": coords[1],
                "lng": coords[0],
                "zone": f["properties"].get("zone") or "NWR",
                "state": f["properties"].get("state") or "Rajasthan",
                "is_junction": False,
                "route_count": 0,
            }

    # Supplement from archive CSV (adds is_junction, route_count, fills gaps)
    if ARCHIVE_CSV.exists():
        print("Supplementing with archive CSV...")
        with open(ARCHIVE_CSV, "r", encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                code = row["station_code"]
                if code in CORRIDOR_SET:
                    if code not in stations:
                        stations[code] = {
                            "id": code,
                            "name": row["station_name"],
                            "code": code,
                            "lat": float(row["latitude"]),
                            "lng": float(row["longitude"]),
                            "zone": row.get("railway_zone_code") or "NWR",
                            "state": row.get("state") or "Rajasthan",
                        }
                    stations[code]["is_junction"] = row.get("is_junction") == "True"
                    stations[code]["route_count"] = int(float(row.get("route_count", 0)))

    missing = CORRIDOR_SET - stations.keys()
    if missing:
        print(f"  WARNING: Missing stations: {missing}")

    print(f"  Found {len(stations)}/{len(CORRIDOR_SET)} corridor stations")
    return stations


def compute_km_markers(stations: dict[str, dict]) -> dict[str, float]:
    """
    Compute cumulative KM from JP (KM 0) along the corridor using Haversine.
    Used for defect KM mapping and topological graph edges.
    """
    km_map: dict[str, float] = {}
    cumulative = 0.0

    for i, code in enumerate(CORRIDOR_ORDER):
        if i == 0:
            km_map[code] = 0.0
        else:
            prev = stations[CORRIDOR_ORDER[i - 1]]
            curr = stations[code]
            dist = haversine_km(prev["lat"], prev["lng"], curr["lat"], curr["lng"])
            cumulative += dist
            km_map[code] = round(cumulative, 2)

    return km_map


def extract_schedules() -> list[dict]:
    """
    Load schedules.json and extract trains passing through both JP and AII.
    Applies the midnight-crossing fix for overnight trains.
    """
    print("Loading schedules.json (~82 MB)...")
    raw = json.loads((RAW_DATA / "schedules.json").read_text(encoding="utf-8"))
    print(f"  Total schedule entries: {len(raw)}")

    # Group by train number, keeping only corridor stops
    trains_map: dict[str, list[dict]] = {}
    for entry in raw:
        if entry["station_code"] in CORRIDOR_SET:
            trains_map.setdefault(entry["train_number"], []).append(entry)

    # Filter: must touch both JP and AII
    jp_aii_trains: dict[str, list[dict]] = {}
    for tnum, stops in trains_map.items():
        codes = {s["station_code"] for s in stops}
        if "JP" in codes and "AII" in codes:
            jp_aii_trains[tnum] = sorted(stops, key=lambda x: x.get("id", 0))

    print(f"  Trains touching corridor: {len(trains_map)}")
    print(f"  Trains traversing JP ↔ AII: {len(jp_aii_trains)}")

    trains: list[dict] = []
    skipped = 0

    for tnum, stops in sorted(jp_aii_trains.items()):
        # Skip slip/variant suffixes (e.g., "19711-Slip")
        if "-" in tnum:
            skipped += 1
            continue

        train_name = stops[0].get("train_name", f"Train {tnum}")

        # ── Build raw schedule entries ────────────────────────────────────
        raw_schedule = []
        has_valid_times = False

        for s in stops:
            arr_min = time_to_minutes(s.get("arrival"))
            dep_min = time_to_minutes(s.get("departure"))

            if arr_min is not None or dep_min is not None:
                has_valid_times = True

            raw_schedule.append({
                "station_id": s["station_code"],
                "station_name": s["station_name"],
                "km": 0.0,  # filled later
                "arrival_minutes": arr_min,
                "departure_minutes": dep_min,
            })

        if not has_valid_times:
            skipped += 1
            continue

        # ── FIX #2: Midnight-crossing correction ─────────────────────────
        # Walk through the schedule; whenever a time is LESS than the
        # previous station's time, add +1440 to it AND all subsequent
        # stations, ensuring a monotonically increasing timeline.
        offset = 0
        prev_time = -1  # track the last seen time value

        for entry in raw_schedule:
            for key in ("arrival_minutes", "departure_minutes"):
                val = entry[key]
                if val is None:
                    continue

                val += offset
                # If this time is earlier than the previous, we crossed midnight
                if val < prev_time:
                    offset += 1440
                    val += 1440

                entry[key] = val
                prev_time = val

        # ── Build final schedule with formatted times ─────────────────────
        schedule = []
        for entry in raw_schedule:
            arr = entry["arrival_minutes"]
            dep = entry["departure_minutes"]
            schedule.append({
                "station_id": entry["station_id"],
                "station_name": entry["station_name"],
                "km": 0.0,
                "arrival_time": minutes_to_hhmm(arr) if arr is not None else None,
                "departure_time": minutes_to_hhmm(dep) if dep is not None else None,
                "arrival_minutes": arr,
                "departure_minutes": dep,
            })

        # ── Direction inference ───────────────────────────────────────────
        first_code = schedule[0]["station_id"]
        first_idx = CORRIDOR_ORDER.index(first_code)
        last_code = schedule[-1]["station_id"]
        last_idx = CORRIDOR_ORDER.index(last_code)

        direction = "UP" if last_idx > first_idx else "DN"

        # Source / destination
        source = schedule[0]["station_id"]
        destination = schedule[-1]["station_id"]

        # Total travel (first dep → last arr)
        first_dep = next((e["departure_minutes"] for e in schedule if e["departure_minutes"] is not None), None)
        last_arr = next((e["arrival_minutes"] for e in reversed(schedule) if e["arrival_minutes"] is not None), None)

        total_travel = 0
        if first_dep is not None and last_arr is not None:
            total_travel = last_arr - first_dep  # already monotonic after fix

        priority, weight = classify_priority(train_name)
        category = categorize_train(train_name)

        trains.append({
            "train_id": tnum,
            "train_name": train_name,
            "source": source,
            "destination": destination,
            "direction": direction,
            "priority": priority,
            "priority_weight": weight,
            "category": category,
            "total_travel_minutes": total_travel,
            "schedule": schedule,
        })

    print(f"  Valid trains extracted: {len(trains)} (skipped {skipped})")
    return trains


# ─────────────────────────────────────────────────────────────────────────────
# Step 2: Construct Solver Input
# ─────────────────────────────────────────────────────────────────────────────

def build_tracks(stations: dict[str, dict], km_map: dict[str, float]) -> dict:
    """Build topological graph with real coordinates. No DPA."""
    nodes = []
    for code in CORRIDOR_ORDER:
        s = stations[code]
        if code in ("JP", "FL", "AII"):
            stype = "junction"
            platforms = {"JP": 6, "FL": 4, "AII": 5}[code]
        else:
            stype = "station"
            platforms = 2 if not s.get("is_junction") else 3

        nodes.append({
            "id": code,
            "name": s["name"],
            "code": code,
            "km": km_map[code],
            "lat": s["lat"],
            "lng": s["lng"],
            "type": stype,
            "platforms": platforms,
        })

    edges = []
    segments = list(zip(CORRIDOR_ORDER[:-1], CORRIDOR_ORDER[1:]))

    for src, dst in segments:
        distance = round(abs(km_map[dst] - km_map[src]), 2)

        # UP direction (JP → AII)
        edges.append({
            "id": f"UP_{src}_{dst}",
            "source": src, "target": dst,
            "direction": "UP",
            "distance_km": distance,
            "capacity": 1,
            "line_type": "mainline",
            "km_start": km_map[src],
            "km_end": km_map[dst],
        })
        # DN direction (AII → JP)
        edges.append({
            "id": f"DN_{dst}_{src}",
            "source": dst, "target": src,
            "direction": "DN",
            "distance_km": distance,
            "capacity": 1,
            "line_type": "mainline",
            "km_start": km_map[dst],
            "km_end": km_map[src],
        })

    # Phulera (FL) — 4 loop/yard edges for freight holding
    fl_km = km_map["FL"]
    for i in range(1, 5):
        edges.append({
            "id": f"LOOP_FL_{i}",
            "source": "FL", "target": "FL",
            "direction": "LOOP",
            "distance_km": 0.5,
            "capacity": 1,
            "line_type": "loop",
            "km_start": fl_km,
            "km_end": fl_km + 0.5,
        })

    return {"nodes": nodes, "edges": edges}


def build_timetable(trains: list[dict], km_map: dict[str, float]) -> dict:
    """Build timetable with real data, filling in KM values per station."""
    for t in trains:
        for entry in t["schedule"]:
            sid = entry["station_id"]
            if sid in km_map:
                entry["km"] = km_map[sid]

    return {
        "corridor": "JP-AII",
        "date": "2026-09-05",
        "trains": trains,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Step 3: Generate Synthetic Defects (mapped to real KM)
# ─────────────────────────────────────────────────────────────────────────────

def generate_defects(km_map: dict[str, float]) -> dict:
    """Generate 15 maintenance defects mapped to real corridor KM locations."""

    # Get endpoints and midpoints for logic
    jp_km = km_map["JP"]
    job_km = km_map["JOB"]
    fl_km = km_map["FL"]
    ksg_km = km_map["KSG"]
    aii_km = km_map["AII"]

    # Forced overlap zone: between JOB and FL
    overlap_start = job_km + (fl_km - job_km) * 0.3
    overlap_mid = job_km + (fl_km - job_km) * 0.5
    overlap_end = job_km + (fl_km - job_km) * 0.7

    defects = [
        # ── Forced overlap: 3 critical tasks between JOB and FL ───────────
        {
            "defect_id": "DEF-001",
            "department": "TMS",
            "department_full": "Track Management System (Engineering)",
            "description": "Rail fracture on UP line — immediate thermit welding required",
            "km_location": round(overlap_start, 2),
            "section_from": "BOBS", "section_to": "DHND",
            "severity": "critical",
            "duration_minutes": 120,
            "equipment_required": ["Thermit welding kit", "Rail cutting machine"],
            "crew_size": 8,
            "overdue_days": 12,
        },
        {
            "defect_id": "DEF-002",
            "department": "SMMS",
            "department_full": "Signal Maintenance Management System (S&T)",
            "description": "Axle counter failure — track circuit showing false occupancy",
            "km_location": round(overlap_mid, 2),
            "section_from": "DHND", "section_to": "HDA",
            "severity": "critical",
            "duration_minutes": 90,
            "equipment_required": ["Axle counter reset unit", "Signal testing kit"],
            "crew_size": 4,
            "overdue_days": 8,
        },
        {
            "defect_id": "DEF-003",
            "department": "TDMS",
            "department_full": "Traction Distribution Management System (Electrical)",
            "description": "OHE contact wire sagging below minimum height — pantograph snag risk",
            "km_location": round(overlap_end, 2),
            "section_from": "HDA", "section_to": "FL",
            "severity": "critical",
            "duration_minutes": 150,
            "equipment_required": ["OHE tower wagon", "Tension adjusting gear"],
            "crew_size": 6,
            "overdue_days": 15,
        },

        # ── Remaining 12 defects spread across the real corridor ──────────
        {
            "defect_id": "DEF-004",
            "department": "TMS",
            "department_full": "Track Management System (Engineering)",
            "description": "Ballast depression at curve — track geometry out of tolerance",
            "km_location": round(jp_km + (job_km - jp_km) * 0.3, 2),
            "section_from": "DNK", "section_to": "SHNX",
            "severity": "high",
            "duration_minutes": 90,
            "equipment_required": ["Ballast tamping machine"],
            "crew_size": 6,
            "overdue_days": 5,
        },
        {
            "defect_id": "DEF-005",
            "department": "SMMS",
            "department_full": "Signal Maintenance Management System (S&T)",
            "description": "Point machine sluggish — exceeding 6-second throw time",
            "km_location": round(fl_km, 2),
            "section_from": "FL", "section_to": "FL",
            "severity": "high",
            "duration_minutes": 60,
            "equipment_required": ["Point machine testing unit"],
            "crew_size": 3,
            "overdue_days": 3,
        },
        {
            "defect_id": "DEF-006",
            "department": "TDMS",
            "department_full": "Traction Distribution Management System (Electrical)",
            "description": "Section insulator cracked — replacement needed before monsoon",
            "km_location": round(fl_km + (ksg_km - fl_km) * 0.2, 2),
            "section_from": "NRI", "section_to": "SK",
            "severity": "medium",
            "duration_minutes": 120,
            "equipment_required": ["OHE tower wagon", "Section insulator kit"],
            "crew_size": 5,
            "overdue_days": 10,
        },
        {
            "defect_id": "DEF-007",
            "department": "TMS",
            "department_full": "Track Management System (Engineering)",
            "description": "Concrete sleeper cracking — batch replacement needed",
            "km_location": round(fl_km + (ksg_km - fl_km) * 0.6, 2),
            "section_from": "GLTA", "section_to": "TL",
            "severity": "medium",
            "duration_minutes": 180,
            "equipment_required": ["Sleeper laying crane", "Concrete sleepers"],
            "crew_size": 10,
            "overdue_days": 20,
        },
        {
            "defect_id": "DEF-008",
            "department": "SMMS",
            "department_full": "Signal Maintenance Management System (S&T)",
            "description": "LED signal lamp dim on DN home signal",
            "km_location": round(ksg_km + (aii_km - ksg_km) * 0.3, 2),
            "section_from": "GEK", "section_to": "LR",
            "severity": "low",
            "duration_minutes": 30,
            "equipment_required": ["LED lamp replacement kit"],
            "crew_size": 2,
            "overdue_days": 1,
        },
        {
            "defect_id": "DEF-009",
            "department": "TMS",
            "department_full": "Track Management System (Engineering)",
            "description": "Level crossing gate hinge worn — manual operation difficulty",
            "km_location": round(jp_km + (job_km - jp_km) * 0.6, 2),
            "section_from": "SHNX", "section_to": "BOBS",
            "severity": "medium",
            "duration_minutes": 60,
            "equipment_required": ["Welding equipment", "Gate hardware"],
            "crew_size": 4,
            "overdue_days": 7,
        },
        {
            "defect_id": "DEF-010",
            "department": "TDMS",
            "department_full": "Traction Distribution Management System (Electrical)",
            "description": "Return conductor joint resistance high — earth leakage risk",
            "km_location": round(ksg_km + (aii_km - ksg_km) * 0.7, 2),
            "section_from": "LR", "section_to": "MD",
            "severity": "high",
            "duration_minutes": 45,
            "equipment_required": ["Resistance testing meter", "Conductor jointing kit"],
            "crew_size": 3,
            "overdue_days": 4,
        },
        {
            "defect_id": "DEF-011",
            "department": "TMS",
            "department_full": "Track Management System (Engineering)",
            "description": "Bridge expansion joint seized — thermal stress risk",
            "km_location": round(aii_km - 3.0, 2),
            "section_from": "MD", "section_to": "AII",
            "severity": "high",
            "duration_minutes": 90,
            "equipment_required": ["Hydraulic jacks", "Expansion joint kit"],
            "crew_size": 6,
            "overdue_days": 6,
        },
        {
            "defect_id": "DEF-012",
            "department": "SMMS",
            "department_full": "Signal Maintenance Management System (S&T)",
            "description": "Block instrument erratic — token exchange delay",
            "km_location": round(job_km + (fl_km - job_km) * 0.9, 2),
            "section_from": "HDA", "section_to": "FL",
            "severity": "medium",
            "duration_minutes": 75,
            "equipment_required": ["Block instrument testing set"],
            "crew_size": 2,
            "overdue_days": 9,
        },
        {
            "defect_id": "DEF-013",
            "department": "TDMS",
            "department_full": "Traction Distribution Management System (Electrical)",
            "description": "Catenary wire wear exceeding limits near neutral section",
            "km_location": round(fl_km + (ksg_km - fl_km) * 0.8, 2),
            "section_from": "TL", "section_to": "KSG",
            "severity": "medium",
            "duration_minutes": 150,
            "equipment_required": ["OHE tower wagon", "Catenary wire drum"],
            "crew_size": 8,
            "overdue_days": 14,
        },
        {
            "defect_id": "DEF-014",
            "department": "TMS",
            "department_full": "Track Management System (Engineering)",
            "description": "Track alignment deviation at curve entry — speed restriction imposed",
            "km_location": round(jp_km + 2.0, 2),
            "section_from": "JP", "section_to": "KKU",
            "severity": "low",
            "duration_minutes": 120,
            "equipment_required": ["Track geometry trolley", "Alignment jacks"],
            "crew_size": 8,
            "overdue_days": 2,
        },
        {
            "defect_id": "DEF-015",
            "department": "SMMS",
            "department_full": "Signal Maintenance Management System (S&T)",
            "description": "Communication cable damaged — backup BSNL line active",
            "km_location": round(fl_km + (ksg_km - fl_km) * 0.4, 2),
            "section_from": "SK", "section_to": "SALI",
            "severity": "low",
            "duration_minutes": 90,
            "equipment_required": ["Cable jointing kit", "Cable locator"],
            "crew_size": 3,
            "overdue_days": 11,
        },
    ]

    return {"corridor": "JP-AII", "generated_date": "2026-09-05", "defects": defects}


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Step 1: Extract
    stations = extract_stations()
    km_map = compute_km_markers(stations)
    trains = extract_schedules()

    print("\n── Corridor KM Markers (Haversine) ──")
    for code in CORRIDOR_ORDER:
        s = stations[code]
        print(f"  {code:5s} {s['name']:25s} KM {km_map[code]:7.2f}  ({s['lat']:.6f}, {s['lng']:.6f})")

    # Step 2: Build solver input
    tracks = build_tracks(stations, km_map)
    timetable = build_timetable(trains, km_map)

    # Step 3: Generate defects
    defects = generate_defects(km_map)

    # Write output
    for name, data in [
        ("tracks.json", tracks),
        ("coa_timetable.json", timetable),
        ("defects.json", defects),
    ]:
        path = OUTPUT_DIR / name
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Generated data in {OUTPUT_DIR.resolve()}")
    print(f"  tracks.json         — {len(tracks['nodes'])} nodes, {len(tracks['edges'])} edges")
    print(f"  coa_timetable.json  — {len(timetable['trains'])} trains (REAL schedules)")
    print(f"  defects.json        — {len(defects['defects'])} defects (synthetic, real KM)")

    # Validation: print train summary
    print("\n── Train Summary ──")
    for t in timetable["trains"]:
        dep = next((e["departure_time"] for e in t["schedule"] if e["departure_time"]), "??:??")
        arr = next((e["arrival_time"] for e in reversed(t["schedule"]) if e["arrival_time"]), "??:??")
        print(f"  {t['train_id']:8s} {t['train_name'][:42]:42s} [{t['priority']:6s} w={t['priority_weight']:3d}] {t['direction']} {dep}-{arr} ({t['total_travel_minutes']}m)")

    # Validation: check monotonic timeline
    print("\n── Midnight-Crossing Validation ──")
    violations = 0
    for t in timetable["trains"]:
        prev = -1
        for e in t["schedule"]:
            for key in ("arrival_minutes", "departure_minutes"):
                val = e.get(key)
                if val is not None:
                    if val < prev:
                        violations += 1
                        print(f"  ⚠ NON-MONOTONIC: Train {t['train_id']} at {e['station_id']}: {key}={val} < prev={prev}")
                    prev = val
    if violations == 0:
        print("  ✓ All trains have monotonically increasing timelines")
    else:
        print(f"  ⚠ {violations} violations found!")


if __name__ == "__main__":
    main()
