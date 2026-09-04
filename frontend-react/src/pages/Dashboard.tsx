// ============================================================
// Dashboard Page
// ============================================================

import {
  ClipboardList,
  CalendarCheck,
  CalendarX,
  LayoutGrid,
  Zap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { StatCard, Card, Button, SkeletonCard } from '../components/ui';
import { useRequests, useRunSchedule } from '../api/hooks';
import { SEVERITY_COLORS } from '../lib/constants';
import { useToast } from '../hooks/useToast';
import { useNavigate } from 'react-router-dom';
import type { Severity } from '../lib/types';

export default function Dashboard() {
  const { data: requests, isLoading } = useRequests();
  const runSchedule = useRunSchedule();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const stats = {
    total: requests?.length || 0,
    scheduled: requests?.filter(r => r.status === 'scheduled').length || 0,
    unscheduled: requests?.filter(r => r.status === 'unscheduled' || r.status === 'pending').length || 0,
    windows: Math.ceil((requests?.filter(r => r.status === 'scheduled').length || 0) / 2),
  };

  const severityData = (['critical', 'high', 'medium', 'low'] as Severity[]).map(sev => ({
    name: sev.charAt(0).toUpperCase() + sev.slice(1),
    value: requests?.filter(r => r.severity === sev).length || 0,
    fill: SEVERITY_COLORS[sev],
  }));

  const pieData = [
    { name: 'Scheduled', value: stats.scheduled, color: '#10B981' },
    { name: 'Unscheduled', value: stats.unscheduled, color: '#EF4444' },
  ];

  const handleRunSchedule = async () => {
    try {
      await runSchedule.mutateAsync();
      addToast('success', 'Optimized schedule generated successfully!');
      navigate('/schedule');
    } catch {
      addToast('error', 'Failed to run schedule optimization');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<ClipboardList className="w-5 h-5" />}
          label="Total Requests"
          value={stats.total}
          color="text-railway-600"
        />
        <StatCard
          icon={<CalendarCheck className="w-5 h-5" />}
          label="Scheduled"
          value={stats.scheduled}
          color="text-emerald-500"
        />
        <StatCard
          icon={<CalendarX className="w-5 h-5" />}
          label="Unscheduled"
          value={stats.unscheduled}
          color="text-red-500"
        />
        <StatCard
          icon={<LayoutGrid className="w-5 h-5" />}
          label="Windows Used"
          value={stats.windows}
          color="text-amber-500"
        />
      </div>

      {/* Run Optimized Schedule CTA */}
      <Card className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-railway-600/5 to-railway-400/5 dark:from-railway-600/10 dark:to-railway-400/10">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Optimize Your Schedule
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Run the AI-powered optimizer to maximize block utilization and reduce windows needed.
          </p>
        </div>
        <Button
          size="lg"
          icon={<Zap className="w-5 h-5" />}
          onClick={handleRunSchedule}
          loading={runSchedule.isPending}
          className="shrink-0"
        >
          Run Optimized Schedule
        </Button>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity Bar Chart */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Requests by Severity
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData} barSize={40} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
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
                    backgroundColor: 'var(--tooltip-bg, #1e293b)',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#e2e8f0',
                    fontSize: '13px',
                  }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {severityData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Status Pie Chart */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Scheduled vs Unscheduled
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, idx) => (
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
                  verticalAlign="bottom"
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
      </div>

      {/* Recent Critical Requests */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
          Critical & High Priority Requests
        </h3>
        <div className="space-y-3">
          {requests
            ?.filter(r => r.severity === 'critical' || r.severity === 'high')
            .slice(0, 5)
            .map(req => (
              <div
                key={req.id}
                className={`flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 ${
                  req.severity === 'critical' ? 'bg-red-50/50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      req.severity === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-orange-500'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {req.description}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {req.section} · {req.department} · {req.duration}min
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-lg ${
                    req.severity === 'critical'
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-orange-500/10 text-orange-500'
                  }`}
                >
                  {req.severity}
                </span>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
