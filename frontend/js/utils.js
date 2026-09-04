/* ═══════════════════════════════════════════════
   SIH26027 — Utility Helpers
   DOM helpers, formatting, priority weights
   ═══════════════════════════════════════════════ */

// ── DOM Helpers ──
export const qs  = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * Create a DOM element with optional attributes and children.
 * @param {string} tag
 * @param {Object} attrs — key/value pairs set as attributes (class, id, etc.)
 * @param  {...(string|Node)} children
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    }
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else if (c instanceof Node) node.appendChild(c);
  }
  return node;
}

// ── Priority Weight (matches PRD §6.2 formula) ──
const SEVERITY_WEIGHTS = { critical: 100, high: 60, medium: 30, low: 10 };

export function priorityWeight(request) {
  const sw = SEVERITY_WEIGHTS[request.severity] || 10;
  return sw * 100 + (request.overdue_days || 0) * 2;
}

// ── Badge Renderers ──
export function severityBadge(severity) {
  return el('span', { className: `badge badge-${severity}` }, severity);
}

export function statusBadge(status) {
  return el('span', { className: `badge badge-${status}` }, status);
}

const DEPT_CLASS_MAP = {
  'Engineering':            'badge-dept-eng',
  'Signal & Telecom':       'badge-dept-snt',
  'Traction Distribution':  'badge-dept-trd',
};

export function deptBadge(deptName) {
  const cls = DEPT_CLASS_MAP[deptName] || 'badge-dept-eng';
  return el('span', { className: `badge ${cls}` }, deptName);
}

export function deptChipClass(deptName) {
  if (deptName === 'Engineering')           return 'dept-eng';
  if (deptName === 'Signal & Telecom')      return 'dept-snt';
  if (deptName === 'Traction Distribution') return 'dept-trd';
  return 'dept-eng';
}

// ── Date Helpers ──
export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toISODate(date) {
  return date.toISOString().split('T')[0];
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function dayName(index) {
  return DAY_NAMES[index] || '';
}

// ── Number Animation ──
export function animateValue(element, start, end, duration = 600) {
  if (start === end) { element.textContent = end; return; }
  const range = end - start;
  const startTime = performance.now();
  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.round(start + range * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Toast Notifications ──
let toastContainer = null;

export function showToast(message, type = 'info') {
  if (!toastContainer) {
    toastContainer = el('div', { className: 'toast-container' });
    document.body.appendChild(toastContainer);
  }
  const icons = { success: '✓', error: '✗', info: 'ℹ' };
  const toast = el('div', { className: `toast ${type}` },
    el('span', {}, icons[type] || 'ℹ'),
    el('span', {}, message)
  );
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Misc ──
export function truncateText(text, maxLen = 50) {
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
