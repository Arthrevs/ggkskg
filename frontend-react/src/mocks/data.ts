// ============================================================
// Mock Data — Indian Railways sections, requests, schedules
// ============================================================

import type {
  MaintenanceRequest,
  Section,
  Schedule,
  ScheduleEntry,
  ScheduleComparison,
  StatsSummary,
  Department,
  Severity,
  BlockWindow,
} from '../lib/types';

// ── Railway Sections with realistic coordinates ──────────────
export const MOCK_SECTIONS: Section[] = [
  {
    id: 'sec-1',
    name: 'Delhi Junction – Agra Cantt',
    zone: 'NCR',
    coordinates: [[28.6615, 77.2310], [27.1767, 78.0081]],
  },
  {
    id: 'sec-2',
    name: 'Mumbai CST – Pune Jn',
    zone: 'CR',
    coordinates: [[18.9402, 72.8356], [18.5285, 73.8742]],
  },
  {
    id: 'sec-3',
    name: 'Chennai Central – Bangalore City',
    zone: 'SR',
    coordinates: [[13.0827, 80.2707], [12.9784, 77.5712]],
  },
  {
    id: 'sec-4',
    name: 'Howrah Jn – Kharagpur Jn',
    zone: 'SER',
    coordinates: [[22.5839, 88.3428], [22.3460, 87.3238]],
  },
  {
    id: 'sec-5',
    name: 'Lucknow NR – Varanasi Jn',
    zone: 'NR',
    coordinates: [[26.8467, 80.9462], [25.3176, 82.9739]],
  },
  {
    id: 'sec-6',
    name: 'Jaipur Jn – Ajmer Jn',
    zone: 'NWR',
    coordinates: [[26.9196, 75.7878], [26.4521, 74.6399]],
  },
  {
    id: 'sec-7',
    name: 'Secunderabad – Kazipet Jn',
    zone: 'SCR',
    coordinates: [[17.4344, 78.5013], [17.9784, 79.5483]],
  },
  {
    id: 'sec-8',
    name: 'Patna Jn – Gaya Jn',
    zone: 'ECR',
    coordinates: [[25.6093, 85.1376], [24.7914, 84.9994]],
  },
  {
    id: 'sec-9',
    name: 'Bhopal Jn – Itarsi Jn',
    zone: 'WCR',
    coordinates: [[23.2685, 77.4121], [22.6148, 77.7630]],
  },
  {
    id: 'sec-10',
    name: 'Visakhapatnam – Vijayawada Jn',
    zone: 'ECoR',
    coordinates: [[17.7231, 83.3013], [16.5175, 80.6484]],
  },
  {
    id: 'sec-11',
    name: 'Coimbatore Jn – Erode Jn',
    zone: 'SR',
    coordinates: [[11.0168, 76.9558], [11.3410, 77.7172]],
  },
  {
    id: 'sec-12',
    name: 'Kanpur Central – Allahabad Jn',
    zone: 'NCR',
    coordinates: [[26.4499, 80.3319], [25.4358, 81.8463]],
  },
  {
    id: 'sec-13',
    name: 'Nagpur Jn – Wardha Jn',
    zone: 'CR',
    coordinates: [[21.1458, 79.0882], [20.7453, 78.6022]],
  },
  {
    id: 'sec-14',
    name: 'Ahmedabad Jn – Vadodara Jn',
    zone: 'WR',
    coordinates: [[23.0225, 72.5714], [22.3072, 73.1812]],
  },
  {
    id: 'sec-15',
    name: 'Guwahati – New Jalpaiguri',
    zone: 'NFR',
    coordinates: [[26.1844, 91.7362], [26.6822, 88.4305]],
  },
];

// ── Helper to generate requests ──────────────────────────────
const departments: Department[] = ['Engineering', 'S&T', 'TRD'];
const severities: Severity[] = ['critical', 'high', 'medium', 'low'];

