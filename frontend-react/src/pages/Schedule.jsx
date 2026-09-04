import React, { useState, useEffect } from 'react'
import { getSections, generateBlockWindows, getAssignments, getScheduleRun, getRequest, getDepartmentById } from '../services/mockApi'
import { runSchedule, resetSchedule } from '../services/solver'
import { canRunSchedule } from '../services/auth'
import { toISODate, getMonday, addDays, dayName, deptChipClass, showToast, truncateText } from '../utils/utils'
import { Calendar, Play, RotateCcw, Zap, ClipboardList, Loader2 } from 'lucide-react'

function Schedule() {
  const [currentWeek, setCurrentWeek] = useState(toISODate(getMonday(new Date())))
  const [currentMode, setCurrentMode] = useState('optimized')
  const [running, setRunning] = useState(false)
  
  const [data, setData] = useState({
    sections: [],
    assignments: [],
    run: null,
    windows: [],
    windowAssignments: {}
  })

  const loadCalendar = async () => {
    const secs = await getSections()
    const assigns = await getAssignments(currentWeek, currentMode)
    const runData = await getScheduleRun(currentWeek, currentMode)
    const wins = generateBlockWindows(currentWeek)

    const winAssigns = {}
    for (const a of assigns) {
      if (!winAssigns[a.block_window_id]) winAssigns[a.block_window_id] = []
      const req = await getRequest(a.request_id)
      if (req) {
        const dept = getDepartmentById(req.department_id)
        winAssigns[a.block_window_id].push({ ...req, department: dept })
      }
    }

    setData({ sections: secs, assignments: assigns, run: runData, windows: wins, windowAssignments: winAssigns })
  }

  useEffect(() => {
    loadCalendar()
  }, [currentWeek, currentMode])

  const handleRun = async () => {
    setRunning(true)
    try {
      await resetSchedule(currentWeek)
      await runSchedule(currentWeek, 'manual')
      await runSchedule(currentWeek, 'optimized')
      showToast('Schedule computed for both modes', 'success')
      await loadCalendar()
    } catch (err) {
      showToast('Schedule run failed: ' + err.message, 'error')
    } finally {
      setRunning(false)
    }
  }

  const handleReset = async () => {
    await resetSchedule(currentWeek)
    showToast('Requests reset to pending', 'info')
    await loadCalendar()
  }

  const { sections, run, windows, windowAssignments } = data

  return (
    <>
      <div className="page-header">
        <h1>
          <span className="icon"><Calendar /></span>
          Block Schedule
        </h1>
      </div>

      <div className="schedule-controls">
        <div className="week-picker">
          <label className="form-label" style={{ margin: 0 }}>Week of:</label>
          <input 
            type="date" 
            className="form-input" 
            value={currentWeek} 
            onChange={e => setCurrentWeek(toISODate(getMonday(new Date(e.target.value))))} 
          />
        </div>
        <div className="toggle-group">
          <button className={`toggle-btn ${currentMode === 'optimized' ? 'active' : ''}`} onClick={() => setCurrentMode('optimized')}>
            <Zap size={14} style={{ display: 'inline', marginRight: 4 }}/> Optimized
          </button>
          <button className={`toggle-btn ${currentMode === 'manual' ? 'active' : ''}`} onClick={() => setCurrentMode('manual')}>
            <ClipboardList size={14} style={{ display: 'inline', marginRight: 4 }}/> Manual
          </button>
        </div>
        {canRunSchedule() && (
          <div className="flex gap-3">
            <button className="btn btn-primary" onClick={handleRun} disabled={running}>
              {running ? <Loader2 size={16} className="spinner" style={{ animation: 'spin 2s linear infinite' }} /> : <Play size={16} />}
              {running ? ' Running...' : ' Run Schedule'}
            </button>
            <button className="btn btn-ghost" onClick={handleReset} disabled={running}>
              <RotateCcw size={16} /> Reset
            </button>
          </div>
        )}
      </div>

      {run && (
        <div className="filter-bar" style={{ marginBottom: '1.5rem' }}>
          <span className="text-sm text-secondary">Mode:</span>
          <span className={`badge ${currentMode === 'optimized' ? 'badge-scheduled' : 'badge-pending'}`}>{currentMode}</span>
          <span className="text-sm text-secondary ml-4">Windows:</span>
          <span className="font-mono font-semibold">{run.total_windows}</span>
          <span className="text-sm text-secondary ml-4">Co-located:</span>
          <span className="font-mono font-semibold">{run.co_located_windows}</span>
          <span className="text-sm text-secondary ml-4">Hours:</span>
          <span className="font-mono font-semibold">{run.total_hours}</span>
          <span className="text-sm text-secondary ml-4">Unscheduled:</span>
          <span className="font-mono font-semibold">{run.unscheduled_count}</span>
          <span className="text-sm text-secondary ml-4">Solve:</span>
          <span className="font-mono text-xs text-tertiary">{run.solve_time_ms}ms</span>
        </div>
      )}

      <div className="calendar-grid">
        <div className="calendar-header">Section</div>
        {[0, 1, 2, 3, 4, 5, 6].map(d => {
          const date = addDays(new Date(currentWeek), d)
          return <div key={d} className="calendar-header">{`${dayName(d)} ${date.getDate()}/${date.getMonth() + 1}`}</div>
        })}

        {sections.map(section => (
          <React.Fragment key={section.id}>
            <div className="calendar-section-label">
              <span className="font-mono">{section.code}</span>
            </div>
            {[0, 1, 2, 3, 4, 5, 6].map(d => {
              const window = windows.find(w => w.section_id === section.id && w.day_of_week === d)
              const isMega = section.mega_day !== null && section.mega_day === d
              const reqs = window && windowAssignments[window.id] ? windowAssignments[window.id] : []

              return (
                <div key={d} className={`calendar-cell ${isMega ? 'mega-block' : ''}`}>
                  {window && (
                    <span className="window-indicator">
                      {isMega ? `⚡${window.duration_hours}h` : `${window.duration_hours}h`}
                    </span>
                  )}
                  {reqs.map(req => {
                    const chipClass = req.department ? deptChipClass(req.department.name) : 'dept-eng'
                    return (
                      <div 
                        key={req.id} 
                        className={`calendar-chip ${chipClass}`}
                        title={`${req.task_description}\n${req.department?.short_code || ''} · ${req.severity} · ${req.duration_hours}h`}
                      >
                        {truncateText(req.task_description, 18)}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>
    </>
  )
}

export default Schedule
