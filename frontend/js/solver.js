/* ═══════════════════════════════════════════════
   SIH26027 — Client-Side Scheduling Engine
   Manual (naive) + Optimized (priority bin-packing)
   Approximates what OR-Tools CP-SAT will do on the backend.
   ═══════════════════════════════════════════════ */

import { priorityWeight, generateId } from './utils.js';
import * as api from './mockApi.js';

/**
 * Run the scheduler for a given week.
 * @param {string} weekStartDate — ISO date string (Monday)
 * @param {'manual'|'optimized'} mode
 * @returns {Promise<{run: Object, assignments: Object[]}>}
 */
export async function runSchedule(weekStartDate, mode) {
  const requests = (await api.getRequests()).filter(r => r.status !== 'scheduled' || true);
  // For demo: schedule ALL pending requests; already-scheduled ones are included for completeness
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const windows = api.generateBlockWindows(weekStartDate);
  const sections = await api.getSections();

  const startTime = performance.now();
  let assignments;

  if (mode === 'manual') {
    assignments = solveManual(pendingRequests, windows);
  } else {
    assignments = solveOptimized(pendingRequests, windows);
  }

  const solveTime = Math.round(performance.now() - startTime);

  // Tag assignments with metadata
  assignments = assignments.map(a => ({
    ...a,
    week_start_date: weekStartDate,
    mode,
  }));

  // Compute stats
  const usedWindowIds = new Set(assignments.map(a => a.block_window_id));
  const windowRequestCounts = {};
  for (const a of assignments) {
    windowRequestCounts[a.block_window_id] = (windowRequestCounts[a.block_window_id] || 0) + 1;
  }
  const coLocated = Object.values(windowRequestCounts).filter(c => c > 1).length;

  const totalHours = assignments.reduce((sum, a) => {
    const req = pendingRequests.find(r => r.id === a.request_id);
    return sum + (req ? req.duration_hours : 0);
  }, 0);

  const scheduledIds = new Set(assignments.map(a => a.request_id));
  const unscheduledCount = pendingRequests.filter(r => !scheduledIds.has(r.id)).length;

  // Update request statuses
  for (const req of pendingRequests) {
    if (scheduledIds.has(req.id)) {
      await api.updateRequest(req.id, { status: 'scheduled' });
    } else {
      await api.updateRequest(req.id, { status: 'unscheduled' });
    }
  }

  // Compute objective value (matching PRD formula)
  const EPSILON = 0.1;
  const objectiveValue = assignments.reduce((sum, a) => {
    const req = pendingRequests.find(r => r.id === a.request_id);
    return sum + (req ? priorityWeight(req) : 0);
  }, 0) - EPSILON * usedWindowIds.size;

  const run = {
    id:                generateId(),
    week_start_date:   weekStartDate,
    mode,
    total_hours:       Math.round(totalHours * 10) / 10,
    total_windows:     usedWindowIds.size,
    co_located_windows: coLocated,
    unscheduled_count: unscheduledCount,
    objective_value:   Math.round(objectiveValue * 10) / 10,
    solve_time_ms:     solveTime,
    created_at:        new Date().toISOString(),
  };

  // Persist
  await api.saveScheduleRun(run);
  await api.saveAssignments(weekStartDate, mode, assignments);

  return { run, assignments };
}

/**
 * MANUAL mode: naive first-come-first-served.
 * Each request gets its own window — no co-location, no priority awareness.
 * Represents "absence of coordination" per PRD §6.3.
 */
function solveManual(requests, windows) {
  const assignments = [];
  // Track remaining capacity per window
  const capacity = {};
  for (const w of windows) {
    capacity[w.id] = 1; // Manual mode: only 1 request per window (no coordination)
  }

  for (const req of requests) {
    // Find first matching window with capacity
    const validWindow = windows.find(w =>
      w.section_id === req.section_id &&
      req.duration_hours <= w.duration_hours &&
      capacity[w.id] > 0
    );
    if (validWindow) {
      assignments.push({
        id:               generateId(),
        request_id:       req.id,
        block_window_id:  validWindow.id,
      });
      capacity[validWindow.id]--;
    }
  }

  return assignments;
}

/**
 * OPTIMIZED mode: priority-weighted greedy bin-packing.
 * Sort by priority weight (descending), pack into fewest windows, use full slot_capacity.
 * Not as good as CP-SAT, but a meaningful improvement over Manual for demo purposes.
 */
function solveOptimized(requests, windows) {
  const assignments = [];

  // Sort requests by priority weight (highest first — critical/overdue items get scheduled first)
  const sorted = [...requests].sort((a, b) => priorityWeight(b) - priorityWeight(a));

  // Track remaining capacity per window
  const capacity = {};
  for (const w of windows) {
    capacity[w.id] = w.slot_capacity;
  }

  // Track which windows are "opened" (have at least one assignment) — prefer filling these first
  const openWindows = new Set();

  for (const req of sorted) {
    // Valid windows for this request
    const validWindows = windows.filter(w =>
      w.section_id === req.section_id &&
      req.duration_hours <= w.duration_hours &&
      capacity[w.id] > 0
    );

    if (validWindows.length === 0) continue;

    // Prefer: already-open window with capacity (co-location) > mega block > nightly
    // This implements the "prefer fewer windows" part of the PRD objective
    let bestWindow = null;

    // First try: an already-open window (maximizes co-location)
    bestWindow = validWindows.find(w => openWindows.has(w.id));

    // Second try: any valid window (prefer higher capacity first to leave options open)
    if (!bestWindow) {
      bestWindow = validWindows.sort((a, b) => b.duration_hours - a.duration_hours)[0];
    }

    if (bestWindow) {
      assignments.push({
        id:               generateId(),
        request_id:       req.id,
        block_window_id:  bestWindow.id,
      });
      capacity[bestWindow.id]--;
      openWindows.add(bestWindow.id);
    }
  }

  return assignments;
}

/**
 * Reset all request statuses to pending (for re-running the scheduler).
 */
export async function resetSchedule(weekStartDate) {
  const requests = await api.getRequests();
  for (const req of requests) {
    if (req.status !== 'pending') {
      await api.updateRequest(req.id, { status: 'pending' });
    }
  }
}
