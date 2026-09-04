/* ═══════════════════════════════════════════════
   SIH26027 — Seeded Mock Data Generator
   Produces sections, departments, and maintenance
   requests with realistic distributions.
   ═══════════════════════════════════════════════ */

import { generateId } from '../utils/utils.js';

// ── Seeded PRNG (mulberry32) ──
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let rng = mulberry32(26027);

function pick(arr)        { return arr[Math.floor(rng() * arr.length)]; }
function randInt(lo, hi)  { return lo + Math.floor(rng() * (hi - lo + 1)); }

// ── Departments ──
export const DEPARTMENTS = [
  { id: 'dept-eng', name: 'Engineering',           short_code: 'ENG' },
  { id: 'dept-snt', name: 'Signal & Telecom',      short_code: 'S&T' },
  { id: 'dept-trd', name: 'Traction Distribution', short_code: 'TRD' },
];

// ── Sections (IR-inspired block configs) ──
export const SECTIONS = [
  {
    id: 'sec-ndls-gzb',
    code: 'NDLS-GZB',
    name: 'New Delhi – Ghaziabad',
    window_start_hour: 0,     // midnight
    window_duration_hours: 3,
    mega_day: 3,              // Wednesday (0=Mon)
    mega_duration_hours: 5,
    slot_capacity: 3,
  },
  {
    id: 'sec-gzb-cnb',
    code: 'GZB-CNB',
    name: 'Ghaziabad – Kanpur',
    window_start_hour: 1,
    window_duration_hours: 3,
    mega_day: 4,              // Thursday
    mega_duration_hours: 6,
    slot_capacity: 3,
  },
  {
    id: 'sec-cnb-ald',
    code: 'CNB-ALD',
    name: 'Kanpur – Prayagraj',
    window_start_hour: 0,
    window_duration_hours: 2.5,
    mega_day: 2,              // Wednesday
    mega_duration_hours: 5,
    slot_capacity: 2,
  },
  {
    id: 'sec-ald-mgs',
    code: 'ALD-MGS',
    name: 'Prayagraj – Mughal Sarai',
    window_start_hour: 23,
    window_duration_hours: 3,
    mega_day: 5,              // Saturday
    mega_duration_hours: 6,
    slot_capacity: 3,
  },
  {
    id: 'sec-mgs-ddn',
    code: 'MGS-DDN',
    name: 'Mughal Sarai – Dhanbad',
    window_start_hour: 0,
    window_duration_hours: 2,
    mega_day: null,           // no mega block
    mega_duration_hours: 0,
    slot_capacity: 2,
  },
];

// ── Task descriptions per department ──
const TASKS = {
  'dept-eng': [
    'Rail grinding — Section turnout zone',
    'Sleeper replacement — concrete to PSC',
    'Ballast tamping and packing',
    'Weld joint ultrasonic testing',
    'Track geometry correction',
    'Bridge girder inspection',
    'Level crossing surface repair',
    'Drainage and cess repair',
    'Rail fracture emergency weld',
    'Fish plate bolt tightening',
  ],
  'dept-snt': [
    'Signal aspect alignment check',
    'Axle counter calibration',
    'OFC cable splice repair',
    'Relay room moisture treatment',
    'Point machine servicing',
    'LED signal head replacement',
    'Track circuit insulation test',
    'Electronic interlocking firmware update',
    'Level crossing gate mechanism overhaul',
    'Remote monitoring sensor installation',
  ],
  'dept-trd': [
    'OHE wire tension adjustment',
    'Catenary mast foundation check',
    'Pantograph clearance measurement',
    'Insulator cleaning — high-pollution zone',
    'Auto-tensioning device servicing',
    'Section insulator replacement',
    'SCADA panel maintenance',
    'Transformer oil sampling',
    'Lightning arrester test',
    'Power cable termination repair',
  ],
};

// ── Severity distribution (realistic: most routine, tail critical) ──
function randomSeverity() {
  const r = rng();
  if (r < 0.08) return 'critical';
  if (r < 0.25) return 'high';
  if (r < 0.60) return 'medium';
  return 'low';
}

function randomOverdueDays(severity) {
  if (severity === 'critical') return randInt(5, 45);
  if (severity === 'high')     return randInt(0, 30);
  if (severity === 'medium')   return randInt(0, 15);
  return randInt(0, 7);
}

function randomDuration(severity) {
  if (severity === 'critical') return pick([2, 2.5, 3, 3]);
  if (severity === 'high')     return pick([1.5, 2, 2, 2.5]);
  if (severity === 'medium')   return pick([1, 1, 1.5, 2]);
  return pick([0.5, 1, 1, 1]);
}

// ── Generate requests ──
export function generateRequests(count = 70, seed = 26027) {
  rng = mulberry32(seed);
  const requests = [];

  for (let i = 0; i < count; i++) {
    const dept    = pick(DEPARTMENTS);
    const section = pick(SECTIONS);
    const sev     = randomSeverity();
    const task    = pick(TASKS[dept.id]);

    requests.push({
      id:               generateId(),
      section_id:       section.id,
      department_id:    dept.id,
      task_description: task,
      severity:         sev,
      overdue_days:     randomOverdueDays(sev),
      duration_hours:   randomDuration(sev),
      status:           'pending',
      created_at:       new Date(Date.now() - randInt(0, 14) * 86400000).toISOString(),
    });
  }

  return requests;
}

// ── Full dataset ──
export function generateFullDataset(seed = 26027) {
  return {
    departments: DEPARTMENTS,
    sections:    SECTIONS,
    requests:    generateRequests(70, seed),
  };
}
