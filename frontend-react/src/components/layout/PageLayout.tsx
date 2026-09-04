// ============================================================
// Page Layout — Wraps sidebar + topbar + content
// ============================================================

import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ToastContainer } from '../ui';

export function PageLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      {/* Main content area with sidebar offset */}
      <div className="flex-1 ml-[250px] transition-all duration-300 peer-[.collapsed]:ml-[72px]">
        <TopBar />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
