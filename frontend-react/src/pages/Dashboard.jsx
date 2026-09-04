import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRequests, getSections, getDepartments } from '../services/mockApi'
import { canRunSchedule } from '../services/auth'
import { formatDate, truncateText, severityBadge, statusBadge } from '../utils/utils'
import { BarChart3, Plus, Zap, Clock, CheckCircle, AlertTriangle, Train } from 'lucide-react'

function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState({
    requests: [],
    sections: [],
    departments: [],
  })

  const loadData = async () => {
    const [reqs, secs, depts] = await Promise.all([
      getRequests(), getSections(), getDepartments()
    ])
    setData({ requests: reqs, sections: secs, departments: depts })
  }

  useEffect(() => {
    loadData()
    window.addEventListener('roleChanged', loadData)
    return () => window.removeEventListener('roleChanged', loadData)
  }, [])

  const { requests, sections, departments } = data

  const totalRequests = requests.length
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const scheduledCount = requests.filter(r => r.status === 'scheduled').length
  const criticalPending = requests.filter(r => r.severity === 'critical' && r.status !== 'scheduled').length

  const recent = requests.slice(0, 10)
  const colors = ['var(--dept-engineering)', 'var(--dept-snt)', 'var(--dept-traction)']

  return (
    <>
      <div className="page-header">
        <h1>
          <span className="icon"><BarChart3 /></span>
          Dashboard
        </h1>
        <div className="flex gap-3">
          {canRunSchedule() && (
            <button className="btn btn-primary" onClick={() => navigate('/schedule')}>
              <Zap size={16} /> Run Schedule
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => navigate('/requests')}>
            <Plus size={16} /> New Request
          </button>
        </div>
      </div>

      <div className="dashboard-stats">
        <StatCard title="Total Requests" value={totalRequests} icon={<ClipboardListIcon />} color="blue" />
        <StatCard title="Pending" value={pendingCount} icon={<Clock />} color="amber" />
        <StatCard title="Scheduled" value={scheduledCount} icon={<CheckCircle />} color="emerald" />
        <StatCard title="Critical Unscheduled" value={criticalPending} icon={<AlertTriangle />} color="red" />
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2"><Clock size={16}/> Recent Requests</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/requests')}>View All &rarr;</button>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Section</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(req => {
                  const section = sections.find(s => s.id === req.section_id)
                  return (
                    <tr key={req.id}>
                      <td className="truncate" style={{ maxWidth: 220 }}>{req.task_description}</td>
                      <td><span className="font-mono text-xs">{section ? section.code : req.section_id}</span></td>
                      <td dangerouslySetInnerHTML={{ __html: severityBadge(req.severity).outerHTML }} />
                      <td dangerouslySetInnerHTML={{ __html: statusBadge(req.status).outerHTML }} />
                      <td className="text-xs text-tertiary">{formatDate(req.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-header">
              <span className="card-title flex items-center gap-2"><Train size={16}/> Sections</span>
            </div>
            <div className="flex-col gap-3 mt-2">
              {sections.map(s => {
                const reqCount = requests.filter(r => r.section_id === s.id).length
                return (
                  <div key={s.id} className="flex items-center justify-between" style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border-primary)' }}>
                    <div>
                      <span className="font-mono text-sm font-semibold">{s.code}</span>
                      <span className="text-xs text-tertiary ml-2">{s.name}</span>
                    </div>
                    <span className="badge badge-medium">{reqCount}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card mt-6">
            <div className="card-header">
              <span className="card-title flex items-center gap-2"><BarChart3 size={16}/> By Department</span>
            </div>
            <div className="flex-col gap-3 mt-2">
              {departments.map((dept, i) => {
                const count = requests.filter(r => r.department_id === dept.id).length
                const pct = totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0
                return (
                  <div key={dept.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">{dept.short_code}</span>
                      <span className="text-xs text-tertiary">{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg-tertiary)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: colors[i], borderRadius: 999, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function StatCard({ title, value, icon, color }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{title}</div>
    </div>
  )
}

function ClipboardListIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
}

export default Dashboard
