import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { StationNode, TrackEdge, MegaBlock } from '../api/client';
import L from 'leaflet';
import * as turf from '@turf/turf';

interface MapProps {
  nodes: StationNode[];
  edges: TrackEdge[];
  blocks?: MegaBlock[];
  trains?: any[];
  simMinutes?: number;
  selectedSectorId?: string | null;
  trackedTrainId?: string | null;
  routeGeometries?: any[];
}

// Auto-fit the viewport to the corridor stations or tracked entities
function CameraManager({ nodes, edges, selectedSectorId, trackedTrainId, activeTrains, allTrains, simMinutes }: { nodes: StationNode[], edges: TrackEdge[], selectedSectorId?: string | null, trackedTrainId?: string | null, activeTrains: any[], allTrains: any[], simMinutes: number }) {
  const map = useMap();
  const [lastTracked, setLastTracked] = useState<string | null>(null);

  // Helper to parse "HH:MM" to minutes
  const parseTime = (t: string) => {
     if (!t || t==='--') return null;
     const [h,m] = t.split(':').map(Number);
     return h * 60 + m;
  };

  // 1a. Initial Corridor Bounding (Only runs when a new corridor is loaded)
  useEffect(() => {
    if (nodes.length > 0 && !selectedSectorId && !trackedTrainId) {
      const lats = nodes.map(n => n.lat);
      const lngs = nodes.map(n => n.lng);
      const bounds = L.latLngBounds(
        L.latLng(Math.min(...lats) - 0.05, Math.min(...lngs) - 0.05),
        L.latLng(Math.max(...lats) + 0.05, Math.max(...lngs) + 0.05)
      );
      map.fitBounds(bounds, { padding: [40, 40], animate: true });
    }
  }, [nodes, map]); // Only depends on nodes changing!

  // 1b. Handle Sector Bounding
  useEffect(() => {
    if (trackedTrainId) return;

    if (selectedSectorId) {
       const edge = edges.find(e => e.id === selectedSectorId);
       if (edge) {
          const sNode = nodes.find(n => n.id === edge.source);
          const tNode = nodes.find(n => n.id === edge.target);
          if (sNode && tNode) {
             const lats = [sNode.lat, tNode.lat];
             const lngs = [sNode.lng, tNode.lng];
             const bounds = L.latLngBounds(
                L.latLng(Math.min(...lats) - 0.005, Math.min(...lngs) - 0.005),
                L.latLng(Math.max(...lats) + 0.005, Math.max(...lngs) + 0.005)
             );
             map.fitBounds(bounds, { padding: [20, 20], maxZoom: 17, animate: true });
          }
       }
    }
  }, [selectedSectorId, edges, nodes, map, trackedTrainId]);

  // 2. Handle Live Train Tracking
  useEffect(() => {
    if (!trackedTrainId) { setLastTracked(null); return; }

    // First try: find in activeTrains (currently moving between stations)
    const activeTrain = activeTrains.find(x => x.train_id === trackedTrainId);
    if (activeTrain) {
       if (lastTracked !== trackedTrainId) {
          map.setView([activeTrain.lat, activeTrain.lng], 13, { animate: true });
          setLastTracked(trackedTrainId);
       } else {
          map.panTo([activeTrain.lat, activeTrain.lng], { animate: true, duration: 1 });
       }
       return;
    }

    // Fallback: train is stopped at a station or hasn't departed yet.
    // Find the closest station in the train's schedule relative to current simMinutes.
    const train = allTrains.find((t: any) => t.train_id === trackedTrainId);
    if (train && train.schedule) {
       let bestStation: string | null = null;
       let bestDiff = Infinity;
       for (const stop of train.schedule) {
          const arr = parseTime(stop.arrival_time);
          const dep = parseTime(stop.departure_time);
          const t = dep ?? arr;
          if (t !== null) {
             const diff = Math.abs(t - simMinutes);
             if (diff < bestDiff) { bestDiff = diff; bestStation = stop.station_code; }
          }
       }
       if (bestStation) {
          const node = nodes.find(n => n.code === bestStation);
          if (node) {
             if (lastTracked !== trackedTrainId) {
                map.setView([node.lat, node.lng], 13, { animate: true });
                setLastTracked(trackedTrainId);
             } else {
                map.panTo([node.lat, node.lng], { animate: true, duration: 1 });
             }
          }
       }
    }
  }, [trackedTrainId, activeTrains, allTrains, simMinutes, map, lastTracked, nodes]);

  return null;
}

