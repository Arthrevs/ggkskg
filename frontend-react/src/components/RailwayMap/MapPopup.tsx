import type { RailwaySectionProperties } from '../../types/map';

interface MapPopupProps {
  properties: RailwaySectionProperties;
}

export function MapPopup({ properties }: MapPopupProps) {
  return (
    <div className="text-sm min-w-[240px]">
      <h4 className="font-bold text-slate-900 mb-2 uppercase tracking-wide">
        {properties.line_name}
      </h4>
      <div className="border-t border-slate-200 pt-2 mb-2">
        <p className="text-xs font-medium text-slate-500 mb-1">
          Section: <span className="font-mono text-slate-800">{properties.section_code}</span>
        </p>
        <p className="text-xs font-medium text-slate-500 mb-1">
          Status:{' '}
          <span className="font-semibold" style={{ color: getStatusColor(properties.status) }}>
            {properties.status.toUpperCase()}
          </span>
        </p>
      </div>
      
      {properties.status === 'integrated' && (
        <div className="bg-purple-50 border border-purple-200 rounded p-2 mt-2">
          <p className="text-xs font-bold text-purple-700 mb-1 flex items-center gap-1">
            <span>🟣</span> INTEGRATED BLOCK
          </p>
        </div>
      )}
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'open': return '#16a34a';
    case 'blocked': return '#dc2626';
    case 'scheduled': return '#ca8a04';
    case 'integrated': return '#9333ea';
    default: return '#64748b';
  }
}
