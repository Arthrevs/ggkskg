/* ═══════════════════════════════════════════════
   SIH26027 — Sections Page
   View track sections with interactive route map
   and block-window config cards
   ═══════════════════════════════════════════════ */

import { el, qs, dayName } from '../utils.js';
import * as api from '../mockApi.js';

let initialized = false;
let tooltipEl = null;

// ── Station definitions (ordered along the corridor) ──
const STATIONS = [
  { code: 'NDLS', name: 'New Delhi' },
  { code: 'GZB',  name: 'Ghaziabad' },
  { code: 'CNB',  name: 'Kanpur' },
  { code: 'ALD',  name: 'Prayagraj' },
  { code: 'MGS',  name: 'Mughal Sarai' },
  { code: 'DDN',  name: 'Dhanbad' },
];

// Maps section IDs to station pair indices [fromIdx, toIdx]
const SECTION_STATION_MAP = {
  'sec-ndls-gzb': [0, 1],
  'sec-gzb-cnb':  [1, 2],
  'sec-cnb-ald':  [2, 3],
  'sec-ald-mgs':  [3, 4],
  'sec-mgs-ddn':  [4, 5],
};

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

  // ── Build route map ──
  container.appendChild(buildRouteMap(sections, requests));

  // ── Existing section cards grid ──
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

// ═══════════════════════════════════════════════
//  Route Map Builder
// ═══════════════════════════════════════════════

function getSectionStatus(section, requests) {
  const today = new Date();
  // JS getDay(): 0=Sun, 1=Mon ... 6=Sat → convert to our 0=Mon format
  const jsDay = today.getDay();
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon, 1=Tue, ..., 6=Sun

  const sectionRequests = requests.filter(r => r.section_id === section.id);
  const criticalUnscheduled = sectionRequests.filter(
    r => r.severity === 'critical' && r.status !== 'scheduled'
  ).length;

  // Mega block day match — section is fully blocked
  if (section.mega_day !== null && section.mega_day === dayOfWeek) {
    return {
      state: 'blocked',
      label: 'MEGA BLOCK',
      reason: `Mega block active (${dayName(dayOfWeek)})`,
    };
  }

  // Critical unscheduled — warning state
  if (criticalUnscheduled > 0) {
    return {
      state: 'warning',
      label: `${criticalUnscheduled} CRITICAL`,
      reason: `${criticalUnscheduled} critical unscheduled task${criticalUnscheduled > 1 ? 's' : ''}`,
    };
  }

  return {
    state: 'active',
    label: 'OPERATIONAL',
    reason: 'Section is operational',
  };
}

