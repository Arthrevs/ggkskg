import { useMemo } from 'react';
import type { StationNode, Train, MegaBlock } from '../api/client';

interface StringlineProps {
  nodes: StationNode[];
  trains: Train[];
  blocks: MegaBlock[];
}

export function TimelineGantt({ nodes, trains, blocks }: StringlineProps) {
  // Stringline diagram: X-axis is time (24+ hrs), Y-axis is distance (KM)
  
  const { viewBox, width, height, yMap, xMap, xTicks, yTicks, maxTime } = useMemo(() => {
    if (nodes.length === 0) {
      const width = 1600, height = 800;
      return { viewBox: `0 0 ${width} ${height}`, width, height, yMap: () => 0, xMap: () => 0, xTicks: [], yTicks: [], maxTime: 1440 };
    }
    const totalKm = Math.max(...nodes.map(n => n.km)) || 1; // Fallback to 1 to avoid division by zero
    
    // Find absolute max time to draw the X-axis (may exceed 1440 due to overnight trains)
    let maxT = 1440; // Default 24h
    trains.forEach(t => {
      t.schedule.forEach(s => {
        if (s.arrival_minutes && s.arrival_minutes > maxT) maxT = s.arrival_minutes;
        if (s.departure_minutes && s.departure_minutes > maxT) maxT = s.departure_minutes;
      });
    });
    
    // Add 2 hours padding
    maxT += 120;

    // Dynamically scale width and height so it doesn't get squished
    const width = Math.max(1600, maxT * 1.5); // 1.5 pixels per minute
    const height = Math.max(800, nodes.length * 45); // 45 pixels per station minimum
    const padding = { top: 40, right: 60, bottom: 40, left: 160 };

    // Mappers
    const yMap = (km: number) => padding.top + (km / totalKm) * (height - padding.top - padding.bottom);
    const xMap = (minutes: number) => padding.left + (minutes / maxT) * (width - padding.left - padding.right);

    // Ticks with Anti-Overlap Collision Detection
    let lastTextY = -100;
    const yTicks = nodes.map(n => {
      const trueY = yMap(n.km);
      let textY = trueY;
      // Ensure at least 28px of vertical clearance between text blocks
      if (textY - lastTextY < 28) {
        textY = lastTextY + 28;
      }
      lastTextY = textY;
      return { id: n.id, name: n.name, km: n.km, y: trueY, textY: textY };
    });
    
    const xTicks = [];
    for (let m = 0; m <= maxT; m += 60) {
      const hh = Math.floor(m / 60) % 24;
      xTicks.push({
        minutes: m,
        x: xMap(m),
        label: `${hh.toString().padStart(2, '0')}:00`,
        isDayChange: m > 0 && m % 1440 === 0
      });
    }

    return { viewBox: `0 0 ${width} ${height}`, width, height, yMap, xMap, xTicks, yTicks, maxTime: maxT };
  }, [nodes, trains]);

  return (
    <div className="w-full h-full overflow-auto bg-slate-950 border border-rail-border p-4">
      <div style={{ minWidth: width, height: height }} className="relative">
        <svg width="100%" height="100%" viewBox={viewBox} className="font-mono text-xs select-none">
          {/* Grid: Time (Vertical lines) */}
          {xTicks.map(t => (
            <g key={t.minutes}>
              <line x1={t.x} y1={20} x2={t.x} y2={yMap(nodes[nodes.length-1].km)} stroke="#334155" strokeWidth={t.isDayChange ? 2 : 1} strokeDasharray={t.isDayChange ? "" : "4 4"} />
              <text x={t.x} y={15} fill="#94a3b8" textAnchor="middle">{t.label}</text>
              <text x={t.x} y={yMap(nodes[nodes.length-1].km) + 20} fill="#94a3b8" textAnchor="middle">{t.label}</text>
            </g>
          ))}

          {/* Grid: Stations (Horizontal lines) */}
          {yTicks.map(s => (
            <g key={s.id}>
              {/* Track Line */}
              <line x1={xMap(0)} y1={s.y} x2={xMap(maxTime)} y2={s.y} stroke="#334155" strokeWidth="1" />
              
              {/* Anti-Overlap Leader Line (if text was staggered) */}
              {Math.abs(s.y - s.textY) > 2 && (
                <line x1={xMap(0) - 20} y1={s.textY} x2={xMap(0)} y2={s.y} stroke="#475569" strokeDasharray="2 2" strokeWidth="1" />
              )}
              
              {/* Text Labels */}
              <text x={xMap(0) - 25} y={s.textY + 4} fill="#ffffff" textAnchor="end" fontWeight="bold">{s.name}</text>
              <text x={xMap(0) - 25} y={s.textY + 16} fill="#94a3b8" textAnchor="end" fontSize="10">KM {s.km.toFixed(1)}</text>
            </g>
          ))}

          {/* Blocks (Yellow Rectangles) */}
          {blocks.map(b => (
            <rect
              key={b.cluster_id}
              x={xMap(b.scheduled_start_minutes)}
              y={Math.min(yMap(b.km_start), yMap(b.km_end))}
              width={xMap(b.scheduled_start_minutes + b.duration_minutes) - xMap(b.scheduled_start_minutes)}
              height={Math.abs(yMap(b.km_end) - yMap(b.km_start))}
              fill="#FFFF00"
              fillOpacity="0.2"
              stroke="#FFFF00"
              strokeWidth="2"
            >
              <title>{b.cluster_id} ({b.departments.join(',')}) | {b.duration_minutes}m</title>
            </rect>
          ))}

          {/* Trains (Diagonal Lines) */}
          {trains.map(t => {
            // Build polyline points
            const points = [];
            for (const s of t.schedule) {
              const y = yMap(s.km);
              if (s.arrival_minutes !== null) points.push(`${xMap(s.arrival_minutes)},${y}`);
              if (s.departure_minutes !== null) points.push(`${xMap(s.departure_minutes)},${y}`);
            }
            if (points.length < 2) return null;

            const color = t.priority === 'high' ? '#FF00FF' : t.category === 'Passenger' ? '#00FFFF' : '#00FF00';

            return (
              <g key={t.train_id} className="group">
                <polyline
                  points={points.join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  className="opacity-70 group-hover:opacity-100 group-hover:stroke-[3px] transition-all cursor-crosshair"
                />
                {/* Train Label near the middle */}
                {points.length > 2 && (
                  <text
                    x={parseFloat(points[Math.floor(points.length/2)].split(',')[0])}
                    y={parseFloat(points[Math.floor(points.length/2)].split(',')[1]) - 5}
                    fill={color}
                    className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    fontSize="14"
                    fontWeight="bold"
                  >
                    {t.train_id}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
