import { memo } from 'react';

export const RailwayLegend = memo(() => {
  return (
    <div className="absolute bottom-6 right-6 z-[1000] bg-white dark:bg-slate-800 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg border border-slate-200 dark:border-slate-700">
      <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Railway Status</h4>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500 shadow-sm" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Open</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500 shadow-sm" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Blocked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-yellow-500 shadow-sm" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Scheduled Maintenance</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-purple-500 shadow-sm" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Integrated Block</span>
        </div>
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
          <div className="w-3 h-3 rounded-full bg-white border-2 border-slate-800 dark:border-slate-300 shadow-sm" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Station</span>
        </div>
      </div>
    </div>
  );
});

RailwayLegend.displayName = 'RailwayLegend';
