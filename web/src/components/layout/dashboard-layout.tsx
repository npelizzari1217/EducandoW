import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { ThemeToggle } from '../ui/theme-toggle';
import { useInstitution } from '../../context/institution-context';
import './sidebar.css';

function isDesktop() {
  try {
    return typeof window !== 'undefined' && window.innerWidth >= 1024;
  } catch {
    return true; // default to desktop in test environments
  }
}

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop);
  const { config } = useInstitution();
  const location = useLocation();

  // Close sidebar on route change in mobile/tablet
  useEffect(() => {
    if (!isDesktop()) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  // Sync institution theme attribute on :root for opt-in theming
  useEffect(() => {
    const root = document.documentElement;
    const hasBranding = !!(
      config.header_color ||
      config.body_color ||
      config.footer_color
    );
    if (hasBranding) {
      root.setAttribute('data-theme-institution', '');
    } else {
      root.removeAttribute('data-theme-institution');
    }
  }, [config.header_color, config.body_color, config.footer_color]);

  // Auto-responsive: close sidebar when shrinking below desktop, open when expanding
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mql = window.matchMedia('(min-width: 1024px)');

    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setSidebarOpen(e.matches);
    };

    handler(mql);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const handleToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  return (
    <div style={{ display: 'flex' }}>
      {/* Hamburger — hidden on desktop, below sidebar when sidebar is open */}
      <button
        className="hamburger-btn"
        onClick={handleToggle}
        aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Overlay — only on mobile/tablet when sidebar is open */}
      {sidebarOpen && !isDesktop() && (
        <div
          className="sidebar-overlay"
          onClick={handleToggle}
          aria-hidden="true"
        />
      )}

      {/* Theme toggle — always visible */}
      <ThemeToggle />

      <Sidebar isOpen={sidebarOpen} onToggle={handleToggle} />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
