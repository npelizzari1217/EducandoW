import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

// ── Mock apiClient ──
const mockPost = vi.fn(() => Promise.resolve({ data: { data: { created: 3, updated: 2, total: 5 } } }));
const mockGet = vi.fn((url: string) => {
  if (url === '/academic-cycles') {
    return Promise.resolve({ data: { data: [{ id: 'cycle-1', name: '2026' }, { id: 'cycle-2', name: '2025' }] } });
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

  // 5.2.2 — Submit with mandatory filters only
  it('submits generate with level and cycleId only (no studyPlanId)', async () => {
    const user = userEvent.setup();
    renderPage();

    const levelSelect = selectByLabelText('Nivel');
    await user.selectOptions(levelSelect, '20');
    // Wait for React to process state change
    await waitFor(() => {
      expect(levelSelect).toHaveValue('20');
    });

    const cycleSelect = selectByLabelText('Ciclo Lectivo');
    await user.selectOptions(cycleSelect, 'cycle-1');
    await waitFor(() => {
      expect(cycleSelect).toHaveValue('cycle-1');
    });

    await waitFor(() => {
      expect(getGenerateBtn()).not.toBeDisabled();
    }, { timeout: 3000 });

    await user.click(getGenerateBtn());

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/course-cycles/generate', {
        level: 20,
        cycleId: 'cycle-1',
      }, { params: { institutionId: 'inst-1' } });
    });
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
});
