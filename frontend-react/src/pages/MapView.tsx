// ============================================================
// Map View Page — Leaflet with timeline playback
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Popup, useMap } from 'react-leaflet';
import { Play, Pause, SkipBack, FastForward, MapPin } from 'lucide-react';
import { Card, Badge } from '../components/ui';
import { useSections, useSchedule } from '../api/hooks';
import { DEPARTMENT_BADGE_CLASSES, MAP_COLORS, DEPARTMENT_COLORS } from '../lib/constants';
import { formatTime, cn } from '../lib/utils';
import type { Section, ScheduleEntry } from '../lib/types';
import 'leaflet/dist/leaflet.css';

// ── Time helpers ─────────────────────────────────────────────
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ── Map Center Controller ────────────────────────────────────
function MapBoundsController({ sections }: { sections: Section[] }) {
  const map = useMap();

  useEffect(() => {
    if (sections.length === 0) return;
    const allCoords = sections.flatMap(s => s.coordinates);
    if (allCoords.length > 0) {
      const lats = allCoords.map(c => c[0]);
      const lngs = allCoords.map(c => c[1]);
      map.fitBounds([
        [Math.min(...lats) - 1, Math.min(...lngs) - 1],
        [Math.max(...lats) + 1, Math.max(...lngs) + 1],
      ]);
    }
  }, [sections, map]);

  return null;
}

