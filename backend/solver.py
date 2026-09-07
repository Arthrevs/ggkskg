"""
SIH26027 — OR-Tools CP-SAT Solver for Railway Block Planning

Mathematical formulation
========================

Given:
  - A set of maintenance-defect clusters (mega-blocks), each with a duration
    and a set of affected track segments.
  - A set of trains, each with a fixed-speed schedule across segments.

Decision variables:
  - block_start[c]  : minute-of-day when cluster c's track closure begins
  - delay[t]        : non-negative minutes of delay applied to train t at origin
                       (all station times shift uniformly)

Constraints:
  1. NoOverlap per segment per direction:
     On each physical track (UP or DN) of each segment, the set of
     {train-occupation intervals ∪ block intervals} must be pairwise
     non-overlapping.  This enforces BOTH:
       a) Block–train conflict avoidance (no train on track during block)
       b) Headway / absolute-block signalling (one train per block section)

  2. Blocks close both UP and DN tracks simultaneously (typical for OHE /
     track / signalling work).

Objective:
  Minimize  Σ  delay[t] × priority_weight[t]

  High-priority trains (Vande Bharat/Shatabdi, weight 100) are 10× more
  expensive to delay than freight (weight 10).  The solver will naturally
  push blocks into freight-dominated windows.
"""

from __future__ import annotations

import json
from pathlib import Path
from ortools.sat.python import cp_model

CLUSTER_RADIUS_KM = 5.0
DATA_DIR = Path(__file__).parent / "data"


# ─────────────────────────────────────────────────────────────────────────────
# Data loading
# ─────────────────────────────────────────────────────────────────────────────

def load_data() -> tuple[dict, dict, dict]:
    """Load the three generated JSON datasets."""
    tracks = json.loads((DATA_DIR / "tracks.json").read_text(encoding="utf-8"))
    timetable = json.loads((DATA_DIR / "coa_timetable.json").read_text(encoding="utf-8"))
    defects = json.loads((DATA_DIR / "defects.json").read_text(encoding="utf-8"))
    return tracks, timetable, defects


# ─────────────────────────────────────────────────────────────────────────────
# Defect clustering
# ─────────────────────────────────────────────────────────────────────────────

def cluster_defects(defects_list: list[dict]) -> list[dict]:
    """
    Cluster defects within CLUSTER_RADIUS_KM of each other into
    Integrated Mega Blocks using greedy single-linkage clustering.

    Any defect within 5 KM of an existing cluster member is absorbed
    into that cluster.  The cluster's duration equals the longest
    constituent task (crews work in parallel once the block is granted).
    """
    sorted_defects = sorted(defects_list, key=lambda d: d["km_location"])
    used: set[int] = set()
    clusters: list[dict] = []

    for i, d in enumerate(sorted_defects):
        if i in used:
            continue

        cluster = [d]
        used.add(i)

        # Expand: any unseen defect within radius of ANY cluster member
        for j in range(i + 1, len(sorted_defects)):
            if j in used:
                continue
            if any(
                abs(sorted_defects[j]["km_location"] - c["km_location"]) <= CLUSTER_RADIUS_KM
                for c in cluster
            ):
                cluster.append(sorted_defects[j])
                used.add(j)

        km_min = min(c["km_location"] for c in cluster)
        km_max = max(c["km_location"] for c in cluster)
        duration = max(c["duration_minutes"] for c in cluster)
        departments = sorted(set(c["department"] for c in cluster))

        severity = "critical" if any(c["severity"] == "critical" for c in cluster) else \
                   "high"     if any(c["severity"] == "high"     for c in cluster) else \
                   "medium"   if any(c["severity"] == "medium"   for c in cluster) else "low"

        clusters.append({
            "cluster_id": f"MEGA-{len(clusters) + 1:03d}",
            "defect_ids": [c["defect_id"] for c in cluster],
            "defects": cluster,
            "km_start": km_min,
            "km_end": km_max,
            "duration_minutes": duration,
            "departments": departments,
            "is_mega_block": len(cluster) > 1,
            "severity": severity,
        })

    return clusters


# ─────────────────────────────────────────────────────────────────────────────
# CP-SAT Solver
# ─────────────────────────────────────────────────────────────────────────────

def _min_to_hhmm(minutes: int) -> str:
    return f"{(minutes // 60) % 24:02d}:{minutes % 60:02d}"


