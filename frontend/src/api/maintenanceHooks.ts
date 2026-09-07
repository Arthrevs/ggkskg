// ============================================================
// TanStack Query hooks for all API endpoints
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './maintenanceClient';
import type {
  MaintenanceRequest,
  CreateRequestPayload,
  Schedule,
  ScheduleComparison,
  ScheduleMode,
  Section,
  StatsSummary,
  Department,
} from '../lib/types';

// ── Query Keys ───────────────────────────────────────────────
export const queryKeys = {
  requests: ['requests'] as const,
  schedule: (week: string, mode: ScheduleMode) => ['schedule', week, mode] as const,
  compare: ['schedule', 'compare'] as const,
  stats: ['stats'] as const,
  sections: ['sections'] as const,
};

// ── Mappers for Frontend <-> Backend Schema Mismatch ──────────
const DEPT_MAP: Record<number, Department> = { 1: 'Engineering', 2: 'S&T', 3: 'TRD' };
const DEPT_ID_MAP: Record<string, number> = { 'Engineering': 1, 'S&T': 2, 'TRD': 3 };

const SECTION_MAP: Record<number, string> = {
  16: 'Delhi Junction – Agra Cantt', 17: 'Mumbai CST – Pune Jn', 18: 'Chennai Central – Bangalore City',
  19: 'Howrah Jn – Kharagpur Jn', 20: 'Lucknow NR – Varanasi Jn', 21: 'Jaipur Jn – Ajmer Jn',
  22: 'Secunderabad – Kazipet Jn', 23: 'Patna Jn – Gaya Jn', 24: 'Bhopal Jn – Itarsi Jn',
  25: 'Visakhapatnam – Vijayawada Jn', 26: 'Coimbatore Jn – Erode Jn', 27: 'Kanpur Central – Allahabad Jn',
  28: 'Nagpur Jn – Wardha Jn', 29: 'Ahmedabad Jn – Vadodara Jn', 30: 'Guwahati – New Jalpaiguri'
};
const SECTION_ID_MAP = Object.fromEntries(Object.entries(SECTION_MAP).map(([id, name]) => [name, parseInt(id)]));

function mapToFrontendReq(backendReq: any): MaintenanceRequest {
  return {
    id: String(backendReq.id),
    section: SECTION_MAP[backendReq.sectionId] || `Section ${backendReq.sectionId}`,
    department: DEPT_MAP[backendReq.departmentId] || 'Engineering',
    description: backendReq.taskDescription,
    duration: backendReq.durationMinutes,
    severity: backendReq.severity,
    overdueDays: backendReq.overdueDays,
    status: backendReq.status,
    createdAt: backendReq.createdAt,
  };
}

function mapToBackendPayload(frontendPayload: any) {
  return {
    sectionId: SECTION_ID_MAP[frontendPayload.section] || 21,
    departmentId: DEPT_ID_MAP[frontendPayload.department] || 1,
    taskDescription: frontendPayload.description,
    durationMinutes: frontendPayload.duration,
    severity: frontendPayload.severity,
    overdueDays: frontendPayload.overdueDays,
  };
}

// ── Requests ─────────────────────────────────────────────────
export function useRequests() {
  return useQuery({
    queryKey: queryKeys.requests,
    queryFn: async () => {
      const { data } = await apiClient.get<any[]>('/requests');
      return data.map(mapToFrontendReq);
    },
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRequestPayload) => {
      const { data } = await apiClient.post<any>('/requests', mapToBackendPayload(payload));
      return mapToFrontendReq(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests });
    },
  });
}

export function useUpdateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<MaintenanceRequest> & { id: string }) => {
      const { data } = await apiClient.put<any>(`/requests/${id}`, mapToBackendPayload(payload));
      return mapToFrontendReq(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests });
    },
  });
}

export function useDeleteRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/requests/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.requests });
    },
  });
}

// ── Schedule ─────────────────────────────────────────────────
export function useRunSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/schedule/run');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
}

export function useSchedule(week: string, mode: ScheduleMode) {
  return useQuery({
    queryKey: queryKeys.schedule(week, mode),
    queryFn: async () => {
      const { data } = await apiClient.get<Schedule>(`/schedule/${week}`, {
        params: { mode },
      });
      return data;
    },
  });
}

export function useCompareSchedules(week: string) {
  return useQuery({
    queryKey: [...queryKeys.compare, week],
    queryFn: async () => {
      const { data } = await apiClient.get<ScheduleComparison>(`/schedule/compare?week_start_date=${week}`);
      return data;
    },
  });
}

// ── Stats ────────────────────────────────────────────────────
export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: async () => {
      const { data } = await apiClient.get<StatsSummary>('/stats/summary');
      return data;
    },
  });
}

// ── Sections ─────────────────────────────────────────────────
export function useSections() {
  return useQuery({
    queryKey: queryKeys.sections,
    queryFn: async () => {
      const { data } = await apiClient.get<Section[]>('/sections');
      return data;
    },
  });
}

// ── Mock Data Generator ──────────────────────────────────────
export function useGenerateMockData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/mock-data/generate');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
