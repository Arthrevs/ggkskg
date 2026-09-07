const API_BASE = '/api';

export interface Department {
  id: number;
  name: string;
  code: string;
}

export interface Section {
  id: number;
  name: string;
  length_km: number;
}

export interface WorkType {
  id: number;
  name: string;
  requires_traffic_block: boolean;
  requires_power_block: boolean;
}

export interface MaintenanceRequest {
  id: number;
  department_id: number;
  section_id: number;
  work_type_id: number;
  work_type?: WorkType;
  duration_minutes: number;
  priority: string;
  status: string;
  created_at: string;
}

export interface StatsSummary {
  total_requests: number;
  pending_requests: number;
  scheduled_requests: number;
  completed_requests: number;
  total_maintenance_hours: number;
  total_disruption_score: number;
  department_stats: Record<string, number>;
  priority_stats: Record<string, number>;
}

export async function fetchStatsSummary(): Promise<StatsSummary> {
  const res = await fetch(`${API_BASE}/stats/summary`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchMaintenanceRequests(): Promise<MaintenanceRequest[]> {
  const res = await fetch(`${API_BASE}/requests`);
  if (!res.ok) throw new Error('Failed to fetch requests');
  return res.json();
}

export async function triggerOptimizer(weekStartDate: string): Promise<any> {
  const res = await fetch(`${API_BASE}/schedules/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_date: weekStartDate,
      weights: { priority: 10, disruption: -5, asset_criticality: 5 }
    })
  });
  if (!res.ok) throw new Error('Failed to run optimizer');
  return res.json();
}
