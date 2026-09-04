# Backend PRD — SIH26027 Automatic Block Planning System

**Status:** Draft for team review · **Owner:** [assign] · **Last updated:** Sept 2026

---

## 1. Overview

The backend is the service that turns a list of maintenance requests from three railway departments (Engineering, Signal & Telecom, Traction Distribution) into an actual block-allocation schedule — deciding which requests share a track closure, which get scheduled when, and which don't fit this week and escalate.

This document covers the **full backend** as it should exist for Grand Finale-level polish. It is not what you build for the internal round (see §11 — Phasing). Read this to know what you're building *toward*, not what's due this week.

---

## 2. Goals

- Replace the browser-only heuristic (current prototype) with a real, persistent, provably-reasoned scheduling engine
- Support both "Manual/Decentralized" and "AI-Optimized" modes so the before/after comparison is computed server-side, not hardcoded
- Let requests be submitted, edited, and re-planned without redeploying anything
- Produce a schedule fast enough to demo live (solver response under ~5 seconds for realistic hackathon-scale data)

## 2.1 Non-Goals

- This is **not** a real-time, nationwide, production railway control system. It does not talk to actual TMS/SMMS/TDMS/COA systems, and it does not need to scale beyond a handful of sections and a few hundred requests.
- It does not attempt to guarantee the mathematically perfect schedule for arbitrarily large inputs — it uses a solver with a time budget, exactly as real scheduling software does.

---

## 3. Users & Roles

| Role | What they can do |
|---|---|
| **Department requester** (Engineering / S&T / Traction) | Submit and view their own maintenance requests |
| **Planner / Admin** | View all requests, trigger a schedule run, compare Manual vs Optimized, view history |
| **Viewer** (for demo/judging) | Read-only access to the current schedule and stats |

Auth can be as simple as a role selector for the hackathon — this doesn't need to be hardened security, just enough to show role separation exists.

---

## 4. Architecture

```
React frontend  <-- REST/JSON -->  FastAPI backend  <-->  PostgreSQL
                                          |
                                          v
                                  OR-Tools CP-SAT solver
                                  (runs in-process, invoked
                                   synchronously per schedule request)
```

One backend service. The solver is a library call inside the API process, not a separate microservice — there's no scale requirement here that justifies the extra complexity.

---

## 5. Data Model

```
Department
  id, name, short_code

Section
  id, code, name
  window_start_hour, window_duration_hours   -- normal nightly block window
  mega_day (nullable), mega_duration_hours   -- extended weekly block, if any
  slot_capacity                              -- max concurrent department crews per window

MaintenanceRequest
  id, section_id (FK), department_id (FK)
  task_description
  severity (critical | high | medium | low)
  overdue_days
  duration_hours
  status (pending | scheduled | unscheduled)
  created_at

BlockWindow                                  -- generated per week from Section config
  id, section_id (FK), week_start_date
  day_of_week, start_hour, duration_hours, slot_capacity

ScheduleAssignment
  id, request_id (FK), block_window_id (FK)
  week_start_date, mode (manual | optimized)

ScheduleRun                                  -- one record per solver invocation, for history/audit
  id, week_start_date, mode
  total_hours, total_windows, co_located_windows, unscheduled_count
  objective_value, solve_time_ms, created_at
```

---

## 6. The Scheduling Engine — this is the actual product

### 6.1 What it replaces

The current prototype uses a hand-written greedy heuristic (sort by priority, fill windows first-come). That's fine for a browser demo. It is **not** what should ship for the Grand Finale, for the exact reason this problem statement is worth doing in the first place: a greedy heuristic can't tell you how close it is to the best possible schedule, and it makes ad-hoc tradeoffs no one can defend under questioning.

### 6.2 The real formulation (Google OR-Tools, CP-SAT solver)

**Decision variable:** for every valid (request, window) pair —

> `assign[r, w]` = 1 if request `r` is placed in block window `w`, else 0

A pair is only "valid" (i.e., the variable is created at all) if `w.section_id == r.section_id` and `r.duration_hours <= w.duration_hours`. Excluding invalid pairs up front keeps the model small and fast.

**Constraints:**

1. *Each request scheduled at most once:*
   `sum(assign[r, w] for w in valid_windows(r)) <= 1`
2. *Window capacity:*
   `sum(assign[r, w] for r in valid_requests(w)) <= w.slot_capacity`

**Objective — maximize priority-weighted scheduled work, with a small penalty per window opened:**

```
maximize:
    sum( priority_weight(r) * assign[r, w] for all valid (r, w) )
    - EPSILON * sum( window_used[w] for all w )

where window_used[w] = 1 if any request is assigned to w, else 0
      priority_weight(r) = severity_weight[r.severity] * 100 + r.overdue_days * 2
      EPSILON = a small constant (e.g. 0.1) — just enough to prefer fewer
                windows when priority-value is tied, without ever letting
                window-count outrank actually scheduling a critical defect
```

This single objective encodes both halves of the problem statement at once: schedule the most dangerous/overdue work first, *and* prefer sharing windows across departments — without needing two separate passes or hand-tuned tie-breaking logic.

