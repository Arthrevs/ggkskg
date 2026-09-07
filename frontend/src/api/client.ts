export interface StationNode {
  id: string;
  name: string;
  code: string;
  km: number;
  lat: number;
  lng: number;
  type: string;
  platforms: number;
  loops?: number; // TOPOLOGIC: Number of track loops at this station
}

export interface TrackEdge {
  id: string;
  source: string;
  target: string;
  direction: 'UP' | 'DN';
  distance: number;
  capacity: number;
  line_type: string;
  km_start: number;
  km_end: number;
  tracks?: number; // TOPOLOGIC: Number of tracks in this block section
}

export interface ScheduleEntry {
  station_code: string;
  station_name: string;
  km: number;
  arrival_time: string | null;
  departure_time: string | null;
  arrival_minutes: number | null;
  departure_minutes: number | null;
  delay_minutes?: number;
}

export interface Train {
  train_id: string;
  train_name: string;
  source: string;
  destination: string;
  direction: string;
  priority: string;
  priority_weight: number;
  category: string;
  total_travel_minutes: number;
  schedule: ScheduleEntry[];
  delay_minutes?: number;
}

export interface MegaBlock {
  cluster_id: string;
  defect_ids: string[];
  km_start: number;
  km_end: number;
  duration_minutes: number;
  departments: string[];
  is_mega_block: boolean;
  severity: string;
  affected_segments: [string, string][];
  scheduled_start_minutes: number;
  scheduled_end_minutes: number;
  scheduled_start_time: string;
  scheduled_end_time: string;
}

export interface SolverResponse {
  status: string;
  objective_value: number;
  solve_time_seconds: number;
  optimized_timetable: {
    corridor: string;
    date: string;
    trains: Train[];
  };
  block_schedule: MegaBlock[];
  stats: {
    total_weighted_delay: number;
    trains_delayed: number;
    trains_unaffected: number;
    max_single_delay_minutes: number;
    mega_blocks_formed: number;
    total_clusters: number;
    total_defects: number;
  };
  tracks: {
    nodes: StationNode[];
    edges: TrackEdge[];
  };
}

export interface RouteGeometry {
  source: string;
  target: string;
  distance_km: number;
  geometry: {
    type: 'LineString';
    coordinates: number[][];
  };
}

export interface CorridorData {
  source: string;
  destination: string;
  nodes: StationNode[];
  edges: TrackEdge[];
  trains: Train[];
  route_geometries: RouteGeometry[];
}

export const fetchStations = async (): Promise<{ code: string, name: string }[]> => {
  const res = await fetch('/api/stations');
  if (!res.ok) throw new Error("Failed to fetch stations");
  return res.json();
};

export interface CorridorOption {
  source: string;
  destination: string;
  source_name: string;
  destination_name: string;
  train_count: number;
  label: string;
}

export const fetchCorridors = async (): Promise<CorridorOption[]> => {
  const res = await fetch('/api/corridors');
  if (!res.ok) throw new Error("Failed to fetch corridor list");
  return res.json();
};

export const fetchCorridor = async (src: string, dst: string): Promise<CorridorData> => {
  const res = await fetch(`/api/corridor/${src}/${dst}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to fetch corridor data");
  }
  return res.json();
};

export const runSolver = async (corridor: CorridorData): Promise<SolverResponse> => {
  // Generate a dummy defect on the first segment just to prove the solver blocking works
  const defects = [];
  if (corridor.nodes.length >= 2) {
    defects.push({
      defect_id: "DUMMY-001",
      department: "TMS",
      description: "Sample track maintenance",
      km_location: (corridor.nodes[0].km + corridor.nodes[1].km) / 2,
      section_from: corridor.nodes[0].id,
      section_to: corridor.nodes[1].id,
      severity: "high",
      duration_minutes: 120,
      equipment_required: [],
      crew_size: 5,
      overdue_days: 1
    });
  }

  const payload = {
    nodes: corridor.nodes,
    edges: corridor.edges,
    trains: corridor.trains,
    defects: defects
  };

  const res = await fetch('/api/solve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    throw new Error("Solver failed");
  }
  return res.json();
};
