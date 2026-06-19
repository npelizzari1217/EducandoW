import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { ThemeToggle } from '../ui/theme-toggle';
import { ActiveInstitutionSelector } from './active-institution-selector';
import { useInstitution } from '../../context/institution-context';
import { useAuth } from '../../context/auth-context';
import { useActiveInstitution } from '../../context/active-institution-context';
import './sidebar.css';

/**
 * Frontend routes where ROOT can operate WITHOUT an active institution.
 * These mirror the master-only paths in:
 *   api/src/infrastructure/auth/tenant.middleware.ts → isMasterRoute()
 *
 * IMPORTANT: Keep this list in sync with isMasterRoute() in the API.
 * Master routes use the master DB and do not require a tenant/institutionId.
 */
const MASTER_ROUTES = [
  '/',            // dashboard home (static cards, no tenant API calls)
  '/institutions', // institution CRUD → master DB
  '/users',        // user management → master DB
  '/modules',      // module management → master DB
  '/profiles',     // profile management → master DB
] as const;

/**
 * Returns true if the given pathname corresponds to a MASTER (non-tenant) route.
 * Matches exact paths and any sub-paths (e.g. /institutions/123).
 * The root '/' is matched exactly to avoid accidentally allowing everything.
 */
function isMasterRoute(pathname: string): boolean {
  return MASTER_ROUTES.some((route) =>
    route === '/'
      ? pathname === '/'
      : pathname === route || pathname.startsWith(route + '/'),
  );
}

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
  const { user } = useAuth();
  const { activeId } = useActiveInstitution();

  // ROOT without an active institution must not load tenant-scoped pages.
  // MASTER routes (institution management, users, modules, profiles) are
  // always accessible — they don't require a tenant DB.
  const isRoot = user?.roles?.includes('ROOT') ?? false;
  const showTenantGuard = isRoot && activeId == null && !isMasterRoute(location.pathname);

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

      {/* Global institution selector — visible only for ROOT */}
      <ActiveInstitutionSelector />

      <Sidebar isOpen={sidebarOpen} onToggle={handleToggle} />
      <main className="main-content">
        {showTenantGuard ? (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              marginTop: '4rem',
            }}
          >
            <p style={{ fontSize: 'var(--text-lg)', marginBottom: '1.5rem' }}>
              Seleccioná una institución para ver y editar sus datos
            </p>
            {/* Inline selector so the user can pick without hunting the top bar */}
            <ActiveInstitutionSelector />
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
