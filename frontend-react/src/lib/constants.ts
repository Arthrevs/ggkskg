// ============================================================
// Constants
// ============================================================

import type { Department, Severity } from './types';

export const DEPARTMENT_COLORS: Record<Department, string> = {
  'Engineering': '#3B82F6', // Blue
  'S&T': '#10B981',        // Green
  'TRD': '#F59E0B',        // Orange
};

export const DEPARTMENT_BG_COLORS: Record<Department, string> = {
  'Engineering': 'bg-blue-500',
  'S&T': 'bg-emerald-500',
  'TRD': 'bg-amber-500',
};

export const DEPARTMENT_TEXT_COLORS: Record<Department, string> = {
  'Engineering': 'text-blue-500',
  'S&T': 'text-emerald-500',
  'TRD': 'text-amber-500',
};

export const DEPARTMENT_BADGE_CLASSES: Record<Department, string> = {
  'Engineering': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'S&T': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'TRD': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#6B7280',
};

export const SEVERITY_BADGE_CLASSES: Record<Severity, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  scheduled: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  unscheduled: 'bg-red-500/15 text-red-400 border-red-500/30',
  completed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

export const MAP_COLORS = {
  active: '#EF4444',
  free: '#9CA3AF',
  multiDepartment: '#8B5CF6',
};

export const DEPARTMENTS: Department[] = ['Engineering', 'S&T', 'TRD'];
export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const API_BASE_URL = '/api';
