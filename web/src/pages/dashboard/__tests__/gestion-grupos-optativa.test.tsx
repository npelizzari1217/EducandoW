/**
 * GestionGrupos — PR3 optativas tests
 *
 * TDD RED phase: these tests must fail before implementation.
 * They cover:
 *  - Optativa badge renders when esOptativa === true
 *  - Badge absent when esOptativa === false
 *  - Toggle PATCH is called with the inverse value, then refetches materias
 *  - Materia-universe modal fetches ?eligible=true
 *  - Modal add calls POST with studentId
 *  - Modal remove calls DELETE with enrollment id
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

// ── Mock API client ───────────────────────────────────────────────────────────
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiDelete = vi.fn();
const mockApiPatch = vi.fn();

vi.mock('../../../api/client', () => ({
  default: {
    get: mockApiGet,
    post: mockApiPost,
    patch: mockApiPatch,
    delete: mockApiDelete,
  },
}));

// ── Mock contexts ─────────────────────────────────────────────────────────────
vi.mock('../../../context/institution-context', () => ({
  useInstitution: () => ({
    config: {
      id: 'inst-1', name: 'Escuela Test', levels: [30],
      send_email: false, send_messages: false, logo_url: null,
      header_color: null, header_text_color: null, body_color: null,
      body_text_color: null, footer_color: null, footer_text_color: null,
    },
    isLoading: false, error: null, reload: vi.fn(), clear: vi.fn(),
  }),
}));

// ROOT user so that the toggle is visible (isRoot=true in the component).
let mockUser = {
  id: 'root-1', email: 'root@test.com', name: 'Root User',
  role: 'ROOT', roles: ['ROOT'],
  institutionId: 'inst-1', levels: [30],
  userLevels: [{ level: 3, modality: 0 }],
  modules: [{ moduleCode: 'COURSE_CYCLES', actions: ['READ', 'WRITE', 'UPDATE', 'DELETE'] }],
};

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn(), isLoading: false, login: vi.fn(), accessToken: 'fake' }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────
const mockCourseCycles = [{ uuid: 'cc-1', courseName: 'Primer Año A', level: 30 }];

const mockMaterias = [
  { id: 'm-1', subjectName: 'Matemática', esOptativa: false },
  { id: 'm-2', subjectName: 'Arte', esOptativa: true },
];

const mockGrupos = [
  {
    id: 'g-1', name: 'Grupo A', docenteName: 'Ana García', docenteUserId: 'teacher-1',
    materiaId: 'm-1', subjectName: 'Matemática', courseCycleId: 'cc-1',
    courseName: 'Primer Año A', level: 30, alumnosCount: 5,
  },
];

const mockInscriptos = [{ id: 'enr-1', studentId: 'stu-1', studentName: 'Juan Pérez' }];
const mockEligibles = [{ id: 'cc-enr-1', studentId: 'stu-2', studentName: 'María García' }];

// ── Default mock setup ────────────────────────────────────────────────────────
function setupDefaultMocks() {
  mockApiGet.mockImplementation(
    (url: string, config?: { params?: Record<string, string> }) => {
      if (url === '/grupos') return Promise.resolve({ data: mockGrupos });
      if (url === '/institutions')
        return Promise.resolve({ data: { data: [{ id: 'inst-1', name: 'Escuela Test' }] } });
      if (url === '/course-cycles')
        return Promise.resolve({ data: { data: mockCourseCycles } });
      if (url.includes('/materias') && url.includes('/alumnos')) {
        if (config?.params?.eligible === 'true')
          return Promise.resolve({ data: { data: mockEligibles } });
        return Promise.resolve({ data: { data: mockInscriptos } });
      }
      if (url.includes('/materias'))
        return Promise.resolve({ data: { data: mockMaterias } });
      if (url.includes('/users'))
        return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: [] });
    },
  );
  mockApiPatch.mockResolvedValue({ data: { data: { id: 'm-2', subjectName: 'Arte', esOptativa: false } } });
  mockApiPost.mockResolvedValue({ data: { data: { id: 'enr-new', studentId: 'stu-2' } } });
  mockApiDelete.mockResolvedValue({ data: {} });
}

// ── Component loader ──────────────────────────────────────────────────────────
let GestionGruposPage: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  setupDefaultMocks();
  const module = await import('../gestion-grupos');
  GestionGruposPage = module.default;
});

afterEach(() => cleanup());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/grupos']}>
      <Routes>
        <Route path="/grupos" element={<GestionGruposPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Select a level + CC to trigger materia load and show the materia management section. */
