/* ═══════════════════════════════════════════════
   SIH26027 — Compare Page
   Side-by-side Manual vs Optimized comparison
   ═══════════════════════════════════════════════ */

import { el, qs, dayName, toISODate, getMonday, addDays, deptChipClass, showToast, truncateText } from '../utils.js';
import * as api from '../mockApi.js';
import { runSchedule, resetSchedule } from '../solver.js';

let initialized = false;
let currentWeek = toISODate(getMonday(new Date()));

export async function render(container) {
  container.innerHTML = '';
  initialized = true;

  const header = el('div', { className: 'page-header' },
    el('h1', {},
      el('span', { className: 'icon' }, '⚖️'),
      'Compare: Manual vs Optimized'
    ),
    el('div', { className: 'flex gap-3 items-center' },
      el('div', { className: 'week-picker' },
        el('label', { className: 'form-label', style: 'margin: 0' }, 'Week:'),
        el('input', {
          type: 'date',
          className: 'form-input',
          id: 'compare-week',
          value: currentWeek,
          onChange: handleWeekChange,
        })
      ),
      el('button', { className: 'btn btn-primary', onClick: handleRunBoth },
        '▶', ' Run Both Modes')
    )
  );
  container.appendChild(header);

  // Delta bar
  container.appendChild(el('div', { id: 'compare-delta', className: 'compare-delta-bar' }));

  // Side-by-side panels
  container.appendChild(el('div', { className: 'compare-layout', id: 'compare-panels' }));

  await loadComparison();
}

function handleWeekChange(e) {
  currentWeek = toISODate(getMonday(new Date(e.target.value)));
  qs('#compare-week').value = currentWeek;
  loadComparison();
}

async function handleRunBoth() {
  showToast('Running both modes…', 'info');

  try {
    await resetSchedule(currentWeek);
    await runSchedule(currentWeek, 'manual');
    // Reset again for optimized run (fresh slate)
    await resetSchedule(currentWeek);
    await runSchedule(currentWeek, 'optimized');
    showToast('Both schedules computed', 'success');
    await loadComparison();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function loadComparison() {
  const comparison = await api.getComparison(currentWeek);
  const deltaEl  = qs('#compare-delta');
  const panelsEl = qs('#compare-panels');
  if (!deltaEl || !panelsEl) return;

  const { manual, optimized, manualAssignments, optimizedAssignments } = comparison;

  // Delta stats
  deltaEl.innerHTML = '';

  if (manual && optimized) {
    const windowsSaved = manual.total_windows - optimized.total_windows;
    const hoursDiff    = manual.total_hours - optimized.total_hours;
    const coLocGain    = optimized.co_located_windows - manual.co_located_windows;
    const criticalDiff = manual.unscheduled_count - optimized.unscheduled_count;

    const deltas = [
      {
        label: 'Windows Saved',
        value: windowsSaved >= 0 ? `−${windowsSaved}` : `+${Math.abs(windowsSaved)}`,
        cls: windowsSaved > 0 ? 'delta-positive' : windowsSaved < 0 ? 'delta-negative' : 'delta-neutral',
      },
      {
        label: 'Hours Diff',
        value: hoursDiff >= 0 ? `−${hoursDiff}h` : `+${Math.abs(hoursDiff)}h`,
        cls: hoursDiff >= 0 ? 'delta-positive' : 'delta-negative',
      },
      {
        label: 'Co-location Gain',
        value: `+${coLocGain}`,
        cls: coLocGain > 0 ? 'delta-positive' : 'delta-neutral',
      },
      {
        label: 'Critical Rescued',
        value: `+${criticalDiff}`,
        cls: criticalDiff > 0 ? 'delta-positive' : 'delta-neutral',
      },
    ];

    for (const d of deltas) {
      deltaEl.appendChild(
        el('div', { className: 'delta-card' },
          el('div', { className: `delta-value ${d.cls}` }, d.value),
          el('div', { className: 'delta-label' }, d.label)
        )
      );
    }
  } else {
    deltaEl.appendChild(
      el('div', { className: 'delta-card', style: 'grid-column: 1/-1' },
        el('div', { className: 'delta-value delta-neutral' }, '—'),
        el('div', { className: 'delta-label' }, 'Run both modes to see the comparison')
      )
    );
  }

  // Panels
  panelsEl.innerHTML = '';

  panelsEl.appendChild(buildPanel('Manual (Baseline)', 'mode-manual', manual, manualAssignments));
  panelsEl.appendChild(buildPanel('Optimized (AI)', 'mode-optimized', optimized, optimizedAssignments));
}

function buildPanel(title, modeClass, run, assignments) {
  const panel = el('div', { className: 'compare-panel' });

  // Header
  const headerTitle = el('h3', { className: modeClass },
    modeClass === 'mode-manual' ? '📋' : '⚡',
    ' ', title
  );

  const stats = run
    ? el('span', { className: 'text-xs text-tertiary font-mono' },
        `${run.total_windows} windows · ${run.total_hours}h · ${run.co_located_windows} co-loc`)
    : el('span', { className: 'text-xs text-tertiary' }, 'Not computed');

  panel.appendChild(
    el('div', { className: 'compare-panel-header' }, headerTitle, stats)
  );

  // Body — mini calendar or list
  const body = el('div', { className: 'compare-panel-body' });

  if (!run || assignments.length === 0) {
    body.appendChild(
      el('div', { className: 'empty-state' },
        el('div', { className: 'icon' }, '📭'),
        el('p', {}, 'No schedule data — run the scheduler first')
      )
    );
  } else {
    // Group assignments by window
    const byWindow = {};
    for (const a of assignments) {
      if (!byWindow[a.block_window_id]) byWindow[a.block_window_id] = [];
      byWindow[a.block_window_id].push(a);
    }

    const sections = api.getAllRequests(); // for lookups
    const windowList = api.generateBlockWindows(currentWeek);

    for (const [windowId, windowAssignments] of Object.entries(byWindow)) {
      const window = windowList.find(w => w.id === windowId);
      const section = window ? api.getSectionById(window.section_id) : null;

      const windowCard = el('div', {
        style: 'padding: 0.5rem; margin-bottom: 0.5rem; background: var(--bg-tertiary); border-radius: var(--radius-md); border: 1px solid var(--border-primary)'
      },
        el('div', { className: 'flex items-center justify-between mb-2' },
          el('span', { className: 'font-mono text-xs font-semibold' },
            section ? section.code : 'Unknown',
            ' · ',
            window ? dayName(window.day_of_week) : ''),
          el('span', { className: 'text-xs text-tertiary' },
            `${windowAssignments.length} task${windowAssignments.length > 1 ? 's' : ''}`)
        )
      );

      for (const a of windowAssignments) {
        const req = api.getAllRequests().find(r => r.id === a.request_id);
        if (!req) continue;
        const dept = api.getDepartmentById(req.department_id);
        const chipClass = dept ? deptChipClass(dept.name) : 'dept-eng';
        windowCard.appendChild(
          el('div', { className: `calendar-chip ${chipClass}`, style: 'margin-bottom: 2px' },
            truncateText(req.task_description, 30))
        );
      }

      body.appendChild(windowCard);
    }
  }

  panel.appendChild(body);
  return panel;
}

export function refresh() {
  if (initialized) loadComparison();
}
