#!/usr/bin/env python3
"""
SIH26027 — Synthetic Data Generator
Generates mathematically sound JSON datasets for the Jaipur (JP) to Ajmer (AII)
corridor of the North Western Railway (135 km).

Outputs:
  data/tracks.json         — Topological graph (nodes + edges)
  data/coa_timetable.json  — Daily schedule for 20 trains
  data/defects.json        — 15 maintenance defects (3 forced overlap at JOB–FL)
"""

import json
import random
from pathlib import Path

SEED = 26027
random.seed(SEED)

OUTPUT_DIR = Path(__file__).parent / "data"

# ── KM markers (approximate real NWR values) ─────────────────────────────────
# JP=200, JOB=237, FL=258, KSG=305, AII=335  → total ~135 km
# Forced-overlap defects sit at KM 240–245 (between JOB and FL).

STATION_ORDER = ["JP", "JOB", "FL", "KSG", "AII"]


# ─────────────────────────────────────────────────────────────────────────────
# Phase 1-A: Topological Graph
# ─────────────────────────────────────────────────────────────────────────────

def generate_tracks() -> dict:
    """Generate the topological graph for the JP → AII corridor."""

    nodes = [
        {
            "id": "JP", "name": "Jaipur", "code": "JP",
            "km": 200.0, "lat": 26.9196, "lng": 75.7878,
            "type": "junction", "platforms": 6,
        },
        {
            "id": "JOB", "name": "Asalpur Jobner", "code": "JOB",
            "km": 237.0, "lat": 26.8183, "lng": 75.3900,
            "type": "station", "platforms": 2,
        },
        {
            "id": "FL", "name": "Phulera Junction", "code": "FL",
            "km": 258.0, "lat": 26.8729, "lng": 75.2413,
            "type": "junction", "platforms": 4,
        },
        {
            "id": "KSG", "name": "Kishangarh", "code": "KSG",
            "km": 305.0, "lat": 26.5837, "lng": 74.8530,
            "type": "station", "platforms": 3,
        },
        {
            "id": "AII", "name": "Ajmer", "code": "AII",
            "km": 335.0, "lat": 26.4521, "lng": 74.6399,
            "type": "junction", "platforms": 5,
        },
    ]

    edges = []
    segments = [("JP", "JOB"), ("JOB", "FL"), ("FL", "KSG"), ("KSG", "AII")]

    for src, dst in segments:
        src_node = next(n for n in nodes if n["id"] == src)
        dst_node = next(n for n in nodes if n["id"] == dst)
        distance = abs(dst_node["km"] - src_node["km"])

        # UP direction (JP → AII)
        edges.append({
            "id": f"UP_{src}_{dst}",
            "source": src, "target": dst,
            "direction": "UP",
            "distance_km": distance,
            "capacity": 1,
            "line_type": "mainline",
            "km_start": src_node["km"],
            "km_end": dst_node["km"],
        })
        # DN direction (AII → JP)
        edges.append({
            "id": f"DN_{dst}_{src}",
            "source": dst, "target": src,
            "direction": "DN",
            "distance_km": distance,
            "capacity": 1,
            "line_type": "mainline",
            "km_start": dst_node["km"],
            "km_end": src_node["km"],
        })

    # Phulera (FL) — 4 loop/yard edges for freight holding
    for i in range(1, 5):
        edges.append({
            "id": f"LOOP_FL_{i}",
            "source": "FL", "target": "FL",
            "direction": "LOOP",
            "distance_km": 0.5,
            "capacity": 1,
            "line_type": "loop",
            "km_start": 258.0,
            "km_end": 258.5,
        })

    return {"nodes": nodes, "edges": edges}


# ─────────────────────────────────────────────────────────────────────────────
# Phase 1-B: Timetable
# ─────────────────────────────────────────────────────────────────────────────

def _min_to_hhmm(minutes: int) -> str:
    """Convert integer minutes-from-midnight to HH:MM string."""
    return f"{(minutes // 60) % 24:02d}:{minutes % 60:02d}"


