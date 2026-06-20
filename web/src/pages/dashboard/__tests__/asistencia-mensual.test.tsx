/**
 * AsistenciaMensualPage — unit tests (TDD RED, T-34).
 * Tests written BEFORE the component exists (strict TDD).
 *
 * WM-01: renders the planilla container
 * WM-02: shows a CourseCycle selector
 * WM-03: "Generar" button calls POST /course-cycles/:ccId/asistencia-mensual/generate
 * WM-04: after rows load, shows student grid with one row per student
 * WM-05: clicking a day cell calls PATCH /course-cycles/:ccId/asistencia-mensual/dia
 * WM-06: subject tab is visible (mode switch)
 * WM-07: materia mode — materia selector appears after tab switch
 * WM-08: materia mode — grupoId filter appears when materia has groups
 * WM-09: materia mode — GET subject rows passes grupoId when group is selected
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

// ── Mock apiClient ────────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();

vi.mock('../../../api/client', () => ({
  default: {
    get: mockGet,
    post: mockPost,
    patch: mockPatch,
  },
}));

// ── Mock auth ─────────────────────────────────────────────────────────────────

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      email: 'admin@test.com',
      name: 'Admin',
      roles: ['ADMIN'],
      institutionId: 'inst-1',
    },
    logout: vi.fn(),
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    accessToken: 'fake-token',
  }),
}));

vi.mock('../../../context/institution-context', () => ({
  useInstitution: () => ({
    config: {
      id: 'inst-1',
      name: 'Escuela Test',
      levels: [30],
      send_email: false,
      send_messages: false,
    },
    isLoading: false,
    error: null,
    reload: vi.fn(),
    clear: vi.fn(),
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const courseCycles = [
  { uuid: 'cc-1', name: 'Primer Año A - 2026', level: 3 },
];

const attendanceTypes = [
  { id: 'at-1', code: 'P', name: 'Presente', active: true },
  { id: 'at-2', code: 'A', name: 'Ausente', active: true },
];

const generalRows = [
  { id: 'row-1', courseCycleId: 'cc-1', studentId: 'stu-1', year: 2026, month: 6, days: {} },
  { id: 'row-2', courseCycleId: 'cc-1', studentId: 'stu-2', year: 2026, month: 6, days: { '1': 'P' } },
];

const materias = [
  { id: 'mx-1', subjectName: 'Matemática', courseCycleId: 'cc-1' },
  { id: 'mx-2', subjectName: 'Inglés', courseCycleId: 'cc-1' },
];

const grupos = [
  { id: 'grp-1', name: 'Básico', docenteName: 'Prof. Smith', materiaId: 'mx-2' },
];

const subjectRows = [
  { id: 'row-m1', materiaXCursoXCicloId: 'mx-1', studentId: 'stu-1', year: 2026, month: 6, days: {} },
];

// ── Lazy import (mocks must be set up first) ──────────────────────────────────

let AsistenciaMensualPage: React.ComponentType<object>;

beforeEach(async () => {
  vi.clearAllMocks();

  // Default mock: course-cycles + attendance-types on mount
  mockGet.mockImplementation((url: string) => {
    if (url === '/course-cycles') {
      return Promise.resolve({ data: { data: courseCycles } });
    }
    if (url === '/attendance-types') {
      return Promise.resolve({ data: { data: attendanceTypes } });
    }
    if (url.includes('/asistencia-mensual') && !url.includes('materia')) {
      return Promise.resolve({ data: { data: generalRows } });
    }
    if (url.includes('/materias-curso-ciclo') && url.includes('/asistencia-mensual')) {
      return Promise.resolve({ data: { data: subjectRows } });
    }
    if (url.includes('/materias-curso-ciclo') && !url.includes('/asistencia-mensual')) {
      return Promise.resolve({ data: { data: materias } });
    }
    if (url.includes('/grupos')) {
      return Promise.resolve({ data: { data: grupos } });
    }
    return Promise.resolve({ data: { data: [] } });
  });

  mockPost.mockResolvedValue({
    data: { data: { generalCreated: 2, generalSkipped: 0, materiaCreated: 2, materiaSkipped: 0 } },
  });
  mockPatch.mockResolvedValue({
    data: { data: { ...generalRows[0], days: { '5': 'P' } } },
  });

  const mod = await import('../asistencia-mensual');
  AsistenciaMensualPage = (mod as unknown as { default: React.ComponentType<object> }).default;
});

afterEach(() => cleanup());

function renderPage() {
  return render(<AsistenciaMensualPage />);
}

// ═════════════════════════════════════════════════════════════════════════════
describe('AsistenciaMensualPage', () => {
  it('WM-01: renders the planilla container', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('asistencia-mensual-page')).toBeInTheDocument();
    });
  });

  it('WM-02: shows a CourseCycle selector', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('cc-selector')).toBeInTheDocument();
    });
  });

  it('WM-03: "Generar" button calls POST generate endpoint', async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for CC selector to load with the first option auto-selected
    await waitFor(() => {
      expect(screen.getByTestId('btn-generar')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('btn-generar'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('/asistencia-mensual/generate'),
        expect.objectContaining({ year: expect.any(Number), month: expect.any(Number) }),
      );
    });
  });

  it('WM-04: after rows load, shows one row per student in the grid', async () => {
    renderPage();

    await waitFor(() => {
      // Grid container should be present
      expect(screen.getByTestId('grid-container')).toBeInTheDocument();
    });

    // Each student row should be present
    await waitFor(() => {
      expect(screen.getByTestId('student-row-stu-1')).toBeInTheDocument();
      expect(screen.getByTestId('student-row-stu-2')).toBeInTheDocument();
    });
  });

  it('WM-05: clicking a day cell in the grid calls PATCH with correct payload', async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for grid to load with cells
    await waitFor(() => {
      expect(screen.getByTestId('grid-container')).toBeInTheDocument();
    });

    // Find a day cell for student stu-1, day 3 (should be a select/button)
    await waitFor(() => {
      expect(screen.getByTestId('cell-stu-1-3')).toBeInTheDocument();
    });

    // Select 'A' (Ausente) in the cell
    const cell = screen.getByTestId('cell-stu-1-3') as HTMLSelectElement;
    await user.selectOptions(cell, 'A');

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        expect.stringContaining('/asistencia-mensual/dia'),
        expect.objectContaining({
          studentId: 'stu-1',
          day: 3,
          statusCode: 'A',
        }),
      );
    });
  });

  it('WM-06: shows subject tab for mode switching', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('tab-materia')).toBeInTheDocument();
    });
  });

  it('WM-07: switching to materia mode shows materia selector', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByTestId('tab-materia')).toBeInTheDocument());
    await user.click(screen.getByTestId('tab-materia'));

    await waitFor(() => {
      expect(screen.getByTestId('materia-selector')).toBeInTheDocument();
    });
  });

  it('WM-08: materia mode shows grupo filter when materia has grupos', async () => {
    const user = userEvent.setup();

    // Override: GET /grupos returns the grupo list for mx-2 (Inglés, has groups)
    mockGet.mockImplementation((url: string) => {
      if (url === '/course-cycles') return Promise.resolve({ data: { data: courseCycles } });
      if (url === '/attendance-types') return Promise.resolve({ data: { data: attendanceTypes } });
      if (url.includes('/materias-curso-ciclo') && !url.includes('/asistencia-mensual')) {
        return Promise.resolve({ data: { data: materias } });
      }
      if (url.includes('/grupos')) return Promise.resolve({ data: { data: grupos } });
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => expect(screen.getByTestId('tab-materia')).toBeInTheDocument());
    await user.click(screen.getByTestId('tab-materia'));

    await waitFor(() => expect(screen.getByTestId('materia-selector')).toBeInTheDocument());

    // Select the materia that has groups (Inglés, mx-2)
    const materiaSelect = screen.getByTestId('materia-selector') as HTMLSelectElement;
    await user.selectOptions(materiaSelect, 'mx-2');

    // Grupo selector should appear because Inglés has groups
    await waitFor(() => {
      expect(screen.getByTestId('grupo-selector')).toBeInTheDocument();
    });
  });

  it('WM-09: materia mode passes grupoId to GET request when group is selected', async () => {
    const user = userEvent.setup();

    mockGet.mockImplementation((url: string) => {
      if (url === '/course-cycles') return Promise.resolve({ data: { data: courseCycles } });
      if (url === '/attendance-types') return Promise.resolve({ data: { data: attendanceTypes } });
      if (url.includes('/materias-curso-ciclo') && !url.includes('/asistencia-mensual')) {
        return Promise.resolve({ data: { data: materias } });
      }
      if (url.includes('/grupos')) return Promise.resolve({ data: { data: grupos } });
      if (url.includes('/asistencia-mensual')) return Promise.resolve({ data: { data: subjectRows } });
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => expect(screen.getByTestId('tab-materia')).toBeInTheDocument());
    await user.click(screen.getByTestId('tab-materia'));

    await waitFor(() => expect(screen.getByTestId('materia-selector')).toBeInTheDocument());
    await user.selectOptions(screen.getByTestId('materia-selector') as HTMLSelectElement, 'mx-2');

    await waitFor(() => expect(screen.getByTestId('grupo-selector')).toBeInTheDocument());
    await user.selectOptions(screen.getByTestId('grupo-selector') as HTMLSelectElement, 'grp-1');

    await waitFor(() => {
      // Should have called GET with grupoId query param
      const calls = mockGet.mock.calls.map((c) => c[0] as string);
      expect(calls.some((url) => url.includes('grupoId=grp-1'))).toBe(true);
    });
  });
});
