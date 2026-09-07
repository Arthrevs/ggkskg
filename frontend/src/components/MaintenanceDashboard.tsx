import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MaintenanceSubNav } from './MaintenanceSubNav';
import { ToastProvider } from '../hooks/useToast';

// Import sub-pages
import Dashboard from '../pages/maintenance/Dashboard';
import Requests from '../pages/maintenance/Requests';
import Schedule from '../pages/maintenance/Schedule';
import Compare from '../pages/maintenance/Compare';
import Stats from '../pages/maintenance/Stats';

import type { StationNode, TrackEdge } from '../lib/corridorTypes';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: false, // Do not retry on failure (e.g. 404) to avoid slow loading times
    },
  },
});

interface MaintenanceDashboardProps {
  nodes?: StationNode[];
  edges?: TrackEdge[];
  selectedCorridor?: string;
}

export function MaintenanceDashboard({ nodes, edges, selectedCorridor }: MaintenanceDashboardProps) {
  const [activeView, setActiveView] = useState('dashboard');

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <div className="flex h-full w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
          {/* Sub Navigation Sidebar */}
          <MaintenanceSubNav activeView={activeView} onNavigate={setActiveView} />

          {/* Main Content Area */}
          <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
              {activeView === 'dashboard' && <Dashboard onNavigate={setActiveView} />}
              {activeView === 'requests' && <Requests nodes={nodes} edges={edges} selectedCorridor={selectedCorridor} />}
              {activeView === 'schedule' && <Schedule />}
              {activeView === 'compare' && <Compare />}
              {activeView === 'stats' && <Stats />}
            </main>
          </div>
        </div>
      </ToastProvider>
    </QueryClientProvider>
  );
}
