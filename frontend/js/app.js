/* ═══════════════════════════════════════════════
   SIH26027 — App Entry Point
   Initializes store, registers routes, starts router
   ═══════════════════════════════════════════════ */

import { qs, el, showToast } from './utils.js';
import { initStore, regenerateMockData } from './mockApi.js';
import { getRole, setRole, getAllRoles, getRoleLabel } from './auth.js';
import * as router from './router.js';

// Page modules
import * as dashboardPage from './pages/dashboard.js';
import * as requestsPage  from './pages/requests.js';
import * as schedulePage   from './pages/schedule.js';
import * as comparePage    from './pages/compare.js';
import * as sectionsPage   from './pages/sections.js';

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  // Seed data on first load
  initStore();

  // Build role selector
  buildRoleSelector();

  // Register routes
  router.register('/dashboard', (el) => dashboardPage.render(el));
  router.register('/requests',  (el) => requestsPage.render(el));
  router.register('/schedule',  (el) => schedulePage.render(el));
  router.register('/compare',   (el) => comparePage.render(el));
  router.register('/sections',  (el) => sectionsPage.render(el));

  // Listen for nav clicks
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const route = link.dataset.route;
      if (route) router.navigate(route);
    });
  });

  // Listen for role changes — refresh current page
  window.addEventListener('roleChanged', () => {
    const current = router.getCurrentRoute();
    if (current) {
      const pageEl = qs('#page-' + current.slice(1));
      if (pageEl) {
        // Re-render current page
        const handlers = {
          '/dashboard': dashboardPage,
          '/requests':  requestsPage,
          '/schedule':  schedulePage,
          '/compare':   comparePage,
          '/sections':  sectionsPage,
        };
        handlers[current]?.render(pageEl);
      }
    }
  });

  // Reset data button
  const resetBtn = qs('#btn-reset-data');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      await regenerateMockData();
      showToast('Mock data regenerated', 'success');
      // Re-render current page
      window.dispatchEvent(new CustomEvent('roleChanged'));
    });
  }

  // Start router
  router.init();
});

function buildRoleSelector() {
  const container = qs('#role-selector-container');
  if (!container) return;

  const roles = getAllRoles();
  const select = el('select', {
    className: 'form-select',
    id: 'role-select',
    onChange: (e) => setRole(e.target.value),
  });

  for (const r of roles) {
    const opt = el('option', { value: r.key }, r.label);
    if (r.key === getRole()) opt.selected = true;
    select.appendChild(opt);
  }

  container.innerHTML = '';
  container.appendChild(
    el('div', { className: 'role-selector' },
      el('span', { className: 'role-label' }, 'Role:'),
      select
    )
  );
}
