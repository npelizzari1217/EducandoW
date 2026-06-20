/**
 * AlumnosCursoCicloPanel — T-20 (TDD RED)
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
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

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

// ── Mock useBoletin ───────────────────────────────────────────────────────────

const mockDownloadBoletinBatch = vi.fn();

vi.mock('../../../hooks/useBoletin', () => ({
  downloadBoletinBatch: (...args: unknown[]) => mockDownloadBoletinBatch(...args),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const currentAlumnos = [
  { id: 'row-1', studentId: 'stu-1', studentName: 'Ana García', printable: true },
  { id: 'row-2', studentId: 'stu-2', studentName: 'Carlos López', printable: false },
];

const allStudents = [
  { id: 'stu-1', firstName: 'Ana', lastName: 'García', fullName: 'Ana García' },
  { id: 'stu-2', firstName: 'Carlos', lastName: 'López', fullName: 'Carlos López' },
  { id: 'stu-3', firstName: 'Pedro', lastName: 'Ramírez', fullName: 'Pedro Ramírez' },
];

// ── Lazy import after mocks ───────────────────────────────────────────────────

let AlumnosCursoCicloPanel: React.ComponentType<{ ccId: string; onClose: () => void }>;

beforeEach(async () => {
  vi.clearAllMocks();
  mockDownloadBoletinBatch.mockResolvedValue(undefined);
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

function renderPanel(ccId = 'cc-1', onClose = vi.fn()) {
  return render(<AlumnosCursoCicloPanel ccId={ccId} onClose={onClose} />);
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
});