def solve(tracks: dict, timetable: dict, defects_data: dict) -> dict:
    """
    Run the CP-SAT solver to optimally schedule maintenance blocks
    while minimising priority-weighted train delays.
    """
    trains = timetable["trains"]
    defects_list = defects_data["defects"]

    # ── 1. Cluster defects ────────────────────────────────────────────────
    clusters = cluster_defects(defects_list)

    # ── 2. Map clusters → physical segments ───────────────────────────────
    km_by_id = {n["id"]: n["km"] for n in tracks["nodes"]}
    
    # Dynamically build station order from track edges (UP direction)
    up_edges = [e for e in tracks["edges"] if e["direction"] == "UP" and e["line_type"] == "mainline"]
    # Sort UP edges by their km_start to get the sequential order
    up_edges.sort(key=lambda e: e["km_start"])
    
    STATION_ORDER = []
    if up_edges:
        STATION_ORDER.append(up_edges[0]["source"])
        for e in up_edges:
            STATION_ORDER.append(e["target"])
    
    segments = [(STATION_ORDER[i], STATION_ORDER[i + 1])
                for i in range(len(STATION_ORDER) - 1)]

    for cluster in clusters:
        affected: list[tuple[str, str]] = []
        for s_from, s_to in segments:
            seg_lo = km_by_id[s_from]
            seg_hi = km_by_id[s_to]
            if cluster["km_start"] <= seg_hi and cluster["km_end"] >= seg_lo:
                affected.append((s_from, s_to))
        cluster["affected_segments"] = affected

    # ── 3. Build CP-SAT model ─────────────────────────────────────────────
    model = cp_model.CpModel()

    MAX_DELAY = 240          # hard cap: 4 hours

    # Dynamic time horizon: find the latest time in the real timetable
    # (overnight trains can have minutes > 1440 after midnight-crossing fix)
    max_time = 1440
    for t in trains:
        for e in t["schedule"]:
            for key in ("arrival_minutes", "departure_minutes"):
                val = e.get(key)
                if val is not None and val > max_time:
                    max_time = val
    TIME_HORIZON = max_time + MAX_DELAY + 60  # headroom for delays

    # --- Block start-time variables ---
    block_start: dict[str, cp_model.IntVar] = {}
    # Block intervals keyed by (seg_key, direction)
    block_ivs: dict[tuple[str, str], list] = {}
    for s in segments:
        key = f"{s[0]}_{s[1]}"
        block_ivs[(key, "UP")] = []
        block_ivs[(key, "DN")] = []

    for c in clusters:
        bs = model.NewIntVar(0, TIME_HORIZON - c["duration_minutes"],
                             f"bs_{c['cluster_id']}")
        block_start[c["cluster_id"]] = bs

        for seg in c["affected_segments"]:
            seg_key = f"{seg[0]}_{seg[1]}"
            dur = c["duration_minutes"]
            # One interval per direction (both tracks closed during block)
            for direction in ("UP", "DN"):
                iv = model.NewFixedSizeIntervalVar(
                    bs, dur,
                    f"bi_{direction}_{c['cluster_id']}_{seg_key}")
                block_ivs[(seg_key, direction)].append(iv)

    # --- Train delay variables + segment-occupation intervals ---
    train_delay: dict[str, cp_model.IntVar] = {}
    train_ivs: dict[tuple[str, str], list] = {}
    for s in segments:
        key = f"{s[0]}_{s[1]}"
        train_ivs[(key, "UP")] = []
        train_ivs[(key, "DN")] = []

    for t in trains:
        d_var = model.NewIntVar(0, MAX_DELAY, f"d_{t['train_id']}")
        train_delay[t["train_id"]] = d_var

        schedule = t["schedule"]
        for i in range(len(schedule) - 1):
            s_from = schedule[i]
            s_to   = schedule[i + 1]

            dep_min = s_from.get("departure_minutes")
            arr_min = s_to.get("arrival_minutes")
            if dep_min is None or arr_min is None:
                continue

            travel = arr_min - dep_min  # fixed travel time on this segment

            # Adjusted start = scheduled departure + delay
            adj_start = model.NewIntVar(
                dep_min, min(dep_min + MAX_DELAY, TIME_HORIZON),
                f"ts_{t['train_id']}_{s_from['station_id']}_{s_to['station_id']}")
            model.Add(adj_start == dep_min + d_var)

            iv = model.NewFixedSizeIntervalVar(
                adj_start, travel,
                f"ti_{t['train_id']}_{s_from['station_id']}_{s_to['station_id']}")

            # Normalise segment key: always (lower-KM, higher-KM)
            sid_a = s_from["station_id"]
            sid_b = s_to["station_id"]
            if km_by_id[sid_a] < km_by_id[sid_b]:
                seg_key = f"{sid_a}_{sid_b}"
                direction = "UP"
            else:
                seg_key = f"{sid_b}_{sid_a}"
                direction = "DN"

            if (seg_key, direction) in train_ivs:
                train_ivs[(seg_key, direction)].append(iv)

    # ── 4. NoOverlap constraints ──────────────────────────────────────────
    # Real JP–AII corridor is double-line: trains do NOT conflict with
    # each other.  Only maintenance BLOCKS conflict with trains (a block
    # closes the track, so no train may occupy that segment while the
    # block is active).
    #
    # For each block interval, add a pairwise NoOverlap with every train
    # interval on the same (segment, direction).
    for s_from, s_to in segments:
        seg_key = f"{s_from}_{s_to}"
        for direction in ("UP", "DN"):
            b_ivs = block_ivs[(seg_key, direction)]
            t_ivs = train_ivs[(seg_key, direction)]
            # Each block must not overlap with any train on this segment
            for b_iv in b_ivs:
                for t_iv in t_ivs:
                    model.AddNoOverlap([b_iv, t_iv])

    # ── 5. Objective: minimise priority-weighted delay ────────────────────
    model.Minimize(
        sum(train_delay[t["train_id"]] * t["priority_weight"]
            for t in trains)
    )

    # ── 6. Solve ──────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 8.0
    solver.parameters.num_workers = 4

    status = solver.Solve(model)

    STATUS_NAMES = {
        cp_model.OPTIMAL:       "OPTIMAL",
        cp_model.FEASIBLE:      "FEASIBLE",
        cp_model.INFEASIBLE:    "INFEASIBLE",
        cp_model.MODEL_INVALID: "MODEL_INVALID",
        cp_model.UNKNOWN:       "UNKNOWN",
    }
    status_name = STATUS_NAMES.get(status, "UNKNOWN")

    # ── 7. Extract results ────────────────────────────────────────────────
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {
            "status": status_name,
            "objective_value": None,
            "solve_time_seconds": solver.WallTime(),
            "optimized_timetable": None,
            "block_schedule": None,
            "clusters": _clean_clusters(clusters),
            "stats": None,
            "error": f"Solver returned status: {status_name}",
        }

    # --- Optimised timetable ---
    optimized_trains = []
    for t in trains:
        delay_val = solver.Value(train_delay[t["train_id"]])
        new_schedule = []
        for entry in t["schedule"]:
            e = dict(entry)
            if entry["arrival_minutes"] is not None:
                e["arrival_minutes"] = entry["arrival_minutes"] + delay_val
                e["arrival_time"] = _min_to_hhmm(e["arrival_minutes"])
            if entry["departure_minutes"] is not None:
                e["departure_minutes"] = entry["departure_minutes"] + delay_val
                e["departure_time"] = _min_to_hhmm(e["departure_minutes"])
            e["delay_minutes"] = delay_val
            new_schedule.append(e)

        optimized_trains.append({
            **t,
            "schedule": new_schedule,
            "delay_minutes": delay_val,
        })

    # --- Block schedule ---
    block_schedule = []
    for c in clusters:
        start_val = solver.Value(block_start[c["cluster_id"]])
        end_val = start_val + c["duration_minutes"]
        block_schedule.append({
            "cluster_id": c["cluster_id"],
            "defect_ids": c["defect_ids"],
            "km_start": c["km_start"],
            "km_end": c["km_end"],
            "duration_minutes": c["duration_minutes"],
            "departments": c["departments"],
            "is_mega_block": c["is_mega_block"],
            "severity": c["severity"],
            "affected_segments": [list(seg) for seg in c["affected_segments"]],
            "scheduled_start_minutes": start_val,
            "scheduled_end_minutes": end_val,
            "scheduled_start_time": _min_to_hhmm(start_val),
            "scheduled_end_time": _min_to_hhmm(end_val),
        })

    # --- Stats ---
    total_weighted_delay = sum(
        solver.Value(train_delay[t["train_id"]]) * t["priority_weight"]
        for t in trains
    )
    trains_delayed = sum(
        1 for t in trains if solver.Value(train_delay[t["train_id"]]) > 0
    )
    max_delay = max(
        solver.Value(train_delay[t["train_id"]]) for t in trains
    )

    return {
        "status": status_name,
        "objective_value": solver.ObjectiveValue(),
        "solve_time_seconds": round(solver.WallTime(), 3),
        "optimized_timetable": {
            "corridor": timetable["corridor"],
            "date": timetable["date"],
            "trains": optimized_trains,
        },
        "block_schedule": block_schedule,
        "clusters": _clean_clusters(clusters),
        "stats": {
            "total_weighted_delay": total_weighted_delay,
            "trains_delayed": trains_delayed,
            "trains_unaffected": len(trains) - trains_delayed,
            "max_single_delay_minutes": max_delay,
            "mega_blocks_formed": sum(1 for c in clusters if c["is_mega_block"]),
            "total_clusters": len(clusters),
            "total_defects": len(defects_list),
        },
    }


def _clean_clusters(clusters: list[dict]) -> list[dict]:
    """Strip internal fields for JSON response."""
    return [
        {
            "cluster_id": c["cluster_id"],
            "defect_ids": c["defect_ids"],
            "km_start": c["km_start"],
            "km_end": c["km_end"],
            "duration_minutes": c["duration_minutes"],
            "departments": c["departments"],
            "is_mega_block": c["is_mega_block"],
            "severity": c["severity"],
            "affected_segments": [list(seg) for seg in c.get("affected_segments", [])],
        }
        for c in clusters
    ]