export default function MapView() {
  const { data: sections } = useSections();
  const { data: schedule } = useSchedule('2026-W36', 'optimized');

  // Timeline state
  const [currentTime, setCurrentTime] = useState(0); // minutes from midnight
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  // Playback logic
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= 24 * 60 - 1) {
            setIsPlaying(false);
            return 0;
          }
          return prev + speed * 5; // advance 5 * speed minutes per tick
        });
      }, 200);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed]);

  // Determine section status at current time
  const getSectionStatus = useCallback(
    (sectionName: string): { status: 'active' | 'free' | 'multi-department'; entry?: ScheduleEntry } => {
      if (!schedule) return { status: 'free' };

      const matchingEntry = schedule.entries.find(entry => {
        if (entry.blockWindow.section !== sectionName) return false;
        const start = timeToMinutes(entry.blockWindow.startTime);
        let end = timeToMinutes(entry.blockWindow.endTime);
        // Handle overnight blocks
        if (end < start) end += 24 * 60;

        let current = currentTime;
        if (current < start && end > 24 * 60) current += 24 * 60;

        return current >= start && current <= end;
      });

      if (!matchingEntry) return { status: 'free' };
      if (matchingEntry.departments.length > 1) return { status: 'multi-department', entry: matchingEntry };
      return { status: 'active', entry: matchingEntry };
    },
    [schedule, currentTime]
  );

  const getPolylineColor = (status: 'active' | 'free' | 'multi-department') => {
    switch (status) {
      case 'active': return MAP_COLORS.active;
      case 'multi-department': return MAP_COLORS.multiDepartment;
      default: return MAP_COLORS.free;
    }
  };

  const getPolylineWeight = (status: 'active' | 'free' | 'multi-department') => {
    return status === 'free' ? 3 : 5;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 h-[calc(100vh-180px)]">
        {/* Map Container */}
        <Card className="overflow-hidden relative">
          <MapContainer
            center={[22.5, 79.0]}
            zoom={5}
            className="h-full w-full"
            style={{ minHeight: '500px' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            {sections && <MapBoundsController sections={sections} />}

            {sections?.map(section => {
              const { status, entry } = getSectionStatus(section.name);
              const color = getPolylineColor(status);
              const weight = getPolylineWeight(status);

              return (
                <Polyline
                  key={section.id}
                  positions={section.coordinates.map(c => [c[0], c[1]] as [number, number])}
                  pathOptions={{
                    color,
                    weight,
                    opacity: status === 'free' ? 0.4 : 0.9,
                    dashArray: status === 'free' ? '8 4' : undefined,
                  }}
                  eventHandlers={{
                    click: () => setSelectedSection(section.name),
                  }}
                >
                  <Popup>
                    <div className="text-sm min-w-[240px]">
                      <h4 className="font-bold text-slate-900 mb-2">{section.name}</h4>
                      <p className="text-xs text-slate-500 mb-2">Zone: {section.zone}</p>
                      {entry ? (
                        <>
                          <div className="border-t border-slate-200 pt-2 mt-2">
                            <p className="text-xs font-medium text-slate-700 mb-1">
                              Block: {formatTime(entry.blockWindow.startTime)} – {formatTime(entry.blockWindow.endTime)}
                            </p>
                            <p className="text-xs text-slate-500 mb-2">
                              Day: {entry.blockWindow.day}
                            </p>
                            <p className="text-xs font-medium text-slate-700 mb-1">Departments:</p>
                            <div className="flex gap-1 flex-wrap mb-2">
                              {entry.departments.map(dept => (
                                <span
                                  key={dept}
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{ backgroundColor: `${DEPARTMENT_COLORS[dept]}20`, color: DEPARTMENT_COLORS[dept] }}
                                >
                                  {dept}
                                </span>
                              ))}
                            </div>
                            <p className="text-xs font-medium text-slate-700 mb-1">Assigned Requests:</p>
                            {entry.assignedRequests.map(req => (
                              <p key={req.id} className="text-xs text-slate-500">
                                • {req.id}: {req.description}
                              </p>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No active block at current time</p>
                      )}
                    </div>
                  </Popup>
                </Polyline>
              );
            })}
          </MapContainer>

          {/* Legend Overlay */}
          <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Legend</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 rounded" style={{ backgroundColor: MAP_COLORS.active }} />
                <span className="text-xs text-slate-600 dark:text-slate-400">Active Block</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 rounded" style={{ backgroundColor: MAP_COLORS.multiDepartment }} />
                <span className="text-xs text-slate-600 dark:text-slate-400">Multi-Department</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 rounded opacity-40" style={{ backgroundColor: MAP_COLORS.free }} />
                <span className="text-xs text-slate-600 dark:text-slate-400">Free Section</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Right Panel — Timeline + Section Info */}
        <div className="flex flex-col gap-4">
          {/* Timeline Playback */}
          <Card className="p-5">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
              Timeline Playback
            </h4>

            {/* Current Time Display */}
            <div className="text-center mb-4">
              <span className="text-3xl font-bold font-mono text-slate-900 dark:text-white">
                {minutesToTime(currentTime)}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Current simulation time</p>
            </div>

            {/* Time Slider */}
            <input
              type="range"
              min={0}
              max={24 * 60 - 1}
              value={currentTime}
              onChange={e => setCurrentTime(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-railway-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:59</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setCurrentTime(0)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Reset"
              >
                <SkipBack className="w-4 h-4 text-slate-500" />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-3 rounded-xl bg-railway-600 hover:bg-railway-700 text-white transition-colors"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setSpeed(s => (s >= 5 ? 1 : s + 1))}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                title="Speed"
              >
                <FastForward className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-500">{speed}x</span>
              </button>
            </div>
          </Card>

          {/* Active Blocks at Current Time */}
          <Card className="p-5 flex-1 overflow-y-auto scrollbar-thin">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Active Blocks
            </h4>
            <div className="space-y-2">
              {sections?.map(section => {
                const { status, entry } = getSectionStatus(section.name);
                if (status === 'free') return null;

                return (
                  <div
                    key={section.id}
                    className={cn(
                      'p-3 rounded-xl border transition-all cursor-pointer',
                      status === 'multi-department'
                        ? 'border-purple-500/30 bg-purple-50/50 dark:bg-purple-500/5'
                        : 'border-red-500/30 bg-red-50/50 dark:bg-red-500/5',
                      selectedSection === section.name && 'ring-2 ring-railway-500/40'
                    )}
                    onClick={() => setSelectedSection(section.name)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {section.name}
                        </p>
                        {entry && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formatTime(entry.blockWindow.startTime)} – {formatTime(entry.blockWindow.endTime)}
                          </p>
                        )}
                      </div>
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    </div>
                    {entry && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {entry.departments.map(dept => (
                          <Badge key={dept} className={DEPARTMENT_BADGE_CLASSES[dept]}>
                            {dept}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }).filter(Boolean)}

              {sections?.every(s => getSectionStatus(s.name).status === 'free') && (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  No active blocks at {minutesToTime(currentTime)}
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
