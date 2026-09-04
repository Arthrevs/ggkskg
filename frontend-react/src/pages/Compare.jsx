import React, { useState, useEffect } from 'react'
import { getComparison, getAllRequests, generateBlockWindows, getSectionById, getDepartmentById } from '../services/mockApi'
import { runSchedule, resetSchedule } from '../services/solver'
import { toISODate, getMonday, dayName, deptChipClass, showToast, truncateText } from '../utils/utils'
import { Scale, Play, ClipboardList, Zap, Loader2 } from 'lucide-react'

function Compare() {
  const [currentWeek, setCurrentWeek] = useState(toISODate(getMonday(new Date())))
  const [running, setRunning] = useState(false)
  const [data, setData] = useState({
    manual: null,
    optimized: null,
    manualAssignments: [],
    optimizedAssignments: [],
    requests: [],
    windows: []
  })

  const loadComparison = async () => {
    const comp = await getComparison(currentWeek)
    const reqs = getAllRequests()
    const wins = generateBlockWindows(currentWeek)
    setData({ ...comp, requests: reqs, windows: wins })
  }

  useEffect(() => {
    loadComparison()
  }, [currentWeek])

  const handleRunBoth = async () => {
    setRunning(true)
    showToast('Running both modes...', 'info')
    try {
      await resetSchedule(currentWeek)
      await runSchedule(currentWeek, 'manual')
      await resetSchedule(currentWeek)
      await runSchedule(currentWeek, 'optimized')
      showToast('Both schedules computed', 'success')
      await loadComparison()
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    } finally {
      setRunning(false)
    }
  }

  const { manual, optimized, manualAssignments, optimizedAssignments, requests, windows } = data

  const getDeltas = () => {
    if (!manual || !optimized) return null
    const windowsSaved = manual.total_windows - optimized.total_windows
    const hoursDiff = manual.total_hours - optimized.total_hours
    const coLocGain = optimized.co_located_windows - manual.co_located_windows
    const criticalDiff = manual.unscheduled_count - optimized.unscheduled_count

    return [
      {
        label: 'Windows Saved',
        value: windowsSaved >= 0 ? `−${windowsSaved}` : `+${Math.abs(windowsSaved)}`,
        cls: windowsSaved > 0 ? 'delta-positive' : windowsSaved < 0 ? 'delta-negative' : 'delta-neutral',
      },
      {
        label: 'Hours Diff',
        value: hoursDiff >= 0 ? `−${hoursDiff}h` : `+${Math.abs(hoursDiff)}h`,
        cls: hoursDiff >= 0 ? 'delta-positive' : 'delta-negative',
      },
      {
        label: 'Co-location Gain',
        value: `+${coLocGain}`,
        cls: coLocGain > 0 ? 'delta-positive' : 'delta-neutral',
      },
      {
        label: 'Critical Rescued',
        value: `+${criticalDiff}`,
        cls: criticalDiff > 0 ? 'delta-positive' : 'delta-neutral',
      }
    ]
  }

  const deltas = getDeltas()

  return (
    <>
      <div className="page-header">
        <h1>
          <span className="icon"><Scale /></span>
          Compare: Manual vs Optimized
        </h1>
        <div className="flex gap-3 items-center">
          <div className="week-picker">
            <label className="form-label" style={{ margin: 0 }}>Week:</label>
            <input 
              type="date" 
              className="form-input" 
              value={currentWeek} 
              onChange={e => setCurrentWeek(toISODate(getMonday(new Date(e.target.value))))} 
            />
          </div>
          <button className="btn btn-primary" onClick={handleRunBoth} disabled={running}>
            {running ? <Loader2 size={16} style={{ animation: 'spin 2s linear infinite' }} /> : <Play size={16} />}
            {running ? ' Running...' : ' Run Both Modes'}
          </button>
        </div>
      </div>

      <div className="compare-delta-bar">
        {deltas ? deltas.map((d, i) => (
          <div key={i} className="delta-card">
            <div className={`delta-value ${d.cls}`}>{d.value}</div>
            <div className="delta-label">{d.label}</div>
          </div>
        )) : (
          <div className="delta-card" style={{ gridColumn: '1/-1' }}>
            <div className="delta-value delta-neutral">—</div>
            <div className="delta-label">Run both modes to see the comparison</div>
          </div>
        )}
      </div>

      <div className="compare-layout">
        <ComparePanel 
          title="Manual (Baseline)" 
          icon={<ClipboardList size={20} className="mode-manual" style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />} 
          modeClass="mode-manual" 
          run={manual} 
          assignments={manualAssignments} 
          requests={requests}
          windows={windows}
        />
        <ComparePanel 
          title="Optimized (AI)" 
          icon={<Zap size={20} className="mode-optimized" style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />} 
          modeClass="mode-optimized" 
          run={optimized} 
          assignments={optimizedAssignments} 
          requests={requests}
          windows={windows}
        />
      </div>
    </>
  )
}

function ComparePanel({ title, icon, modeClass, run, assignments, requests, windows }) {
  const byWindow = {}
  for (const a of assignments) {
    if (!byWindow[a.block_window_id]) byWindow[a.block_window_id] = []
    byWindow[a.block_window_id].push(a)
  }

  return (
    <div className="compare-panel">
      <div className="compare-panel-header">
        <h3 className={modeClass}>{icon}{title}</h3>
        {run ? (
          <span className="text-xs text-tertiary font-mono">
            {run.total_windows} windows · {run.total_hours}h · {run.co_located_windows} co-loc
          </span>
        ) : (
          <span className="text-xs text-tertiary">Not computed</span>
        )}
      </div>
      <div className="compare-panel-body">
        {!run || assignments.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📭</div>
            <p>No schedule data — run the scheduler first</p>
          </div>
        ) : (
          Object.entries(byWindow).map(([windowId, windowAssignments]) => {
            const window = windows.find(w => w.id === windowId)
            const section = window ? getSectionById(window.section_id) : null

            return (
              <div key={windowId} style={{ padding: '0.5rem', marginBottom: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-semibold">
                    {section ? section.code : 'Unknown'} · {window ? dayName(window.day_of_week) : ''}
                  </span>
                  <span className="text-xs text-tertiary">
                    {windowAssignments.length} task{windowAssignments.length > 1 ? 's' : ''}
                  </span>
                </div>
                {windowAssignments.map(a => {
                  const req = requests.find(r => r.id === a.request_id)
                  if (!req) return null
                  const dept = getDepartmentById(req.department_id)
                  const chipClass = dept ? deptChipClass(dept.name) : 'dept-eng'
                  return (
                    <div key={a.id} className={`calendar-chip ${chipClass}`} style={{ marginBottom: 2 }}>
                      {truncateText(req.task_description, 30)}
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default Compare
