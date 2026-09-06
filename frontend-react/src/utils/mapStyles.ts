import type { PathOptions } from 'leaflet';
import type { RailwaySectionFeature, BlockStatus } from '../types/map';

export const STATUS_COLORS: Record<BlockStatus, string> = {
  open: '#22c55e',       // green-500
  blocked: '#ef4444',    // red-500
  scheduled: '#eab308',  // yellow-500
  integrated: '#a855f7', // purple-500
  unknown: '#94a3b8'     // slate-400
};

export function getRouteStyle(feature?: RailwaySectionFeature): PathOptions {
  if (!feature) {
    return { color: STATUS_COLORS.unknown, weight: 3, opacity: 0.5 };
  }

  const status = feature.properties.status || 'unknown';
  const color = STATUS_COLORS[status] || STATUS_COLORS.unknown;
  
  // Make the line thicker if there's any active block/schedule
  const weight = status === 'open' ? 4 : 6;
  const opacity = status === 'open' ? 0.7 : 0.9;
  
  return {
    color,
    weight,
    opacity,
    lineCap: 'round',
    lineJoin: 'round'
  };
}
