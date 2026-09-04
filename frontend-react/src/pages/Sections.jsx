import React, { useState, useEffect } from 'react'
import { getSections, getRequests } from '../services/mockApi'
import { dayName } from '../utils/utils'
import { Train } from 'lucide-react'

function Sections() {
  const [data, setData] = useState({
    sections: [],
    requests: []
  })

  useEffect(() => {
    const loadData = async () => {
      const [secs, reqs] = await Promise.all([getSections(), getRequests()])
      setData({ sections: secs, requests: reqs })
    }
    loadData()
  }, [])

  const { sections, requests } = data

  const formatHour = (h) => {
    const hours = Math.floor(h)
    const mins = Math.round((h - hours) * 60)
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
  }

  return (
    <>
      <div className="page-header">
        <h1>
          <span className="icon"><Train /></span>
          Track Sections
        </h1>
      </div>

      <div className="grid grid-3">
        {sections.map(section => {
          const sectionRequests = requests.filter(r => r.section_id === section.id)
          const pendingCount = sectionRequests.filter(r => r.status === 'pending').length
          const criticalCount = sectionRequests.filter(r => r.severity === 'critical').length

          return (
            <div key={section.id} className="section-card">
              <div className="section-card-header">
                <span className="section-code">{section.code}</span>
                <span className="badge badge-medium">{sectionRequests.length} req</span>
              </div>
              
              <div className="section-card-body">
                <h4 style={{ marginBottom: '0.75rem', fontSize: 'var(--text-sm)' }}>{section.name}</h4>

                <div className="section-detail">
                  <span className="label">Nightly Window</span>
                  <span className="value">{formatHour(section.window_start_hour)} — {section.window_duration_hours}h</span>
                </div>
                
                <div className="section-detail">
                  <span className="label">Mega Block</span>
                  <span className="value">
                    {section.mega_day !== null 
                      ? `${dayName(section.mega_day)} · ${section.mega_duration_hours}h` 
                      : 'None'}
                  </span>
                </div>
                
                <div className="section-detail">
                  <span className="label">Slot Capacity</span>
                  <span className="value">{section.slot_capacity} concurrent crews</span>
                </div>

                <div className="section-detail">
                  <span className="label">Pending</span>
                  <span className="value">{pendingCount} tasks</span>
                </div>

                <div className="section-detail">
                  <span className="label">Critical</span>
                  <span className="value">
                    {criticalCount > 0 
                      ? <span style={{ color: 'var(--severity-critical)', fontWeight: 600 }}>{criticalCount} tasks</span>
                      : '0'}
                  </span>
                </div>

                <div className="text-xs text-tertiary" style={{ marginTop: '0.75rem' }}>Weekly block windows:</div>
                <div className="timeline-bar">
                  {[0, 1, 2, 3, 4, 5, 6].map(d => {
                    const isMega = section.mega_day !== null && section.mega_day === d
                    const duration = isMega ? section.mega_duration_hours : section.window_duration_hours
                    const widthPct = (duration / 24) * (100 / 7)
                    const gapPct = ((24 - duration) / 24) * (100 / 7)

                    return (
                      <React.Fragment key={d}>
                        <div 
                          className={`timeline-segment ${isMega ? 'mega' : 'nightly'}`}
                          style={{ width: `${widthPct}%`, minWidth: 12 }}
                          title={`${dayName(d)}: ${duration}h ${isMega ? '(Mega)' : '(Nightly)'}`}
                        >
                          {dayName(d).charAt(0)}
                        </div>
                        {gapPct > 0 && <div style={{ width: `${gapPct}%` }} />}
                      </React.Fragment>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export default Sections
