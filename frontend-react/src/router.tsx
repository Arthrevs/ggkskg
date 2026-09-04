// ============================================================
// Router Configuration
// ============================================================

import { createBrowserRouter } from 'react-router-dom';
import { PageLayout } from './components/layout/PageLayout';
import Dashboard from './pages/Dashboard';
import Requests from './pages/Requests';
import Schedule from './pages/Schedule';
import Compare from './pages/Compare';
import MapView from './pages/MapView';
import Stats from './pages/Stats';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PageLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'requests', element: <Requests /> },
      { path: 'schedule', element: <Schedule /> },
      { path: 'compare', element: <Compare /> },
      { path: 'map', element: <MapView /> },
      { path: 'stats', element: <Stats /> },
    ],
  },
]);