def _make_train(
    nodes: list[dict],
    train_id: str,
    name: str,
    source_idx: int,
    dest_idx: int,
    dep_minutes: int,
    priority: str,
    weight: int,
    category: str,
    avg_speed_kmph: float,
    dwell_minutes: int = 2,
) -> dict:
    """Build a single train record with per-station arrival/departure times."""

    km_map = {n["id"]: n["km"] for n in nodes}
    name_map = {n["id"]: n["name"] for n in nodes}

    direction = "UP" if dest_idx > source_idx else "DN"
    step = 1 if direction == "UP" else -1
    indices = list(range(source_idx, dest_idx + step, step))

    schedule = []
    current = dep_minutes

    for j, idx in enumerate(indices):
        sid = STATION_ORDER[idx]
        if j == 0:
            # Origin — departure only
            schedule.append({
                "station_id": sid,
                "station_name": name_map[sid],
                "km": km_map[sid],
                "arrival_time": None,
                "departure_time": _min_to_hhmm(current),
                "arrival_minutes": None,
                "departure_minutes": current,
            })
        else:
            prev_sid = STATION_ORDER[indices[j - 1]]
            dist = abs(km_map[sid] - km_map[prev_sid])
            travel = int((dist / avg_speed_kmph) * 60)
            arr = current + travel

            if j == len(indices) - 1:
                # Destination — arrival only
                schedule.append({
                    "station_id": sid,
                    "station_name": name_map[sid],
                    "km": km_map[sid],
                    "arrival_time": _min_to_hhmm(arr),
                    "departure_time": None,
                    "arrival_minutes": arr,
                    "departure_minutes": None,
                })
            else:
                dep = arr + dwell_minutes
                schedule.append({
                    "station_id": sid,
                    "station_name": name_map[sid],
                    "km": km_map[sid],
                    "arrival_time": _min_to_hhmm(arr),
                    "departure_time": _min_to_hhmm(dep),
                    "arrival_minutes": arr,
                    "departure_minutes": dep,
                })
                current = dep

    total_travel = schedule[-1]["arrival_minutes"] - schedule[0]["departure_minutes"]

    return {
        "train_id": train_id,
        "train_name": name,
        "source": STATION_ORDER[source_idx],
        "destination": STATION_ORDER[dest_idx],
        "direction": direction,
        "priority": priority,
        "priority_weight": weight,
        "category": category,
        "total_travel_minutes": total_travel,
        "schedule": schedule,
    }


def generate_timetable(tracks: dict) -> dict:
    """Generate a daily schedule for 20 trains on the JP–AII corridor."""

    nodes = tracks["nodes"]
    mt = lambda *a, **kw: _make_train(nodes, *a, **kw)

    trains = [
        # ── High Priority (weight 100) — ~110 min @ ~75 km/h ─────────────
        mt("20977", "JP–AII Vande Bharat",  0, 4,  360, "high", 100, "Vande Bharat", 75, 2),  # 06:00
        mt("12015", "Ajmer Shatabdi",       0, 4,  420, "high", 100, "Shatabdi",     75, 2),  # 07:00
        mt("12195", "Ajmer Duronto",        0, 4, 1050, "high", 100, "Duronto",      75, 2),  # 17:30
        mt("12196", "JP Duronto",           4, 0, 1110, "high", 100, "Duronto",      75, 2),  # 18:30 DN

        # ── Medium Priority (weight 50) — ~140 min @ ~58–65 km/h ─────────
        mt("12991", "Marudhar Express",     0, 4,  480, "medium", 50, "Superfast", 60, 3),  # 08:00
        mt("12992", "Marudhar Express",     4, 0,  510, "medium", 50, "Superfast", 60, 3),  # 08:30 DN
        mt("19707", "AII Intercity",        0, 4,  570, "medium", 50, "Intercity", 58, 3),  # 09:30
        mt("19708", "JP Intercity",         4, 0,  600, "medium", 50, "Intercity", 58, 3),  # 10:00 DN
        mt("12989", "AII Superfast",        0, 4,  690, "medium", 50, "Superfast", 60, 3),  # 11:30
        mt("12990", "JP Superfast",         4, 0,  720, "medium", 50, "Superfast", 60, 3),  # 12:00 DN
        mt("19601", "Udaipur Mail",         0, 4,  780, "medium", 50, "Mail",      55, 3),  # 13:00
        mt("19602", "Udaipur Mail",         4, 0,  840, "medium", 50, "Mail",      55, 3),  # 14:00 DN
        mt("22981", "Kota Jan Shatabdi",    0, 4,  900, "medium", 50, "Jan Shatabdi", 65, 2),  # 15:00
        mt("22982", "Kota Jan Shatabdi",    4, 0,  960, "medium", 50, "Jan Shatabdi", 65, 2),  # 16:00 DN

        # ── Low Priority (weight 10) — ~200 min @ ~42 km/h ───────────────
        mt("FGDS01", "CONCOR Container 1",  0, 4,   60, "low", 10, "Freight", 42, 5),  # 01:00
        mt("FGDS02", "Goods Rake 2",        4, 0,   90, "low", 10, "Freight", 42, 5),  # 01:30 DN
        mt("FGDS03", "CONCOR Container 3",  0, 4,  150, "low", 10, "Freight", 42, 5),  # 02:30
        mt("FGDS04", "Goods Rake 4",        0, 4, 1320, "low", 10, "Freight", 42, 5),  # 22:00
        mt("FGDS05", "CONCOR Container 5",  4, 0, 1350, "low", 10, "Freight", 42, 5),  # 22:30 DN
        mt("FGDS06", "Goods Rake 6",        4, 0, 1380, "low", 10, "Freight", 42, 5),  # 23:00 DN
    ]

    return {"corridor": "JP-AII", "date": "2026-09-05", "trains": trains}


