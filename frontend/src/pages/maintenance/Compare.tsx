// ============================================================
// Compare Page — Side-by-side Manual vs Optimized
// ============================================================

import { useState } from 'react';
import {
  CalendarCheck,
  CalendarX,
  LayoutGrid,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, Badge, Skeleton } from '../../components/ui';
import { useCompareSchedules } from '../../api/maintenanceHooks';
import { cn } from '../../lib/utils';


export default function Compare() {
  // Using a hardcoded week for now, similar to Schedule.tsx
  const [week] = useState<string>('2026-10-05');
  const { data: comparison, isLoading } = useCompareSchedules(week);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <Card key={i} className="p-6 space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-40 w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!comparison) return null;

  if (!comparison.manual || !comparison.optimized) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 glass-card">
        <CalendarX className="w-12 h-12 mb-4 opacity-50" />
        <h3 className="text-xl text-rail-text font-semibold mb-2">No Comparison Available</h3>
        <p>Please generate both a manual and optimized schedule for this week to view the comparison.</p>
      </div>
    );
  }

  const { manual, optimized } = comparison;

  const improvements = {
    additionalRequestsScheduled: (manual.unscheduled_count || 0) - (optimized.unscheduled_count || 0),
    windowsSaved: (manual.total_windows || 0) - (optimized.total_windows || 0),
    percentImprovement: (manual.unscheduled_count && manual.unscheduled_count > 0)
      ? Math.round((((manual.unscheduled_count || 0) - (optimized.unscheduled_count || 0)) / (manual.unscheduled_count || 1)) * 100)
      : 0
  };

  const chartData = [
    {
      metric: 'Windows Used',
      Manual: manual.total_windows || 0,
      Optimized: optimized.total_windows || 0,
    },
    {
      metric: 'Co-located Blocks',
      Manual: manual.co_located_windows || 0,
      Optimized: optimized.co_located_windows || 0,
    },
    {
      metric: 'Total Hours',
      Manual: Math.round(manual.total_hours || 0),
      Optimized: Math.round(optimized.total_hours || 0),
    },
    {
      metric: 'Unscheduled',
      Manual: manual.unscheduled_count || 0,
      Optimized: optimized.unscheduled_count || 0,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Improvement Banner */}
      <Card className="p-6 bg-linear-to-r from-emerald-500/5 to-railway-500/5 dark:from-emerald-500/10 dark:to-railway-500/10 border-emerald-200/50 dark:border-emerald-500/20">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10">
            <TrendingUp className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Optimization Results
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              The optimized schedule scheduled{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {improvements.additionalRequestsScheduled > 0 ? improvements.additionalRequestsScheduled : 0} more requests
              </strong>
              {improvements.windowsSaved > 0 && (
                <>
                  {' '}while using{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {improvements.windowsSaved} fewer windows
                  </strong>
                </>
              )}
              {' '}— a{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {improvements.percentImprovement}% improvement
              </strong>.
            </p>
          </div>
        </div>
      </Card>

      {/* Side-by-Side Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricPanel title="Manual Schedule" stats={manual} variant="manual" />
        <MetricPanel title="Optimized Schedule" stats={optimized} variant="optimized" />
      </div>

      {/* Comparison Bar Chart */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
          Visual Comparison
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={8} margin={{ top: 5, right: 30, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="metric"
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#e2e8f0',
                  fontSize: '13px',
                }}
              />
              <Legend
                iconType="circle"
                iconSize={10}
                formatter={(value: string) => (
                  <span className="text-sm text-slate-600 dark:text-slate-400">{value}</span>
                )}
              />
              <Bar dataKey="Manual" fill="#94a3b8" radius={[6, 6, 0, 0]} barSize={32} />
              <Bar dataKey="Optimized" fill="#4c6ef5" radius={[6, 6, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Detailed Side-by-Side Schedule Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SchedulePreview title="Manual" entries={manual.assignments ? manual.assignments.slice(0, 6) : []} />
        <SchedulePreview title="Optimized" entries={optimized.assignments ? optimized.assignments.slice(0, 6) : []} />
      </div>
    </div>
  );
}

function MetricPanel({
  title,
  stats,
  variant,
}: {
  title: string;
  stats: any; // using any since ScheduleStats is outdated for this view
  variant: 'manual' | 'optimized';
}) {
  const isOptimized = variant === 'optimized';

  return (
    <Card className={cn('p-6', isOptimized && 'border-railway-500/30 dark:border-railway-500/20')}>
      <div className="flex items-center gap-2 mb-5">
        <div
          className={cn(
            'w-3 h-3 rounded-full',
            isOptimized ? 'bg-railway-600' : 'bg-slate-400'
          )}
        />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
        {isOptimized && (
          <Badge className="bg-railway-500/15 text-railway-500 border-railway-500/30 ml-auto">
            Recommended
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <MetricItem
          icon={<LayoutGrid className="w-4 h-4" />}
          label="Windows Used"
          value={stats.totalWindows || 0}
          positive={!isOptimized}
        />
        <MetricItem
          icon={<CalendarCheck className="w-4 h-4" />}
          label="Co-located Blocks"
          value={stats.coLocatedWindows || 0}
          positive={isOptimized}
        />
        <MetricItem
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Total Hours"
          value={Math.round(stats.totalHours || 0)}
          positive={isOptimized}
        />
        <MetricItem
          icon={<CalendarX className="w-4 h-4" />}
          label="Unscheduled"
          value={stats.unscheduledCount || 0}
          positive={!isOptimized}
        />
      </div>
    </Card>
  );
}

function MetricItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
      <div className="text-slate-400">{icon}</div>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function SchedulePreview({
  title,
  entries,
}: {
  title: string;
  entries: any[]; // map_data format from backend
}) {
  return (
    <Card className="p-6">
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
        {title} Schedule Preview
      </h4>
      <div className="space-y-2">
        {entries.map((entry, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs"
          >
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {entry.block_window}
              </span>
              <span className="text-slate-400 ml-2">
                {entry.start_time}–{entry.end_time}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">{entry.assignments?.length || 0} req</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">{(entry.departments || []).join(', ')}</span>
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-slate-400 p-4 text-center">No assignments</div>
        )}
      </div>
    </Card>
  );
}
