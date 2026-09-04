/* ═══════════════════════════════════════════════
   SIH26027 — Dashboard Page
   KPI stat cards, recent requests, quick actions
   ═══════════════════════════════════════════════ */

import { el, qs, animateValue, severityBadge, statusBadge, truncateText, formatDate } from '../utils.js';
import * as api from '../mockApi.js';
import { canRunSchedule } from '../auth.js';
import { navigate } from '../router.js';

let initialized = false;

export async function render(container) {
  container.innerHTML = '';
  initialized = true;

  // Page header
  const header = el('div', { className: 'page-header' },
    el('h1', {},
      el('span', { className: 'icon' }, '📊'),
      'Dashboard'
    ),
    el('div', { className: 'flex gap-3' },
      canRunSchedule()
        ? el('button', { className: 'btn btn-primary', onClick: () => navigate('/schedule') },
            '⚡', ' Run Schedule')
        : el('span'),
      el('button', { className: 'btn btn-ghost', onClick: () => navigate('/requests') },
        '＋', ' New Request')
    )
  );

  container.appendChild(header);

  // Stats row
  const statsContainer = el('div', { className: 'dashboard-stats', id: 'dashboard-stats' });
  container.appendChild(statsContainer);

  // Grid: recent requests + sidebar info
  const grid = el('div', { className: 'dashboard-grid' },
    el('div', { id: 'recent-requests-card' }),
    el('div', { id: 'dashboard-sidebar' })
  );
  container.appendChild(grid);

  await loadDashboardData();
}

async function loadDashboardData() {
  const requests = await api.getRequests();
  const sections = await api.getSections();

  // Compute stats from current data
  const totalRequests  = requests.length;
  const pendingCount   = requests.filter(r => r.status === 'pending').length;
  const scheduledCount = requests.filter(r => r.status === 'scheduled').length;
  const criticalPending = requests.filter(r => r.severity === 'critical' && r.status !== 'scheduled').length;

  const totalHours = requests.reduce((sum, r) => sum + r.duration_hours, 0);

  // Render stat cards
  const statsEl = qs('#dashboard-stats');
  statsEl.innerHTML = '';

  const stats = [
    { icon: '📋', value: totalRequests,  label: 'Total Requests',      color: 'blue',    id: 'stat-total'     },
    { icon: '⏳', value: pendingCount,   label: 'Pending',             color: 'amber',   id: 'stat-pending'   },
    { icon: '✅', value: scheduledCount, label: 'Scheduled',           color: 'emerald', id: 'stat-scheduled' },
    { icon: '🚨', value: criticalPending,label: 'Critical Unscheduled',color: 'red',     id: 'stat-critical'  },
  ];

  for (const s of stats) {
    const valueEl = el('div', { className: 'stat-value', id: s.id }, '0');
    const card = el('div', { className: `stat-card ${s.color}` },
      el('div', { className: 'stat-icon' }, s.icon),
      valueEl,
      el('div', { className: 'stat-label' }, s.label)
    );
    statsEl.appendChild(card);
    // Animate on mount
    setTimeout(() => animateValue(valueEl, 0, s.value, 800), 100);
  }

  // Recent requests table
  const recentCard = qs('#recent-requests-card');
  const recent = requests.slice(0, 10);

  const thead = el('thead', {},
    el('tr', {},
      el('th', {}, 'Task'),
      el('th', {}, 'Section'),
      el('th', {}, 'Severity'),
      el('th', {}, 'Status'),
      el('th', {}, 'Created')
    )
  );

  const tbody = el('tbody', {});
  for (const req of recent) {
    const section = api.getSectionById(req.section_id);
    const row = el('tr', {},
      el('td', { className: 'truncate', style: 'max-width:220px' }, req.task_description),
      el('td', {},
        el('span', { className: 'font-mono text-xs' }, section ? section.code : req.section_id)
      ),
      el('td', {}, severityBadge(req.severity)),
      el('td', {}, statusBadge(req.status)),
      el('td', { className: 'text-xs text-tertiary' }, formatDate(req.created_at))
    );
    tbody.appendChild(row);
  }

  recentCard.innerHTML = '';
  recentCard.appendChild(
    el('div', { className: 'card' },
      el('div', { className: 'card-header' },
        el('span', { className: 'card-title' }, '🕐 Recent Requests'),
        el('button', { className: 'btn btn-ghost btn-sm', onClick: () => navigate('/requests') }, 'View All →')
      ),
      el('div', { className: 'table-wrapper' },
        el('table', { className: 'data-table' }, thead, tbody)
      )
    )
  );

  // Sidebar: quick info
  const sidebar = qs('#dashboard-sidebar');
  sidebar.innerHTML = '';

  // Section overview card
  const sectionList = el('div', { className: 'flex-col gap-3', style: 'margin-top: 0.5rem' });
  for (const s of sections) {
    const reqCount = requests.filter(r => r.section_id === s.id).length;
    sectionList.appendChild(
      el('div', { className: 'flex items-center justify-between', style: 'padding: 0.5rem 0; border-bottom: 1px solid var(--border-primary)' },
        el('div', {},
          el('span', { className: 'font-mono text-sm font-semibold' }, s.code),
          el('span', { className: 'text-xs text-tertiary', style: 'margin-left: 0.5rem' }, s.name)
        ),
        el('span', { className: 'badge badge-medium' }, `${reqCount}`)
      )
    );
  }

  sidebar.appendChild(
    el('div', { className: 'card' },
      el('div', { className: 'card-header' },
        el('span', { className: 'card-title' }, '🛤️ Sections')
      ),
      sectionList
    )
  );

  // Department breakdown card
  const departments = await api.getDepartments();
  const deptCard = el('div', { className: 'card', style: 'margin-top: 1.5rem' },
    el('div', { className: 'card-header' },
      el('span', { className: 'card-title' }, '🏢 By Department')
    )
  );
  const deptBody = el('div', { className: 'flex-col gap-3', style: 'margin-top: 0.5rem' });
  const colors = ['var(--dept-engineering)', 'var(--dept-snt)', 'var(--dept-traction)'];
  departments.forEach((dept, i) => {
    const count = requests.filter(r => r.department_id === dept.id).length;
    const pct = totalRequests > 0 ? Math.round(count / totalRequests * 100) : 0;
    deptBody.appendChild(
      el('div', {},
        el('div', { className: 'flex items-center justify-between mb-2' },
          el('span', { className: 'text-sm' }, dept.short_code),
          el('span', { className: 'text-xs text-tertiary' }, `${count} (${pct}%)`)
        ),
        el('div', { style: 'height: 4px; background: var(--bg-tertiary); border-radius: 999px; overflow: hidden' },
          el('div', { style: `height: 100%; width: ${pct}%; background: ${colors[i]}; border-radius: 999px; transition: width 0.6s ease` })
        )
      )
    );
  });
  deptCard.appendChild(deptBody);
  sidebar.appendChild(deptCard);
}

export function refresh() {
  if (initialized) {
    const container = qs('#page-dashboard');
    if (container) render(container);
  }
}