**Pseudocode sketch (Python / ortools.sat):**

```python
from ortools.sat.python import cp_model

model = cp_model.CpModel()
assign = {}
for r in requests:
    for w in windows_for_section(r.section_id):
        if r.duration_hours <= w.duration_hours:
            assign[r.id, w.id] = model.NewBoolVar(f"a_{r.id}_{w.id}")

for r in requests:
    model.Add(sum(assign[r.id, w.id] for w in valid_windows(r)) <= 1)

for w in all_windows:
    model.Add(sum(assign[r.id, w.id] for r in valid_requests(w)) <= w.slot_capacity)

window_used = {w.id: model.NewBoolVar(f"used_{w.id}") for w in all_windows}
for w in all_windows:
    for r in valid_requests(w):
        model.Add(window_used[w.id] >= assign[r.id, w.id])

model.Maximize(
    sum(priority_weight(r) * assign[r.id, w.id] for (r_id, w_id) in assign for r in [request_by_id(r_id)])
    - EPSILON * sum(window_used.values())
)

solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 5.0
status = solver.Solve(model)
```

**Manual/baseline mode** doesn't need the solver at all — it's the original first-come, one-request-per-window logic, computed directly, precisely because the point of Manual mode is to represent the *absence* of coordination.

### 6.3 Why this matters for the project, not just the code

This is the part of the system an agentic IDE cannot correctly generate without someone on the team understanding constraint programming well enough to specify it — the model above, the choice of objective, and the reasoning behind the epsilon term are the actual intellectual contribution of the project. Guard this section in any presentation: if a judge asks "why this objective function and not a different one," that answer should come from your team, confidently, not from a comment a coding assistant wrote.

---

## 7. API Specification

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/requests` | Submit a new maintenance request |
| `GET` | `/api/requests?section=&department=&status=` | List/filter requests |
| `GET` | `/api/requests/{id}` | Fetch one request |
| `PUT` | `/api/requests/{id}` | Edit a request |
| `DELETE` | `/api/requests/{id}` | Withdraw a request |
| `GET` | `/api/sections` | List sections and their window configuration |
| `POST` | `/api/schedule/run` | Run the solver for a given week + mode; persists a `ScheduleRun` |
| `GET` | `/api/schedule/{week_start_date}?mode=` | Retrieve a previously computed schedule |
| `GET` | `/api/schedule/compare?week_start_date=` | Manual vs Optimized, side by side, with stats |
| `GET` | `/api/stats/summary?week_start_date=` | KPI numbers: total hours, windows, co-located count, unscheduled-critical count |
| `POST` | `/api/mock-data/generate?seed=` | Regenerate a fresh synthetic dataset for demos |
| `POST` | `/api/auth/login` / `GET /api/auth/me` | Minimal role-based auth |

---

## 8. Mock Data Strategy

Since real TMS/SMMS/TDMS/COA data isn't accessible, the mock-data generator is a first-class part of the backend, not a throwaway script:

- Section configs (window timing, capacity) should reflect whatever real IR block-category research the team does (see teammate briefing) — not arbitrary numbers
- Requests should be generated with a realistic severity/overdue-day distribution (most requests routine, a smaller tail of critical/overdue ones), not uniformly random
- The generator should be re-runnable with a seed, so a demo can be reproduced exactly if a judge asks to see it again

---

## 9. Non-Functional Requirements

- Solver must return within ~5 seconds for realistic hackathon-scale inputs (a handful of sections, low hundreds of requests) — comfortably within CP-SAT's capability at this size
- API should be stateless aside from the database, so it can be redeployed without losing in-flight demo state
- No requirement for high availability, horizontal scaling, or handling concurrent nationwide load — explicitly out of scope (see §2.1)

---

## 10. Phasing

| Phase | When | Backend scope |
|---|---|---|
| **Internal hackathon** | ~Sept 6–15 | **None.** Stay with the client-side React prototype. |
| **Grand Finale prep — MVP backend** | Oct 2026 | FastAPI + PostgreSQL + the CP-SAT model above, wired to the existing frontend. Basic auth. |
| **Grand Finale — polish** | Nov–Dec 2026 | Deployed (not local), schedule history/audit trail, richer mock-data generator, role-based views per department |

---

## 11. Success Metrics

- Optimized-mode schedule strictly dominates the Manual baseline on the same input: fewer or equal windows, fewer or equal total hours, zero critical items unscheduled unless genuinely infeasible
- Solver returns a provable objective value (or a proven optimality gap if time-limited) — not just "a schedule," but a schedule with a defensible quality claim
- A judge can ask "why did request X get this slot and not that one" and the team can answer from the constraint model, not guess

---

## 12. Open Questions / Risks

- **Real IR block-category rules** — still pending team research; the section config schema above is ready to accept real values once found, but is currently placeholder-realistic, not verified
- **Window-capacity assumption (3 concurrent crews)** — invented for the demo; needs a real-world sanity check if possible
- **Objective epsilon weighting** — needs tuning once real request-volume assumptions are in; too high and it under-schedules critical work to save a window, too low and co-location stops mattering
