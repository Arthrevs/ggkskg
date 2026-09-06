import { RailwayMap } from '../components/RailwayMap/RailwayMap';

export default function MapView() {
  return (
    <div className="space-y-4 animate-fade-in h-full">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Railway Network Map
          </h1>
          <p className="text-sm text-slate-500 mt-1">Interactive simulation of network blocks and schedule.</p>
        </div>
      </div>
      
      <RailwayMap />
    </div>
  );
}