function buildRouteMap(sections, requests) {
  const wrapper = el('div', { className: 'route-map-container' });

  // Header
  const mapHeader = el('div', { className: 'route-map-header' },
    el('div', { className: 'route-map-title' },
      el('span', {}, '🗺️'),
      'Live Route Status Map'
    ),
    el('div', { className: 'route-map-legend' },
      el('div', { className: 'legend-item' },
        el('span', { className: 'legend-dot active' }),
        'Operational'
      ),
      el('div', { className: 'legend-item' },
        el('span', { className: 'legend-dot blocked' }),
        'Blocked (Mega Block)'
      ),
      el('div', { className: 'legend-item' },
        el('span', { className: 'legend-dot warning' }),
        'Critical Tasks Pending'
      )
    )
  );
  wrapper.appendChild(mapHeader);

  // SVG map
  const svgWrapper = el('div', { className: 'route-map-svg-wrapper' });
  const svgNS = 'http://www.w3.org/2000/svg';

  const svgWidth = 900;
  const svgHeight = 200;
  const paddingX = 70;
  const centerY = 100;
  const stationSpacing = (svgWidth - paddingX * 2) / (STATIONS.length - 1);

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // ── Defs: filters and gradients ──
  const defs = document.createElementNS(svgNS, 'defs');

  // Glow filter for stations
  const glowFilter = document.createElementNS(svgNS, 'filter');
  glowFilter.setAttribute('id', 'station-glow');
  glowFilter.setAttribute('x', '-50%');
  glowFilter.setAttribute('y', '-50%');
  glowFilter.setAttribute('width', '200%');
  glowFilter.setAttribute('height', '200%');
  const feGaussian = document.createElementNS(svgNS, 'feGaussianBlur');
  feGaussian.setAttribute('stdDeviation', '3');
  feGaussian.setAttribute('result', 'blur');
  glowFilter.appendChild(feGaussian);
  const feMerge = document.createElementNS(svgNS, 'feMerge');
  const feMergeNode1 = document.createElementNS(svgNS, 'feMergeNode');
  feMergeNode1.setAttribute('in', 'blur');
  feMerge.appendChild(feMergeNode1);
  const feMergeNode2 = document.createElementNS(svgNS, 'feMergeNode');
  feMergeNode2.setAttribute('in', 'SourceGraphic');
  feMerge.appendChild(feMergeNode2);
  glowFilter.appendChild(feMerge);
  defs.appendChild(glowFilter);

  svg.appendChild(defs);

  // ── Draw track segments ──
  const sectionStatuses = {};
  for (const section of sections) {
    const stationPair = SECTION_STATION_MAP[section.id];
    if (!stationPair) continue;

    const [fromIdx, toIdx] = stationPair;
    const x1 = paddingX + fromIdx * stationSpacing;
    const x2 = paddingX + toIdx * stationSpacing;
    const status = getSectionStatus(section, requests);
    sectionStatuses[section.id] = status;

    // Background line (rail bed)
    const bgLine = document.createElementNS(svgNS, 'line');
    bgLine.setAttribute('x1', x1);
    bgLine.setAttribute('y1', centerY);
    bgLine.setAttribute('x2', x2);
    bgLine.setAttribute('y2', centerY);
    bgLine.setAttribute('class', 'track-line-bg');
    svg.appendChild(bgLine);

    // Foreground line (colored by status)
    const trackLine = document.createElementNS(svgNS, 'line');
    trackLine.setAttribute('x1', x1);
    trackLine.setAttribute('y1', centerY);
    trackLine.setAttribute('x2', x2);
    trackLine.setAttribute('y2', centerY);
    trackLine.setAttribute('class', `track-line track-${status.state}`);

    // Tooltip events
    trackLine.addEventListener('mouseenter', (e) => {
      showMapTooltip(e, section, status, requests);
    });
    trackLine.addEventListener('mousemove', (e) => {
      moveMapTooltip(e);
    });
    trackLine.addEventListener('mouseleave', () => {
      hideMapTooltip();
    });

    svg.appendChild(trackLine);

    // Section code label above track
    const midX = (x1 + x2) / 2;
    const codeLabelY = centerY - 22;

    const codeText = document.createElementNS(svgNS, 'text');
    codeText.setAttribute('x', midX);
    codeText.setAttribute('y', codeLabelY);
    codeText.setAttribute('class', `track-section-code code-${status.state}`);
    codeText.textContent = section.code;
    svg.appendChild(codeText);

    // Status label below track
    const statusLabelY = centerY + 30;
    const statusText = document.createElementNS(svgNS, 'text');
    statusText.setAttribute('x', midX);
    statusText.setAttribute('y', statusLabelY);
    statusText.setAttribute('class', 'track-status-badge');
    statusText.setAttribute('fill',
      status.state === 'blocked' ? '#ef4444' :
      status.state === 'warning' ? '#f59e0b' : '#10b981'
    );
    statusText.textContent = status.label;
    svg.appendChild(statusText);
  }

  // ── Draw station nodes (on top of tracks) ──
  for (let i = 0; i < STATIONS.length; i++) {
    const station = STATIONS[i];
    const cx = paddingX + i * stationSpacing;
    const cy = centerY;

    const group = document.createElementNS(svgNS, 'g');
    group.setAttribute('class', 'station-node');

    // Outer glow ring
    const outer = document.createElementNS(svgNS, 'circle');
    outer.setAttribute('cx', cx);
    outer.setAttribute('cy', cy);
    outer.setAttribute('r', '14');
    outer.setAttribute('fill', 'rgba(59, 130, 246, 0.12)');
    outer.setAttribute('stroke', 'rgba(59, 130, 246, 0.3)');
    outer.setAttribute('stroke-width', '1');
    outer.setAttribute('class', 'station-outer');
    outer.setAttribute('filter', 'url(#station-glow)');
    group.appendChild(outer);

    // Inner circle
    const inner = document.createElementNS(svgNS, 'circle');
    inner.setAttribute('cx', cx);
    inner.setAttribute('cy', cy);
    inner.setAttribute('r', '7');
    inner.setAttribute('fill', '#1a2234');
    inner.setAttribute('stroke', '#3b82f6');
    inner.setAttribute('stroke-width', '2.5');
    inner.setAttribute('class', 'station-inner');
    group.appendChild(inner);

    // Station code label (above)
    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', cx);
    label.setAttribute('y', cy - 28);
    label.setAttribute('class', 'station-label');
    label.textContent = station.code;
    group.appendChild(label);

    // Station name label (below status text)
    const subLabel = document.createElementNS(svgNS, 'text');
    subLabel.setAttribute('x', cx);
    subLabel.setAttribute('y', cy + 48);
    subLabel.setAttribute('class', 'station-sublabel');
    subLabel.textContent = station.name;
    group.appendChild(subLabel);

    svg.appendChild(group);
  }

  svgWrapper.appendChild(svg);
  wrapper.appendChild(svgWrapper);

  return wrapper;
}

