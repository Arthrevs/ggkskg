// ============================================================
// TanStack Query hooks for all API endpoints
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type {
  MaintenanceRequest,
  CreateRequestPayload,
  Schedule,
  ScheduleComparison,
  ScheduleMode,
  Section,
  StatsSummary,
} from '../lib/types';

// ── Query Keys ───────────────────────────────────────────────
export const queryKeys = {
  requests: ['requests'] as const,
  schedule: (week: string, mode: ScheduleMode) => ['schedule', week, mode] as const,
  compare: ['schedule', 'compare'] as const,
  stats: ['stats'] as const,
  sections: ['sections'] as const,
};

// ── Requests ─────────────────────────────────────────────────
export function useRequests() {
  return useQuery({
    queryKey: queryKeys.requests,
    queryFn: async () => {
      const { data } = await apiClient.get<MaintenanceRequest[]>('/requests');
      return data;
    },
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRequestPayload) => {
      const { data } = await apiClient.post<MaintenanceRequest>('/requests', payload);
      return data;
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
      const { data } = await apiClient.put<MaintenanceRequest>(`/requests/${id}`, payload);
      return data;
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

export function useCompareSchedules() {
  return useQuery({
    queryKey: queryKeys.compare,
    queryFn: async () => {
      const { data } = await apiClient.get<ScheduleComparison>('/schedule/compare');
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
