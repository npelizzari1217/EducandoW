import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

// ── Mock apiClient ──
const mockPost = vi.fn(() => Promise.resolve({ data: { data: { created: 3, updated: 2, total: 5 } } }));
const mockGet = vi.fn((url: string) => {
  if (url === '/academic-cycles') {
    return Promise.resolve({ data: { data: [{ uuid: 'cycle-1', name: '2026' }, { uuid: 'cycle-2', name: '2025' }] } });
  }
  if (url === '/study-plans') {
    return Promise.resolve({ data: { data: [{ id: 'plan-1', name: 'Plan Primario 2026' }] } });
  }
  if (url === '/institutions') {
    return Promise.resolve({ data: { data: [] } });
  }
  if (url === '/course-cycles') {
    return Promise.resolve({ data: { data: [], page: 1, pageSize: 20, total: 0 } });
  }
  return Promise.resolve({ data: { data: [] } });
});
vi.mock('../../../api/client', () => ({
  default: {
    get: mockGet,
    post: mockPost,
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({})),
  },
}));

// ── Mock useBoletin ──
const mockDownloadBoletinBatch = vi.fn((..._args: unknown[]) => Promise.resolve());
vi.mock('../../../hooks/useBoletin', () => ({
  downloadBoletinBatch: (...args: any[]) => mockDownloadBoletinBatch(...args),
  downloadBoletin: vi.fn(),
}));

// ── Mock useAuth ──
vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1', email: 'admin@test.com', name: 'Admin',
      roles: ['ROOT'], userLevels: [{ level: 2 }],
    },
    logout: vi.fn(),
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    accessToken: 'fake-token',
  }),
}));

// ── Mock useInstitution ──
vi.mock('../../../context/institution-context', () => ({
  useInstitution: () => ({
    config: { id: 'inst-1', name: 'Escuela Test', levels: [10, 20, 30, 40], send_email: false, send_messages: false },
    isLoading: false, error: null,
    reload: vi.fn(), clear: vi.fn(),
  }),
}));

let CourseCyclesPage: any;

beforeAll(async () => {
  const mod = await import('../course-cycles');
  CourseCyclesPage = mod.default;
});

function renderPage() {
  return render(
    <MemoryRouter>
      <CourseCyclesPage />
    </MemoryRouter>
  );
}

/** Get the first generate button (handles potential duplicate rendering). */
function getGenerateBtn() {
  const btns = screen.getAllByTestId('generate-btn');
  return btns[0];
}

/**
 * Find a <select> by its associated <label> text.
 * The label and select are siblings inside a <div>.
 * Searches from last match to avoid table header conflicts.
 */
function selectByLabelText(labelText: string): HTMLSelectElement {
  const labels = screen.getAllByText(labelText);
  for (let i = labels.length - 1; i >= 0; i--) {
    const div = labels[i].closest('div');
    if (div) {
      const select = div.querySelector('select');
      if (select) return select;
    }
  }
  throw new Error(`No <select> near label "${labelText}"`);
}

