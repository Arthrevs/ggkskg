/* ═══════════════════════════════════════════════
   SIH26027 — Hash-Based SPA Router
   ═══════════════════════════════════════════════ */

import { qs, qsa } from './utils.js';

const routes = {};
let currentRoute = null;

/**
 * Register a route.
 * @param {string} path — e.g. '/dashboard'
 * @param {Function} handler — called when route becomes active; receives page container element
 */
export function register(path, handler) {
  routes[path] = handler;
}

/**
 * Navigate to a route programmatically.
 */
export function navigate(path) {
  window.location.hash = '#' + path;
}

/**
 * Initialize the router — call once after all routes are registered.
 */
export function init() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || '/dashboard';

  // Hide all pages
  qsa('.page').forEach(p => p.classList.remove('active'));

  // Deactivate all nav links
  qsa('.nav-link').forEach(link => link.classList.remove('active'));

  // Show the target page
  const pageId = 'page-' + hash.slice(1); // '/dashboard' → 'page-dashboard'
  const pageEl = qs('#' + pageId);
  if (pageEl) {
    pageEl.classList.add('active');
  }

  // Activate the matching nav link
  const navLink = qs(`.nav-link[data-route="${hash}"]`);
  if (navLink) navLink.classList.add('active');

  // Call handler
  if (routes[hash]) {
    if (hash !== currentRoute) {
      routes[hash](pageEl);
    }
    currentRoute = hash;
  } else {
    // Default to dashboard
    navigate('/dashboard');
  }
}

export function getCurrentRoute() {
  return currentRoute;
}
