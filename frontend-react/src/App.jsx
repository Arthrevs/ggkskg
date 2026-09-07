import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { initStore } from './services/mockApi'

// Components
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'

// Pages
import Dashboard from './pages/Dashboard'
import Requests from './pages/Requests'
import Schedule from './pages/Schedule'
import Compare from './pages/Compare'
import Sections from './pages/Sections'

function App() {
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    // Seed data on first load
    initStore()
    setInitialized(true)
  }, [])

  if (!initialized) return null

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <Topbar />
        <div className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/sections" element={<Sections />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default App
