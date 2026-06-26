/**
 * AsistenciaMensualPage — unit tests (TDD RED, T-34 + T-FE-1 + T-FE-2).
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
 * WM-10: T-FE-1 — grid renders studentName, not the UUID
 * WM-11: T-FE-2 — pre-selects CC from ?ccId= search param (async list)
 * WM-12: T-FE-2 — no pre-selection when ccId not in list (graceful fallback)
 * WM-13: T-FE-2 — no regression: behavior unchanged when no ccId param
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
  { id: 'at-1', code: 'P', name: 'Presente', active: true, assignable: true },
  { id: 'at-2', code: 'A', name: 'Ausente', active: true, assignable: true },
];

const generalRows = [
  { id: 'row-1', courseCycleId: 'cc-1', studentId: 'stu-1', studentName: 'García, Juan', year: 2026, month: 6, days: {} },
  { id: 'row-2', courseCycleId: 'cc-1', studentId: 'stu-2', studentName: 'López, María', year: 2026, month: 6, days: { '1': 'P' } },
];

const materias = [
  { id: 'mx-1', subjectName: 'Matemática', courseCycleId: 'cc-1' },
  { id: 'mx-2', subjectName: 'Inglés', courseCycleId: 'cc-1' },
];

const grupos = [
  { id: 'grp-1', name: 'Básico', docenteName: 'Prof. Smith', materiaId: 'mx-2' },
];

const subjectRows = [
  { id: 'row-m1', materiaXCursoXCicloId: 'mx-1', studentId: 'stu-1', studentName: 'García, Juan', year: 2026, month: 6, days: {} },
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

/** Render the page inside a router with no URL params (regression-safe). */
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/asistencia-mensual']}>
      <AsistenciaMensualPage />
    </MemoryRouter>,
  );
}

