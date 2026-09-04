/* ═══════════════════════════════════════════════
   SIH26027 — Requests Page
   Submit, list, filter, edit, delete maintenance requests
   ═══════════════════════════════════════════════ */

import { el, qs, qsa, severityBadge, statusBadge, deptBadge, formatDate, showToast, truncateText } from '../utils.js';
import * as api from '../mockApi.js';
import { canEdit, canSubmit, getRole } from '../auth.js';

let initialized = false;

export async function render(container) {
  container.innerHTML = '';
  initialized = true;

  const header = el('div', { className: 'page-header' },
    el('h1', {},
      el('span', { className: 'icon' }, '📝'),
      'Maintenance Requests'
    ),
    canSubmit()
      ? el('button', { className: 'btn btn-primary', id: 'btn-new-request', onClick: openNewModal },
          '＋', ' New Request')
      : el('span')
  );
  container.appendChild(header);

  // Filter bar
  const sections    = await api.getSections();
  const departments = await api.getDepartments();

  const sectionOpts = [el('option', { value: '' }, 'All Sections')];
  sections.forEach(s => sectionOpts.push(el('option', { value: s.id }, s.code)));

  const deptOpts = [el('option', { value: '' }, 'All Departments')];
  departments.forEach(d => deptOpts.push(el('option', { value: d.id }, d.short_code)));

  const filterBar = el('div', { className: 'filter-bar' },
    el('select', { className: 'form-select', id: 'filter-section', onChange: loadTable }, ...sectionOpts),
    el('select', { className: 'form-select', id: 'filter-dept', onChange: loadTable }, ...deptOpts),
    el('select', { className: 'form-select', id: 'filter-status', onChange: loadTable },
      el('option', { value: '' }, 'All Statuses'),
      el('option', { value: 'pending' }, 'Pending'),
      el('option', { value: 'scheduled' }, 'Scheduled'),
      el('option', { value: 'unscheduled' }, 'Unscheduled')
    ),
    el('select', { className: 'form-select', id: 'filter-severity', onChange: loadTable },
      el('option', { value: '' }, 'All Severities'),
      el('option', { value: 'critical' }, 'Critical'),
      el('option', { value: 'high' }, 'High'),
      el('option', { value: 'medium' }, 'Medium'),
      el('option', { value: 'low' }, 'Low')
    )
  );
  container.appendChild(filterBar);

  // Table container
  container.appendChild(el('div', { id: 'requests-table-container' }));

  // Modal (hidden)
  container.appendChild(buildModal(sections, departments));

  await loadTable();
}

async function loadTable() {
  const container = qs('#requests-table-container');
  if (!container) return;

  const filters = {
    section:    qs('#filter-section')?.value || undefined,
    department: qs('#filter-dept')?.value || undefined,
    status:     qs('#filter-status')?.value || undefined,
    severity:   qs('#filter-severity')?.value || undefined,
  };

  // Clean undefined values
  Object.keys(filters).forEach(k => { if (!filters[k]) delete filters[k]; });

  const requests = await api.getRequests(filters);

  const thead = el('thead', {},
    el('tr', {},
      el('th', {}, 'Task'),
      el('th', {}, 'Section'),
      el('th', {}, 'Department'),
      el('th', {}, 'Severity'),
      el('th', {}, 'Overdue'),
      el('th', {}, 'Duration'),
      el('th', {}, 'Status'),
      el('th', {}, 'Created'),
      canEdit() ? el('th', {}, 'Actions') : el('th')
    )
  );

  const tbody = el('tbody', {});

  if (requests.length === 0) {
    tbody.appendChild(
      el('tr', {},
        el('td', { colspan: '9', className: 'text-center text-tertiary', style: 'padding: 3rem' },
          'No requests match your filters')
      )
    );
  }

  for (const req of requests) {
    const section = api.getSectionById(req.section_id);
    const dept    = api.getDepartmentById(req.department_id);

    const actions = canEdit()
      ? el('td', { className: 'actions-cell' },
          el('button', { className: 'btn btn-ghost btn-sm', onClick: () => openEditModal(req) }, '✏️'),
          el('button', { className: 'btn btn-ghost btn-sm', onClick: () => handleDelete(req.id) }, '🗑️')
        )
      : el('td');

    const row = el('tr', {},
      el('td', { style: 'max-width: 200px' }, truncateText(req.task_description, 40)),
      el('td', {}, el('span', { className: 'font-mono text-xs' }, section ? section.code : '—')),
      el('td', {}, dept ? deptBadge(dept.name) : el('span', {}, '—')),
      el('td', {}, severityBadge(req.severity)),
      el('td', { className: 'font-mono text-sm' }, `${req.overdue_days}d`),
      el('td', { className: 'font-mono text-sm' }, `${req.duration_hours}h`),
      el('td', {}, statusBadge(req.status)),
      el('td', { className: 'text-xs text-tertiary' }, formatDate(req.created_at)),
      actions
    );
    tbody.appendChild(row);
  }

  container.innerHTML = '';
  container.appendChild(
    el('div', { className: 'table-wrapper' },
      el('table', { className: 'data-table' }, thead, tbody)
    )
  );
}

