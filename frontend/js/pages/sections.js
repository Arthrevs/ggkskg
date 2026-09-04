/* ═══════════════════════════════════════════════
   SIH26027 — Sections Page
   View track sections and their block-window configs
   ═══════════════════════════════════════════════ */

import { el, qs, dayName } from '../utils.js';
import * as api from '../mockApi.js';

let initialized = false;

export async function render(container) {
  container.innerHTML = '';
  initialized = true;

  const header = el('div', { className: 'page-header' },
    el('h1', {},
      el('span', { className: 'icon' }, '🛤️'),
      'Track Sections'
    )
  );
  container.appendChild(header);

  const sections = await api.getSections();
  const requests = await api.getRequests();

  const grid = el('div', { className: 'grid grid-3' });

  for (const section of sections) {
    const sectionRequests = requests.filter(r => r.section_id === section.id);
    const pendingCount    = sectionRequests.filter(r => r.status === 'pending').length;
    const criticalCount   = sectionRequests.filter(r => r.severity === 'critical').length;

    const card = el('div', { className: 'section-card' },
      // Header
      el('div', { className: 'section-card-header' },
        el('span', { className: 'section-code' }, section.code),
        el('span', { className: 'badge badge-medium' }, `${sectionRequests.length} req`)
      ),
      // Body
      el('div', { className: 'section-card-body' },
        el('h4', { style: 'margin-bottom: 0.75rem; font-size: var(--text-sm)' }, section.name),

        // Details
        buildDetail('Nightly Window', `${formatHour(section.window_start_hour)} — ${section.window_duration_hours}h`),
        buildDetail('Mega Block',
          section.mega_day !== null
            ? `${dayName(section.mega_day)} · ${section.mega_duration_hours}h`
            : 'None'
        ),
        buildDetail('Slot Capacity', `${section.slot_capacity} concurrent crews`),
        buildDetail('Pending', `${pendingCount} tasks`),
        buildDetail('Critical', criticalCount > 0
          ? el('span', { style: 'color: var(--severity-critical); font-weight: 600' }, `${criticalCount} tasks`)
          : '0'
        ),

        // Timeline bar
        el('div', { className: 'text-xs text-tertiary', style: 'margin-top: 0.75rem' }, 'Weekly block windows:'),
        buildTimeline(section)
      )
    );

    grid.appendChild(card);
  }

  container.appendChild(grid);
}

function buildDetail(label, value) {
  const valueNode = typeof value === 'string' ? document.createTextNode(value) : value;
  return el('div', { className: 'section-detail' },
    el('span', { className: 'label' }, label),
    el('span', { className: 'value' }, valueNode)
  );
}

function formatHour(h) {
  const hours = Math.floor(h);
  const mins  = Math.round((h - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function buildTimeline(section) {
  const bar = el('div', { className: 'timeline-bar' });
  const totalHours = 24;

  for (let d = 0; d < 7; d++) {
    const isMega = section.mega_day !== null && section.mega_day === d;
    const duration = isMega ? section.mega_duration_hours : section.window_duration_hours;
    const widthPct = (duration / totalHours) * (100 / 7);
    const gapPct   = ((totalHours - duration) / totalHours) * (100 / 7);

    bar.appendChild(
      el('div', {
        className: `timeline-segment ${isMega ? 'mega' : 'nightly'}`,
        style: `width: ${widthPct}%; min-width: 12px`,
        title: `${dayName(d)}: ${duration}h ${isMega ? '(Mega)' : '(Nightly)'}`,
      }, dayName(d).charAt(0))
    );

    // Gap
    if (gapPct > 0) {
      bar.appendChild(
        el('div', { style: `width: ${gapPct}%` })
      );
    }
  }

  return bar;
}

export function refresh() {
  if (initialized) {
    const container = qs('#page-sections');
    if (container) render(container);
  }
}
