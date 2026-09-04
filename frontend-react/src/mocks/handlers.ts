// ============================================================
// MSW Handlers — Mock API for all endpoints
// ============================================================

import { http, HttpResponse, delay } from 'msw';
import {
  MOCK_REQUESTS,
  MOCK_SECTIONS,
  MOCK_MANUAL_SCHEDULE,
  MOCK_OPTIMIZED_SCHEDULE,
  MOCK_COMPARISON,
  MOCK_STATS,
} from './data';
import type { MaintenanceRequest, CreateRequestPayload } from '../lib/types';

let requests = [...MOCK_REQUESTS];
let nextId = requests.length + 1;

export const handlers = [
  // ── Requests CRUD ──────────────────────────────────────────
  http.get('/api/requests', async () => {
    await delay(300);
    return HttpResponse.json(requests);
  }),

  http.post('/api/requests', async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as CreateRequestPayload;
    const newReq: MaintenanceRequest = {
      id: `REQ-${String(nextId++).padStart(3, '0')}`,
      ...body,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    requests = [newReq, ...requests];
    return HttpResponse.json(newReq, { status: 201 });
  }),

  http.put('/api/requests/:id', async ({ params, request }) => {
    await delay(300);
    const { id } = params;
    const body = (await request.json()) as Partial<MaintenanceRequest>;
    requests = requests.map(r => (r.id === id ? { ...r, ...body } : r));
    const updated = requests.find(r => r.id === id);
    return updated
      ? HttpResponse.json(updated)
      : HttpResponse.json({ error: 'Not found' }, { status: 404 });
  }),

  http.delete('/api/requests/:id', async ({ params }) => {
    await delay(200);
    const { id } = params;
    requests = requests.filter(r => r.id !== id);
    return HttpResponse.json({ success: true });
  }),

  // ── Schedule ───────────────────────────────────────────────
  http.post('/api/schedule/run', async () => {
    await delay(1500); // Simulate solver time
    return HttpResponse.json({ success: true, schedule: MOCK_OPTIMIZED_SCHEDULE });
  }),

  http.get('/api/schedule/:week', async ({ request }) => {
    await delay(400);
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || 'optimized';
    const schedule = mode === 'manual' ? MOCK_MANUAL_SCHEDULE : MOCK_OPTIMIZED_SCHEDULE;
    return HttpResponse.json(schedule);
  }),

  http.get('/api/schedule/compare', async () => {
    await delay(500);
    return HttpResponse.json(MOCK_COMPARISON);
  }),

  // ── Stats ──────────────────────────────────────────────────
  http.get('/api/stats/summary', async () => {
    await delay(300);
    return HttpResponse.json(MOCK_STATS);
  }),

  // ── Sections ───────────────────────────────────────────────
  http.get('/api/sections', async () => {
    await delay(200);
    return HttpResponse.json(MOCK_SECTIONS);
  }),

  // ── Mock Data Generator ────────────────────────────────────
  http.post('/api/mock-data/generate', async () => {
    await delay(800);
    return HttpResponse.json({ success: true, message: 'Mock data regenerated' });
  }),
];