/** Render the page with a ?ccId= param to test pre-selection (T-FE-2). */
function renderPageWithCcId(ccId: string) {
  return render(
    <MemoryRouter initialEntries={[`/asistencia-mensual?ccId=${ccId}`]}>
      <AsistenciaMensualPage />
    </MemoryRouter>,
  );
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
      if (url.endsWith('/materias')) {
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
      if (url.endsWith('/materias')) {
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

  // ── T-FE-1: studentName rendered instead of UUID ─────────────────────────

  it('WM-10: grid renders studentName (not the UUID) in the row label', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('grid-container')).toBeInTheDocument();
    });

    await waitFor(() => {
      // Names from fixture should appear as cell text
      expect(screen.getByText('García, Juan')).toBeInTheDocument();
      expect(screen.getByText('López, María')).toBeInTheDocument();
      // UUID values must NOT appear as visible text in the grid
      expect(screen.queryByText('stu-1')).not.toBeInTheDocument();
      expect(screen.queryByText('stu-2')).not.toBeInTheDocument();
    });
  });

  // ── T-FE-2: pre-selection from ?ccId= ────────────────────────────────────

  it('WM-11: pre-selects the CC matching ?ccId= param after list loads', async () => {
    const twoCourseCycles = [
      { uuid: 'cc-1', name: 'Primer Año A - 2026', level: 3 },
      { uuid: 'cc-2', name: 'Segundo Año B - 2026', level: 3 },
    ];

    mockGet.mockImplementation((url: string) => {
      if (url === '/course-cycles') return Promise.resolve({ data: { data: twoCourseCycles } });
      if (url === '/attendance-types') return Promise.resolve({ data: { data: attendanceTypes } });
      if (url.includes('/asistencia-mensual') && !url.includes('materia')) {
        return Promise.resolve({ data: { data: generalRows } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPageWithCcId('cc-2');

    await waitFor(() => {
      const selector = screen.getByTestId('cc-selector') as HTMLSelectElement;
      expect(selector.value).toBe('cc-2');
    });
  });

  it('WM-12: silent fallback when ?ccId= not found in list — no error thrown', async () => {
    // Unknown ccId → no pre-selection, no crash
    renderPageWithCcId('cc-unknown');

    await waitFor(() => {
      expect(screen.getByTestId('asistencia-mensual-page')).toBeInTheDocument();
    });
    // No toast-error should appear from this scenario
    expect(screen.queryByTestId('asistencia-toast')).not.toBeInTheDocument();
  });

  it('WM-13: no regression — behavior unchanged when no ccId param', async () => {
    renderPage();

    await waitFor(() => {
      // First CC is auto-selected (original behavior)
      const selector = screen.getByTestId('cc-selector') as HTMLSelectElement;
      expect(selector.value).toBe('cc-1');
    });
  });

  // ── 403 on materia list → "sin curso asignado" popup ─────────────────────

  it('WM-14: shows "sin curso asignado" popup when materias GET returns 403', async () => {
    const user = userEvent.setup();

    mockGet.mockImplementation((url: string) => {
      if (url === '/course-cycles') return Promise.resolve({ data: { data: courseCycles } });
      if (url === '/attendance-types') return Promise.resolve({ data: { data: attendanceTypes } });
      if (url.endsWith('/materias')) return Promise.reject({ response: { status: 403 } });
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => expect(screen.getByTestId('tab-materia')).toBeInTheDocument());
    await user.click(screen.getByTestId('tab-materia'));

    await waitFor(() => {
      expect(screen.getByTestId('alert-modal-overlay')).toBeInTheDocument();
    });
  });

  it('WM-15: shows "sin curso asignado" popup when materias list is empty (200)', async () => {
    const user = userEvent.setup();

    mockGet.mockImplementation((url: string) => {
      if (url === '/course-cycles') return Promise.resolve({ data: { data: courseCycles } });
      if (url === '/attendance-types') return Promise.resolve({ data: { data: attendanceTypes } });
      if (url.endsWith('/materias')) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => expect(screen.getByTestId('tab-materia')).toBeInTheDocument());
    await user.click(screen.getByTestId('tab-materia'));

    await waitFor(() => {
      expect(screen.getByTestId('alert-modal-overlay')).toBeInTheDocument();
    });
  });

  // ── GRID scenarios — T8.1 (REQ-GRID-1..7 / Scenarios GRID-1..7) ─────────────

  describe('GRID scenarios — T8.1', () => {
    // Full attendance types including non-assignable system codes
    const fullTypes = [
      { id: 'at-1', code: 'P', name: 'Presente', active: true, assignable: true },
      { id: 'at-2', code: 'A', name: 'Ausente', active: true, assignable: true },
      { id: 'at-3', code: 'SAB', name: 'Sábado', active: true, assignable: false },
      { id: 'at-4', code: 'DOM', name: 'Domingo', active: true, assignable: false },
      { id: 'at-5', code: 'X', name: 'No existe', active: true, assignable: false },
    ];

    // Row with days 4=SAB, 5=DOM, 29/30/31=X; day 6 has no entry (editable)
    const lockedRow = {
      id: 'row-grid',
      courseCycleId: 'cc-1',
      studentId: 'stu-grid',
      studentName: 'Test Student',
      year: 2026,
      month: 6,
      days: { '4': 'SAB', '5': 'DOM', '29': 'X', '30': 'X', '31': 'X' },
    };

    /** Render the page returning locked rows and full attendance types. */
    function renderWithLockedRows() {
      mockGet.mockImplementation((url: string) => {
        if (url === '/course-cycles') return Promise.resolve({ data: { data: courseCycles } });
        if (url === '/attendance-types') return Promise.resolve({ data: { data: fullTypes } });
        if (url.includes('/asistencia-mensual')) return Promise.resolve({ data: { data: [lockedRow] } });
        return Promise.resolve({ data: { data: [] } });
      });
      return render(
        <MemoryRouter initialEntries={['/asistencia-mensual']}>
          <AsistenciaMensualPage />
        </MemoryRouter>,
      );
    }

    it('GRID-1: renders exactly 31 day columns for any month (REQ-GRID-1)', async () => {
      renderWithLockedRows();
      await waitFor(() => expect(screen.getByTestId('grid-container')).toBeInTheDocument());
      await waitFor(() => {
        const allHeaders = screen.getAllByRole('columnheader');
        // Day headers have numeric text content; "Alumno" header does not
        const dayHeaders = allHeaders.filter(
          (h) => h.textContent !== null && /^\d+$/.test(h.textContent.trim()),
        );
        expect(dayHeaders).toHaveLength(31);
      });
    });

    it('GRID-2: SAB cell renders as read-only span with correct testid (REQ-GRID-2)', async () => {
      renderWithLockedRows();
      await waitFor(() =>
        expect(screen.getByTestId('cell-locked-stu-grid-4')).toBeInTheDocument(),
      );
      const lockedCell = screen.getByTestId('cell-locked-stu-grid-4');
      expect(lockedCell.tagName.toLowerCase()).toBe('span');
      expect(lockedCell).toHaveTextContent('SAB');
      // No editable select for this cell
      expect(screen.queryByTestId('cell-stu-grid-4')).not.toBeInTheDocument();
    });

    it('GRID-2 (style): locked cell has visually distinct style (REQ-GRID-2)', async () => {
      renderWithLockedRows();
      await waitFor(() =>
        expect(screen.getByTestId('cell-locked-stu-grid-4')).toBeInTheDocument(),
      );
      const lockedCell = screen.getByTestId('cell-locked-stu-grid-4');
      // cursor: not-allowed signals non-interactable cell
      expect(lockedCell).toHaveStyle({ cursor: 'not-allowed' });
    });

    it('GRID-3: DOM cell renders as read-only with no select (REQ-GRID-3)', async () => {
      renderWithLockedRows();
      await waitFor(() =>
        expect(screen.getByTestId('cell-locked-stu-grid-5')).toBeInTheDocument(),
      );
      expect(screen.getByTestId('cell-locked-stu-grid-5')).toHaveTextContent('DOM');
      expect(screen.queryByTestId('cell-stu-grid-5')).not.toBeInTheDocument();
    });

    it('GRID-4: X cells for days 29, 30, 31 are locked read-only (REQ-GRID-4)', async () => {
      renderWithLockedRows();
      await waitFor(() => {
        expect(screen.getByTestId('cell-locked-stu-grid-29')).toBeInTheDocument();
        expect(screen.getByTestId('cell-locked-stu-grid-30')).toBeInTheDocument();
        expect(screen.getByTestId('cell-locked-stu-grid-31')).toBeInTheDocument();
      });
      for (const d of [29, 30, 31]) {
        expect(screen.queryByTestId(`cell-stu-grid-${d}`)).not.toBeInTheDocument();
      }
    });

    it('GRID-5: hábil cell renders a select with only assignable codes (REQ-GRID-5)', async () => {
      renderWithLockedRows();
      // Day 6 has no entry in lockedRow.days → editable
      await waitFor(() =>
        expect(screen.getByTestId('cell-stu-grid-6')).toBeInTheDocument(),
      );
      const select = screen.getByTestId('cell-stu-grid-6') as HTMLSelectElement;
      const optionValues = Array.from(select.options)
        .map((o) => o.value)
        .filter((v) => v !== '');
      expect(optionValues).toContain('P');
      expect(optionValues).toContain('A');
      expect(optionValues).not.toContain('SAB');
      expect(optionValues).not.toContain('DOM');
      expect(optionValues).not.toContain('X');
    });

    it('GRID-6: combo uses assignable flag — custom non-assignable code excluded (REQ-GRID-6)', async () => {
      const typesWithCustom = [
        ...fullTypes,
        { id: 'at-6', code: 'CUSTOM', name: 'Custom non-assignable', active: true, assignable: false },
      ];
      mockGet.mockImplementation((url: string) => {
        if (url === '/course-cycles') return Promise.resolve({ data: { data: courseCycles } });
        if (url === '/attendance-types') return Promise.resolve({ data: { data: typesWithCustom } });
        if (url.includes('/asistencia-mensual')) return Promise.resolve({ data: { data: [lockedRow] } });
        return Promise.resolve({ data: { data: [] } });
      });
      render(
        <MemoryRouter initialEntries={['/asistencia-mensual']}>
          <AsistenciaMensualPage />
        </MemoryRouter>,
      );
      await waitFor(() =>
        expect(screen.getByTestId('cell-stu-grid-6')).toBeInTheDocument(),
      );
      const select = screen.getByTestId('cell-stu-grid-6') as HTMLSelectElement;
      const optionValues = Array.from(select.options).map((o) => o.value);
      expect(optionValues).not.toContain('CUSTOM');
    });

    it('GRID-7: clicking a locked cell does not trigger any API call (REQ-GRID-7)', async () => {
      const user = userEvent.setup();
      renderWithLockedRows();
      await waitFor(() =>
        expect(screen.getByTestId('cell-locked-stu-grid-4')).toBeInTheDocument(),
      );
      const lockedCell = screen.getByTestId('cell-locked-stu-grid-4');
      await user.click(lockedCell);
      // No PATCH should have been called; cell stays read-only
      expect(mockPatch).not.toHaveBeenCalled();
      expect(lockedCell.tagName.toLowerCase()).toBe('span');
    });
  });
});
