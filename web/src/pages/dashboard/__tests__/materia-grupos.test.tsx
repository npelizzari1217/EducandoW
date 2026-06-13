/**
 * Phase 7 UI tests — F7-T1 through F7-T7
 * TDD: tests written before implementation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

// ── Mock apiClient ────────────────────────────────────────────────────────────

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../../api/client', () => ({
  default: {
    get: mockApiGet,
    post: mockApiPost,
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    delete: mockApiDelete,
  },
}));

// ── Mock useInstitution ───────────────────────────────────────────────────────

vi.mock('../../../context/institution-context', () => ({
  useInstitution: () => ({
    config: { id: 'inst-1', name: 'Escuela Test', levels: [30], send_email: false, send_messages: false },
    isLoading: false,
    error: null,
    reload: vi.fn(),
    clear: vi.fn(),
  }),
}));

// ── Mutable user slot — swap between tests ────────────────────────────────────

let mockUser: {
  id: string;
  email: string;
  name: string;
  role: string;
  roles: string[];
  institutionId?: string;
  levels?: number[];
  modules?: { moduleCode: string; actions: string[] }[];
} = {
  id: 'admin-1',
  email: 'admin@test.com',
  name: 'Admin User',
  role: 'ADMIN',
  roles: ['ADMIN'],
  institutionId: 'inst-1',
  levels: [30],
  modules: [
    { moduleCode: 'GRADES', actions: ['READ', 'WRITE'] },
    { moduleCode: 'ATTENDANCE', actions: ['READ', 'WRITE'] },
    { moduleCode: 'COURSE_CYCLES', actions: ['READ'] },
  ],
};

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn(),
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    accessToken: 'fake-token',
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockMaterias = [
  { id: 'm-1', courseCycleId: 'cc-1', subjectId: 'sub-1', subjectName: 'Matemática', alumnosCount: 30, gruposCount: 2 },
  { id: 'm-2', courseCycleId: 'cc-1', subjectId: 'sub-2', subjectName: 'Lengua', alumnosCount: 28, gruposCount: 1 },
];

const mockGruposMateria1 = [
  { id: 'g-1', materiaXCursoXCicloId: 'm-1', docenteXCicloId: 'dxc-1', userId: 'teacher-1', name: 'Grupo A', docenteName: 'Ana García', alumnosCount: 15 },
  { id: 'g-2', materiaXCursoXCicloId: 'm-1', docenteXCicloId: 'dxc-2', userId: 'teacher-2', name: 'Grupo B', docenteName: 'Carlos López', alumnosCount: 15 },
];

const mockGruposMateria2 = [
  { id: 'g-3', materiaXCursoXCicloId: 'm-2', docenteXCicloId: 'dxc-1', userId: 'teacher-1', name: null, docenteName: 'Ana García', alumnosCount: 28 },
];

const mockCourseCycles = [
  { uuid: 'cc-1', courseName: 'Primer Año A', level: 30, cycleId: 'cy-1', active: true, passingGrade: 7, studyPlanId: 'sp-1' },
  { uuid: 'cc-2', courseName: 'Segundo Año B', level: 30, cycleId: 'cy-1', active: true, passingGrade: 7, studyPlanId: 'sp-1' },
];

// ── Users ─────────────────────────────────────────────────────────────────────

const adminUser = {
  id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'ADMIN', roles: ['ADMIN'],
  institutionId: 'inst-1', levels: [30],
  modules: [
    { moduleCode: 'GRADES', actions: ['READ', 'WRITE'] },
    { moduleCode: 'COURSE_CYCLES', actions: ['READ'] },
  ],
};

const secretarioUser = {
  id: 'sec-1', email: 'sec@test.com', name: 'Secretario', role: 'SECRETARIO', roles: ['SECRETARIO'],
  institutionId: 'inst-1', levels: [30],
  modules: [
    { moduleCode: 'GRADES', actions: ['READ', 'WRITE'] },
  ],
};

const teacherUser = {
  id: 'teacher-1', email: 'teacher@test.com', name: 'Ana García', role: 'TEACHER', roles: ['TEACHER'],
  institutionId: 'inst-1', levels: [30],
  modules: [
    { moduleCode: 'GRADES', actions: ['READ', 'WRITE'] },
  ],
};

const noModulesUser = {
  id: 'user-2', email: 'user@test.com', name: 'Sin Modulos', role: 'TEACHER', roles: ['TEACHER'],
  institutionId: 'inst-1', levels: [30],
  modules: [],
};

// ── Lazy imports (after mocks are set up) ────────────────────────────────────

let GrupoSelector: React.ComponentType<{
  grupos: { id: string; name: string | null; docenteName: string | null }[];
  selectedId: string | null;
  onChange: (id: string) => void;
}>;

let MateriasGruposPage: React.ComponentType;
let CourseCyclesPage: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  mockUser = adminUser;

  const [gsModule, mgModule, ccModule] = await Promise.all([
    import('../components/GrupoSelector'),
    import('../materia-grupos'),
    import('../course-cycles'),
  ]);
  GrupoSelector = gsModule.GrupoSelector;
  MateriasGruposPage = mgModule.default;
  CourseCyclesPage = ccModule.default;
});

afterEach(() => {
  cleanup();
});

// ── Helper renderers ──────────────────────────────────────────────────────────

function setupDefaultMateriasApiMocks() {
  mockApiGet.mockImplementation((url: string) => {
    if (url === '/course-cycles/cc-1/materias') {
      return Promise.resolve({ data: { data: mockMaterias } });
    }
    if (url === '/course-cycles/cc-1/materias/m-1/grupos') {
      return Promise.resolve({ data: { data: mockGruposMateria1 } });
    }
    if (url === '/course-cycles/cc-1/materias/m-2/grupos') {
      return Promise.resolve({ data: { data: mockGruposMateria2 } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
}

function renderMateriasPage() {
  return render(
    <MemoryRouter initialEntries={['/course-cycles/cc-1/materias']}>
      <Routes>
        <Route path="/course-cycles/:ccId/materias" element={<MateriasGruposPage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// F7-T1 + F7-T2 — GrupoSelector
// ═════════════════════════════════════════════════════════════════════════════

describe('GrupoSelector', () => {
  // F7-T1: selector not rendered when only 1 group
  it('F7-T1: does not render selector when grupos.length === 1', () => {
    render(
      <GrupoSelector
        grupos={[{ id: 'g-1', name: 'Grupo A', docenteName: 'Ana' }]}
        selectedId={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('grupo-selector')).not.toBeInTheDocument();
  });

  // F7-T2: selector rendered when more than 1 group
  it('F7-T2: renders selector with options when grupos.length > 1', () => {
    render(
      <GrupoSelector
        grupos={[
          { id: 'g-1', name: 'Grupo A', docenteName: 'Ana' },
          { id: 'g-2', name: 'Grupo B', docenteName: 'Carlos' },
        ]}
        selectedId={null}
        onChange={vi.fn()}
      />,
    );
    const selector = screen.getByTestId('grupo-selector');
    expect(selector).toBeInTheDocument();
    expect(screen.getByText('Grupo A')).toBeInTheDocument();
    expect(screen.getByText('Grupo B')).toBeInTheDocument();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F7-T3 + F7-T4 — Role-based group filtering in MateriasGruposPage
// ═════════════════════════════════════════════════════════════════════════════

describe('MateriasGruposPage — role filtering', () => {
  beforeEach(() => {
    setupDefaultMateriasApiMocks();
  });

  // F7-T3: TEACHER only sees their grupos
  it('F7-T3: TEACHER sees only their own grupos (matching userId)', async () => {
    mockUser = teacherUser; // user.id = 'teacher-1'

    renderMateriasPage();

    // Wait for materias to load
    await waitFor(() => expect(screen.getByText('Matemática')).toBeInTheDocument());

    // Wait for grupos to load
    await waitFor(() => {
      // Grupo A belongs to teacher-1 — must be visible
      expect(screen.getByText('Grupo A')).toBeInTheDocument();
    });

    // Grupo B belongs to teacher-2 — must NOT be visible for a TEACHER with id teacher-1
    expect(screen.queryByText('Grupo B')).not.toBeInTheDocument();
  });

  // F7-T4: SECRETARIO sees all grupos
  it('F7-T4: SECRETARIO sees all grupos for the materia', async () => {
    mockUser = secretarioUser;

    renderMateriasPage();

    await waitFor(() => expect(screen.getByText('Matemática')).toBeInTheDocument());

    // Both grupos should appear (may appear multiple times: in selector options + in row spans)
    await waitFor(() => {
      expect(screen.getAllByText('Grupo A').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Grupo B').length).toBeGreaterThan(0);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F7-T5 — Route guard redirects when no GRADES module
// ═════════════════════════════════════════════════════════════════════════════

describe('Route guard — GRADES module required', () => {
  it('F7-T5: redirects to / when user has no GRADES module', async () => {
    mockUser = noModulesUser;

    render(
      <MemoryRouter initialEntries={['/course-cycles/cc-1/materias']}>
        <Routes>
          <Route path="/course-cycles/:ccId/materias" element={<MateriasGruposPage />} />
          <Route path="/" element={<div data-testid="home-page">Home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // Should redirect to home, not show materias content
    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });

    // MateriasGruposPage content should NOT be shown
    expect(screen.queryByText('Matemática')).not.toBeInTheDocument();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F7-T6 — "Asignar docente" button visibility
// ═════════════════════════════════════════════════════════════════════════════

describe('MateriasGruposPage — assignment button visibility', () => {
  beforeEach(() => {
    setupDefaultMateriasApiMocks();
  });

  // F7-T6a: hidden for TEACHER
  it('F7-T6a: "Asignar docente" button is hidden for TEACHER', async () => {
    mockUser = teacherUser;

    renderMateriasPage();

    await waitFor(() => expect(screen.getByText('Matemática')).toBeInTheDocument());

    // No assignment button should be visible for a pure TEACHER
    expect(screen.queryByTestId('btn-asignar-docente')).not.toBeInTheDocument();
  });

  // F7-T6b: visible for ADMIN
  it('F7-T6b: "Asignar docente" button is visible for ADMIN', async () => {
    mockUser = adminUser;

    renderMateriasPage();

    await waitFor(() => expect(screen.getByText('Matemática')).toBeInTheDocument());
    await waitFor(() => {
      expect(screen.getAllByTestId('btn-asignar-docente').length).toBeGreaterThan(0);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F7-T7 — Regeneration warning in CourseCyclesPage
// ═════════════════════════════════════════════════════════════════════════════

describe('CourseCyclesPage — regeneration warning (F7-D1/D2)', () => {
  beforeEach(() => {
    mockUser = adminUser;
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/academic-cycles') {
        return Promise.resolve({ data: { data: [{ uuid: 'cy-1', name: '2026' }] } });
      }
      if (url === '/study-plans') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === '/institutions') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === '/course-cycles') {
        // Return existing CCs to trigger the warning
        return Promise.resolve({ data: { data: mockCourseCycles, page: 1, pageSize: 20, total: 2 } });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  // F7-T7: warning appears when CCs already exist (they were previously generated → may have materias)
  it('F7-T7: shows regeneration warning text when course cycles already exist', async () => {
    render(
      <MemoryRouter>
        <CourseCyclesPage />
      </MemoryRouter>,
    );

    // Wait for CCs to load
    await waitFor(() => expect(screen.getByText('Primer Año A')).toBeInTheDocument());

    // D1/D2 warning text must be visible
    expect(
      screen.getByText(/materias faltantes del plan/i),
    ).toBeInTheDocument();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F7-T8 — Teacher picker inline
// ═════════════════════════════════════════════════════════════════════════════

describe('MateriasGruposPage — teacher picker', () => {
  const mockTeachers = [
    { id: 'teacher-1', name: 'Ana García', firstName: 'Ana', lastName: 'García', roles: ['TEACHER'] },
    { id: 'teacher-2', name: 'Carlos López', firstName: 'Carlos', lastName: 'López', roles: ['TEACHER'] },
  ];

  beforeEach(() => {
    mockUser = adminUser;
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/course-cycles/cc-1/materias') {
        return Promise.resolve({ data: { data: mockMaterias } });
      }
      if (url === '/course-cycles/cc-1/materias/m-1/grupos') {
        return Promise.resolve({ data: { data: mockGruposMateria1 } });
      }
      if (url === '/course-cycles/cc-1/materias/m-2/grupos') {
        return Promise.resolve({ data: { data: mockGruposMateria2 } });
      }
      if (url.startsWith('/users')) {
        return Promise.resolve({ data: { data: mockTeachers } });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it('F7-T8: shows teacher dropdown inline when "Asignar docente" is clicked', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    renderMateriasPage();

    await waitFor(() => expect(screen.getByText('Matemática')).toBeInTheDocument());

    // Wait for grupos and asignar buttons to appear
    await waitFor(() => {
      expect(screen.getAllByTestId('btn-asignar-docente').length).toBeGreaterThan(0);
    });

    // Click the first "Asignar docente" button
    await user.click(screen.getAllByTestId('btn-asignar-docente')[0]);

    // Teacher picker should now be visible
    await waitFor(() => {
      expect(screen.getByTestId('teacher-picker')).toBeInTheDocument();
    });

    // Teacher select should contain teacher options
    await waitFor(() => {
      expect(screen.getByTestId('teacher-select')).toBeInTheDocument();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F7-T9 — Alumnos panel per grupo
// ═════════════════════════════════════════════════════════════════════════════

describe('MateriasGruposPage — alumnos per grupo', () => {
  const mockAlumnosMateria = [
    { id: 'axm-1', studentId: 'stu-1', studentName: 'Pedro Rodríguez' },
    { id: 'axm-2', studentId: 'stu-2', studentName: 'Laura Sánchez' },
  ];

  // GET /grupos/g-1/alumnos now returns {id, studentId, studentName} (enriched)
  const mockAlumnosGrupo = [
    { id: 'axg-1', studentId: 'stu-1', studentName: 'Pedro Rodríguez' },
  ];

  beforeEach(() => {
    mockUser = adminUser;
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/course-cycles/cc-1/materias') {
        return Promise.resolve({ data: { data: mockMaterias } });
      }
      if (url === '/course-cycles/cc-1/materias/m-1/grupos') {
        return Promise.resolve({ data: { data: mockGruposMateria1 } });
      }
      if (url === '/course-cycles/cc-1/materias/m-2/grupos') {
        return Promise.resolve({ data: { data: mockGruposMateria2 } });
      }
      if (url === '/grupos/g-1/alumnos') {
        return Promise.resolve({ data: { data: mockAlumnosGrupo } });
      }
      if (url === '/course-cycles/cc-1/materias/m-1/alumnos') {
        return Promise.resolve({ data: { data: mockAlumnosMateria } });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it('F7-T9: shows available alumnos when "Agregar alumnos" is clicked', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    renderMateriasPage();

    await waitFor(() => expect(screen.getByText('Matemática')).toBeInTheDocument());

    await waitFor(() => {
      expect(screen.getAllByTestId('btn-agregar-alumnos').length).toBeGreaterThan(0);
    });

    // Click "Agregar alumnos" on the first grupo
    await user.click(screen.getAllByTestId('btn-agregar-alumnos')[0]);

    // Panel should appear
    await waitFor(() => {
      expect(screen.getByTestId('alumnos-panel')).toBeInTheDocument();
    });

    // axm-2 (Laura Sánchez) is not yet in the grupo — should be shown as available
    await waitFor(() => {
      expect(screen.getByText('Laura Sánchez')).toBeInTheDocument();
    });

    // Pedro Rodríguez (studentId:'stu-1') is already assigned — must NOT appear in available list.
    // The filter compares by studentId: assignedStudentIds = {'stu-1'}.
    // available[0].studentId='stu-1' is in the set → filtered out.
    expect(screen.queryByTestId('btn-add-alumno-axm-1')).not.toBeInTheDocument();
    expect(screen.queryByText('Pedro Rodríguez')).not.toBeInTheDocument();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F7-T10 — Navigation buttons
// ═════════════════════════════════════════════════════════════════════════════

describe('MateriasGruposPage — navigation', () => {
  beforeEach(() => {
    mockUser = adminUser;
    setupDefaultMateriasApiMocks();
  });

  it('F7-T10: "Notas" button navigates to /competency-grading route', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/course-cycles/cc-1/materias']}>
        <Routes>
          <Route path="/course-cycles/:ccId/materias" element={<MateriasGruposPage />} />
          <Route
            path="/competency-grading"
            element={<div data-testid="competency-grading-page">Notas Page</div>}
          />
          <Route path="/attendance" element={<div data-testid="attendance-page">Asistencia Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Matemática')).toBeInTheDocument());

    // Wait for grupos to load and "Notas" buttons to appear
    await waitFor(() => {
      expect(screen.getAllByText('Notas').length).toBeGreaterThan(0);
    });

    await user.click(screen.getAllByText('Notas')[0]);

    // Should navigate to the competency-grading page
    await waitFor(() => {
      expect(screen.getByTestId('competency-grading-page')).toBeInTheDocument();
    });
  });

  it('F7-T10b: "Ausencias" button navigates to /attendance route', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/course-cycles/cc-1/materias']}>
        <Routes>
          <Route path="/course-cycles/:ccId/materias" element={<MateriasGruposPage />} />
          <Route
            path="/competency-grading"
            element={<div data-testid="competency-grading-page">Notas Page</div>}
          />
          <Route path="/attendance" element={<div data-testid="attendance-page">Asistencia Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Matemática')).toBeInTheDocument());

    await waitFor(() => {
      expect(screen.getAllByText('Ausencias').length).toBeGreaterThan(0);
    });

    await user.click(screen.getAllByText('Ausencias')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('attendance-page')).toBeInTheDocument();
    });
  });
});
