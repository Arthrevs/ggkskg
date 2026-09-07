// ============================================================
// Schedule Page — Table + Timeline views, Manual/Optimized toggle
// ============================================================

import { useState, useMemo } from 'react';
import { Table2, GanttChart, Filter, Zap } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, Badge, Toggle, Tabs, Skeleton, EmptyState, Button } from '../../components/ui';
import { useSchedule, useRunSchedule } from '../../api/maintenanceHooks';
import { DEPARTMENT_BADGE_CLASSES, DEPARTMENT_COLORS, DEPARTMENTS } from '../../lib/constants';
import type { ScheduleMode, Department } from '../../lib/types';

export default function Schedule() {
  const [mode, setMode] = useState<ScheduleMode>('optimized');
  const [view, setView] = useState<'table' | 'timeline'>('table');
  const [filterDept, setFilterDept] = useState('');
  const [filterDay, setFilterDay] = useState('');

  const { data: schedule, isLoading } = useSchedule('2026-10-05', mode);
  const runSchedule = useRunSchedule();

  const filteredEntries = useMemo(() => {
    if (!schedule || !schedule.map_data) return [];
    return schedule.map_data.filter((entry: any) => {
      if (filterDept && !(entry.departments || []).includes(filterDept)) return false;
      if (filterDay && entry.block_window !== filterDay) return false;
      return true;
    });
  }, [schedule, filterDept, filterDay]);

  // Timeline data — group by section
  const timelineData = useMemo(() => {
    if (!filteredEntries.length) return [];
    const sections = [...new Set(filteredEntries.map((e: any) => e.section_id?.toString() || 'Unknown'))];
    return sections.map(section => {
      const entries = filteredEntries.filter((e: any) => (e.section_id?.toString() || 'Unknown') === section);
      const row: Record<string, unknown> = { section: `Section ${section}` };
      entries.forEach((entry: any, i: number) => {
        const startHour = parseInt((entry.start_time || '00:00').split(':')[0]);
        const endHour = parseInt((entry.end_time || '24:00').split(':')[0]) || 24;
        const duration = endHour > startHour ? endHour - startHour : (24 - startHour) + endHour;
        row[`block_${i}`] = duration;
        row[`block_${i}_dept`] = (entry.departments || [])[0] || 'Unknown';
        row[`block_${i}_start`] = entry.start_time;
      });
      return row;
    });
  }, [filteredEntries]);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Card className="p-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-12 w-full mb-2" />
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Toggle
          options={['Manual', 'Optimized']}
          value={mode === 'manual' ? 'Manual' : 'Optimized'}
          onChange={v => setMode(v === 'Manual' ? 'manual' : 'optimized')}
        />

        <div className="flex items-center gap-3">
          <Tabs
            tabs={[
              { key: 'table', label: 'Table', icon: <Table2 className="w-4 h-4" /> },
              { key: 'timeline', label: 'Timeline', icon: <GanttChart className="w-4 h-4" /> },
            ]}
            active={view}
            onChange={v => setView(v as 'table' | 'timeline')}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400" />
        <select
          value={filterDay}
          onChange={e => setFilterDay(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
        >
          <option value="">All Days</option>
          {days.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
        >
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Stats Summary */}
        {schedule && (
          <div className="ml-auto flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span><strong className="text-slate-700 dark:text-slate-300">{schedule.total_windows}</strong> windows</span>
            <span><strong className="text-slate-700 dark:text-slate-300">{(schedule.assignments || []).length}</strong> scheduled</span>
            <span><strong className="text-slate-700 dark:text-slate-300">{schedule.unscheduled_count}</strong> unscheduled</span>
          </div>
        )}
      </div>

      {/* Table View */}
      {view === 'table' && (
        filteredEntries.length === 0 ? (
          <EmptyState
            icon={<Zap className="w-8 h-8 text-yellow-500" />}
            title="No Schedule Generated"
            description="Run the AI optimizer to process pending maintenance requests and generate an optimal schedule."
            action={
              <Button 
                onClick={() => runSchedule.mutate()}
                loading={runSchedule.isPending}
                icon={<Zap className="w-4 h-4" />}
              >
                Run Optimizer
              </Button>
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Block Window</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Section</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Assigned Requests</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Departments</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry, idx) => (
                    <ScheduleTableRow key={idx} entry={entry} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* Timeline View */}
      {view === 'timeline' && (
        filteredEntries.length === 0 ? (
          <EmptyState
            icon={<Zap className="w-8 h-8 text-yellow-500" />}
            title="No Schedule Generated"
            description="Run the AI optimizer to process pending maintenance requests and generate an optimal schedule."
            action={
              <Button 
                onClick={() => runSchedule.mutate()}
                loading={runSchedule.isPending}
                icon={<Zap className="w-4 h-4" />}
              >
                Run Optimizer
              </Button>
            }
          />
        ) : (
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
              Block Schedule Timeline
            </h3>
            <div className="h-100">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={timelineData}
                  layout="vertical"
                  barSize={24}
                  margin={{ top: 5, right: 30, bottom: 5, left: 120 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'Hours', position: 'bottom', fontSize: 11, fill: '#94a3b8' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="section"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: 'none',
                      borderRadius: '12px',
                      color: '#e2e8f0',
                      fontSize: '12px',
                    }}
                    formatter={(value: unknown, name: unknown) => {
                      const cleanName = String(name).replace('block_', 'Block ');
                      return [`${value}h`, cleanName];
                    }}
                  />
                  {/* Render up to 3 blocks per section */}
                  {[0, 1, 2].map(i => (
                    <Bar key={i} dataKey={`block_${i}`} stackId="a" radius={i === 0 ? [4, 0, 0, 4] : i === 2 ? [0, 4, 4, 0] : [0, 0, 0, 0]}>
                      {timelineData.map((entry, idx) => {
                        const dept = entry[`block_${i}_dept`] as Department | undefined;
                        return (
                          <Cell
                            key={idx}
                            fill={dept ? DEPARTMENT_COLORS[dept] : 'transparent'}
                            fillOpacity={0.8}
                          />
                        );
                      })}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4">
              {DEPARTMENTS.map(dept => (
                <div key={dept} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: DEPARTMENT_COLORS[dept] }} />
                  <span className="text-xs text-slate-500 dark:text-slate-400">{dept}</span>
                </div>
              ))}
            </div>
          </Card>
        )
      )}
    </div>
  );
}

function ScheduleTableRow({ entry }: { entry: any }) {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {entry.block_window}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {entry.start_time} – {entry.end_time}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-slate-600 dark:text-slate-400">Section {entry.section_id}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {(entry.assignments || []).length} assignments
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1.5 flex-wrap">
          {(entry.departments || []).map((dept: any) => (
            <Badge key={dept} className={DEPARTMENT_BADGE_CLASSES[dept as keyof typeof DEPARTMENT_BADGE_CLASSES] || ''}>
              {dept}
            </Badge>
          ))}
        </div>
      </td>
    </tr>
  );
}
