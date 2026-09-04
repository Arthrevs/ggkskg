/* ═══════════════════════════════════════════════
   SIH26027 — Role-Based Auth (Hackathon)
   Simple role selector — no real authentication.
   ═══════════════════════════════════════════════ */

const STORAGE_KEY = 'sih26027_role';

const ROLES = {
  planner:   { label: 'Planner / Admin',    canEdit: true,  canSchedule: true,  canSubmit: true  },
  requester: { label: 'Dept. Requester',     canEdit: true,  canSchedule: false, canSubmit: true  },
  viewer:    { label: 'Viewer (Read-only)',   canEdit: false, canSchedule: false, canSubmit: false },
};

let currentRole = localStorage.getItem(STORAGE_KEY) || 'planner';

export function getRole() {
  return currentRole;
}

export function getRoleLabel() {
  return ROLES[currentRole]?.label || 'Unknown';
}

export function setRole(role) {
  if (!ROLES[role]) return;
  currentRole = role;
  localStorage.setItem(STORAGE_KEY, role);
  // Dispatch custom event so pages can react
  window.dispatchEvent(new CustomEvent('roleChanged', { detail: { role } }));
}

export function canEdit() {
  return ROLES[currentRole]?.canEdit ?? false;
}

export function canRunSchedule() {
  return ROLES[currentRole]?.canSchedule ?? false;
}

export function canSubmit() {
  return ROLES[currentRole]?.canSubmit ?? false;
}

export function getAllRoles() {
  return Object.entries(ROLES).map(([key, val]) => ({ key, ...val }));
}
