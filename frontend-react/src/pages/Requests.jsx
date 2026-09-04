import React, { useState, useEffect } from 'react'
import { getRequests, getSections, getDepartments, createRequest, updateRequest, deleteRequest } from '../services/mockApi'
import { canEdit, canSubmit } from '../services/auth'
import { formatDate, truncateText, severityBadge, statusBadge, deptBadge, showToast } from '../utils/utils'
import { ClipboardList, Plus, Edit2, Trash2, X } from 'lucide-react'

function Requests() {
  const [data, setData] = useState({ requests: [], sections: [], departments: [] })
  const [filters, setFilters] = useState({ section: '', department: '', status: '', severity: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({ id: '', section_id: '', department_id: '', task_description: '', severity: 'medium', duration_hours: '1', overdue_days: '0' })

  const loadData = async () => {
    const cleanFilters = { ...filters }
    Object.keys(cleanFilters).forEach(k => { if (!cleanFilters[k]) delete cleanFilters[k] })
    
    const [reqs, secs, depts] = await Promise.all([
      getRequests(cleanFilters), getSections(), getDepartments()
    ])
    setData({ requests: reqs, sections: secs, departments: depts })
  }

  useEffect(() => {
    loadData()
    window.addEventListener('roleChanged', loadData)
    return () => window.removeEventListener('roleChanged', loadData)
  }, [filters])

  const openNew = () => {
    setFormData({ id: '', section_id: data.sections[0]?.id || '', department_id: data.departments[0]?.id || '', task_description: '', severity: 'medium', duration_hours: '1', overdue_days: '0' })
    setModalOpen(true)
  }

  const openEdit = (req) => {
    setFormData({ ...req })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.task_description.trim()) {
      showToast('Please enter a task description', 'error')
      return
    }
    try {
      if (formData.id) await updateRequest(formData.id, formData)
      else await createRequest(formData)
      showToast(`Request ${formData.id ? 'updated' : 'created'}`, 'success')
      setModalOpen(false)
      loadData()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this request?')) return
    try {
      await deleteRequest(id)
      showToast('Request deleted', 'success')
      loadData()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>
          <span className="icon"><ClipboardList /></span>
          Maintenance Requests
        </h1>
        {canSubmit() && (
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> New Request
          </button>
        )}
      </div>

      <div className="filter-bar">
        <select className="form-select" value={filters.section} onChange={e => setFilters({...filters, section: e.target.value})}>
          <option value="">All Sections</option>
          {data.sections.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
        </select>
        <select className="form-select" value={filters.department} onChange={e => setFilters({...filters, department: e.target.value})}>
          <option value="">All Departments</option>
          {data.departments.map(d => <option key={d.id} value={d.id}>{d.short_code}</option>)}
        </select>
        <select className="form-select" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="scheduled">Scheduled</option>
          <option value="unscheduled">Unscheduled</option>
        </select>
        <select className="form-select" value={filters.severity} onChange={e => setFilters({...filters, severity: e.target.value})}>
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Section</th>
              <th>Department</th>
              <th>Severity</th>
              <th>Overdue</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Created</th>
              {canEdit() && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.requests.length === 0 ? (
              <tr><td colSpan="9" className="text-center text-tertiary" style={{ padding: '3rem' }}>No requests match your filters</td></tr>
            ) : (
              data.requests.map(req => {
                const section = data.sections.find(s => s.id === req.section_id)
                const dept = data.departments.find(d => d.id === req.department_id)
                return (
                  <tr key={req.id}>
                    <td style={{ maxWidth: 200 }}>{truncateText(req.task_description, 40)}</td>
                    <td><span className="font-mono text-xs">{section ? section.code : '—'}</span></td>
                    <td dangerouslySetInnerHTML={{ __html: dept ? deptBadge(dept.name).outerHTML : '—' }} />
                    <td dangerouslySetInnerHTML={{ __html: severityBadge(req.severity).outerHTML }} />
                    <td className="font-mono text-sm">{req.overdue_days}d</td>
                    <td className="font-mono text-sm">{req.duration_hours}h</td>
                    <td dangerouslySetInnerHTML={{ __html: statusBadge(req.status).outerHTML }} />
                    <td className="text-xs text-tertiary">{formatDate(req.created_at)}</td>
                    {canEdit() && (
                      <td className="actions-cell">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(req)}><Edit2 size={14}/></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(req.id)}><Trash2 size={14}/></button>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <div className={`modal-overlay ${modalOpen ? 'open' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <h3>{formData.id ? 'Edit Request' : 'New Request'}</h3>
            <button className="modal-close" onClick={() => setModalOpen(false)}><X size={18}/></button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Section</label>
              <select className="form-select" value={formData.section_id} onChange={e => setFormData({...formData, section_id: e.target.value})}>
                {data.sections.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <select className="form-select" value={formData.department_id} onChange={e => setFormData({...formData, department_id: e.target.value})}>
                {data.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Task Description</label>
              <textarea className="form-textarea" placeholder="Describe the maintenance task..." value={formData.task_description} onChange={e => setFormData({...formData, task_description: e.target.value})}></textarea>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Severity</label>
                <select className="form-select" value={formData.severity} onChange={e => setFormData({...formData, severity: e.target.value})}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Duration (hours)</label>
                <input type="number" className="form-input" min="0.5" max="8" step="0.5" value={formData.duration_hours} onChange={e => setFormData({...formData, duration_hours: e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Overdue Days</label>
              <input type="number" className="form-input" min="0" max="90" value={formData.overdue_days} onChange={e => setFormData({...formData, overdue_days: e.target.value})} />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save Request</button>
          </div>
        </div>
      </div>
    </>
  )
}

export default Requests