async function selectCC() {
  const levelSelect = screen.getByTestId('filter-level');
  await userEvent.selectOptions(levelSelect, '30');
  await waitFor(() =>
    expect(screen.getByTestId('filter-course-cycle')).not.toBeDisabled(),
  );
  const ccSelect = screen.getByTestId('filter-course-cycle');
  await userEvent.selectOptions(ccSelect, 'cc-1');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GGO — optativas PR3', () => {
  it('GGO-T1: badge renders next to materia with esOptativa === true', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Grupo A'));
    await selectCC();

    await waitFor(() =>
      expect(screen.getByTestId('badge-optativa-m-2')).toBeInTheDocument(),
    );
  });

  it('GGO-T2: badge is absent for materia with esOptativa === false', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Grupo A'));
    await selectCC();

    // Wait for materia management section to appear
    await waitFor(() =>
      expect(screen.getByTestId('badge-optativa-m-2')).toBeInTheDocument(),
    );
    // badge for m-1 (esOptativa:false) must not exist
    expect(screen.queryByTestId('badge-optativa-m-1')).not.toBeInTheDocument();
  });

  it('GGO-T3: toggle calls PATCH with inverse value (true → false)', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Grupo A'));
    await selectCC();

    // Wait for toggle to appear (m-2 is esOptativa:true)
    await waitFor(() =>
      expect(screen.getByTestId('toggle-optativa-m-2')).toBeInTheDocument(),
    );

    const toggle = screen.getByTestId('toggle-optativa-m-2');
    // m-2 is currently true → clicking it should PATCH with esOptativa: false
    await userEvent.click(toggle);

    await waitFor(() =>
      expect(mockApiPatch).toHaveBeenCalledWith(
        '/course-cycles/cc-1/materias/m-2',
        { esOptativa: false },
        expect.anything(),
      ),
    );
  });

  it('GGO-T4: after toggle PATCH, GET materias is refetched', async () => {
    let materiasCallCount = 0;
    mockApiGet.mockImplementation(
      (url: string, config?: { params?: Record<string, string> }) => {
        if (url === '/grupos') return Promise.resolve({ data: mockGrupos });
        if (url === '/institutions')
          return Promise.resolve({ data: { data: [{ id: 'inst-1', name: 'Escuela Test' }] } });
        if (url === '/course-cycles')
          return Promise.resolve({ data: { data: mockCourseCycles } });
        if (url.includes('/materias') && url.includes('/alumnos')) {
          if (config?.params?.eligible === 'true')
            return Promise.resolve({ data: { data: mockEligibles } });
          return Promise.resolve({ data: { data: mockInscriptos } });
        }
        if (url.includes('/materias')) {
          materiasCallCount++;
          return Promise.resolve({ data: { data: mockMaterias } });
        }
        if (url.includes('/users'))
          return Promise.resolve({ data: { data: [] } });
        return Promise.resolve({ data: [] });
      },
    );

    renderPage();
    await waitFor(() => screen.getByText('Grupo A'));
    await selectCC();

    await waitFor(() =>
      expect(screen.getByTestId('toggle-optativa-m-2')).toBeInTheDocument(),
    );

    const callsBefore = materiasCallCount;
    await userEvent.click(screen.getByTestId('toggle-optativa-m-2'));

    // After PATCH, GET materias must be called again (refetch)
    await waitFor(() => expect(materiasCallCount).toBeGreaterThan(callsBefore));
  });

  it('GGO-T5: opening materia modal fetches ?eligible=true endpoint', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Grupo A'));
    await selectCC();

    await waitFor(() =>
      expect(screen.getByTestId('btn-inscriptos-m-2')).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByTestId('btn-inscriptos-m-2'));

    await waitFor(() =>
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('/course-cycles/cc-1/materias/m-2/alumnos'),
        expect.objectContaining({
          params: expect.objectContaining({ eligible: 'true' }),
        }),
      ),
    );
  });

  it('GGO-T6: modal add button calls POST with studentId from eligible list', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Grupo A'));
    await selectCC();

    await waitFor(() =>
      expect(screen.getByTestId('btn-inscriptos-m-2')).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByTestId('btn-inscriptos-m-2'));

    // Wait for eligible student to appear in modal
    await waitFor(() =>
      expect(screen.getByTestId('btn-add-materia-alumno-cc-enr-1')).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByTestId('btn-add-materia-alumno-cc-enr-1'));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith(
        '/course-cycles/cc-1/materias/m-2/alumnos',
        { studentId: 'stu-2' },
        expect.anything(),
      ),
    );
  });

  it('GGO-T7: modal remove button calls DELETE with enrollment id', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Grupo A'));
    await selectCC();

    await waitFor(() =>
      expect(screen.getByTestId('btn-inscriptos-m-2')).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByTestId('btn-inscriptos-m-2'));

    // Wait for current inscripto to appear in modal
    await waitFor(() =>
      expect(screen.getByTestId('btn-remove-materia-alumno-enr-1')).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByTestId('btn-remove-materia-alumno-enr-1'));

    await waitFor(() =>
      expect(mockApiDelete).toHaveBeenCalledWith(
        '/course-cycles/cc-1/materias/m-2/alumnos/enr-1',
        expect.anything(),
      ),
    );
  });
});

