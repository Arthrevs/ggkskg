// ============================================================
// Sidebar Navigation
// ============================================================

import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  CalendarClock,
  GitCompareArrows,
  Map,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Train,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState } from 'react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/requests', icon: ClipboardList, label: 'Requests' },
  { to: '/schedule', icon: CalendarClock, label: 'Schedule' },
  { to: '/compare', icon: GitCompareArrows, label: 'Compare' },
  { to: '/map', icon: Map, label: 'Map' },
  { to: '/stats', icon: BarChart3, label: 'Stats' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-[250px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="p-2 rounded-xl bg-railway-600 text-white shrink-0">
          <Train className="w-5 h-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              RailBlock
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              Maintenance Scheduler
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map(item => {
          const isActive =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-railway-600/10 text-railway-600 dark:text-railway-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn('w-5 h-5 shrink-0', isActive && 'text-railway-600 dark:text-railway-400')} />
              {!collapsed && <span>{item.label}</span>}
              {isActive && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-railway-600 dark:bg-railway-400" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