// ── Tooltip Management ──

function showMapTooltip(e, section, status, requests) {
  if (!tooltipEl) {
    tooltipEl = el('div', { className: 'route-map-tooltip' });
    document.body.appendChild(tooltipEl);
  }

  const sectionRequests = requests.filter(r => r.section_id === section.id);
  const pendingCount = sectionRequests.filter(r => r.status === 'pending').length;
  const criticalCount = sectionRequests.filter(r => r.severity === 'critical').length;

  const megaInfo = section.mega_day !== null
    ? `${dayName(section.mega_day)} · ${section.mega_duration_hours}h`
    : 'None';

  tooltipEl.innerHTML = `
    <div class="tip-title">${section.code} — ${section.name}</div>
    <div class="tip-row"><span>Nightly Window</span><span class="tip-val">${formatHour(section.window_start_hour)} · ${section.window_duration_hours}h</span></div>
    <div class="tip-row"><span>Mega Block</span><span class="tip-val">${megaInfo}</span></div>
    <div class="tip-row"><span>Slot Capacity</span><span class="tip-val">${section.slot_capacity} crews</span></div>
    <div class="tip-row"><span>Pending Tasks</span><span class="tip-val">${pendingCount}</span></div>
    <div class="tip-row"><span>Critical Tasks</span><span class="tip-val">${criticalCount}</span></div>
    <div><span class="tip-status status-${status.state}">${status.state === 'blocked' ? '🚫 ' : status.state === 'warning' ? '⚠️ ' : '✅ '}${status.reason}</span></div>
  `;

  moveMapTooltip(e);
  tooltipEl.classList.add('visible');
}

function moveMapTooltip(e) {
  if (!tooltipEl) return;
  const offsetX = 16;
  const offsetY = 16;
  let x = e.clientX + offsetX;
  let y = e.clientY + offsetY;

  // Keep tooltip in viewport
  const rect = tooltipEl.getBoundingClientRect();
  if (x + rect.width > window.innerWidth - 8) {
    x = e.clientX - rect.width - offsetX;
  }
  if (y + rect.height > window.innerHeight - 8) {
    y = e.clientY - rect.height - offsetY;
  }

  tooltipEl.style.left = x + 'px';
  tooltipEl.style.top = y + 'px';
}

function hideMapTooltip() {
  if (tooltipEl) {
    tooltipEl.classList.remove('visible');
  }
}

// ═══════════════════════════════════════════════
//  Original Section Card Helpers (preserved)
// ═══════════════════════════════════════════════

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