const descriptions: Record<Department, string[]> = {
  Engineering: [
    'Rail fracture repair on UP line',
    'Sleeper replacement (concrete)',
    'Ballast tamping and packing',
    'Track realignment at curve',
    'Bridge girder inspection',
    'Point and crossing renewal',
    'Level crossing gate repair',
    'Rail welding (thermit)',
    'Track geometry correction',
    'Culvert cleaning and repair',
  ],
  'S&T': [
    'Signal relay replacement',
    'Axle counter calibration',
    'Interlocking panel maintenance',
    'LED signal lamp upgrade',
    'Track circuit bonding repair',
    'Point machine overhaul',
    'Cable route inspection',
    'BPAC system testing',
    'Block instrument maintenance',
    'Communication cable repair',
  ],
  TRD: [
    'OHE mast straightening',
    'Pantograph zone marking',
    'Contact wire re-tensioning',
    'Section insulator replacement',
    'Return conductor repair',
    'ATD inspection and testing',
    'Catenary wire replacement',
    'Power block for OHE work',
    'Feeder cable joint repair',
    'Neutral section maintenance',
  ],
};

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRequests(): MaintenanceRequest[] {
  const requests: MaintenanceRequest[] = [];
  for (let i = 1; i <= 36; i++) {
    const dept = departments[i % 3];
    const sev = severities[Math.floor(Math.random() * 4)];
    const section = MOCK_SECTIONS[(i - 1) % MOCK_SECTIONS.length];
    requests.push({
      id: `REQ-${String(i).padStart(3, '0')}`,
      section: section.name,
      department: dept,
      description: randomChoice(descriptions[dept]),
      duration: [30, 45, 60, 90, 120, 150, 180][Math.floor(Math.random() * 7)],
      severity: sev,
      overdueDays: sev === 'critical' ? Math.floor(Math.random() * 15) + 5 : Math.floor(Math.random() * 30),
      status: i <= 24 ? 'scheduled' : (i <= 30 ? 'pending' : 'unscheduled'),
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString(),
    });
  }
  return requests;
}

export const MOCK_REQUESTS: MaintenanceRequest[] = generateRequests();

// ── Schedule generation ──────────────────────────────────────
const timeSlots = [
  { start: '00:30', end: '04:30' },
  { start: '01:00', end: '04:00' },
  { start: '02:00', end: '05:00' },
  { start: '23:00', end: '03:00' },
  { start: '00:00', end: '03:30' },
  { start: '01:30', end: '04:30' },
];

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function generateSchedule(mode: 'manual' | 'optimized', requests: MaintenanceRequest[]): Schedule {
  const scheduledRequests = requests.filter(r => r.status === 'scheduled' || r.status === 'pending');
  const entries: ScheduleEntry[] = [];
  const usedWindows = new Set<string>();

  const maxEntries = mode === 'optimized' ? Math.min(scheduledRequests.length, 22) : Math.min(scheduledRequests.length, 16);

  for (let i = 0; i < maxEntries; i++) {
    const req = scheduledRequests[i];
    const day = days[i % 7];
    const slot = timeSlots[i % timeSlots.length];
    const section = MOCK_SECTIONS.find(s => s.name === req.section) || MOCK_SECTIONS[0];

    const windowId = `${day}-${section.name}-${slot.start}`;
    const blockWindow: BlockWindow = {
      id: `BW-${String(i + 1).padStart(3, '0')}`,
      day,
      startTime: slot.start,
      endTime: slot.end,
      section: section.name,
    };

    // Try to co-locate: if same day + section, add to existing entry
    const existingEntry = entries.find(
      e => e.blockWindow.day === day && e.blockWindow.section === section.name
    );

    if (existingEntry && mode === 'optimized') {
      existingEntry.assignedRequests.push(req);
      if (!existingEntry.departments.includes(req.department)) {
        existingEntry.departments.push(req.department);
      }
    } else if (!usedWindows.has(windowId)) {
      usedWindows.add(windowId);
      entries.push({
        blockWindow,
        assignedRequests: [req],
        departments: [req.department],
      });
    }
  }

  const totalScheduled = entries.reduce((sum, e) => sum + e.assignedRequests.length, 0);
  const criticalCovered = entries.reduce(
    (sum, e) => sum + e.assignedRequests.filter(r => r.severity === 'critical').length,
    0
  );
  return {
    id: `SCH-${mode}-001`,
    mode,
    week: '2026-W36',
    entries,
    stats: {
      totalWindowsUsed: entries.length,
      totalRequestsScheduled: totalScheduled,
      criticalRequestsCovered: criticalCovered,
      unscheduledRequests: requests.length - totalScheduled,
      totalHoursScheduled: entries.reduce(
        (sum, e) => sum + e.assignedRequests.reduce((s, r) => s + r.duration, 0) / 60,
        0
      ),
    },
  };
}

