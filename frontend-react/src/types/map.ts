import type { Department } from '../lib/types';
import type { Feature, LineString, Point, FeatureCollection } from 'geojson';

export type BlockStatus = 'open' | 'blocked' | 'scheduled' | 'integrated' | 'unknown';

export interface RailwaySectionProperties {
  id: string;
  line_name: string;
  section_code: string;
  status: BlockStatus;
  department: Department | null;
}

export interface RailwayStationProperties {
  id: string;
  name: string;
  code: string;
  line_id: string;
}

export interface BlockMarkerProperties {
  id: string;
  section: string;
  startTime: string;
  endTime: string;
  status: BlockStatus;
  departments: Department[];
  requests: string[];
}

export type RailwaySectionFeature = Feature<LineString, RailwaySectionProperties>;
export type RailwayStationFeature = Feature<Point, RailwayStationProperties>;
export type BlockMarkerFeature = Feature<Point, BlockMarkerProperties>;

export type RailwayNetworkGeoJSON = FeatureCollection<LineString, RailwaySectionProperties>;
export type StationsGeoJSON = FeatureCollection<Point, RailwayStationProperties>;
export type BlocksGeoJSON = FeatureCollection<Point, BlockMarkerProperties>;
