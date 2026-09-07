import React from 'react'
import { NavLink } from 'react-router-dom'
import { regenerateMockData } from '../services/mockApi'
import { showToast } from '../utils/utils'
import { BarChart3, ClipboardList, Calendar, Scale, Train, RefreshCw } from 'lucide-react'

function Sidebar() {
  const handleReset = async () => {
    await regenerateMockData()
    showToast('Mock data regenerated', 'success')
    // Dispatch event so other components know to reload data
    window.dispatchEvent(new CustomEvent('roleChanged'))
  }

  const navClass = ({ isActive }) => isActive ? 'nav-link active' : 'nav-link'

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo">BP</div>
        <div className="brand-text">
          <span className="brand-name">BlockPlan</span>
          <span className="brand-sub">SIH 2026 · 26027</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>

        <NavLink to="/dashboard" className={navClass}>
          <BarChart3 className="nav-icon" size={18} />
          <span className="nav-label">Dashboard</span>
        </NavLink>

        <NavLink to="/requests" className={navClass}>
          <ClipboardList className="nav-icon" size={18} />
          <span className="nav-label">Requests</span>
        </NavLink>

        <NavLink to="/schedule" className={navClass}>
          <Calendar className="nav-icon" size={18} />
          <span className="nav-label">Block Schedule</span>
        </NavLink>

        <NavLink to="/compare" className={navClass}>
          <Scale className="nav-icon" size={18} />
          <span className="nav-label">Compare</span>
        </NavLink>

        <NavLink to="/sections" className={navClass}>
          <Train className="nav-icon" size={18} />
          <span className="nav-label">Sections</span>
        </NavLink>

        <div className="nav-section-label nav-section-label-spaced">System</div>

        <button onClick={handleReset} className="nav-link" style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left' }}>
          <RefreshCw className="nav-icon" size={18} />
          <span className="nav-label">Reset Mock Data</span>
        </button>
      </nav>
    </aside>
  )
}

export default Sidebar
