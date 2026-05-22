import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';

export function DashboardLayout() {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