# ─────────────────────────────────────────────────────────────────────────────
# Phase 1-C: Defects
# ─────────────────────────────────────────────────────────────────────────────

def generate_defects() -> dict:
    """Generate 15 maintenance defects with a forced critical overlap at JOB–FL."""

    defects = [
        # ── Forced overlap: 3 critical tasks at KM 240–245 (JOB–FL) ──────
        {
            "defect_id": "DEF-001",
            "department": "TMS",
            "department_full": "Track Management System (Engineering)",
            "description": "Rail fracture on UP line — immediate thermit welding required",
            "km_location": 241.5,
            "section_from": "JOB", "section_to": "FL",
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
            "km_location": 243.0,
            "section_from": "JOB", "section_to": "FL",
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
            "km_location": 244.2,
            "section_from": "JOB", "section_to": "FL",
            "severity": "critical",
            "duration_minutes": 150,
            "equipment_required": ["OHE tower wagon", "Tension adjusting gear"],
            "crew_size": 6,
            "overdue_days": 15,
        },

        # ── Remaining 12 defects spread across the corridor ──────────────
        {
            "defect_id": "DEF-004",
            "department": "TMS",
            "department_full": "Track Management System (Engineering)",
            "description": "Ballast depression at curve — track geometry out of tolerance",
            "km_location": 210.0,
            "section_from": "JP", "section_to": "JOB",
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
            "km_location": 258.0,
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
            "km_location": 270.0,
            "section_from": "FL", "section_to": "KSG",
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
            "km_location": 290.0,
            "section_from": "FL", "section_to": "KSG",
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
            "km_location": 315.0,
            "section_from": "KSG", "section_to": "AII",
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
            "km_location": 225.0,
            "section_from": "JP", "section_to": "JOB",
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
            "km_location": 320.0,
            "section_from": "KSG", "section_to": "AII",
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
            "km_location": 330.0,
            "section_from": "KSG", "section_to": "AII",
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
            "km_location": 250.0,
            "section_from": "JOB", "section_to": "FL",
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
            "km_location": 295.0,
            "section_from": "FL", "section_to": "KSG",
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
            "km_location": 205.0,
            "section_from": "JP", "section_to": "JOB",
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
            "km_location": 265.0,
            "section_from": "FL", "section_to": "KSG",
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

    tracks = generate_tracks()
    timetable = generate_timetable(tracks)
    defects = generate_defects()

    for name, data in [
        ("tracks.json", tracks),
        ("coa_timetable.json", timetable),
        ("defects.json", defects),
    ]:
        path = OUTPUT_DIR / name
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"✓ Generated data in {OUTPUT_DIR.resolve()}")
    print(f"  tracks.json         — {len(tracks['nodes'])} nodes, {len(tracks['edges'])} edges")
    print(f"  coa_timetable.json  — {len(timetable['trains'])} trains")
    print(f"  defects.json        — {len(defects['defects'])} defects")

    # Quick validation
    for t in timetable["trains"]:
        assert len(t["schedule"]) >= 2, f"Train {t['train_id']} has < 2 schedule entries"
        assert t["schedule"][0]["departure_minutes"] is not None
        assert t["schedule"][-1]["arrival_minutes"] is not None
    print("  ✓ All trains validated")


if __name__ == "__main__":
    main()
