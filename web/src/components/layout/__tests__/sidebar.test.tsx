import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../sidebar';

// ── Mock useAuth ──
const mockUser = {
  id: 'user-1',
  email: 'test@school.edu',
  name: 'María Gómez',
  role: 'ADMIN' as const,
};

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    accessToken: 'fake-token',
  }),
}));

// ── Mock useInstitution (configurable per test) ──
let mockLevels: number[] = [10, 20, 30, 40]; // composite codes: 1=Inicial, 2=Primario, 3=Secundario, 4=Terciario
let mockSendEmail = true;
let mockSendMessages = true;

vi.mock('../../../context/institution-context', () => ({
  useInstitution: () => ({
    config: {
      id: 'inst-1',
      name: 'Escuela Test',
      levels: mockLevels,
      send_email: mockSendEmail,
      send_messages: mockSendMessages,
      header_color: null,
      header_text_color: null,
      body_text_color: null,
      active: true,
    } as any,
    isLoading: false,
    error: null,
    reload: vi.fn(),
    clear: vi.fn(),
  }),
}));

const noop = () => {};

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar isOpen={true} onToggle={noop} />
    </MemoryRouter>,
  );
}

describe('Sidebar filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLevels = [10, 20, 30, 40];
    mockSendEmail = true;
    mockSendMessages = true;
  });

  it('always shows Dashboard link regardless of levels', () => {
    mockLevels = [];
    renderSidebar();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('always shows Instituciones link for ADMIN role', () => {
    renderSidebar();
    expect(screen.getByText('Instituciones')).toBeInTheDocument();
  });

  it('hides academic nav items when levels array is empty', () => {
    mockLevels = [];
    renderSidebar();

    expect(screen.queryByText('Estudiantes')).not.toBeInTheDocument();
    expect(screen.queryByText('Docentes')).not.toBeInTheDocument();
    expect(screen.queryByText('Inscripciones')).not.toBeInTheDocument();
    expect(screen.queryByText('Legajos')).not.toBeInTheDocument();
    expect(screen.queryByText('Planes de Estudio')).not.toBeInTheDocument();
    expect(screen.queryByText('Calificaciones parciales')).not.toBeInTheDocument();
    expect(screen.queryByText('Asistencia del día')).not.toBeInTheDocument();
    // Level-specific items also hidden
    expect(screen.queryByText('Salas')).not.toBeInTheDocument();
    expect(screen.queryByText('Grados')).not.toBeInTheDocument();
    expect(screen.queryByText('Cursos')).not.toBeInTheDocument();
    expect(screen.queryByText('Carreras')).not.toBeInTheDocument();
  });

  it('shows generic items + only Inicial level items when institution has only Inicial', () => {
    mockLevels = [10];
    (mockUser as any).role = 'ADMIN';
    renderSidebar();

    // Generic items visible (any level exists)
    expect(screen.getByText('Estudiantes')).toBeInTheDocument();
    expect(screen.getByText('Docentes')).toBeInTheDocument();
    expect(screen.getByText('Legajos')).toBeInTheDocument();
    expect(screen.getByText('Planes de Estudio')).toBeInTheDocument();
    expect(screen.getByText('Alumnos por curso')).toBeInTheDocument();
    expect(screen.getByText('Calificaciones parciales')).toBeInTheDocument();
    expect(screen.getByText('Asistencia del día')).toBeInTheDocument();

    // Inicial items visible (levelId: 1, base level from Math.floor(10/10) = 1)
    expect(screen.getByText('Salas')).toBeInTheDocument();
    expect(screen.getByText('Informes Evolutivos')).toBeInTheDocument();
    expect(screen.getByText('Planificaciones')).toBeInTheDocument();

    // Primario items NOT visible
    expect(screen.queryByText('Grados')).not.toBeInTheDocument();

    // Secundario items NOT visible
    expect(screen.queryByText('Cursos')).not.toBeInTheDocument();
    expect(screen.queryByText('Mesas de Examen')).not.toBeInTheDocument();

    // Terciario items NOT visible
    expect(screen.queryByText('Carreras')).not.toBeInTheDocument();

    // Inicial sub-heading visible
    expect(screen.getByText('Inicial')).toBeInTheDocument();
    // Other sub-headings NOT visible
    expect(screen.queryByText('Nivel Primario')).not.toBeInTheDocument();
    expect(screen.queryByText('Secundario')).not.toBeInTheDocument();
    expect(screen.queryByText('Terciario')).not.toBeInTheDocument();
  });

  it('shows only Secundario level items when institution has only Secundario', () => {
    mockLevels = [30];
    (mockUser as any).role = 'ADMIN';
    renderSidebar();

    // Generic items visible
    expect(screen.getByText('Estudiantes')).toBeInTheDocument();
    expect(screen.getByText('Alumnos por curso')).toBeInTheDocument();
    expect(screen.getByText('Calificaciones parciales')).toBeInTheDocument();
    expect(screen.getByText('Asistencia del día')).toBeInTheDocument();

    // Inicial NOT visible
    expect(screen.queryByText('Salas')).not.toBeInTheDocument();
    expect(screen.queryByText('Informes Evolutivos')).not.toBeInTheDocument();
    expect(screen.queryByText('Planificaciones')).not.toBeInTheDocument();

    // Primario NOT visible
    expect(screen.queryByText('Grados')).not.toBeInTheDocument();

    // Secundario visible
    expect(screen.getByText('Cursos')).toBeInTheDocument();
    expect(screen.getByText('Mesas de Examen')).toBeInTheDocument();

    // Terciario NOT visible
    expect(screen.queryByText('Carreras')).not.toBeInTheDocument();

    // Secundario sub-heading visible
    expect(screen.getByText('Secundario')).toBeInTheDocument();
    // Other sub-headings NOT visible
    expect(screen.queryByText('Inicial')).not.toBeInTheDocument();
    expect(screen.queryByText('Nivel Primario')).not.toBeInTheDocument();
    expect(screen.queryByText('Terciario')).not.toBeInTheDocument();
  });

  it('shows only Primario and Secundario items when institution has those two levels', () => {
    mockLevels = [20, 30];
    (mockUser as any).role = 'ADMIN';
    renderSidebar();

    // Generic items visible
    expect(screen.getByText('Alumnos por curso')).toBeInTheDocument();

    // Inicial NOT visible
    expect(screen.queryByText('Salas')).not.toBeInTheDocument();
    expect(screen.queryByText('Informes Evolutivos')).not.toBeInTheDocument();
    expect(screen.queryByText('Planificaciones')).not.toBeInTheDocument();

    // Primario visible
    expect(screen.getByText('Grados')).toBeInTheDocument();

    // Secundario visible
    expect(screen.getByText('Cursos')).toBeInTheDocument();
    expect(screen.getByText('Mesas de Examen')).toBeInTheDocument();

    // Terciario NOT visible
    expect(screen.queryByText('Carreras')).not.toBeInTheDocument();

    // Sub-headings: Nivel Primario and Secundario visible
    expect(screen.getByText('Nivel Primario')).toBeInTheDocument();
    expect(screen.getByText('Secundario')).toBeInTheDocument();
    // Others NOT visible
    expect(screen.queryByText('Inicial')).not.toBeInTheDocument();
    expect(screen.queryByText('Terciario')).not.toBeInTheDocument();
  });

  it('shows placeholder when levels array is empty and user is ADMIN', () => {
    mockLevels = [];
    (mockUser as any).role = 'ADMIN';
    renderSidebar();

    expect(screen.getByText(/No tenés niveles educativos asignados/i)).toBeInTheDocument();
    expect(screen.getByText(/Ir a configuración/i)).toBeInTheDocument();
  });

  it('does NOT show placeholder for ROOT — ROOT sees all items regardless of levels', () => {
    mockLevels = [];
    (mockUser as any).role = 'ROOT';
    renderSidebar();

    // ROOT sees all nav items even without levels
    expect(screen.getByText('Estudiantes')).toBeInTheDocument();
    expect(screen.getByText('Docentes')).toBeInTheDocument();
    // ROOT bypasses level filtering — all level items visible
    expect(screen.getByText('Salas')).toBeInTheDocument();
    expect(screen.getByText('Grados')).toBeInTheDocument();
    expect(screen.getByText('Cursos')).toBeInTheDocument();
    expect(screen.getByText('Carreras')).toBeInTheDocument();
    // All 4 sub-headings visible for ROOT
    expect(screen.getByText('Inicial')).toBeInTheDocument();
    expect(screen.getByText('Nivel Primario')).toBeInTheDocument();
    expect(screen.getByText('Secundario')).toBeInTheDocument();
    expect(screen.getByText('Terciario')).toBeInTheDocument();
    // Placeholder should NOT appear for ROOT
    expect(screen.queryByText(/No tenés niveles educativos asignados/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ir a configuración/i)).not.toBeInTheDocument();
  });

  it('does NOT show placeholder when levels exist', () => {
    mockLevels = [10];
    renderSidebar();

    expect(screen.queryByText(/No tenés niveles educativos asignados/i)).not.toBeInTheDocument();
  });

  it('does NOT show placeholder for non-admin roles when levels empty', () => {
    mockLevels = [];
    (mockUser as any).role = 'MANAGER';
    renderSidebar();

    expect(screen.queryByText(/No tenés niveles educativos asignados/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ir a configuración/i)).not.toBeInTheDocument();
  });

  it('shows SMTP config link when send_email is true', () => {
    mockSendEmail = true;
    renderSidebar();

    expect(screen.getByText('Configuración SMTP')).toBeInTheDocument();
  });

  it('hides SMTP config link when send_email is false', () => {
    mockSendEmail = false;
    renderSidebar();

    expect(screen.queryByText('Configuración SMTP')).not.toBeInTheDocument();
  });

  it('shows WebSocket config link when send_messages is true', () => {
    mockSendMessages = true;
    renderSidebar();

    expect(screen.getByText('WebSocket')).toBeInTheDocument();
  });

  it('hides WebSocket config link when send_messages is false', () => {
    mockSendMessages = false;
    renderSidebar();

    expect(screen.queryByText('WebSocket')).not.toBeInTheDocument();
  });

  it('shows all items when all levels and flags are active', () => {
    // Use ROOT role so Módulos (ROOT-only) and Instituciones are visible.
    (mockUser as any).role = 'ROOT';
    mockLevels = [10, 20, 30, 40];
    mockSendEmail = true;
    mockSendMessages = true;
    renderSidebar();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Estudiantes')).toBeInTheDocument();
    expect(screen.getByText('Docentes')).toBeInTheDocument();
    expect(screen.getByText('Calificaciones parciales')).toBeInTheDocument();
    expect(screen.getByText('Asistencia del día')).toBeInTheDocument();
    expect(screen.getByText('Instituciones')).toBeInTheDocument();
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
    expect(screen.getByText('Módulos')).toBeInTheDocument();
    expect(screen.getByText('Configuración SMTP')).toBeInTheDocument();
    expect(screen.getByText('WebSocket')).toBeInTheDocument();

    // All level items visible
    expect(screen.getByText('Salas')).toBeInTheDocument();
    expect(screen.getByText('Grados')).toBeInTheDocument();
    expect(screen.getByText('Cursos')).toBeInTheDocument();
    expect(screen.getByText('Carreras')).toBeInTheDocument();

    // All 4 sub-headings visible
    expect(screen.getByText('Inicial')).toBeInTheDocument();
    expect(screen.getByText('Nivel Primario')).toBeInTheDocument();
    expect(screen.getByText('Secundario')).toBeInTheDocument();
    expect(screen.getByText('Terciario')).toBeInTheDocument();

    // Two Inscripciones: Secretarios + Academico/Terciario
    expect(screen.getAllByText('Inscripciones').length).toBe(2);
  });

  it('renders group labels (Secretarios, Académico, Sistema)', () => {
    renderSidebar();

    expect(screen.getByText('Secretarios')).toBeInTheDocument();
    expect(screen.getByText('Académico')).toBeInTheDocument();
    expect(screen.getByText('Sistema')).toBeInTheDocument();
  });

  it('does NOT render legacy level groups as top-level sidebar groups', () => {
    renderSidebar();

    // Old top-level groups (Inicial, Nivel Primario, Secundario, Terciario)
    // should NOT exist as separate sidebar groups anymore.
    // They are now sub-headings inside Académico.
    // Verify the section labels exist inside the Academico group.
    const sectionLabels = document.querySelectorAll('.sidebar-section-label');
    expect(sectionLabels.length).toBe(4);

    // Verify the labels have the right text
    const labelTexts = Array.from(sectionLabels).map((el) => el.textContent);
    expect(labelTexts).toContain('Inicial');
    expect(labelTexts).toContain('Nivel Primario');
    expect(labelTexts).toContain('Secundario');
    expect(labelTexts).toContain('Terciario');
  });

  it('hides groups that have no visible items', () => {
    // With no levels, disabled feature flags, and a non-privileged role,
    // every group should end up empty.
    mockLevels = [];
    mockSendEmail = false;
    mockSendMessages = false;
    (mockUser as any).role = 'USER';

    renderSidebar();

    // Only Dashboard should be visible (no groups because all items are filtered)
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Secretarios')).not.toBeInTheDocument();
    expect(screen.queryByText('Académico')).not.toBeInTheDocument();
    expect(screen.queryByText('Sistema')).not.toBeInTheDocument();
  });

  it('ROOT sees all items bypassing level filter even with partial levels', () => {
    mockLevels = [10]; // Only Inicial configured
    (mockUser as any).role = 'ROOT';
    renderSidebar();

    // ROOT sees ALL level items regardless of config
    expect(screen.getByText('Salas')).toBeInTheDocument();       // Inicial (levelId: 1)
    expect(screen.getByText('Grados')).toBeInTheDocument();      // Primario (levelId: 2)
    expect(screen.getByText('Cursos')).toBeInTheDocument();      // Secundario (levelId: 3)
    expect(screen.getByText('Carreras')).toBeInTheDocument();    // Terciario (levelId: 4)

    // All 4 sub-headings visible
    expect(screen.getByText('Inicial')).toBeInTheDocument();
    expect(screen.getByText('Nivel Primario')).toBeInTheDocument();
    expect(screen.getByText('Secundario')).toBeInTheDocument();
    expect(screen.getByText('Terciario')).toBeInTheDocument();
  });

  it('renders sub-heading labels only for levels with visible items', () => {
    mockLevels = [10, 30]; // Inicial + Secundario
    (mockUser as any).role = 'ADMIN';
    renderSidebar();

    // Active sub-headings
    expect(screen.getByText('Inicial')).toBeInTheDocument();
    expect(screen.getByText('Secundario')).toBeInTheDocument();

    // Inactive sub-headings NOT rendered
    expect(screen.queryByText('Nivel Primario')).not.toBeInTheDocument();
    expect(screen.queryByText('Terciario')).not.toBeInTheDocument();
  });
});
