export interface StationNode {
  id: string;
  name: string;
  code: string;
  km: number;
  lat: number;
  lng: number;
  type: string;
  platforms: number;
}

export interface TrackEdge {
  id: string;
  source: string;
  target: string;
  direction: string;
  distance_km: number;
  capacity: number;
  line_type: string;
  km_start: number;
  km_end: number;
}

export interface NetworkGraph {
  nodes: StationNode[];
  edges: TrackEdge[];
}

export interface TrainScheduleEntry {
  station_id: string;
  station_name: string;
  km: number;
  arrival_time: string | null;
  departure_time: string | null;
  arrival_minutes: number | null;
  departure_minutes: number | null;
  delay_minutes: number | null;
}

export interface Train {
  train_id: string;
  train_name: string;
  source: string;
  destination: string;
  direction: string;
  priority: 'high' | 'medium' | 'low';
  priority_weight: number;
  category: string;
  total_travel_minutes: number;
  schedule: TrainScheduleEntry[];
  delay_minutes: number | null;
}

export interface TimetableResponse {
  corridor: string;
  date: string;
  trains: Train[];
}

export interface Defect {
  defect_id: string;
  department: string;
  department_full: string;
  description: string;
  km_location: number;
  section_from: string;
  section_to: string;
  severity: string;
  duration_minutes: number;
  equipment_required: string[];
  crew_size: number;
  overdue_days: number;
}

export interface MegaBlockCluster {
  cluster_id: string;
  defect_ids: string[];
  km_start: number;
  km_end: number;
  duration_minutes: number;
  departments: string[];
  is_mega_block: boolean;
  severity: string;
  affected_segments: string[][]; // [["JP", "JOB"], ["JOB", "FL"]]
}

export interface DefectsResponse {
  defects: Defect[];
  clusters: MegaBlockCluster[];
}

export interface BlockScheduleEntry {
  cluster_id: string;
  defect_ids: string[];
  km_start: number;
  km_end: number;
  duration_minutes: number;
  departments: string[];
  is_mega_block: boolean;
  severity: string;
  affected_segments: string[][];
  scheduled_start_minutes: number;
  scheduled_end_minutes: number;
  scheduled_start_time: string;
  scheduled_end_time: string;
}

export interface SolverStats {
  total_weighted_delay: number;
  trains_delayed: number;
  trains_unaffected: number;
  max_single_delay_minutes: number;
  mega_blocks_formed: number;
  total_clusters: number;
  total_defects: number;
}

export interface SolverResponse {
  status: string;
  objective_value: number | null;
  solve_time_seconds: number | null;
  optimized_timetable: TimetableResponse | null;
  block_schedule: BlockScheduleEntry[] | null;
  clusters: MegaBlockCluster[];
  stats: SolverStats | null;
  error: string | null;
}