describe('CourseCyclesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ data: { data: { created: 3, updated: 2, total: 5 } } });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the page title', () => {
    renderPage();
    const titles = screen.getAllByText('Cursos por Ciclo');
    expect(titles.length).toBeGreaterThan(0);
  });

  it('renders filter controls', () => {
    renderPage();
    const nivelLabels = screen.getAllByText('Nivel');
    expect(nivelLabels.length).toBeGreaterThan(0);
    const cycleLabels = screen.getAllByText('Ciclo Lectivo');
    expect(cycleLabels.length).toBeGreaterThan(0);
    expect(getGenerateBtn()).toBeInTheDocument();
  });

  // 5.2.1 — Button disabled without level+cycleId
  it('disables "Generar Cursos" button when level and cycleId not selected', () => {
    renderPage();
    const btn = getGenerateBtn();
    expect(btn).toBeDisabled();
  });

  // 5.2.2 — Plan de estudio is now mandatory: button stays disabled without it
  it('keeps "Generar Cursos" disabled when studyPlanId is missing', async () => {
    const user = userEvent.setup();
    renderPage();

    const levelSelect = selectByLabelText('Nivel');
    await user.selectOptions(levelSelect, '20');
    await waitFor(() => {
      expect(levelSelect).toHaveValue('20');
    });

    const cycleSelect = selectByLabelText('Ciclo Lectivo');
    await user.selectOptions(cycleSelect, 'cycle-1');
    await waitFor(() => {
      expect(cycleSelect).toHaveValue('cycle-1');
    });

    // Without studyPlanId the button must remain disabled
    expect(getGenerateBtn()).toBeDisabled();
    expect(mockPost).not.toHaveBeenCalled();
  });

  // 5.2.3 — Submit with all three filters (optional studyPlanId)
  it('submits generate with level, cycleId and studyPlanId', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(selectByLabelText('Nivel'), '30');
    await waitFor(() => {
      expect(selectByLabelText('Nivel')).toHaveValue('30');
    });

    await user.selectOptions(selectByLabelText('Ciclo Lectivo'), 'cycle-1');
    await waitFor(() => {
      expect(selectByLabelText('Ciclo Lectivo')).toHaveValue('cycle-1');
    });

    await user.selectOptions(selectByLabelText('Plan de Estudio'), 'plan-1');
    await waitFor(() => {
      expect(selectByLabelText('Plan de Estudio')).toHaveValue('plan-1');
    });

    await waitFor(() => {
      expect(getGenerateBtn()).not.toBeDisabled();
    }, { timeout: 3000 });

    await user.click(getGenerateBtn());

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/course-cycles/generate', {
        level: 30,
        cycleId: 'cycle-1',
        studyPlanId: 'plan-1',
      }, { params: { institutionId: 'inst-1' } });
    });
  });

  // 5.2.4 — Success toast displays result counts
  it('shows success toast with result counts after generate', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(selectByLabelText('Nivel'), '20');
    await waitFor(() => {
      expect(selectByLabelText('Nivel')).toHaveValue('20');
    });

    await user.selectOptions(selectByLabelText('Ciclo Lectivo'), 'cycle-1');
    await waitFor(() => {
      expect(selectByLabelText('Ciclo Lectivo')).toHaveValue('cycle-1');
    });

    await user.selectOptions(selectByLabelText('Plan de Estudio'), 'plan-1');
    await waitFor(() => {
      expect(selectByLabelText('Plan de Estudio')).toHaveValue('plan-1');
    });

    await waitFor(() => {
      expect(getGenerateBtn()).not.toBeDisabled();
    }, { timeout: 3000 });

    await user.click(getGenerateBtn());

    await waitFor(() => {
      expect(screen.getByText(/Creados: 3/i)).toBeInTheDocument();
      expect(screen.getByText(/Actualizados: 2/i)).toBeInTheDocument();
      expect(screen.getByText(/Total: 5/i)).toBeInTheDocument();
    });
  });

  // Verify "Nuevo Curso por Ciclo" button is NOT present
  it('does NOT render "Nuevo Curso por Ciclo" button', () => {
    renderPage();
    expect(screen.queryByText('Nuevo Curso por Ciclo')).not.toBeInTheDocument();
  });

  // Verify the page structure is intact
  it('renders complete page structure', () => {
    renderPage();
    const instLabels = screen.getAllByText('Institución');
    expect(instLabels.length).toBeGreaterThan(0);
  });

  // ── Alumnos column (S-6) ────────────────────────────────────────────────────

  describe('Alumnos enrolled-count column', () => {
    function makeGetWithCC(ccOverrides: Record<string, unknown> = {}) {
      return (url: string) => {
        if (url === '/academic-cycles') {
          return Promise.resolve({ data: { data: [{ uuid: 'cycle-1', name: '2026' }] } });
        }
        if (url === '/study-plans') {
          return Promise.resolve({ data: { data: [{ id: 'plan-1', name: 'Plan Primario 2026' }] } });
        }
        if (url === '/institutions') {
          return Promise.resolve({ data: { data: [] } });
        }
        if (url === '/course-cycles') {
          return Promise.resolve({
            data: {
              data: [{
                uuid: 'cc-alumnos-1',
                courseName: 'Matemática',
                level: 20,
                cycleId: 'cycle-1',
                studyPlanId: 'plan-1',
                active: true,
                passingGrade: 7,
                ...ccOverrides,
              }],
              page: 1,
              pageSize: 20,
              total: 1,
            },
          });
        }
        return Promise.resolve({ data: { data: [] } });
      };
    }

    it('S-6-A: renders "Alumnos" column header in <th>', async () => {
      mockGet.mockImplementation(makeGetWithCC({ studentCount: 3 }) as any);
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('columnheader', { name: 'Alumnos' })).toBeInTheDocument();
      });
    });

    it('S-6-B: row shows the correct studentCount', async () => {
      mockGet.mockImplementation(makeGetWithCC({ studentCount: 8 }) as any);
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('cell', { name: '8' })).toBeInTheDocument();
      });
    });

    it('S-6-D: undefined studentCount renders as "0"', async () => {
      mockGet.mockImplementation(makeGetWithCC({ studentCount: undefined }) as any);
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('columnheader', { name: 'Alumnos' })).toBeInTheDocument();
        expect(screen.getByRole('cell', { name: '0' })).toBeInTheDocument();
      });
    });

    it('S-6-C: zero studentCount renders as "0" not blank', async () => {
      mockGet.mockImplementation(makeGetWithCC({ studentCount: 0 }) as any);
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('columnheader', { name: 'Alumnos' })).toBeInTheDocument();
        expect(screen.getByRole('cell', { name: '0' })).toBeInTheDocument();
      });
    });
  });

  // ── Boletines per-row button ─────────────────────────────────────────────────

  describe('Boletines por fila', () => {
    const ccRow = {
      uuid: 'cc-bol-1', courseName: '2do B', level: 30, cycleId: 'cycle-1',
      studyPlanId: 'plan-1', active: true, passingGrade: 7, studentCount: 4,
    };
    function mockWith(row: { studentCount?: number } & Record<string, unknown>) {
      mockDownloadBoletinBatch.mockClear();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockGet.mockImplementation((url: string): any => {
        if (url === '/academic-cycles') return Promise.resolve({ data: { data: [{ uuid: 'cycle-1', name: '2026' }] } });
        if (url === '/study-plans') return Promise.resolve({ data: { data: [{ id: 'plan-1', name: 'Plan Primario 2026' }] } });
        if (url === '/institutions') return Promise.resolve({ data: { data: [] } });
        if (url === '/course-cycles') return Promise.resolve({ data: { data: [row], page: 1, pageSize: 20, total: 1 } });
        return Promise.resolve({ data: { data: [] } });
      });
    }

    it('ya no muestra el boton roto "Boletines del Curso" en la barra de filtros', async () => {
      mockWith(ccRow);
      renderPage();
      await waitFor(() => expect(screen.getByTestId('btn-boletines-cc-bol-1')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: /Boletines del Curso/i })).not.toBeInTheDocument();
    });

    it('baja el ZIP del curso (cc.uuid) al clickear Boletines de la fila', async () => {
      mockWith(ccRow);
      renderPage();
      const btn = await screen.findByTestId('btn-boletines-cc-bol-1');
      expect(btn).not.toBeDisabled();
      await userEvent.click(btn);
      expect(mockDownloadBoletinBatch).toHaveBeenCalledWith('cc-bol-1');
    });

    it('deshabilita Boletines cuando el curso no tiene alumnos', async () => {
      mockWith({ ...ccRow, studentCount: 0 });
      renderPage();
      const btn = await screen.findByTestId('btn-boletines-cc-bol-1');
      expect(btn).toBeDisabled();
    });
  });

  // ── Bulk cascade button ──────────────────────────────────────────────────────

  describe('Bulk cascade button', () => {
    const ccRow = {
      uuid: 'cc-bulk-1',
      courseName: '1ro A',
      level: 20,
      cycleId: 'cycle-1',
      studyPlanId: 'plan-1',
      active: true,
      passingGrade: 7,
      studentCount: 5,
    };

    const bulkResult = {
      studentsProcessed: 5,
      studentsFailed: 0,
      materiasCreated: 10,
      materiasSkipped: 0,
      competenciasCreated: 30,
      competenciasSkipped: 0,
    };

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockGet.mockImplementation((url: string): any => {
        if (url === '/academic-cycles') {
          return Promise.resolve({ data: { data: [{ uuid: 'cycle-1', name: '2026' }] } });
        }
        if (url === '/study-plans') {
          return Promise.resolve({ data: { data: [{ id: 'plan-1', name: 'Plan Primario 2026' }] } });
        }
        if (url === '/institutions') {
          return Promise.resolve({ data: { data: [] } });
        }
        if (url === '/course-cycles') {
          return Promise.resolve({ data: { data: [ccRow], page: 1, pageSize: 20, total: 1 } });
        }
        return Promise.resolve({ data: { data: [] } });
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPost.mockResolvedValue({ data: { data: bulkResult } } as any);
    });

    // W-24: button enabled when the course has enrolled students (studentCount > 0)
    it('W-24: "Asignar materias y competencias" button is enabled when the course has students', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('btn-bulk-cascade-cc-bulk-1')).toBeInTheDocument();
      });
      expect(screen.getByTestId('btn-bulk-cascade-cc-bulk-1')).not.toBeDisabled();
    });

    // W-25: button disabled when the course has 0 enrolled students (cascade would be a no-op)
    it('W-25: button is disabled when the course has 0 students', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockGet.mockImplementation((url: string): any => {
        if (url === '/academic-cycles') {
          return Promise.resolve({ data: { data: [{ uuid: 'cycle-1', name: '2026' }] } });
        }
        if (url === '/study-plans') {
          return Promise.resolve({ data: { data: [{ id: 'plan-1', name: 'Plan Primario 2026' }] } });
        }
        if (url === '/institutions') {
          return Promise.resolve({ data: { data: [] } });
        }
        if (url === '/course-cycles') {
          return Promise.resolve({
            data: { data: [{ ...ccRow, studentCount: 0 }], page: 1, pageSize: 20, total: 1 },
          });
        }
        return Promise.resolve({ data: { data: [] } });
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('btn-bulk-cascade-cc-bulk-1')).toBeInTheDocument();
      });
      expect(screen.getByTestId('btn-bulk-cascade-cc-bulk-1')).toBeDisabled();
    });

    // W-19: clicking the button opens a confirmation dialog
    it('W-19: clicking the button opens a confirmation dialog', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('btn-bulk-cascade-cc-bulk-1')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('btn-bulk-cascade-cc-bulk-1'));
      expect(screen.getByTestId('btn-confirm-bulk-cascade')).toBeInTheDocument();
    });

    // W-20: POST fired only after confirming
    it('W-20: confirming the dialog fires POST /course-cycles/:ccId/alumnos/cascade', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('btn-bulk-cascade-cc-bulk-1')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('btn-bulk-cascade-cc-bulk-1'));
      await user.click(screen.getByTestId('btn-confirm-bulk-cascade'));
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/course-cycles/cc-bulk-1/alumnos/cascade');
      });
    });

    // W-21: button disabled while request is in-flight
    it('W-21: button is disabled while request is in-flight', async () => {
      let resolve!: () => void;
      const inflightPromise = new Promise<void>((res) => { resolve = res; });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPost.mockImplementationOnce((): any =>
        inflightPromise.then(() => ({ data: { data: bulkResult } })),
      );

      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('btn-bulk-cascade-cc-bulk-1')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('btn-bulk-cascade-cc-bulk-1'));
      await user.click(screen.getByTestId('btn-confirm-bulk-cascade'));

      // While in-flight the button must be disabled
      await waitFor(() => {
        expect(screen.getByTestId('btn-bulk-cascade-cc-bulk-1')).toBeDisabled();
      });

      resolve(); // unblock to avoid test leak
    });

    // W-22: success toast shows aggregated counts
    it('W-22: success toast shows aggregated counts after successful cascade', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('btn-bulk-cascade-cc-bulk-1')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('btn-bulk-cascade-cc-bulk-1'));
      await user.click(screen.getByTestId('btn-confirm-bulk-cascade'));
      await waitFor(() => {
        expect(screen.getByText(/10 materias y 30 competencias asignadas a 5 alumnos/i)).toBeInTheDocument();
      });
    });

    // W-23: error toast when POST fails
    it('W-23: error toast shown when the cascade POST fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockPost as any).mockRejectedValueOnce(new Error('Network error'));
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('btn-bulk-cascade-cc-bulk-1')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('btn-bulk-cascade-cc-bulk-1'));
      await user.click(screen.getByTestId('btn-confirm-bulk-cascade'));
      await waitFor(() => {
        expect(screen.getByText(/Error al asignar materias y competencias/i)).toBeInTheDocument();
      });
    });
  });
});