// Map background click handler
function MapBgInteractions({ onBgClick }: { onBgClick: () => void }) {
  useMapEvents({
    click: () => onBgClick()
  });
  return null;
}

export function GeographicMap({ nodes, edges, blocks, trains, simMinutes, selectedSectorId, trackedTrainId, routeGeometries = [] }: MapProps) {

  
  const [hoveredSector, setHoveredSector] = useState<TrackEdge | null>(null);
  const [pinnedSector, setPinnedSector] = useState<TrackEdge | null>(null);
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);

  const stationPinIcon = new L.DivIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff" width="18px" height="18px">
             <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
           </svg>`,
    className: 'custom-station-pin',
    iconSize: [18, 18],
    iconAnchor: [9, 24],
    tooltipAnchor: [0, -24]
  });


  // ib_signal nodes are not rendered (filtered at render time), so skip expensive OSM snapping.
  // Only real stations need coordinates, and those already have correct lat/lng from the dataset.
  const snappedNodes = useMemo(() => nodes || [], [nodes]);



  // Helper to parse "HH:MM"
  const parseTime = (t: string) => {
     if (!t || t==='--') return null;
     const [h,m] = t.split(':').map(Number);
     return h * 60 + m;
  };


  const activeTrains = useMemo(() => {
     if (!trains || simMinutes === undefined) return [];
     
     const active = [];
     for (const t of trains) {
        if (!t.schedule || t.schedule.length < 2) continue;
        
        let currentPos = null;
        for (let i = 0; i < t.schedule.length - 1; i++) {
            const current = t.schedule[i];
            const next = t.schedule[i+1];
            
            let dTime = parseTime(current.departure_time);
            let aTime = parseTime(next.arrival_time);
            
            if (dTime === null || aTime === null) continue;
            
            if (aTime < dTime) aTime += 1440;
            
            let simM = simMinutes;
            if (simM < dTime && aTime >= 1440) simM += 1440;
            
            if (simM >= dTime && simM <= aTime) {
                const progress = aTime === dTime ? 0 : (simM - dTime) / (aTime - dTime);
                const node1 = nodes.find(n => n.code === current.station_code);
                const node2 = nodes.find(n => n.code === next.station_code);
                
                if (node1 && node2) {
                    let rawLat = node1.lat + (node2.lat - node1.lat) * progress;
                    let rawLng = node1.lng + (node2.lng - node1.lng) * progress;
                    
                    // Express trains skip stations, meaning node1 and node2 might not form an adjacent edge.
                    // To snap tightly to track curves, we find the exact intermediate nodes the train is between.
                    const currentKm = node1.km + (node2.km - node1.km) * progress;
                    const isUp = node2.km >= node1.km;
                    
                    let subNode1 = node1;
                    let subNode2 = node2;
                    
                    const sortedNodes = [...nodes].sort((a,b) => a.km - b.km);
                    for (let k = 0; k < sortedNodes.length - 1; k++) {
                        const nA = sortedNodes[k];
                        const nB = sortedNodes[k+1];
                        if (currentKm >= nA.km && currentKm <= nB.km) {
                            subNode1 = isUp ? nA : nB;
                            subNode2 = isUp ? nB : nA;
                            break;
                        }
                    }
                    
                    const subDist = Math.abs(subNode2.km - subNode1.km);
                    const subProgress = subDist === 0 ? 0 : Math.abs(currentKm - subNode1.km) / subDist;
                    // Look up the precomputed physical route for this exact segment
                    const route = routeGeometries.find(rg => 
                        (rg.source === subNode1.code && rg.target === subNode2.code) ||
                        (rg.source === subNode2.code && rg.target === subNode1.code)
                    );

                    if (route) {
                        try {
                            const line = turf.lineString(route.geometry.coordinates);
                            // Ensure the line flows from subNode1 -> subNode2
                            const startPt = turf.point([subNode1.lng, subNode1.lat]);
                            const firstCoord = route.geometry.coordinates[0];
                            const distToStart = turf.distance(startPt, turf.point(firstCoord));
                            const distToEnd = turf.distance(startPt, turf.point(route.geometry.coordinates[route.geometry.coordinates.length - 1]));
                            
                            const finalLine = distToEnd < distToStart ? turf.lineString([...route.geometry.coordinates].reverse()) : line;
                            
                            // Offset by -10m so the train runs on the left track
                            let offsetLine;
                            try {
                                offsetLine = turf.lineOffset(finalLine, -10, { units: 'meters' });
                            } catch(e) {
                                offsetLine = finalLine;
                            }
                            
                            // Interpolate precisely along the physical track
                            const targetDist = turf.length(offsetLine, { units: 'kilometers' }) * subProgress;
                            const interpolated = turf.along(offsetLine, targetDist, { units: 'kilometers' });
                            
                            rawLng = interpolated.geometry.coordinates[0];
                            rawLat = interpolated.geometry.coordinates[1];
                        } catch (e) {
                            rawLat = subNode1.lat + (subNode2.lat - subNode1.lat) * subProgress;
                            rawLng = subNode1.lng + (subNode2.lng - subNode1.lng) * subProgress;
                        }
                    } else {
                        rawLat = subNode1.lat + (subNode2.lat - subNode1.lat) * subProgress;
                        rawLng = subNode1.lng + (subNode2.lng - subNode1.lng) * subProgress;
                    }

                    currentPos = {
                       train_id: t.train_id,
                       train_name: t.train_name,
                       lat: rawLat,
                       lng: rawLng
                    };
                }
                break;
            }
        }
        if (currentPos) active.push(currentPos);
     }
     return active;
  }, [trains, simMinutes, nodes, routeGeometries]);



  const activeSector = pinnedSector || hoveredSector;

  return (
    <div className="relative w-full h-full border border-slate-800 rounded-lg overflow-hidden shadow-2xl">
      {/* Active Sector Overlay Tooltip (Outside MapContainer to prevent crashes) */}
      {activeSector && cursorPos && (
        <div 
          className="absolute z-2000 pointer-events-none bg-slate-50 border border-slate-300 rounded p-2 shadow-xl"
          style={{ 
            left: cursorPos.x + 15, 
            top: cursorPos.y + 15,
          }}
        >
          <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#0f172a' }}>
            <strong>{activeSector.source} ↔ {activeSector.target}</strong><br/>
            Dist: {activeSector.distance} km<br/>
            {pinnedSector ? <span style={{ color: '#0ea5e9' }}>📌 Pinned</span> : null}
          </div>
        </div>
      )}

      <MapContainer 
        key={`geo-map-${nodes[0]?.code || 'empty'}-${nodes[nodes.length-1]?.code || 'empty'}`}
        center={[20.5937, 78.9629]} 
        zoom={5} 
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <MapBgInteractions onBgClick={() => { setPinnedSector(null); setHoveredSector(null); }} />
        
        {/* Standard OSM basemap for real world geography */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          className="dark-tiles"
        />
        {/* OpenRailwayMap overlay for full rail network context (faded) */}
        <TileLayer
          url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.OpenRailwayMap.org">OpenRailwayMap</a>'
          opacity={0.3}
        />
        <CameraManager nodes={snappedNodes} edges={edges} selectedSectorId={selectedSectorId} trackedTrainId={trackedTrainId} activeTrains={activeTrains} allTrains={trains || []} simMinutes={simMinutes || 0} />

        {/* Render the precomputed accurate track geometry from the backend */}
        {routeGeometries.map((rg, i) => {
           const isBlocked = blocks?.some(b => 
              b.affected_segments.some(seg => 
                (seg[0] === rg.source && rg.target === seg[1]) || 
                (seg[0] === rg.target && rg.source === seg[1])
              )
           );
           
           const upEdges = edges.filter(e => e.direction === 'UP');
           const edgeIdx = upEdges.findIndex(e => {
              const sNode = nodes.find(n => n.id === e.source);
              const tNode = nodes.find(n => n.id === e.target);
              if (!sNode || !tNode) return false;
              return (sNode.code === rg.source && tNode.code === rg.target) || 
                     (tNode.code === rg.source && sNode.code === rg.target);
           });
           
           const colors = ['#22c55e', '#3b82f6', '#a855f7', '#eab308', '#ec4899', '#06b6d4'];
           const sectorColor = edgeIdx >= 0 ? colors[edgeIdx % colors.length] : '#22c55e';
           const color = isBlocked ? '#ef4444' : sectorColor;
           
           const line = turf.lineString(rg.geometry.coordinates);
           let upPositions: [number, number][] = [];
           let downPositions: [number, number][] = [];
           try {
               const upOffsetLine = turf.lineOffset(line, 10, {units: 'meters'});
               const downOffsetLine = turf.lineOffset(line, -10, {units: 'meters'});
               upPositions = upOffsetLine.geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
               downPositions = downOffsetLine.geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
           } catch(e) {
               const basePositions = rg.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
               upPositions = basePositions;
               downPositions = basePositions;
           }
           
           return (
             <React.Fragment key={`${rg.source}-${rg.target}-${i}`}>
               <Polyline 
                 positions={upPositions}
                 color={color}
                 weight={3}
                 opacity={0.8}
               />
               <Polyline 
                 positions={downPositions}
                 color={color}
                 weight={3}
                 opacity={0.8}
               />
               {/* Invisible wider hit area for hover interactions */}
               <Polyline 
                 positions={upPositions}
                 color="transparent"
                 weight={15}
                 eventHandlers={{
                    mousemove: (e) => {
                       // Simulate closest edge for tooltip
                       const correspondingEdge = edges.find(ed => ed.source === rg.source && ed.target === rg.target && ed.direction === 'UP');
                       if (correspondingEdge && !pinnedSector) {
                          setHoveredSector(correspondingEdge);
                          setCursorPos({ x: e.containerPoint.x, y: e.containerPoint.y });
                       }
                    },
                    mouseout: () => {
                       if (!pinnedSector) setHoveredSector(null);
                    },
                    click: (e) => {
                       L.DomEvent.stopPropagation(e);
                       const correspondingEdge = edges.find(ed => ed.source === rg.source && ed.target === rg.target && ed.direction === 'UP');
                       if (correspondingEdge) {
                          if (hoveredSector && hoveredSector !== pinnedSector) {
                             setPinnedSector(correspondingEdge);
                             setCursorPos({ x: e.containerPoint.x, y: e.containerPoint.y });
                          } else {
                             setPinnedSector(null);
                             setHoveredSector(null);
                          }
                       }
                    }
                 }}
               />
             </React.Fragment>
           );
        })}
        


        {/* Clean station markers (Intermediate blocks are hidden) */}
        {snappedNodes.map(n => {
          if (n.type === 'ib_signal') return null;
          return (
            <Marker
              key={n.id}
              position={[n.lat, n.lng]}
              icon={stationPinIcon}
            >
              <Tooltip direction="top" opacity={1}>
                <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 'bold', color: '#0f172a', padding: '2px 4px' }}>
                  {n.name} ({n.code})<br/>
                  <span style={{ fontWeight: 'normal', fontSize: '10px' }}>KM {n.km.toFixed(1)}</span>
                </div>
              </Tooltip>
            </Marker>
          );
        })}

        {/* Active Trains (Blinking Dots) */}
        {activeTrains.map(t => (
           <Marker 
              key={t.train_id} 
              position={[t.lat, t.lng]}
              icon={new L.DivIcon({
                 html: `
                    <div class="relative flex h-3 w-3">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-3 w-3 bg-cyan-400 border border-slate-900 shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
                    </div>
                 `,
                 className: 'custom-train-marker',
                 iconSize: [12, 12],
                 iconAnchor: [6, 6]
              })}
              zIndexOffset={1000}
           >
             <Tooltip direction="top" opacity={1}>
                <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 'bold' }}>
                  🚂 {t.train_id}<br/>{t.train_name}
                </div>
             </Tooltip>
           </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
