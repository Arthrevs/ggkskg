import React, { useState, useEffect } from 'react'
import { getRole, setRole, getAllRoles } from '../services/auth'

function Topbar() {
  const [currentRole, setCurrentRole] = useState(getRole())
  const roles = getAllRoles()

  const handleRoleChange = (e) => {
    const newRole = e.target.value
    setCurrentRole(newRole)
    setRole(newRole)
  }

  useEffect(() => {
    const handleRoleChanged = (e) => {
      if (e.detail?.role) {
        setCurrentRole(e.detail.role)
      }
    }
    window.addEventListener('roleChanged', handleRoleChanged)
    return () => window.removeEventListener('roleChanged', handleRoleChanged)
  }, [])

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h2 className="topbar-title">
          Automatic Block Planning System
        </h2>
      </div>
      <div className="topbar-right">
        <div className="role-selector">
          <span className="role-label">Role:</span>
          <select className="form-select" value={currentRole} onChange={handleRoleChange}>
            {roles.map(r => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>
    </header>
  )
}

export default Topbar