export const MOCK_MANUAL_SCHEDULE = generateSchedule('manual', MOCK_REQUESTS);
export const MOCK_OPTIMIZED_SCHEDULE = generateSchedule('optimized', MOCK_REQUESTS);

export const MOCK_COMPARISON: ScheduleComparison = {
  manual: MOCK_MANUAL_SCHEDULE,
  optimized: MOCK_OPTIMIZED_SCHEDULE,
  improvements: {
    windowsSaved:
      MOCK_MANUAL_SCHEDULE.stats.totalWindowsUsed - MOCK_OPTIMIZED_SCHEDULE.stats.totalWindowsUsed,
    additionalRequestsScheduled:
      MOCK_OPTIMIZED_SCHEDULE.stats.totalRequestsScheduled -
      MOCK_MANUAL_SCHEDULE.stats.totalRequestsScheduled,
    criticalCoverageImprovement:
      MOCK_OPTIMIZED_SCHEDULE.stats.criticalRequestsCovered -
      MOCK_MANUAL_SCHEDULE.stats.criticalRequestsCovered,
    percentImprovement: Math.round(
      ((MOCK_OPTIMIZED_SCHEDULE.stats.totalRequestsScheduled -
        MOCK_MANUAL_SCHEDULE.stats.totalRequestsScheduled) /
        Math.max(MOCK_MANUAL_SCHEDULE.stats.totalRequestsScheduled, 1)) *
        100
    ),
  },
};

// ── Stats ────────────────────────────────────────────────────
export const MOCK_STATS: StatsSummary = {
  totalHoursScheduled: Math.round(MOCK_OPTIMIZED_SCHEDULE.stats.totalHoursScheduled * 10) / 10,
  windowsUsed: MOCK_OPTIMIZED_SCHEDULE.stats.totalWindowsUsed,
  colocatedBlocks: MOCK_OPTIMIZED_SCHEDULE.entries.filter(e => e.departments.length > 1).length,
  solverTimeMs: 1247,
  requestsByDepartment: {
    Engineering: MOCK_REQUESTS.filter(r => r.department === 'Engineering').length,
    'S&T': MOCK_REQUESTS.filter(r => r.department === 'S&T').length,
    TRD: MOCK_REQUESTS.filter(r => r.department === 'TRD').length,
  },
  requestsBySeverity: {
    critical: MOCK_REQUESTS.filter(r => r.severity === 'critical').length,
    high: MOCK_REQUESTS.filter(r => r.severity === 'high').length,
    medium: MOCK_REQUESTS.filter(r => r.severity === 'medium').length,
    low: MOCK_REQUESTS.filter(r => r.severity === 'low').length,
  },
  requestsOverTime: Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400000).toISOString().split('T')[0],
    count: Math.floor(Math.random() * 5) + 1,
  })),
  departmentWorkload: [
    { department: 'Engineering', hours: 24.5, requests: 12 },
    { department: 'S&T', hours: 18.0, requests: 12 },
    { department: 'TRD', hours: 15.5, requests: 12 },
  ],
};
