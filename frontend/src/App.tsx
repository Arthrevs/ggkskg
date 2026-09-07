import { useEffect, useState } from 'react';
import { fetchCorridor, runSolver, fetchCorridors } from './api/client';
import type { StationNode, TrackEdge, MegaBlock, Train, SolverResponse, CorridorOption } from './api/client';
import { GeographicMap } from './components/GeographicMap';
import { TimelineGantt } from './components/TimelineGantt';
import { MimicPanelMap } from './components/MimicPanelMap';
import { MaintenanceDashboard } from './components/MaintenanceDashboard';
import { Activity, TrainFront, ShieldAlert, GitMerge, Map as MapIcon, Grid3x3, Play, Pause, ChevronRight, ChevronLeft, MapPin, Wrench } from 'lucide-react';

type TabType = 'MAP' | 'TIMELINE' | 'MIMIC' | 'MAINTENANCE';

export default function App() {
  const [corridorList, setCorridorList] = useState<CorridorOption[]>([]);
  const [selectedCorridor, setSelectedCorridor] = useState('JP-AII'); // default
  
  const [loading, setLoading] = useState(false);
  const [solving, setSolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [nodes, setNodes] = useState<StationNode[]>([]);
  const [edges, setEdges] = useState<TrackEdge[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [blocks, setBlocks] = useState<MegaBlock[]>([]);
  const [routeGeometries, setRouteGeometries] = useState<any[]>([]);
  const [stats, setStats] = useState<SolverResponse['stats'] | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('MIMIC');
  const [simMinutes, setSimMinutes] = useState<number>(480); // Default 08:00 AM
  const [isPlaying, setIsPlaying] = useState<boolean>(true); // Auto-playback

  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [trackedTrainId, setTrackedTrainId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  useEffect(() => {
    if (!isPlaying) return;
    // Update once per second (1000ms) to prevent React-Leaflet DOM lag.
    // 5 real minutes (300,000 ms) = 1 sim hour (60 sim minutes).
    // This equals 0.2 sim minutes per 1000 ms.
    const interval = setInterval(() => {
      setSimMinutes(prev => (prev + 0.2) % 1440);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const [source, dest] = selectedCorridor.split('-');

  const loadCorridor = async () => {
    setLoading(true);
    setError(null);
    setBlocks([]);
    setStats(null);
    setNodes([]);
    setEdges([]);
    setTrains([]);
    try {
      const data = await fetchCorridor(source, dest);
      setNodes(data.nodes);
      setEdges(data.edges);
      setTrains(data.trains);
      setRouteGeometries(data.route_geometries || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
    setLoading(false);
  };

  const executeSolver = async () => {
    setSolving(true);
    setError(null);
    try {
      const data = await runSolver({ source, destination: dest, nodes, edges, trains, route_geometries: routeGeometries });
      setTrains(data.optimized_timetable.trains);
      setBlocks(data.block_schedule);
      setStats(data.stats);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
    setSolving(false);
  };

  // Load corridor list + default corridor on mount
  useEffect(() => {
    fetchCorridors().then(setCorridorList).catch(console.error);
    loadCorridor();
  }, []);

  return (
    <div className="h-screen bg-slate-950 text-rail-text font-mono flex flex-col overflow-hidden">
      {/* HEADER */}
      <header className="border-b border-rail-border p-4 flex items-center justify-between bg-rail-panel">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 border border-rail-border p-1 bg-slate-900">
            <span className="text-rail-muted text-xs pl-2">ROUTE:</span>
            <select 
              value={selectedCorridor} 
              onChange={e => setSelectedCorridor(e.target.value)}
              className="bg-slate-900 text-white w-48 outline-none border border-slate-700 rounded px-1"
            >
              {corridorList.map(c => (
                <option key={`${c.source}-${c.destination}`} value={`${c.source}-${c.destination}`} className="bg-slate-900 text-white">
                  {c.label} [{c.train_count} trains]
                </option>
              ))}
            </select>
            <button 
              onClick={loadCorridor}
              disabled={loading || solving}
              className="px-3 py-1 bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? 'LOADING...' : 'FETCH'}
            </button>
            <button 
              onClick={executeSolver}
              disabled={loading || solving || nodes.length === 0}
              className="px-3 py-1 bg-rail-block text-black font-bold hover:bg-yellow-400 disabled:opacity-50 ml-2"
            >
              {solving ? 'SOLVING...' : 'OPTIMIZE BLOCKS'}
            </button>
          </div>
        </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('MIMIC')}
              className={`px-4 py-2 border flex items-center gap-2 ${activeTab === 'MIMIC' ? 'bg-rail-clear text-slate-950 border-rail-clear' : 'border-rail-border text-rail-muted hover:text-rail-text'}`}
            >
              <Grid3x3 size={16}/> MIMIC_PANEL
            </button>
            <button 
              onClick={() => setActiveTab('MAP')}
              className={`px-4 py-2 border flex items-center gap-2 ${activeTab === 'MAP' ? 'bg-rail-clear text-slate-950 border-rail-clear' : 'border-rail-border text-rail-muted hover:text-rail-text'}`}
            >
              <MapIcon size={16}/> GEOGRAPHIC_MAP
            </button>
            <button 
              onClick={() => setActiveTab('TIMELINE')}
              className={`px-4 py-2 border flex items-center gap-2 ${activeTab === 'TIMELINE' ? 'bg-rail-clear text-slate-950 border-rail-clear' : 'border-rail-border text-rail-muted hover:text-rail-text'}`}
            >
              STRINGLINE_DIAGRAM
            </button>
            <button 
              onClick={() => setActiveTab('MAINTENANCE')}
              className={`px-4 py-2 border flex items-center gap-2 ${activeTab === 'MAINTENANCE' ? 'bg-rail-clear text-slate-950 border-rail-clear' : 'border-rail-border text-rail-muted hover:text-rail-text'}`}
            >
              <Wrench size={16}/> MAINTENANCE_PLANNER
            </button>
          </div>
          
          <div className="flex items-center gap-4 ml-4">
             <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 border border-rail-border text-rail-clear hover:bg-rail-clear hover:text-slate-950 rounded-full transition-colors"
                title={isPlaying ? "Pause Simulation" : "Play Simulation"}
             >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
             </button>
             <span className="font-mono text-rail-clear w-16 text-right">
                {String(Math.floor(simMinutes / 60)).padStart(2, '0')}:{String(Math.floor(simMinutes % 60)).padStart(2, '0')}
             </span>
             <input 
                type="range" 
                min={0} max={1439} 
                value={Math.floor(simMinutes)} 
                onChange={e => {
                    setSimMinutes(parseInt(e.target.value));
                    setIsPlaying(false);
                }}
                className="w-48 accent-rail-clear cursor-pointer"
             />
             <button 
               onClick={() => setIsPanelOpen(!isPanelOpen)} 
               className="p-2 ml-4 border border-rail-border text-rail-muted hover:text-rail-clear"
               title="Toggle Side Panel"
             >
                {isPanelOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
             </button>
          </div>
      </header>

      {/* ERROR BANNER */}
      {error && (
        <div className="bg-rail-occupied text-white p-2 text-center text-sm font-bold">
          SYS_ERROR: {error}
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden relative border-t border-rail-border">
        
        <div className="flex-1 flex flex-col">
          {/* METRICS PANEL */}
          <div className="grid grid-cols-4 gap-4 p-4 border-b border-rail-border shrink-0 bg-slate-950">
            <MetricCard icon={<TrainFront size={20}/>} label="TOTAL_TRAINS" value={trains.length} color="text-rail-clear" />
            <MetricCard icon={<GitMerge size={20}/>} label="MEGA_BLOCKS" value={stats?.mega_blocks_formed || 0} color="text-rail-block" />
            <MetricCard icon={<ShieldAlert size={20}/>} label="CORRIDOR_STATIONS" value={nodes.length} color="text-rail-block" />
            <MetricCard icon={<Activity size={20}/>} label="TRAINS_DELAYED" value={stats ? `${stats.trains_delayed} / ${trains.length}` : '-'} color={stats?.trains_delayed === 0 ? 'text-rail-clear' : 'text-rail-occupied'} />
          </div>

          <main className="flex-1 relative p-4">
            <div className="absolute inset-4">
              {activeTab === 'MIMIC' && <MimicPanelMap nodes={nodes} edges={edges} blocks={blocks} trains={trains} simMinutes={simMinutes} selectedSectorId={selectedSectorId} trackedTrainId={trackedTrainId} routeGeometries={routeGeometries} />}
              {activeTab === 'MAP' && <GeographicMap nodes={nodes} edges={edges} blocks={blocks} trains={trains} simMinutes={simMinutes} selectedSectorId={selectedSectorId} trackedTrainId={trackedTrainId} routeGeometries={routeGeometries} />}
              {activeTab === 'TIMELINE' && <TimelineGantt nodes={nodes} trains={trains} blocks={blocks} />}
              {activeTab === 'MAINTENANCE' && <MaintenanceDashboard nodes={nodes as any} edges={edges as any} selectedCorridor={selectedCorridor} />}
            </div>
          </main>
        </div>

        {/* SIDE PANEL */}
        {isPanelOpen && (
          <aside className="w-80 shrink-0 border-l border-rail-border bg-slate-950 flex flex-col shadow-xl z-20">
             
             {/* SECTOR EXPLORER */}
             <div className="p-4 border-b border-rail-border shrink-0">
               <h2 className="text-rail-muted font-bold text-sm mb-3 flex items-center gap-2">
                 <MapPin size={16} /> SECTOR_EXPLORER
               </h2>
               <select 
                 value={selectedSectorId || ''}
                 onChange={e => {
                   setSelectedSectorId(e.target.value || null);
                   if (e.target.value) setTrackedTrainId(null);
                 }}
                 className="w-full bg-slate-900 border border-rail-border text-rail-text p-2 outline-none focus:border-rail-clear"
               >
                 <option value="">[ SELECT_SECTOR ]</option>
                 {edges.filter(e => e.direction === 'UP').map(edge => {
                   const s = nodes.find(n => n.id === edge.source)?.code || edge.source;
                   const t = nodes.find(n => n.id === edge.target)?.code || edge.target;
                   return <option key={edge.id} value={edge.id}>{s} ➔ {t}</option>
                 })}
               </select>
               {selectedSectorId && (
                 <button onClick={() => setSelectedSectorId(null)} className="text-xs text-rail-block mt-2 hover:underline">
                   [ CLEAR_FOCUS ]
                 </button>
               )}
             </div>

             {/* TRAIN TRACKER */}
             <div className="p-4 flex-1 flex flex-col min-h-0">
               <h2 className="text-rail-muted font-bold text-sm mb-3 flex items-center gap-2">
                 <TrainFront size={16} /> TRAIN_TRACKER
                 <span className="ml-auto text-xs text-rail-clear font-normal">{trains.length} scheduled today</span>
               </h2>
               
               <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                 {[...trains].map(t => {
                   const firstStop = t.schedule?.[0];
                   const lastStop = t.schedule?.[t.schedule.length - 1];
                   let isActive = false;
                   if (t.schedule && t.schedule.length >= 2 && firstStop && lastStop) {
                       const parseTime = (str: string | null) => {
                           if (!str || str === '--') return null;
                           const [h,m] = str.split(':').map(Number);
                           return h * 60 + m;
                       };
                       const startM = parseTime(firstStop.departure_time);
                       let endM = parseTime(lastStop.arrival_time);
                       if (startM !== null && endM !== null) {
                           if (endM < startM) endM += 1440;
                           let simM = simMinutes;
                           if (simM < startM && endM >= 1440) simM += 1440;
                           if (simM >= startM && simM <= endM) {
                               isActive = true;
                           }
                       }
                   }
                   return { ...t, isActive, firstStop, lastStop };
                 }).sort((a, b) => (a.isActive === b.isActive) ? 0 : a.isActive ? -1 : 1).map(t => {
                   const fromCode = t.firstStop?.station_code || '?';
                   const toCode = t.lastStop?.station_code || '?';
                   const depTime = t.firstStop?.departure_time || '--:--';
                   
                   return (
                     <button 
                       key={t.train_id}
                       disabled={!t.isActive}
                       onClick={() => {
                          setTrackedTrainId(trackedTrainId === t.train_id ? null : t.train_id);
                          if (trackedTrainId !== t.train_id) setSelectedSectorId(null);
                       }}
                       className={`w-full text-left p-3 border text-sm transition-colors ${!t.isActive ? 'opacity-30 cursor-not-allowed border-transparent bg-slate-900/50 text-slate-500' : trackedTrainId === t.train_id ? 'border-rail-clear bg-rail-clear/10 text-white' : 'border-rail-border bg-slate-800 text-white shadow-[0_0_8px_rgba(34,211,238,0.2)] hover:border-rail-clear'}`}
                     >
                       <div className="font-bold truncate flex justify-between items-center">
                         {t.train_name}
                         {t.isActive && <span className="text-[10px] bg-rail-clear text-slate-950 px-1 rounded animate-pulse">ACTIVE</span>}
                       </div>
                       <div className="text-xs mt-1 flex items-center justify-between">
                         <span className={t.isActive ? 'text-rail-clear font-bold' : 'opacity-50'}>{t.train_id}</span>
                         <span className={t.isActive ? 'text-rail-clear' : 'opacity-50'}>{fromCode} ➔ {toCode}</span>
                         <span className={t.isActive ? 'text-white font-bold' : 'opacity-50'}>{depTime}</span>
                       </div>
                     </button>
                   );
                 })}
                 {trains.length === 0 && <div className="text-rail-muted text-xs italic">No trains loaded. Fetch a corridor first.</div>}
               </div>
             </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string | number, color: string }) {
  return (
    <div className="border border-rail-border bg-rail-panel p-4 flex items-center justify-between">
      <div>
        <div className="text-rail-muted text-xs mb-1">{label}</div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
      </div>
      <div className="text-rail-muted opacity-50">
        {icon}
      </div>
    </div>
  );
}
