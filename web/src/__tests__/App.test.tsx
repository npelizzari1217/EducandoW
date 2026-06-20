import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';

// ── Mock ALL page components to avoid heavy dependencies ──
vi.mock('../pages/auth/login', () => ({ default: () => <div>Login Page</div> }));
vi.mock('../pages/auth/register', () => ({ default: () => <div>Register Page</div> }));
vi.mock('../pages/dashboard/dashboard', () => ({ default: () => <div>Dashboard Page</div> }));
vi.mock('../pages/dashboard/institutions', () => ({ default: () => <div>Institutions Page</div> }));
vi.mock('../pages/dashboard/students', () => ({ default: () => <div>Students Page</div> }));
vi.mock('../pages/dashboard/pedagogy-pages', () => ({
  GradesPage: () => <div>Grades Page</div>,
  AttendancePage: () => <div>Attendance Page</div>,
}));
vi.mock('../pages/dashboard/modules', () => ({ default: () => <div>Modules Page</div> }));
vi.mock('../pages/dashboard/users', () => ({ default: () => <div>Users Page</div> }));
vi.mock('../pages/dashboard/legajos', () => ({ default: () => <div>Legajos Page</div> }));
vi.mock('../pages/dashboard/study-plans', () => ({ default: () => <div>Study Plans Page</div> }));
vi.mock('../pages/dashboard/profiles', () => ({ default: () => <div>Profiles Page</div> }));
vi.mock('../niveles/inicial/salas/page', () => ({ default: () => <div>Salas Page</div> }));
vi.mock('../niveles/inicial/informes/page', () => ({ default: () => <div>Informes Page</div> }));
vi.mock('../niveles/inicial/planificaciones/page', () => ({ default: () => <div>Planificaciones Page</div> }));
vi.mock('../niveles/primario/grados/page', () => ({ default: () => <div>Grados Page</div> }));
vi.mock('../niveles/primario/calificaciones/page', () => ({ default: () => <div>Calificaciones Primario Page</div> }));
vi.mock('../niveles/secundario/cursos/page', () => ({ default: () => <div>Cursos Page</div> }));
vi.mock('../niveles/secundario/mesas-examen/page', () => ({ default: () => <div>Mesas Examen Page</div> }));
vi.mock('../niveles/terciario/carreras/page', () => ({ default: () => <div>Carreras Page</div> }));
vi.mock('../niveles/terciario/inscripciones/page', () => ({ default: () => <div>Inscripciones Terciario Page</div> }));
vi.mock('../context/auth-context', () => ({
  AuthProvider: ({ children }: any) => <>{children}</>,
  useAuth: () => ({ user: { roles: ['ROOT'] }, isLoading: false }),
}));
vi.mock('../context/institution-context', () => ({
  InstitutionProvider: ({ children }: any) => <>{children}</>,
  useInstitution: () => ({
    config: { id: 'inst-1', name: 'Test', levels: [10], send_email: false, send_messages: false },
    isLoading: false,
  }),
}));
vi.mock('../context/active-institution-context', () => ({
  ActiveInstitutionProvider: ({ children }: any) => <>{children}</>,
  useActiveInstitution: () => ({ activeId: null, setActive: () => {} }),
}));
vi.mock('../components/layout/dashboard-layout', () => ({
  DashboardLayout: () => {
    return <div data-testid="dashboard-layout"><Outlet /></div>;
  },
}));
vi.mock('../components/layout/protected-route', () => ({
  ProtectedRoute: ({ children }: any) => <>{children}</>,
}));
vi.mock('../components/error-boundary', () => ({
  ErrorBoundary: ({ children }: any) => <>{children}</>,
}));
vi.mock('../components/theme/theme-applier', () => ({
  ThemeApplier: () => null,
}));

import App from '../App';

describe('App routing', () => {
  it('renders ProfilesPage at /profiles path', () => {
    render(
      <MemoryRouter initialEntries={['/profiles']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('Profiles Page')).toBeInTheDocument();
  });

  it('renders LoginPage at /login path', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });
});
