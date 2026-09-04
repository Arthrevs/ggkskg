// ============================================================
// Top Bar
// ============================================================

import { Moon, Sun, Bell } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Overview of maintenance scheduling' },
  '/requests': { title: 'Requests', subtitle: 'Manage maintenance requests' },
  '/schedule': { title: 'Schedule', subtitle: 'View and manage block schedules' },
  '/compare': { title: 'Compare', subtitle: 'Manual vs Optimized schedules' },
  '/map': { title: 'Map View', subtitle: 'Railway section block visualization' },
  '/stats': { title: 'Statistics', subtitle: 'Scheduling analytics and KPIs' },
};

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const page = pageTitles[location.pathname] || pageTitles['/'];

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">{page.title}</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">{page.subtitle}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
          title="Notifications"
        >
          <Bell className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 text-slate-500" />
          )}
        </button>

        <div className="ml-2 w-9 h-9 rounded-xl bg-railway-600 flex items-center justify-center text-white font-bold text-sm">
          RP
        </div>
      </div>
    </header>
  );
}
