/* ═══════════════════════════════════════════════
   SIH26027 — In-Memory API Simulation
   Mirrors PRD §7 endpoints as async functions.
   Swap to fetch() calls when the real backend is ready.
   ═══════════════════════════════════════════════ */

import { generateFullDataset, DEPARTMENTS, SECTIONS } from './mockData.js';
import { generateId } from './utils.js';

const STORAGE_KEY = 'sih26027_store';

// ── Internal Store ──
let store = loadStore();

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore corrupt data */ }
  return null;
}

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function initStore(forceSeed) {
  if (!store || forceSeed !== undefined) {
    const data = generateFullDataset(forceSeed ?? 26027);
    store = {
      departments:   data.departments,
      sections:      data.sections,
      requests:      data.requests,
      scheduleRuns:  [],
      assignments:   [],
    };
    saveStore();
  }
  return store;
}

// ── Helpers ──
function delay(ms = 80) {
  return new Promise(r => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════
//  API methods (all async, returns cloned data)
// ═══════════════════════════════════════════════

// ── Departments ──
export async function getDepartments() {
  await delay();
  return [...store.departments];
}

// ── Sections ──
export async function getSections() {
  await delay();
  return store.sections.map(s => ({ ...s }));
}

// ── Requests (CRUD) ──
export async function getRequests(filters = {}) {
  await delay();
  let result = [...store.requests];

  if (filters.section)    result = result.filter(r => r.section_id === filters.section);
  if (filters.department) result = result.filter(r => r.department_id === filters.department);
  if (filters.status)     result = result.filter(r => r.status === filters.status);
  if (filters.severity)   result = result.filter(r => r.severity === filters.severity);

  return result.map(r => ({ ...r }));
}

export async function getRequest(id) {
  await delay();
  const r = store.requests.find(r => r.id === id);
  return r ? { ...r } : null;
}

export async function createRequest(data) {
  await delay();
  const request = {
    id:               generateId(),
    section_id:       data.section_id,
    department_id:    data.department_id,
    task_description: data.task_description,
    severity:         data.severity,
    overdue_days:     Number(data.overdue_days) || 0,
    duration_hours:   Number(data.duration_hours) || 1,
    status:           'pending',
    created_at:       new Date().toISOString(),
  };
  store.requests.unshift(request);
  saveStore();
  return { ...request };
}

export async function updateRequest(id, data) {
  await delay();
  const idx = store.requests.findIndex(r => r.id === id);
  if (idx === -1) throw new Error('Request not found');
  Object.assign(store.requests[idx], data);
  saveStore();
  return { ...store.requests[idx] };
}

export async function deleteRequest(id) {
  await delay();
  const idx = store.requests.findIndex(r => r.id === id);
  if (idx === -1) throw new Error('Request not found');
  store.requests.splice(idx, 1);
  // remove related assignments
  store.assignments = store.assignments.filter(a => a.request_id !== id);
  saveStore();
  return { ok: true };
}

// ── Block Windows (generated per week from section config) ──
export function generateBlockWindows(weekStartDate) {
  const windows = [];
  for (const section of store.sections) {
    for (let d = 0; d < 7; d++) {
      const isMega = section.mega_day !== null && section.mega_day === d;
      windows.push({
        id:              `bw-${section.id}-${weekStartDate}-${d}`,
        section_id:      section.id,
        week_start_date: weekStartDate,
        day_of_week:     d,
        start_hour:      isMega ? section.window_start_hour : section.window_start_hour,
        duration_hours:  isMega ? section.mega_duration_hours : section.window_duration_hours,
        slot_capacity:   section.slot_capacity,
      });
    }
  }
  return windows;
}

// ── Schedule Runs ──
export async function saveScheduleRun(run) {
  await delay();
  // Replace existing run for same week + mode
  const idx = store.scheduleRuns.findIndex(
    sr => sr.week_start_date === run.week_start_date && sr.mode === run.mode
  );
  if (idx !== -1) store.scheduleRuns[idx] = run;
  else store.scheduleRuns.push(run);
  saveStore();
  return { ...run };
}

export async function getScheduleRun(weekStartDate, mode) {
  await delay();
  const run = store.scheduleRuns.find(
    sr => sr.week_start_date === weekStartDate && sr.mode === mode
  );
  return run ? { ...run } : null;
}

// ── Schedule Assignments ──
export async function saveAssignments(weekStartDate, mode, assignments) {
  await delay();
  // Remove old assignments for this week+mode
  store.assignments = store.assignments.filter(
    a => !(a.week_start_date === weekStartDate && a.mode === mode)
  );
  store.assignments.push(...assignments);
  saveStore();
}

export async function getAssignments(weekStartDate, mode) {
  await delay();
  return store.assignments
    .filter(a => a.week_start_date === weekStartDate && a.mode === mode)
    .map(a => ({ ...a }));
}

// ── Schedule Comparison ──
export async function getComparison(weekStartDate) {
  const manual    = await getScheduleRun(weekStartDate, 'manual');
  const optimized = await getScheduleRun(weekStartDate, 'optimized');
  const manualAssignments    = await getAssignments(weekStartDate, 'manual');
  const optimizedAssignments = await getAssignments(weekStartDate, 'optimized');
  return { manual, optimized, manualAssignments, optimizedAssignments };
}

// ── Stats Summary ──
export async function getStatsSummary(weekStartDate) {
  await delay();
  const run = store.scheduleRuns.find(
    sr => sr.week_start_date === weekStartDate && sr.mode === 'optimized'
  ) || store.scheduleRuns.find(
    sr => sr.week_start_date === weekStartDate
  );

  if (!run) {
    return {
      total_hours:           0,
      total_windows:         0,
      co_located_windows:    0,
      unscheduled_critical:  store.requests.filter(r => r.severity === 'critical' && r.status !== 'scheduled').length,
    };
  }

  return {
    total_hours:          run.total_hours,
    total_windows:        run.total_windows,
    co_located_windows:   run.co_located_windows,
    unscheduled_critical: run.unscheduled_count,
  };
}

// ── Mock Data Regeneration ──
export async function regenerateMockData(seed = Date.now()) {
  await delay(200);
  initStore(seed);
  return { ok: true, seed };
}

// ── Lookups (sync, for convenience) ──
export function getSectionById(id) {
  return store.sections.find(s => s.id === id) || null;
}

export function getDepartmentById(id) {
  return store.departments.find(d => d.id === id) || null;
}

export function getAllRequests() {
  return [...store.requests];
}