// ── Modal ──
function buildModal(sections, departments) {
  const sectionOpts = sections.map(s => el('option', { value: s.id }, `${s.code} — ${s.name}`));
  const deptOpts    = departments.map(d => el('option', { value: d.id }, d.name));

  const overlay = el('div', { className: 'modal-overlay', id: 'request-modal' },
    el('div', { className: 'modal' },
      el('div', { className: 'modal-header' },
        el('h3', { id: 'modal-title' }, 'New Request'),
        el('button', { className: 'modal-close', onClick: closeModal }, '✕')
      ),
      el('div', { className: 'modal-body' },
        el('input', { type: 'hidden', id: 'modal-request-id' }),
        el('div', { className: 'form-group' },
          el('label', { className: 'form-label' }, 'Section'),
          el('select', { className: 'form-select', id: 'modal-section' }, ...sectionOpts)
        ),
        el('div', { className: 'form-group' },
          el('label', { className: 'form-label' }, 'Department'),
          el('select', { className: 'form-select', id: 'modal-dept' }, ...deptOpts)
        ),
        el('div', { className: 'form-group' },
          el('label', { className: 'form-label' }, 'Task Description'),
          el('textarea', { className: 'form-textarea', id: 'modal-task', placeholder: 'Describe the maintenance task...' })
        ),
        el('div', { className: 'form-row' },
          el('div', { className: 'form-group' },
            el('label', { className: 'form-label' }, 'Severity'),
            el('select', { className: 'form-select', id: 'modal-severity' },
              el('option', { value: 'low' }, 'Low'),
              el('option', { value: 'medium', selected: true }, 'Medium'),
              el('option', { value: 'high' }, 'High'),
              el('option', { value: 'critical' }, 'Critical')
            )
          ),
          el('div', { className: 'form-group' },
            el('label', { className: 'form-label' }, 'Duration (hours)'),
            el('input', { type: 'number', className: 'form-input', id: 'modal-duration', value: '1', min: '0.5', max: '8', step: '0.5' })
          )
        ),
        el('div', { className: 'form-group' },
          el('label', { className: 'form-label' }, 'Overdue Days'),
          el('input', { type: 'number', className: 'form-input', id: 'modal-overdue', value: '0', min: '0', max: '90' })
        )
      ),
      el('div', { className: 'modal-footer' },
        el('button', { className: 'btn btn-ghost', onClick: closeModal }, 'Cancel'),
        el('button', { className: 'btn btn-primary', id: 'modal-save-btn', onClick: handleSave }, 'Save Request')
      )
    )
  );

  return overlay;
}

function openNewModal() {
  qs('#modal-title').textContent = 'New Request';
  qs('#modal-request-id').value  = '';
  qs('#modal-task').value        = '';
  qs('#modal-severity').value    = 'medium';
  qs('#modal-duration').value    = '1';
  qs('#modal-overdue').value     = '0';
  qs('#request-modal').classList.add('open');
}

function openEditModal(req) {
  qs('#modal-title').textContent = 'Edit Request';
  qs('#modal-request-id').value  = req.id;
  qs('#modal-section').value     = req.section_id;
  qs('#modal-dept').value        = req.department_id;
  qs('#modal-task').value        = req.task_description;
  qs('#modal-severity').value    = req.severity;
  qs('#modal-duration').value    = req.duration_hours;
  qs('#modal-overdue').value     = req.overdue_days;
  qs('#request-modal').classList.add('open');
}

function closeModal() {
  qs('#request-modal').classList.remove('open');
}

async function handleSave() {
  const id = qs('#modal-request-id').value;
  const data = {
    section_id:       qs('#modal-section').value,
    department_id:    qs('#modal-dept').value,
    task_description: qs('#modal-task').value.trim(),
    severity:         qs('#modal-severity').value,
    duration_hours:   qs('#modal-duration').value,
    overdue_days:     qs('#modal-overdue').value,
  };

  if (!data.task_description) {
    showToast('Please enter a task description', 'error');
    return;
  }

  try {
    if (id) {
      await api.updateRequest(id, data);
      showToast('Request updated', 'success');
    } else {
      await api.createRequest(data);
      showToast('Request created', 'success');
    }
    closeModal();
    await loadTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDelete(id) {
  if (!confirm('Delete this request?')) return;
  try {
    await api.deleteRequest(id);
    showToast('Request deleted', 'success');
    await loadTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

export function refresh() {
  if (initialized) loadTable();
}
