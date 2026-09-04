/* ═══════════════════════════════════════════════
   SIH26027 — Schedule Page
   Run scheduler, weekly calendar grid
   ═══════════════════════════════════════════════ */

import { el, qs, qsa, dayName, toISODate, getMonday, addDays, deptChipClass, showToast, truncateText } from '../utils.js';
import * as api from '../mockApi.js';
import { runSchedule, resetSchedule } from '../solver.js';
import { canRunSchedule } from '../auth.js';

let initialized = false;
let currentWeek = toISODate(getMonday(new Date()));

export async function render(container) {
  container.innerHTML = '';
  initialized = true;

  const header = el('div', { className: 'page-header' },
    el('h1', {},
      el('span', { className: 'icon' }, '📅'),
      'Block Schedule'
    )
  );
  container.appendChild(header);

  // Controls
  const controls = el('div', { className: 'schedule-controls' },
    el('div', { className: 'week-picker' },
      el('label', { className: 'form-label', style: 'margin: 0' }, 'Week of:'),
      el('input', {
        type: 'date',
        className: 'form-input',
        id: 'schedule-week',
        value: currentWeek,
        onChange: handleWeekChange,
      })
    ),
    el('div', { className: 'toggle-group', id: 'mode-toggle' },
      el('button', {
        className: 'toggle-btn active',
        dataset: { mode: 'optimized' },
        onClick: () => switchMode('optimized'),
      }, '⚡ Optimized'),
      el('button', {
        className: 'toggle-btn',
        dataset: { mode: 'manual' },
        onClick: () => switchMode('manual'),
      }, '📋 Manual')
    ),
    canRunSchedule()
      ? el('div', { className: 'flex gap-3' },
          el('button', { className: 'btn btn-primary', id: 'btn-run-schedule', onClick: handleRun },
            '▶', ' Run Schedule'),
          el('button', { className: 'btn btn-ghost', id: 'btn-reset-schedule', onClick: handleReset },
            '↺', ' Reset')
        )
      : el('span')
  );
  container.appendChild(controls);

  // Run stats bar
  container.appendChild(el('div', { id: 'schedule-run-stats' }));

  // Calendar grid
  container.appendChild(el('div', { id: 'calendar-container' }));

  await loadCalendar();
}

function handleWeekChange(e) {
  currentWeek = toISODate(getMonday(new Date(e.target.value)));
  qs('#schedule-week').value = currentWeek;
  loadCalendar();
}

let currentMode = 'optimized';

function switchMode(mode) {
  currentMode = mode;
  qsa('#mode-toggle .toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  loadCalendar();
}

async function handleRun() {
  const btn = qs('#btn-run-schedule');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Running…';
  }

  try {
    // Reset first
    await resetSchedule(currentWeek);

    // Run both modes
    await runSchedule(currentWeek, 'manual');
    await runSchedule(currentWeek, 'optimized');

    showToast('Schedule computed for both modes', 'success');
    await loadCalendar();
  } catch (err) {
    showToast('Schedule run failed: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '▶ Run Schedule';
    }
  }
}

async function handleReset() {
  await resetSchedule(currentWeek);
  showToast('Requests reset to pending', 'info');
  await loadCalendar();
}

async function loadCalendar() {
  const calContainer = qs('#calendar-container');
  const statsContainer = qs('#schedule-run-stats');
  if (!calContainer) return;

  const sections    = await api.getSections();
  const assignments = await api.getAssignments(currentWeek, currentMode);
  const run         = await api.getScheduleRun(currentWeek, currentMode);
  const windows     = api.generateBlockWindows(currentWeek);

  // Stats bar
  if (statsContainer) {
    statsContainer.innerHTML = '';
    if (run) {
      const statsBar = el('div', { className: 'filter-bar', style: 'margin-bottom: 1.5rem' },
        el('span', { className: 'text-sm text-secondary' }, `Mode: `),
        el('span', { className: `badge ${currentMode === 'optimized' ? 'badge-scheduled' : 'badge-pending'}` }, currentMode),
        el('span', { className: 'text-sm text-secondary', style: 'margin-left: 1rem' }, `Windows: `),
        el('span', { className: 'font-mono font-semibold' }, `${run.total_windows}`),
        el('span', { className: 'text-sm text-secondary', style: 'margin-left: 1rem' }, `Co-located: `),
        el('span', { className: 'font-mono font-semibold' }, `${run.co_located_windows}`),
        el('span', { className: 'text-sm text-secondary', style: 'margin-left: 1rem' }, `Hours: `),
        el('span', { className: 'font-mono font-semibold' }, `${run.total_hours}`),
        el('span', { className: 'text-sm text-secondary', style: 'margin-left: 1rem' }, `Unscheduled: `),
        el('span', { className: 'font-mono font-semibold' }, `${run.unscheduled_count}`),
        el('span', { className: 'text-sm text-secondary', style: 'margin-left: 1rem' }, `Solve: `),
        el('span', { className: 'font-mono text-xs text-tertiary' }, `${run.solve_time_ms}ms`)
      );
      statsContainer.appendChild(statsBar);
    }
  }

  // Build assignment lookup: windowId → [request]
  const windowAssignments = {};
  for (const a of assignments) {
    if (!windowAssignments[a.block_window_id]) windowAssignments[a.block_window_id] = [];
    const req = await api.getRequest(a.request_id);
    if (req) windowAssignments[a.block_window_id].push(req);
  }

  // Calendar grid
  const grid = el('div', { className: 'calendar-grid' });

  // Header row
  grid.appendChild(el('div', { className: 'calendar-header' }, 'Section'));
  for (let d = 0; d < 7; d++) {
    const date = addDays(new Date(currentWeek), d);
    const dayStr = dayName(d);
    const dateStr = date.getDate() + '/' + (date.getMonth() + 1);
    grid.appendChild(el('div', { className: 'calendar-header' }, `${dayStr} ${dateStr}`));
  }

  // Section rows
  for (const section of sections) {
    // Section label
    grid.appendChild(
      el('div', { className: 'calendar-section-label' },
        el('span', { className: 'font-mono' }, section.code)
      )
    );

    // Day cells
    for (let d = 0; d < 7; d++) {
      const window = windows.find(w => w.section_id === section.id && w.day_of_week === d);
      const isMega = section.mega_day !== null && section.mega_day === d;
      const cell = el('div', { className: `calendar-cell ${isMega ? 'mega-block' : ''}` });

      // Window indicator
      if (window) {
        cell.appendChild(
          el('span', { className: 'window-indicator' },
            isMega ? `⚡${window.duration_hours}h` : `${window.duration_hours}h`)
        );
      }

      // Assignment chips
      if (window && windowAssignments[window.id]) {
        for (const req of windowAssignments[window.id]) {
          const dept = api.getDepartmentById(req.department_id);
          const chipClass = dept ? deptChipClass(dept.name) : 'dept-eng';
          const chip = el('div', {
            className: `calendar-chip ${chipClass}`,
            title: `${req.task_description}\n${dept?.short_code || ''} · ${req.severity} · ${req.duration_hours}h`,
          }, truncateText(req.task_description, 18));
          cell.appendChild(chip);
        }
      }

      grid.appendChild(cell);
    }
  }

  calContainer.innerHTML = '';
  calContainer.appendChild(grid);
}

export function refresh() {
  if (initialized) loadCalendar();
}