// ── Toggle authorization tests (authz fix) ────────────────────────────────────

describe('GGO — toggle authorization (COURSE_CYCLES:UPDATE)', () => {
  // Restore ROOT user after each test so sibling suites are not affected.
  afterEach(() => {
    mockUser = {
      id: 'root-1', email: 'root@test.com', name: 'Root User',
      role: 'ROOT', roles: ['ROOT'],
      institutionId: 'inst-1', levels: [30],
      userLevels: [{ level: 3, modality: 0 }],
      modules: [{ moduleCode: 'COURSE_CYCLES', actions: ['READ', 'WRITE', 'UPDATE', 'DELETE'] }],
    };
  });

  it('GGO-T8: module-permitted admin (non-ROOT) with COURSE_CYCLES:UPDATE sees the toggle', async () => {
    mockUser = {
      id: 'admin-1', email: 'admin@test.com', name: 'Admin User',
      role: 'ADMIN', roles: ['ADMIN'],
      institutionId: 'inst-1', levels: [30],
      userLevels: [{ level: 3, modality: 0 }],
      modules: [{ moduleCode: 'COURSE_CYCLES', actions: ['UPDATE'] }],
    };

    renderPage();
    await waitFor(() => screen.getByText('Grupo A'));
    await selectCC();

    // materia management section with m-2 (esOptativa:true) should appear
    await waitFor(() =>
      expect(screen.getByTestId('badge-optativa-m-2')).toBeInTheDocument(),
    );
    // toggle MUST be visible for this module-permitted admin
    expect(screen.getByTestId('toggle-optativa-m-2')).toBeInTheDocument();
  });

  it('GGO-T9: user without COURSE_CYCLES:UPDATE does NOT see the toggle', async () => {
    mockUser = {
      id: 'admin-2', email: 'limited@test.com', name: 'Limited Admin',
      role: 'ADMIN', roles: ['ADMIN'],
      institutionId: 'inst-1', levels: [30],
      userLevels: [{ level: 3, modality: 0 }],
      modules: [{ moduleCode: 'COURSE_CYCLES', actions: ['READ'] }],
    };

    renderPage();
    await waitFor(() => screen.getByText('Grupo A'));
    await selectCC();

    // Badge is visible for all users (no authz gate)
    await waitFor(() =>
      expect(screen.getByTestId('badge-optativa-m-2')).toBeInTheDocument(),
    );
    // toggle must NOT be visible without UPDATE permission
    expect(screen.queryByTestId('toggle-optativa-m-2')).not.toBeInTheDocument();
  });
});
