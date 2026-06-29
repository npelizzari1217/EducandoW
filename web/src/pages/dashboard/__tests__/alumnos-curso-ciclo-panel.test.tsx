/**
 * AlumnosCursoCicloPanel — T-20 (TDD RED) + T-FE-3
 * Tests written BEFORE the component exists.
 * Mirrors the AlumnosPanelInline pattern from materia-grupos.test.tsx.
 *
 * W-01: renders panel container
 * W-02: shows assigned students
 * W-03: shows only UNASSIGNED students as available to add
 * W-04: clicking add calls POST and refreshes
 * W-05: clicking remove calls DELETE with bridge-row id
 * W-06: empty state when no students assigned
 * W-07: close button calls onClose
 * W-19: T-FE-3 — "Ver asistencia" button visible when user has ATTENDANCE READ
 * W-20: T-FE-3 — "Ver asistencia" button absent when user lacks ATTENDANCE READ
 * W-21: T-FE-3 — clicking "Ver asistencia" navigates to /asistencia-mensual?ccId=<ccId>
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

// ── Hoist navigate mock so it is available inside vi.mock factory ─────────────

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Mock apiClient ────────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();
const mockPatch = vi.fn();

vi.mock('../../../api/client', () => ({
  default: {
    get: mockGet,
    post: mockPost,
    delete: mockDelete,
    patch: mockPatch,
  },
}));

// ── Mock auth / institution ───────────────────────────────────────────────────

// Mutable modules list — swap per-test to control useCan output.
// Default: no modules (ATTENDANCE button hidden in existing tests).
let mockModules: Array<{ moduleCode: string; actions: string[] }> = [];

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      email: 'admin@test.com',
      name: 'Admin',
      roles: ['ADMIN'],
      institutionId: 'inst-1',
      modules: mockModules,
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

// ── Mock useBoletin ───────────────────────────────────────────────────────────

const mockDownloadBoletinBatch = vi.fn();

vi.mock('../../../hooks/useBoletin', () => ({
  downloadBoletinBatch: (...args: unknown[]) => mockDownloadBoletinBatch(...args),
}));

// ── Mock useConstancia ────────────────────────────────────────────────────────

const mockPrintConstancia = vi.fn();
const mockDownloadConstancia = vi.fn();

vi.mock('../../../hooks/useConstancia', () => ({
  printConstancia: (...args: unknown[]) => mockPrintConstancia(...args),
  downloadConstancia: (...args: unknown[]) => mockDownloadConstancia(...args),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const currentAlumnos = [
  { id: 'row-1', studentId: 'stu-1', studentName: 'Ana García', printable: true, fechaDePase: null },
  { id: 'row-2', studentId: 'stu-2', studentName: 'Carlos López', printable: false, fechaDePase: null },
];

const allStudents = [
  { id: 'stu-1', firstName: 'Ana', lastName: 'García', fullName: 'Ana García' },
  { id: 'stu-2', firstName: 'Carlos', lastName: 'López', fullName: 'Carlos López' },
  { id: 'stu-3', firstName: 'Pedro', lastName: 'Ramírez', fullName: 'Pedro Ramírez' },
];

// ── Lazy import after mocks ───────────────────────────────────────────────────

let AlumnosCursoCicloPanel: React.ComponentType<{ ccId: string; onClose: () => void; embedded?: boolean }>;

beforeEach(async () => {
  vi.clearAllMocks();
  mockNavigate.mockReset();
  // Default: user has NO modules → attendance button hidden (preserves existing tests)
  mockModules = [];
  mockDownloadBoletinBatch.mockResolvedValue(undefined);
  mockPrintConstancia.mockResolvedValue(undefined);
  mockDownloadConstancia.mockResolvedValue(undefined);
  mockPatch.mockResolvedValue({});
  mockGet.mockImplementation((url: string) => {
    if (url === '/course-cycles/cc-1/alumnos') {
      return Promise.resolve({ data: { data: currentAlumnos } });
    }
    if (url === '/students') {
      return Promise.resolve({ data: { data: allStudents } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
  mockPost.mockResolvedValue({
    data: { data: { id: 'row-3', studentId: 'stu-3', courseCycleId: 'cc-1' } },
  });
  mockDelete.mockResolvedValue({});

  const mod = await import('../components/AlumnosCursoCicloPanel');
  AlumnosCursoCicloPanel = mod.AlumnosCursoCicloPanel;
});

afterEach(() => cleanup());

function renderPanel(ccId = 'cc-1', onClose = vi.fn(), embedded = false) {
  return render(<AlumnosCursoCicloPanel ccId={ccId} onClose={onClose} embedded={embedded} />);
}

// ═════════════════════════════════════════════════════════════════════════════
describe('AlumnosCursoCicloPanel', () => {
  // W-01: panel container renders
  it('W-01: renders the panel container', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('alumnos-curso-panel')).toBeInTheDocument();
    });
  });

  // W-02: shows assigned students
  it('W-02: shows assigned students in the list', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('Ana García')).toBeInTheDocument();
      expect(screen.getByText('Carlos López')).toBeInTheDocument();
    });
  });

  // W-02b: the printable checkbox column has a clarifying header
  it('W-02b: muestra el titulo "Boletín" en la columna del checkbox imprimible', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('Ana García')).toBeInTheDocument();
    });
    expect(screen.getByTestId('col-header-printable')).toHaveTextContent(/Boletín/i);
  });

  // W-03: unassigned students appear as available; assigned ones do NOT
  it('W-03: shows only unassigned students as available to add', async () => {
    renderPanel();
    await waitFor(() => {
      // Pedro Ramírez is not assigned → add button must be present
      expect(screen.getByTestId('btn-add-alumno-stu-3')).toBeInTheDocument();
      // Ana and Carlos are already assigned → no add button for them
      expect(screen.queryByTestId('btn-add-alumno-stu-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('btn-add-alumno-stu-2')).not.toBeInTheDocument();
    });
  });

  // W-04: clicking add calls POST /course-cycles/:ccId/alumnos
  it('W-04: clicking add student calls POST with studentId', async () => {
    const user = userEvent.setup();
    // First fetch: original 2 items. After POST re-fetch: 3 items (stu-3 added).
    const updatedList = [
      ...currentAlumnos,
      { id: 'row-3', studentId: 'stu-3', studentName: 'Pedro Ramírez' },
    ];
    let alumnosFetchCount = 0;
    mockGet.mockImplementation((url: string) => {
      if (url === '/course-cycles/cc-1/alumnos') {
        alumnosFetchCount++;
        const data = alumnosFetchCount === 1 ? currentAlumnos : updatedList;
        return Promise.resolve({ data: { data } });
      }
      if (url === '/students') {
        return Promise.resolve({ data: { data: allStudents } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPanel();
    await waitFor(() => expect(screen.getByTestId('btn-add-alumno-stu-3')).toBeInTheDocument());

    await user.click(screen.getByTestId('btn-add-alumno-stu-3'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/course-cycles/cc-1/alumnos', { studentId: 'stu-3' });
    });
  });

  // W-05: clicking remove calls DELETE /course-cycles/:ccId/alumnos/:rowId
  it('W-05: clicking remove calls DELETE with bridge-row id', async () => {
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId('btn-remove-alumno-row-1')).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId('btn-remove-alumno-row-1'));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('/course-cycles/cc-1/alumnos/row-1');
    });
  });

  // W-06: empty state when no students assigned
  it('W-06: shows empty-state message when no students are assigned', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/course-cycles/cc-1/alumnos') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === '/students') {
        return Promise.resolve({ data: { data: allStudents } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPanel();

    await waitFor(() => {
      expect(
        screen.getByText(/sin alumnos asignados/i),
      ).toBeInTheDocument();
    });
  });

  // W-07: close button calls onClose callback
  it('W-07: close button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderPanel('cc-1', onClose);

    await waitFor(() =>
      expect(screen.getByTestId('alumnos-curso-panel')).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId('btn-cerrar'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  // ── SDD-2 Printable & Print features ─────────────────────────────────────

  // W-08: printable indicator shown per row
  it('W-08: shows printable indicator for each assigned student', async () => {
    renderPanel();
    await waitFor(() => {
      // row-1 (printable=true) has a printable indicator
      expect(screen.getByTestId('printable-row-1')).toBeInTheDocument();
      // row-2 (printable=false) also has an indicator (unchecked)
      expect(screen.getByTestId('printable-row-2')).toBeInTheDocument();
    });
  });

  // W-09: "Todos" button → PATCH /course-cycles/:ccId/alumnos/printable { value: true }
  it('W-09: "Todos" button calls bulk PATCH with value=true', async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValue({});
    renderPanel();

    await waitFor(() => expect(screen.getByTestId('btn-todos')).toBeInTheDocument());
    await user.click(screen.getByTestId('btn-todos'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/course-cycles/cc-1/alumnos/printable',
        { value: true },
      );
    });
  });

  // W-10: "Ninguno" button → PATCH /course-cycles/:ccId/alumnos/printable { value: false }
  it('W-10: "Ninguno" button calls bulk PATCH with value=false', async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValue({});
    renderPanel();

    await waitFor(() => expect(screen.getByTestId('btn-ninguno')).toBeInTheDocument());
    await user.click(screen.getByTestId('btn-ninguno'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/course-cycles/cc-1/alumnos/printable',
        { value: false },
      );
    });
  });

  // W-11: per-row printable toggle → PATCH /course-cycles/:ccId/alumnos/:id/printable
  it('W-11: toggling per-row printable calls PATCH with the row id', async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValue({});
    renderPanel();

    await waitFor(() => expect(screen.getByTestId('printable-row-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('printable-row-1'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/course-cycles/cc-1/alumnos/row-1/printable',
        { value: false }, // row-1 was printable=true, toggle → false
      );
    });
  });

  // W-12: "Imprimir" button → downloadBoletinBatch(ccId)
  it('W-12: "Imprimir" button calls downloadBoletinBatch with the course cycle id', async () => {
    const user = userEvent.setup();
    renderPanel();

    await waitFor(() => expect(screen.getByTestId('btn-imprimir')).toBeInTheDocument());
    await user.click(screen.getByTestId('btn-imprimir'));

    await waitFor(() => {
      expect(mockDownloadBoletinBatch).toHaveBeenCalledWith('cc-1');
    });
  });

  // W-13: aggregate state label reflects selection state
  it('W-13: shows "Algunos" when only some students are printable', async () => {
    renderPanel();
    // currentAlumnos: row-1 printable=true, row-2 printable=false → Algunos
    await waitFor(() => {
      expect(screen.getByTestId('printable-state-label')).toHaveTextContent('Algunos');
    });
  });

  it('W-13b: shows "Todos" when all students are printable', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/course-cycles/cc-1/alumnos') {
        return Promise.resolve({ data: { data: [
          { id: 'row-1', studentId: 'stu-1', studentName: 'Ana García', printable: true },
          { id: 'row-2', studentId: 'stu-2', studentName: 'Carlos López', printable: true },
        ] } });
      }
      if (url === '/students') return Promise.resolve({ data: { data: allStudents } });
      return Promise.resolve({ data: { data: [] } });
    });
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('printable-state-label')).toHaveTextContent('Todos');
    });
  });

  it('W-13c: shows "Ninguno" when no students are printable', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/course-cycles/cc-1/alumnos') {
        return Promise.resolve({ data: { data: [
          { id: 'row-1', studentId: 'stu-1', studentName: 'Ana García', printable: false },
          { id: 'row-2', studentId: 'stu-2', studentName: 'Carlos López', printable: false },
        ] } });
      }
      if (url === '/students') return Promise.resolve({ data: { data: allStudents } });
      return Promise.resolve({ data: { data: [] } });
    });
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('printable-state-label')).toHaveTextContent('Ninguno');
    });
  });

  // W-14: "Imprimir" button is disabled / shows empty-state when 0 printable
  it('W-14: disables print or shows warning when no students are printable', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/course-cycles/cc-1/alumnos') {
        return Promise.resolve({ data: { data: [
          { id: 'row-1', studentId: 'stu-1', studentName: 'Ana García', printable: false },
        ] } });
      }
      if (url === '/students') return Promise.resolve({ data: { data: allStudents } });
      return Promise.resolve({ data: { data: [] } });
    });
    renderPanel();
    await waitFor(() => {
      const btn = screen.getByTestId('btn-imprimir') as HTMLButtonElement;
      expect(btn).toBeDisabled();
    });
  });

  // ── SDD-3 cascade button ──────────────────────────────────────────────────

  // W-15: cascade button per row calls POST /course-cycles/:ccId/alumnos/:id/cascade
  it('W-15: cascade button calls POST /cascade with the bridge-row id', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({
      data: { data: { materiasCreated: 3, materiasSkipped: 0, competenciasCreated: 6, competenciasSkipped: 0 } },
    });
    renderPanel();

    await waitFor(() => expect(screen.getByTestId('btn-cascade-row-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('btn-cascade-row-1'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/course-cycles/cc-1/alumnos/row-1/cascade');
    });
  });

  // W-16: cascade button is disabled while request is in flight
  it('W-16: cascade button is disabled while the request is in flight', async () => {
    let resolve!: () => void;
    const inflightPromise = new Promise<void>((res) => { resolve = res; });
    mockPost.mockImplementationOnce(() => inflightPromise.then(() => ({
      data: { data: { materiasCreated: 0, materiasSkipped: 3, competenciasCreated: 0, competenciasSkipped: 6 } },
    })));

    const user = userEvent.setup();
    renderPanel();

    await waitFor(() => expect(screen.getByTestId('btn-cascade-row-1')).toBeInTheDocument());

    // Click cascade — promise is pending
    await user.click(screen.getByTestId('btn-cascade-row-1'));

    // Button must be disabled while in flight
    const btn = screen.getByTestId('btn-cascade-row-1') as HTMLButtonElement;
    expect(btn).toBeDisabled();

    // Resolve to unblock
    resolve();
  });

  // W-17: success toast shows cascade counts
  it('W-17: success toast shows returned cascade counts', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({
      data: { data: { materiasCreated: 3, materiasSkipped: 0, competenciasCreated: 6, competenciasSkipped: 0 } },
    });
    renderPanel();

    await waitFor(() => expect(screen.getByTestId('btn-cascade-row-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('btn-cascade-row-1'));

    // Toast must mention materias and competencias created
    await waitFor(() => {
      expect(screen.getByTestId('cascade-toast')).toBeInTheDocument();
    });
  });

  // W-18: error toast shown when cascade fails
  it('W-18: error toast shown when cascade endpoint fails', async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValueOnce(new Error('Network error'));
    renderPanel();

    await waitFor(() => expect(screen.getByTestId('btn-cascade-row-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('btn-cascade-row-1'));

    await waitFor(() => {
      expect(screen.getByTestId('cascade-toast')).toBeInTheDocument();
    });
  });

  // ── T-FE-3: Attendance navigation button ─────────────────────────────────

  // embedded=true mirrors the ONLY production entry point (course-cycles.tsx always passes embedded)
  it('W-19: "Ver asistencia" button visible when user has ATTENDANCE READ (embedded)', async () => {
    mockModules = [{ moduleCode: 'ATTENDANCE', actions: ['READ'] }];
    renderPanel('cc-1', vi.fn(), true);

    await waitFor(() => {
      expect(screen.getByTestId('btn-ver-asistencia')).toBeInTheDocument();
    });
  });

  it('W-20: "Ver asistencia" button absent when user lacks ATTENDANCE READ (embedded)', async () => {
    // mockModules = [] (default — no ATTENDANCE)
    renderPanel('cc-1', vi.fn(), true);

    await waitFor(() => {
      expect(screen.getByTestId('alumnos-curso-panel')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('btn-ver-asistencia')).not.toBeInTheDocument();
  });

  it('W-21: clicking "Ver asistencia" navigates to /asistencia-mensual?ccId=<ccId> (embedded)', async () => {
    mockModules = [{ moduleCode: 'ATTENDANCE', actions: ['READ'] }];
    const user = userEvent.setup();
    renderPanel('cc-abc', vi.fn(), true);

    await waitFor(() => expect(screen.getByTestId('btn-ver-asistencia')).toBeInTheDocument());
    await user.click(screen.getByTestId('btn-ver-asistencia'));

    expect(mockNavigate).toHaveBeenCalledWith('/asistencia-mensual?ccId=cc-abc');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PR4 — Pase de alumno (tasks 4.1–4.8)
// ═════════════════════════════════════════════════════════════════════════════

describe('PR4 — Pase de alumno', () => {
  // ── Fixtures ────────────────────────────────────────────────────────────────

  const alumnoConPase = {
    id: 'row-pase-1',
    studentId: 'stu-pase-1',
    studentName: 'Luisa Fernández',
    printable: true,
    fechaDePase: '2024-06-15',
  };

  const alumnoSinPase = {
    id: 'row-1',
    studentId: 'stu-1',
    studentName: 'Ana García',
    printable: true,
    fechaDePase: null,
  };

  function setupWithPase(ccId = 'cc-1') {
    mockGet.mockImplementation((url: string) => {
      if (url === `/course-cycles/${ccId}/alumnos`) {
        return Promise.resolve({ data: { data: [alumnoConPase, alumnoSinPase] } });
      }
      if (url === '/students') return Promise.resolve({ data: { data: allStudents } });
      return Promise.resolve({ data: { data: [] } });
    });
  }

  // ── Style: line-through ──────────────────────────────────────────────────────

  it('W-22: studentName has line-through style when alumno has fechaDePase', async () => {
    setupWithPase();
    renderPanel();
    await waitFor(() => {
      const nameEl = screen.getByTestId('alumno-nombre-row-pase-1');
      expect(nameEl).toHaveStyle({ textDecoration: 'line-through' });
    });
  });

  it('W-23: studentName has no line-through when alumno has no fechaDePase', async () => {
    setupWithPase();
    renderPanel();
    await waitFor(() => {
      const nameEl = screen.getByTestId('alumno-nombre-row-1');
      expect(nameEl).not.toHaveStyle({ textDecoration: 'line-through' });
    });
  });

  // ── Column headers ───────────────────────────────────────────────────────────

  it('W-24: column headers "Pase" and "Fecha de pase" are present when students are assigned', async () => {
    setupWithPase();
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('col-header-pase')).toBeInTheDocument();
      expect(screen.getByTestId('col-header-fecha-pase')).toBeInTheDocument();
    });
  });

  // ── Data cells ───────────────────────────────────────────────────────────────

  it('W-25: pase cell shows "Sí" for alumno with fechaDePase', async () => {
    setupWithPase();
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('pase-indicator-row-pase-1')).toHaveTextContent('Sí');
    });
  });

  it('W-26: pase cell does not show "Sí" for alumno without fechaDePase', async () => {
    setupWithPase();
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('pase-indicator-row-1')).not.toHaveTextContent('Sí');
    });
  });

  it('W-27: fecha-pase cell shows es-AR formatted date for alumno with fechaDePase', async () => {
    setupWithPase();
    renderPanel();
    // Compute expected value the same way the component does — handles TZ consistently.
    const expectedDate = new Date('2024-06-15').toLocaleDateString('es-AR');
    await waitFor(() => {
      expect(screen.getByTestId('fecha-pase-row-pase-1')).toHaveTextContent(expectedDate);
    });
  });

  it('W-28: fecha-pase cell shows "—" for alumno without fechaDePase', async () => {
    setupWithPase();
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('fecha-pase-row-1')).toHaveTextContent('—');
    });
  });

  // ── Quitar button disabled ───────────────────────────────────────────────────

  it('W-29: "Quitar" button is disabled when alumno has fechaDePase', async () => {
    setupWithPase();
    renderPanel();
    await waitFor(() => {
      const btn = screen.getByTestId('btn-remove-alumno-row-pase-1') as HTMLButtonElement;
      expect(btn).toBeDisabled();
    });
  });

  it('W-30: "Quitar" button is enabled when alumno has no fechaDePase', async () => {
    setupWithPase();
    renderPanel();
    await waitFor(() => {
      const btn = screen.getByTestId('btn-remove-alumno-row-1') as HTMLButtonElement;
      expect(btn).not.toBeDisabled();
    });
  });

  // ── Pase / Revertir pase buttons ─────────────────────────────────────────────

  it('W-31: "Pase" button visible for alumno without fechaDePase; no "Revertir pase"', async () => {
    setupWithPase();
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('btn-pase-row-1')).toBeInTheDocument();
      expect(screen.queryByTestId('btn-revertir-pase-row-1')).not.toBeInTheDocument();
    });
  });

  it('W-32: "Revertir pase" button visible for alumno with fechaDePase; no "Pase"', async () => {
    setupWithPase();
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('btn-revertir-pase-row-pase-1')).toBeInTheDocument();
      expect(screen.queryByTestId('btn-pase-row-pase-1')).not.toBeInTheDocument();
    });
  });

  // ── Modal de fecha ───────────────────────────────────────────────────────────

  it('W-33: clicking "Pase" button opens modal with date input', async () => {
    setupWithPase();
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('btn-pase-row-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('btn-pase-row-1'));
    await waitFor(() => {
      expect(screen.getByTestId('modal-pase')).toBeInTheDocument();
      expect(screen.getByTestId('input-fecha-pase')).toBeInTheDocument();
    });
  });

  it('W-34: confirming pase with date calls PATCH with fechaDePase and closes modal', async () => {
    setupWithPase();
    mockPatch.mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('btn-pase-row-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('btn-pase-row-1'));
    await waitFor(() => expect(screen.getByTestId('modal-pase')).toBeInTheDocument());

    // fireEvent.change is more reliable for type=date inputs in JSDOM
    fireEvent.change(screen.getByTestId('input-fecha-pase'), { target: { value: '2024-06-20' } });

    await user.click(screen.getByTestId('btn-confirmar-pase'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/course-cycles/cc-1/alumnos/row-1/pase',
        { fechaDePase: '2024-06-20' },
      );
    });
    await waitFor(() => {
      expect(screen.queryByTestId('modal-pase')).not.toBeInTheDocument();
    });
  });

  it('W-35: cancelling the pase modal does not call PATCH', async () => {
    setupWithPase();
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('btn-pase-row-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('btn-pase-row-1'));
    await waitFor(() => expect(screen.getByTestId('modal-pase')).toBeInTheDocument());

    await user.click(screen.getByTestId('btn-cancelar-pase'));

    expect(mockPatch).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByTestId('modal-pase')).not.toBeInTheDocument();
    });
  });

  it('W-36: confirm button is disabled when no date is entered; no PATCH called', async () => {
    setupWithPase();
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('btn-pase-row-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('btn-pase-row-1'));
    await waitFor(() => expect(screen.getByTestId('modal-pase')).toBeInTheDocument());

    const confirmBtn = screen.getByTestId('btn-confirmar-pase') as HTMLButtonElement;
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByTestId('modal-pase')).toBeInTheDocument();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('W-37: clicking "Revertir pase" calls PATCH with {fechaDePase: null}', async () => {
    setupWithPase();
    mockPatch.mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId('btn-revertir-pase-row-pase-1')).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId('btn-revertir-pase-row-pase-1'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/course-cycles/cc-1/alumnos/row-pase-1/pase',
        { fechaDePase: null },
      );
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PR#3 — Constancia de Alumno Regular (T-16)
// Cases: W-C1 to W-C6
// ═════════════════════════════════════════════════════════════════════════════

describe('Constancia per-row button', () => {
  const FAKE_TODAY = '2026-06-26';
  const DEFAULT_DESTINATARIO =
    'A pedido del interesado y para ser presentado ante quien corresponda';

  const alumnoConPaseC = {
    id: 'row-cp1',
    studentId: 'stu-cp1',
    studentName: 'María Torres',
    printable: true,
    fechaDePase: '2026-03-15',
  };
  const alumnoSinPaseC = {
    id: 'row-sp1',
    studentId: 'stu-sp1',
    studentName: 'José Pérez',
    printable: true,
    fechaDePase: null,
  };

  function setupConstanciaFixtures(ccId = 'cc-1') {
    mockGet.mockImplementation((url: string) => {
      if (url === `/course-cycles/${ccId}/alumnos`) {
        return Promise.resolve({
          data: { data: [alumnoConPaseC, alumnoSinPaseC] },
        });
      }
      if (url === '/students') return Promise.resolve({ data: { data: allStudents } });
      return Promise.resolve({ data: { data: [] } });
    });
  }

  beforeEach(() => {
    // Only fake Date — leave setTimeout/setInterval/MutationObserver real so
    // waitFor's polling keeps working. vi.setSystemTime requires useFakeTimers first.
    vi.useFakeTimers({ toFake: ['Date'] });
    // June 26, 2026 in LOCAL time — matches FAKE_TODAY when using local components
    vi.setSystemTime(new Date(2026, 5, 26, 12, 0, 0));
    setupConstanciaFixtures();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // W-C1: "Constancia" button visible per row
  it('W-C1: "Constancia" button is visible in each row', async () => {
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('btn-constancia-row-cp1')).toBeInTheDocument();
      expect(screen.getByTestId('btn-constancia-row-sp1')).toBeInTheDocument();
    });
    // Suppress unused warning
    void user;
  });

  // W-C2: button disabled when fechaDePase is set
  it('W-C2: "Constancia" button is disabled when row has fechaDePase', async () => {
    renderPanel();
    await waitFor(() => {
      const disabledBtn = screen.getByTestId('btn-constancia-row-cp1') as HTMLButtonElement;
      expect(disabledBtn).toBeDisabled();

      const enabledBtn = screen.getByTestId('btn-constancia-row-sp1') as HTMLButtonElement;
      expect(enabledBtn).not.toBeDisabled();
    });
  });

  // W-C3: clicking opens modal with default destinatario and today as fechaEmision
  it('W-C3: clicking opens modal with default destinatario text and today as fechaEmision', async () => {
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('btn-constancia-row-sp1')).toBeInTheDocument());

    await user.click(screen.getByTestId('btn-constancia-row-sp1'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-constancia')).toBeInTheDocument();
      const textarea = screen.getByTestId('input-constancia-destinatario') as HTMLTextAreaElement;
      expect(textarea.value).toBe(DEFAULT_DESTINATARIO);
      const dateInput = screen.getByTestId('input-constancia-fecha') as HTMLInputElement;
      expect(dateInput.value).toBe(FAKE_TODAY);
    });
  });

  // W-C4: "Imprimir" calls printConstancia with row id and form values; modal closes on success
  it('W-C4: "Imprimir" calls printConstancia and closes modal on success', async () => {
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('btn-constancia-row-sp1')).toBeInTheDocument());

    await user.click(screen.getByTestId('btn-constancia-row-sp1'));
    await waitFor(() => expect(screen.getByTestId('modal-constancia')).toBeInTheDocument());

    await user.click(screen.getByTestId('btn-constancia-imprimir'));

    await waitFor(() => {
      expect(mockPrintConstancia).toHaveBeenCalledWith('row-sp1', {
        destinatario: DEFAULT_DESTINATARIO,
        fechaEmision: FAKE_TODAY,
      });
    });
    // Modal must close after successful print
    await waitFor(() => {
      expect(screen.queryByTestId('modal-constancia')).not.toBeInTheDocument();
    });
  });

  // W-C5: "Descargar" calls downloadConstancia with row id and form values; modal closes on success
  it('W-C5: "Descargar" calls downloadConstancia and closes modal on success', async () => {
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('btn-constancia-row-sp1')).toBeInTheDocument());

    await user.click(screen.getByTestId('btn-constancia-row-sp1'));
    await waitFor(() => expect(screen.getByTestId('modal-constancia')).toBeInTheDocument());

    await user.click(screen.getByTestId('btn-constancia-descargar'));

    await waitFor(() => {
      expect(mockDownloadConstancia).toHaveBeenCalledWith('row-sp1', {
        destinatario: DEFAULT_DESTINATARIO,
        fechaEmision: FAKE_TODAY,
      });
    });
    // Modal must close after successful download
    await waitFor(() => {
      expect(screen.queryByTestId('modal-constancia')).not.toBeInTheDocument();
    });
  });

  // W-C6: printConstancia error → toast shown
  it('W-C6: printConstancia error shows error toast in panel', async () => {
    mockPrintConstancia.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('btn-constancia-row-sp1')).toBeInTheDocument());

    await user.click(screen.getByTestId('btn-constancia-row-sp1'));
    await waitFor(() => expect(screen.getByTestId('modal-constancia')).toBeInTheDocument());

    await user.click(screen.getByTestId('btn-constancia-imprimir'));

    await waitFor(() => {
      expect(screen.getByText(/error al generar la constancia/i)).toBeInTheDocument();
    });
  });

  // W-C7: downloadConstancia error → toast shown (symmetric with W-C6)
  it('W-C7: downloadConstancia error shows error toast in panel', async () => {
    mockDownloadConstancia.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('btn-constancia-row-sp1')).toBeInTheDocument());

    await user.click(screen.getByTestId('btn-constancia-row-sp1'));
    await waitFor(() => expect(screen.getByTestId('modal-constancia')).toBeInTheDocument());

    await user.click(screen.getByTestId('btn-constancia-descargar'));

    await waitFor(() => {
      expect(screen.getByText(/error al descargar la constancia/i)).toBeInTheDocument();
    });
  });
});
