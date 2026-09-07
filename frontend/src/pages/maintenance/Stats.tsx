// ============================================================
// Stats Page — KPIs, Charts, Export
// ============================================================

import { useMemo } from 'react';
import {
  Clock,
  LayoutGrid,
  Layers,
  Timer,
  FileJson,
  FileText,
  ClipboardList,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, StatCard, Skeleton, Button } from '../../components/ui';
import { useStats, useRequests, useSections } from '../../api/maintenanceHooks';
import { SEVERITY_COLORS, DEPARTMENT_COLORS } from '../../lib/constants';
import { downloadJSON, downloadCSV } from '../../lib/utils';
import type { Severity, Department } from '../../lib/types';
import type { StationNode } from '../../lib/corridorTypes';

interface StatsProps {
  nodes?: StationNode[];
  selectedCorridor?: string;
}

export default function Stats({ nodes, selectedCorridor }: StatsProps) {
  const { data: backendStats, isLoading: statsLoading } = useStats();
  const { data: requests, isLoading: reqLoading } = useRequests();
  const { data: sections } = useSections();

  const isLoading = statsLoading || reqLoading;

  const activeSectionName = useMemo(() => {
    if (!sections || sections.length === 0) return '';
    if (!selectedCorridor) return sections[0].name;
    
    const [sourceCode] = selectedCorridor.split('-');
    const sourceNode = nodes?.find(n => n.code === sourceCode);
    const searchString = sourceNode ? sourceNode.name.toLowerCase() : sourceCode.toLowerCase();

    const match = sections.find(s => s.name.toLowerCase().includes(searchString));
    return match ? match.name : sections[0].name;
  }, [sections, selectedCorridor, nodes]);

  // Filter requests by corridor strictly
  const corridorRequests = useMemo(() => {
    if (!requests) return [];
    if (!activeSectionName) return requests;
    return requests.filter(r => r.section === activeSectionName);
  }, [requests, activeSectionName]);

  // Compute stats from corridor-filtered requests
  const stats = useMemo(() => {
    if (!corridorRequests.length) return null;

    const byDept: Record<string, number> = {};
    const bySev: Record<string, number> = {};
    const deptHours: Record<string, number> = {};

    for (const r of corridorRequests) {
      byDept[r.department] = (byDept[r.department] || 0) + 1;
      bySev[r.severity] = (bySev[r.severity] || 0) + 1;
      deptHours[r.department] = (deptHours[r.department] || 0) + r.duration / 60;
    }

    return {
      totalRequests: corridorRequests.length,
      totalHoursScheduled: backendStats?.totalHoursScheduled ?? 0,
      windowsUsed: backendStats?.windowsUsed ?? 0,
      colocatedBlocks: backendStats?.colocatedBlocks ?? 0,
      solverTimeMs: backendStats?.solverTimeMs ?? 0,
      requestsByDepartment: byDept,
      requestsBySeverity: bySev,
      requestsOverTime: backendStats?.requestsOverTime ?? [],
      departmentWorkload: Object.entries(deptHours).map(([dept, hours]) => ({
        department: dept,
        hours: Math.round(hours * 10) / 10,
        requests: byDept[dept] || 0,
      })),
    };
  }, [corridorRequests, backendStats]);

  const severityPieData = stats
    ? Object.entries(stats.requestsBySeverity).map(([sev, count]) => ({
        name: sev.charAt(0).toUpperCase() + sev.slice(1),
        value: count,
        color: SEVERITY_COLORS[sev as Severity],
      }))
    : [];

  const workloadData = stats
    ? stats.departmentWorkload.map(d => ({
        department: d.department,
        hours: d.hours,
        requests: d.requests,
        fill: DEPARTMENT_COLORS[d.department as Department],
      }))
    : [];

  const handleExportJSON = () => {
    if (!stats) return;
    downloadJSON(stats, 'railway-stats.json');
  };

  const handleExportCSV = () => {
    if (!stats) return;
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Requests', String(stats.totalRequests)],
      ['Total Hours Scheduled', String(stats.totalHoursScheduled)],
      ['Windows Used', String(stats.windowsUsed)],
      ['Co-located Blocks', String(stats.colocatedBlocks)],
      ['Solver Time (ms)', String(stats.solverTimeMs)],
      ...Object.entries(stats.requestsByDepartment).map(([dept, count]) => [`${dept} Requests`, String(count)]),
      ...Object.entries(stats.requestsBySeverity).map(([sev, count]) => [`${sev} Requests`, String(count)]),
    ];
    downloadCSV(headers, rows, 'railway-stats.csv');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="p-5 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
        <ClipboardList className="w-12 h-12 mb-4 text-slate-300 dark:text-slate-700" />
        <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">No requests found</h3>
        <p className="text-sm">Create some maintenance requests to see statistics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Export Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" icon={<FileJson className="w-4 h-4" />} onClick={handleExportJSON}>
          Export JSON
        </Button>
        <Button variant="secondary" size="sm" icon={<FileText className="w-4 h-4" />} onClick={handleExportCSV}>
          Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Total Hours Scheduled"
          value={`${stats.totalHoursScheduled}h`}
          color="text-railway-600"
        />
        <StatCard
          icon={<LayoutGrid className="w-5 h-5" />}
          label="Windows Used"
          value={stats.windowsUsed}
          color="text-emerald-500"
        />
        <StatCard
          icon={<Layers className="w-5 h-5" />}
          label="Co-located Blocks"
          value={stats.colocatedBlocks}
          color="text-purple-500"
        />
        <StatCard
          icon={<Timer className="w-5 h-5" />}
          label="Solver Time"
          value={`${(stats.solverTimeMs / 1000).toFixed(2)}s`}
          color="text-amber-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests Over Time */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Requests Over Time
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.requestsOverTime} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val: string) => val.split('-').slice(1).join('/')}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
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
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#4c6ef5"
                  strokeWidth={2.5}
                  dot={{ fill: '#4c6ef5', strokeWidth: 0, r: 3 }}
                  activeDot={{ fill: '#4c6ef5', strokeWidth: 0, r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Department Workload */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Department Workload Distribution
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadData} barSize={48} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="department"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#e2e8f0',
                    fontSize: '13px',
                  }}
                  formatter={(value: unknown, name: unknown) => [
                    String(name) === 'hours' ? `${value}h` : String(value),
                    String(name) === 'hours' ? 'Hours' : 'Requests',
                  ]}
                />
                <Legend
                  iconType="circle"
                  iconSize={10}
                  formatter={(value: string) => (
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {value === 'hours' ? 'Hours' : 'Requests'}
                    </span>
                  )}
                />
                <Bar dataKey="hours" radius={[6, 6, 0, 0]} name="hours">
                  {workloadData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity Distribution Pie */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Request Severity Distribution
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {severityPieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
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
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Department Request Breakdown */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Department Request Summary
          </h3>
          <div className="space-y-4 mt-6">
            {Object.entries(stats.requestsByDepartment).map(([dept, count]) => {
              const total = Object.values(stats.requestsByDepartment).reduce((a, b) => a + b, 0);
              const pct = Math.round((count / total) * 100);
              return (
                <div key={dept}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{dept}</span>
                    <span className="text-sm text-slate-500">{count} requests ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: DEPARTMENT_COLORS[dept as Department],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
