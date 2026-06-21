import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../sidebar';
import apiClient from '../../../api/client';

// ── Mock apiClient (used by useTeacherGradingAccess hook) ──
vi.mock('../../../api/client', () => ({
  default: { get: vi.fn() },
}));

// ── Mock useAuth ──
const adminModules = [
  { moduleCode: 'INSTITUTIONS', actions: ['READ', 'UPDATE'] },
  { moduleCode: 'USERS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
  { moduleCode: 'STUDENTS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
  { moduleCode: 'TEACHERS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
  { moduleCode: 'REPORTS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
  { moduleCode: 'STUDY_PLANS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
  { moduleCode: 'CLASSROOMS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
  { moduleCode: 'SUBJECTS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
  { moduleCode: 'COURSES', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
  { moduleCode: 'ENROLLMENTS', actions: ['READ', 'CREATE', 'DELETE'] },
  { moduleCode: 'GRADES', actions: ['READ', 'CREATE', 'DELETE'] },
  { moduleCode: 'ATTENDANCE', actions: ['READ', 'CREATE', 'DELETE'] },
];

const mockUser = {
  id: 'user-1',
  email: 'test@school.edu',
  name: 'María Gómez',
  role: 'ADMIN' as const,
  roles: ['ADMIN'],
  modules: adminModules,
  levels: [] as number[],
};

function setRole(role: string) {
  (mockUser as any).role = role;
  (mockUser as any).roles = [role];
  if (role === 'ROOT') {
    (mockUser as any).modules = undefined; // ROOT bypasses all
  } else if (role === 'ADMIN') {
    (mockUser as any).modules = adminModules;
  } else {
    (mockUser as any).modules = [];
  }
}

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
    // Default: no assignments — prevents grading items from showing for non-ROOT non-GRADES tests
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    mockLevels = [10, 20, 30, 40];
    mockSendEmail = true;
    mockSendMessages = true;
    (mockUser as any).levels = [10, 20, 30, 40];
    setRole('ADMIN');
  });

  it('always shows Dashboard link regardless of levels', () => {
    (mockUser as any).levels = [];
    renderSidebar();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('always shows Instituciones link for ADMIN role', () => {
    renderSidebar();
    expect(screen.getByText('Instituciones')).toBeInTheDocument();
  });

  it('hides academic nav items when user levels array is empty', () => {
    (mockUser as any).levels = [];
    renderSidebar();

    expect(screen.queryByText('Estudiantes')).not.toBeInTheDocument();
    expect(screen.queryByText('Docentes')).not.toBeInTheDocument();
    expect(screen.queryByText('Inscripciones')).not.toBeInTheDocument();
    expect(screen.queryByText('Planes de Estudio')).not.toBeInTheDocument();
    expect(screen.queryByText('Notas y Calificaciones')).not.toBeInTheDocument();
    // Level-specific items also hidden
    expect(screen.queryByText('Salas')).not.toBeInTheDocument();
    expect(screen.queryByText('Grados')).not.toBeInTheDocument();
    expect(screen.queryByText('Cursos')).not.toBeInTheDocument();
    expect(screen.queryByText('Carreras')).not.toBeInTheDocument();
  });

  it('shows generic items + only Inicial level items when user has only Inicial', () => {
    (mockUser as any).levels = [10];
    setRole('ADMIN');
    renderSidebar();

    // Generic items visible (any level exists)
    expect(screen.getByText('Estudiantes')).toBeInTheDocument();
    expect(screen.getByText('Planes de Estudio')).toBeInTheDocument();

    // Dead link removed — verify it's NOT present
    expect(screen.queryByText('Alumnos por curso')).not.toBeInTheDocument();

    // Inicial items visible (levelId: 1, base level from Math.floor(10/10) = 1)
    expect(screen.getByText('Salas')).toBeInTheDocument();
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

  it('shows only Secundario level items when user has only Secundario', () => {
    (mockUser as any).levels = [30];
    setRole('ADMIN');
    renderSidebar();

    // Generic items visible
    expect(screen.getByText('Estudiantes')).toBeInTheDocument();

    // Dead link removed
    expect(screen.queryByText('Alumnos por curso')).not.toBeInTheDocument();

    // Inicial NOT visible
    expect(screen.queryByText('Salas')).not.toBeInTheDocument();
    expect(screen.queryByText('Informes Evolutivos')).not.toBeInTheDocument();
    expect(screen.queryByText('Planificaciones')).not.toBeInTheDocument();

    // Primario NOT visible
    expect(screen.queryByText('Grados')).not.toBeInTheDocument();

    // Secundario visible
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

  it('shows only Primario and Secundario items when user has those two levels', () => {
    (mockUser as any).levels = [20, 30];
    setRole('ADMIN');
    renderSidebar();

    // Dead link removed
    expect(screen.queryByText('Alumnos por curso')).not.toBeInTheDocument();

    // Inicial NOT visible
    expect(screen.queryByText('Salas')).not.toBeInTheDocument();
    expect(screen.queryByText('Informes Evolutivos')).not.toBeInTheDocument();
    expect(screen.queryByText('Planificaciones')).not.toBeInTheDocument();

    // Secundario visible
    expect(screen.getByText('Mesas de Examen')).toBeInTheDocument();

    // Terciario NOT visible
    expect(screen.queryByText('Carreras')).not.toBeInTheDocument();

    // Secundario sub-heading visible (Primario subGroup is empty — removed)
    expect(screen.queryByText('Nivel Primario')).not.toBeInTheDocument();
    expect(screen.getByText('Secundario')).toBeInTheDocument();
    // Others NOT visible
    expect(screen.queryByText('Inicial')).not.toBeInTheDocument();
    expect(screen.queryByText('Terciario')).not.toBeInTheDocument();
  });

  it('shows placeholder when user levels array is empty and user is ADMIN', () => {
    (mockUser as any).levels = [];
    setRole('ADMIN');
    renderSidebar();

    expect(screen.getByText(/No tenés niveles educativos asignados/i)).toBeInTheDocument();
    expect(screen.getByText(/Ir a configuración/i)).toBeInTheDocument();
  });

  it('does NOT show placeholder for ROOT — ROOT sees all items regardless of levels', () => {
    (mockUser as any).levels = [];
    setRole('ROOT');
    renderSidebar();

    // ROOT sees all nav items even without levels
    expect(screen.getByText('Estudiantes')).toBeInTheDocument();
    // ROOT bypasses level filtering — remaining level items visible
    expect(screen.getByText('Salas')).toBeInTheDocument();
    expect(screen.getByText('Mesas de Examen')).toBeInTheDocument();
    expect(screen.getByText('Carreras')).toBeInTheDocument();
    // Deleted items NOT present
    expect(screen.queryByText('Grados')).not.toBeInTheDocument();
    expect(screen.queryByText('Cursos')).not.toBeInTheDocument();
    // Active sub-headings visible for ROOT (Primario subGroup is empty — removed)
    expect(screen.getByText('Inicial')).toBeInTheDocument();
    expect(screen.queryByText('Nivel Primario')).not.toBeInTheDocument();
    expect(screen.getByText('Secundario')).toBeInTheDocument();
    expect(screen.getByText('Terciario')).toBeInTheDocument();
    // Placeholder should NOT appear for ROOT
    expect(screen.queryByText(/No tenés niveles educativos asignados/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ir a configuración/i)).not.toBeInTheDocument();
  });

  it('does NOT show placeholder when user levels exist', () => {
    (mockUser as any).levels = [10];
    renderSidebar();

    expect(screen.queryByText(/No tenés niveles educativos asignados/i)).not.toBeInTheDocument();
  });

  it('does NOT show placeholder for non-admin roles when user levels empty', () => {
    (mockUser as any).levels = [];
    setRole('TEACHER');
    renderSidebar();

    expect(screen.queryByText(/No tenés niveles educativos asignados/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ir a configuración/i)).not.toBeInTheDocument();
  });

  it('does NOT show SMTP config link (removed)', () => {
    mockSendEmail = true;
    renderSidebar();

    expect(screen.queryByText('Configuración SMTP')).not.toBeInTheDocument();
  });

  it('does NOT show WebSocket link (removed)', () => {
    mockSendMessages = true;
    renderSidebar();

    expect(screen.queryByText('WebSocket')).not.toBeInTheDocument();
  });

  it('shows all items when all levels and flags are active', () => {
    // Use ROOT role so Módulos (ROOT-only) and Instituciones are visible.
    setRole('ROOT');
    mockLevels = [10, 20, 30, 40];
    mockSendEmail = true;
    mockSendMessages = true;
    renderSidebar();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Estudiantes')).toBeInTheDocument();
    expect(screen.getByText('Instituciones')).toBeInTheDocument();
    expect(screen.getByText('Perfiles')).toBeInTheDocument();
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
    expect(screen.getByText('Módulos')).toBeInTheDocument();

    // SMTP and WebSocket links removed
    expect(screen.queryByText('Configuración SMTP')).not.toBeInTheDocument();
    expect(screen.queryByText('WebSocket')).not.toBeInTheDocument();

    // Remaining level items visible
    expect(screen.getByText('Salas')).toBeInTheDocument();
    expect(screen.getByText('Mesas de Examen')).toBeInTheDocument();
    expect(screen.getByText('Carreras')).toBeInTheDocument();
    // Deleted items NOT present
    expect(screen.queryByText('Grados')).not.toBeInTheDocument();
    expect(screen.queryByText('Cursos')).not.toBeInTheDocument();

    // Active sub-headings visible (Primario subGroup is empty — removed)
    expect(screen.getByText('Inicial')).toBeInTheDocument();
    expect(screen.queryByText('Nivel Primario')).not.toBeInTheDocument();
    expect(screen.getByText('Secundario')).toBeInTheDocument();
    expect(screen.getByText('Terciario')).toBeInTheDocument();

    // One Inscripciones: Academico/Terciario (Secretarios item was removed in SDD-2 PR-6)
    expect(screen.getAllByText('Inscripciones').length).toBe(1);
  });

  it('renders group labels (Secretarios, Académico, Sistema)', () => {
    renderSidebar();

    expect(screen.getByText('Secretarios')).toBeInTheDocument();
    expect(screen.getByText('Académico')).toBeInTheDocument();
    expect(screen.getByText('Sistema')).toBeInTheDocument();
  });

  it('renders level labels as collapsible sub-groups inside Académico', () => {
    renderSidebar();
    // Sub-groups are rendered as <details> inside <div class="sidebar-sub-groups">
    const subGroups = document.querySelectorAll('.sidebar-sub-groups details');
    expect(subGroups.length).toBe(3);
    const labelSpans = document.querySelectorAll('.sidebar-sub-groups .sidebar-group-label');
    const labelTexts = Array.from(labelSpans).map((el) => el.textContent?.trim());
    expect(labelTexts).toContain('Inicial');
    expect(labelTexts).not.toContain('Nivel Primario');
    expect(labelTexts).toContain('Secundario');
    expect(labelTexts).toContain('Terciario');
  });

  it('shows Perfiles link when user has USERS module with READ', () => {
    setRole('ADMIN');
    renderSidebar();

    expect(screen.getByText('Perfiles')).toBeInTheDocument();
  });

  it('hides Perfiles link when user lacks USERS module', () => {
    (mockUser as any).levels = [10];
    setRole('TEACHER'); // TEACHER does not have USERS module access
    renderSidebar();

    expect(screen.queryByText('Perfiles')).not.toBeInTheDocument();
  });

  it('hides groups that have no visible items', () => {
    (mockUser as any).levels = [];
    mockSendEmail = false;
    mockSendMessages = false;
    setRole('USER');

    renderSidebar();

    // Only Dashboard should be visible (no groups because all items are filtered)
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Secretarios')).not.toBeInTheDocument();
    expect(screen.queryByText('Académico')).not.toBeInTheDocument();
    expect(screen.queryByText('Sistema')).not.toBeInTheDocument();
  });

  it('empty user.levels → no Académico group for non-ROOT', () => {
    (mockUser as any).levels = [];
    setRole('ADMIN');
    renderSidebar();

    // Académico group should be absent because all its items require level
    expect(screen.queryByText('Académico')).not.toBeInTheDocument();
  });

  it('ADMIN with empty levels → placeholder visible, no Académico items', () => {
    (mockUser as any).levels = [];
    setRole('ADMIN');
    renderSidebar();

    // Placeholder visible
    expect(screen.getByText(/No tenés niveles educativos asignados/i)).toBeInTheDocument();

    // No Académico group or items visible
    expect(screen.queryByText('Académico')).not.toBeInTheDocument();
    expect(screen.queryByText('Alumnos por curso')).not.toBeInTheDocument();
    expect(screen.queryByText('Notas y Calificaciones')).not.toBeInTheDocument();
    expect(screen.queryByText('Salas')).not.toBeInTheDocument();
    expect(screen.queryByText('Grados')).not.toBeInTheDocument();
    expect(screen.queryByText('Cursos')).not.toBeInTheDocument();
    expect(screen.queryByText('Carreras')).not.toBeInTheDocument();
  });

  it('ROOT sees all items bypassing level filter even with empty user levels', () => {
    (mockUser as any).levels = [];
    setRole('ROOT');
    renderSidebar();

    // ROOT sees ALL remaining level items regardless of config
    expect(screen.getByText('Salas')).toBeInTheDocument();
    expect(screen.getByText('Mesas de Examen')).toBeInTheDocument();
    expect(screen.getByText('Carreras')).toBeInTheDocument();
    // Deleted items NOT present
    expect(screen.queryByText('Grados')).not.toBeInTheDocument();
    expect(screen.queryByText('Cursos')).not.toBeInTheDocument();

    // Active sub-headings visible (Primario subGroup is empty — removed)
    expect(screen.getByText('Inicial')).toBeInTheDocument();
    expect(screen.queryByText('Nivel Primario')).not.toBeInTheDocument();
    expect(screen.getByText('Secundario')).toBeInTheDocument();
    expect(screen.getByText('Terciario')).toBeInTheDocument();
  });

  it('renders sub-heading labels only for levels with visible items', () => {
    (mockUser as any).levels = [10, 30]; // Inicial + Secundario
    setRole('ADMIN');
    renderSidebar();

    // Active sub-headings
    expect(screen.getByText('Inicial')).toBeInTheDocument();
    expect(screen.getByText('Secundario')).toBeInTheDocument();

    // Inactive sub-headings NOT rendered
    expect(screen.queryByText('Nivel Primario')).not.toBeInTheDocument();
    expect(screen.queryByText('Terciario')).not.toBeInTheDocument();
  });
});

// ── Teacher grading access — layered gate ────────────────────────────────────
const teacherGradesModules = [
  { moduleCode: 'GRADES', actions: ['READ'] },
  { moduleCode: 'ATTENDANCE', actions: ['READ'] },
];

const singleCourseCycleData = [{ uuid: 'cc-1', courseName: 'Primario A', level: 2, modality: 1 }];
const singleSubjectData = [{ uuid: 'cc-2', courseName: 'Secundario B', level: 3, modality: 1 }];

describe('Teacher grading access — layered gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    mockLevels = [20, 30];
    mockSendEmail = false;
    mockSendMessages = false;
    (mockUser as any).levels = [20, 30];
    // Default: teacher with GRADES READ
    (mockUser as any).role = 'TEACHER';
    (mockUser as any).roles = ['TEACHER'];
    (mockUser as any).modules = teacherGradesModules;
  });

  it('teacher with GRADES + homeroom + subject assignments → BOTH "Alumnos por Curso" and "Alumnos por Materia" render', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { data: singleCourseCycleData } }) // homeroom
      .mockResolvedValueOnce({ data: { data: singleSubjectData } });    // subject

    renderSidebar();

    await waitFor(() => {
      expect(screen.getByText('Alumnos por Curso')).toBeInTheDocument();
      expect(screen.getByText('Alumnos por Materia')).toBeInTheDocument();
    });
  });

  it('teacher with GRADES + only subject assignment → only "Alumnos por Materia"; "Alumnos por Curso" absent', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { data: [] } })                    // homeroom empty
      .mockResolvedValueOnce({ data: { data: singleSubjectData } });    // subject

    renderSidebar();

    await waitFor(() => {
      expect(screen.getByText('Alumnos por Materia')).toBeInTheDocument();
    });
    expect(screen.queryByText('Alumnos por Curso')).not.toBeInTheDocument();
  });

  it('teacher with GRADES + only homeroom assignment → only "Alumnos por Curso"', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { data: singleCourseCycleData } }) // homeroom
      .mockResolvedValueOnce({ data: { data: [] } });                   // subject empty

    renderSidebar();

    await waitFor(() => {
      expect(screen.getByText('Alumnos por Curso')).toBeInTheDocument();
    });
    expect(screen.queryByText('Alumnos por Materia')).not.toBeInTheDocument();
  });

  it('teacher with GRADES but NO assignments → neither item renders', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { data: [] } }) // homeroom empty
      .mockResolvedValueOnce({ data: { data: [] } }); // subject empty

    renderSidebar();

    // Wait for loading to complete (both API calls must have been made)
    await waitFor(() => {
      expect(vi.mocked(apiClient.get)).toHaveBeenCalledTimes(2);
    });

    expect(screen.queryByText('Alumnos por Curso')).not.toBeInTheDocument();
    expect(screen.queryByText('Alumnos por Materia')).not.toBeInTheDocument();
  });

  it('user WITHOUT GRADES permission → neither item, and assignment endpoints NOT called', () => {
    (mockUser as any).modules = [{ moduleCode: 'STUDENTS', actions: ['READ'] }]; // no GRADES

    renderSidebar();

    expect(screen.queryByText('Alumnos por Curso')).not.toBeInTheDocument();
    expect(screen.queryByText('Alumnos por Materia')).not.toBeInTheDocument();
    expect(vi.mocked(apiClient.get)).not.toHaveBeenCalled();
  });

  it('ROOT → both items render without any assignment fetch', () => {
    setRole('ROOT');

    renderSidebar();

    expect(screen.getByText('Alumnos por Curso')).toBeInTheDocument();
    expect(screen.getByText('Alumnos por Materia')).toBeInTheDocument();
    expect(vi.mocked(apiClient.get)).not.toHaveBeenCalled();
  });

  it('old label "Calificación de Competencias" no longer appears anywhere', () => {
    setRole('ROOT');

    renderSidebar();

    expect(screen.queryByText('Calificación de Competencias')).not.toBeInTheDocument();
  });
});
