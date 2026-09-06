import { CircleMarker, Popup } from 'react-leaflet';
import type { BlockMarkerFeature } from '../../types/map';
import { STATUS_COLORS } from '../../utils/mapStyles';
import { DEPARTMENT_COLORS } from '../../lib/constants';

interface BlockMarkerProps {
  block: BlockMarkerFeature;
}

export function BlockMarker({ block }: BlockMarkerProps) {
  const [lng, lat] = block.geometry.coordinates;
  const { properties } = block;

  return (
    <CircleMarker
      center={[lat, lng]}
      radius={8}
      pathOptions={{
        color: '#ffffff',
        weight: 2,
        fillColor: STATUS_COLORS[properties.status] || STATUS_COLORS.unknown,
        fillOpacity: 1,
      }}
    >
      <Popup>
        <div className="text-sm min-w-[240px]">
          <h4 className="font-bold text-slate-900 mb-2">Block {properties.id}</h4>
          
          <div className="border-t border-slate-200 pt-2 mb-2">
            <p className="text-xs font-medium text-slate-700 mb-1">
              Section: <span className="font-mono">{properties.section}</span>
            </p>
            <p className="text-xs font-medium text-slate-700 mb-1">
              Time: {properties.startTime} – {properties.endTime}
            </p>
            <p className="text-xs font-medium text-slate-700 mb-2">
              Status:{' '}
              <span className="font-semibold uppercase" style={{ color: STATUS_COLORS[properties.status] }}>
                {properties.status}
              </span>
            </p>
          </div>

          <div className="mb-2">
            <p className="text-xs font-medium text-slate-700 mb-1">Departments:</p>
            <div className="flex gap-1 flex-wrap">
              {properties.departments.map(dept => (
                <span
                  key={dept}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${DEPARTMENT_COLORS[dept]}20`, color: DEPARTMENT_COLORS[dept] }}
                >
                  {dept}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-700 mb-1">Requests:</p>
            <ul className="text-xs text-slate-500 list-disc list-inside">
              {properties.requests.map(req => (
                <li key={req}>{req}</li>
              ))}
            </ul>
          </div>
        </div>
      </Popup>
    </CircleMarker>
  );
}
