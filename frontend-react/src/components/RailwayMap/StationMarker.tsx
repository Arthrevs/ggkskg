import { CircleMarker, Popup } from 'react-leaflet';
import type { RailwayStationFeature } from '../../types/map';

interface StationMarkerProps {
  station: RailwayStationFeature;
}

export function StationMarker({ station }: StationMarkerProps) {
  const [lng, lat] = station.geometry.coordinates;

  return (
    <CircleMarker
      center={[lat, lng]}
      radius={6}
      pathOptions={{
        color: '#1e293b', // slate-800
        weight: 2,
        fillColor: '#ffffff',
        fillOpacity: 1,
      }}
    >
      <Popup>
        <div className="text-sm min-w-[200px]">
          <h4 className="font-bold text-slate-900 mb-1">{station.properties.name}</h4>
          <p className="text-xs text-slate-500 mb-2 font-mono">{station.properties.code}</p>
          <div className="border-t border-slate-200 pt-2">
            <p className="text-xs font-medium text-slate-700">Line ID: {station.properties.line_id}</p>
            <p className="text-xs text-slate-500 mt-1">Status: Operational</p>
          </div>
        </div>
      </Popup>
    </CircleMarker>
  );
}
