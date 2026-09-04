// ============================================================
// Railway Maintenance Block Scheduling System — Type Definitions
// ============================================================

export type Department = 'Engineering' | 'S&T' | 'TRD';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type RequestStatus = 'pending' | 'scheduled' | 'unscheduled' | 'completed';
export type ScheduleMode = 'manual' | 'optimized';

export interface MaintenanceRequest {
  id: string;
  section: string;
  department: Department;
  description: string;
  duration: number; // minutes
  severity: Severity;
  overdueDays: number;
  status: RequestStatus;
  createdAt: string;
}

export interface CreateRequestPayload {
  section: string;
  department: Department;
  description: string;
  duration: number;
  severity: Severity;
  overdueDays: number;
}

export interface BlockWindow {
  id: string;
  day: string; // e.g., "Monday"
  startTime: string; // e.g., "02:00"
  endTime: string; // e.g., "05:00"
  section: string;
}

export interface ScheduleEntry {
  blockWindow: BlockWindow;
  assignedRequests: MaintenanceRequest[];
  departments: Department[];
}

export interface Schedule {
  id: string;
  mode: ScheduleMode;
  week: string;
  entries: ScheduleEntry[];
  stats: ScheduleStats;
}

export interface ScheduleStats {
  totalWindowsUsed: number;
  totalRequestsScheduled: number;
  criticalRequestsCovered: number;
  unscheduledRequests: number;
  totalHoursScheduled: number;
}

export interface ScheduleComparison {
  manual: Schedule;
  optimized: Schedule;
  improvements: {
    windowsSaved: number;
    additionalRequestsScheduled: number;
    criticalCoverageImprovement: number;
    percentImprovement: number;
  };
}

export interface Section {
  id: string;
  name: string;
  zone: string;
  coordinates: [number, number][]; // lat, lng pairs for polyline
}

export interface StatsSummary {
  totalHoursScheduled: number;
  windowsUsed: number;
  colocatedBlocks: number;
  solverTimeMs: number;
  requestsByDepartment: Record<Department, number>;
  requestsBySeverity: Record<Severity, number>;
  requestsOverTime: { date: string; count: number }[];
  departmentWorkload: { department: Department; hours: number; requests: number }[];
}

export interface MapSection extends Section {
  status: 'active' | 'free' | 'multi-department';
  currentBlock?: {
    startTime: string;
    endTime: string;
    requests: MaintenanceRequest[];
    departments: Department[];
  };
}

// Toast notification types
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}
