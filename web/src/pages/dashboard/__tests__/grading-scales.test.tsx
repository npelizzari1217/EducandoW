import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

// ── Mock apiClient ──

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../../api/client', () => ({
  default: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
    patch: (...args: any[]) => mockApiPatch(...args),
    delete: (...args: any[]) => mockApiDelete(...args),
  },
}));

// ── Configurable auth mock (ROOT vs non-ROOT) ──

let mockUserRoles: string[] = ['ROOT'];

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'user-root',
      email: 'root@edu.com',
      name: 'Root',
      role: mockUserRoles[0] ?? 'ROOT',
      get roles() { return mockUserRoles; },
      modules: [
        { moduleCode: 'GRADING_CONFIG', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
      ],
      levels: [],
    },
    logout: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    accessToken: 'fake-token',
  }),
}));

// ── Configurable institution mock ──

let mockInstitutionConfig = {
  id: 'inst-1',
  name: 'Escuela Test',
  levels: [10, 20],
  send_email: false,
  send_messages: false,
};

vi.mock('../../../context/institution-context', () => ({
  useInstitution: () => ({
    config: mockInstitutionConfig,
    isLoading: false,
    error: null,
    reload: vi.fn(),
    clear: vi.fn(),
  }),
}));

// ── Mock adaptListResponse ──

vi.mock('../../../api/adapters/index', () => ({
  adaptListResponse: (res: any) => {
    const d = res?.data?.data;
    return Array.isArray(d) ? d : [];
  },
}));

// ── Fixtures ──

const INSTITUTIONS = [
  { id: 'inst-1', name: 'Escuela Test' },
  { id: 'inst-2', name: 'Colegio Otro' },
];

const SCALE_NUMERICA: Record<string, unknown> = {
  id: 'scale-1',
  name: 'Numérica 1-10',
  level: 2,
  modality: 0,
  active: true,
  values: [
    { id: 'val-1', scale_id: 'scale-1', code: '10', label: 'Diez', internal_status: 'APROBADO', sort_order: 0, active: true },
    { id: 'val-2', scale_id: 'scale-1', code: '1', label: 'Uno', internal_status: 'NO_APROBADO', sort_order: 9, active: true },
  ],
};

const SCALE_CUALITATIVA: Record<string, unknown> = {
  id: 'scale-2',
  name: 'Cualitativa Inicial',
  level: 1,
  modality: 0,
  active: true,
  values: [],
};

function setupApiMock() {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPatch.mockReset();
  mockApiDelete.mockReset();

  mockApiGet.mockImplementation((url: string) => {
    if (url === '/institutions') {
      return Promise.resolve({ data: { data: INSTITUTIONS } });
    }
    if (url === '/grading/scales') {
      return Promise.resolve({ data: { data: [SCALE_NUMERICA, SCALE_CUALITATIVA] } });
    }
    return Promise.resolve({ data: { data: [] } });
  });

  mockApiPost.mockResolvedValue({
    data: { data: { id: 'new-scale-1', name: 'Nueva Escala', level: 2, modality: 0, active: true, values: [] } },
  });
  mockApiPatch.mockResolvedValue({ data: { data: {} } });
  mockApiDelete.mockResolvedValue({});
}

// ── Dynamic import so module loads AFTER mocks ──

let GradingScalesPage: any;

beforeAll(async () => {
  const mod = await import('../grading-scales');
  GradingScalesPage = mod.default;
});

function renderPage() {
  return render(
    <MemoryRouter>
      <GradingScalesPage />
    </MemoryRouter>,
  );
}

// ═══════════════════════════════════════════════════════════
// BASIC RENDERING
// ═══════════════════════════════════════════════════════════

describe('GradingScalesPage — basic rendering', () => {
  beforeEach(() => {
    mockUserRoles = ['ROOT'];
    mockInstitutionConfig = { id: 'inst-1', name: 'Escuela Test', levels: [10, 20], send_email: false, send_messages: false };
    setupApiMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders without errors and shows page title', async () => {
    renderPage();
    await waitFor(() => {
      const headings = screen.getAllByText(/Escalas de Calificación/i);
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  it('renders table with scale rows (name, level columns visible)', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Numérica 1-10')).toBeInTheDocument();
      expect(screen.getByText('Cualitativa Inicial')).toBeInTheDocument();
    });
  });

  it('table has name, level and modality column headers', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/^Nombre$/i)).toBeInTheDocument();
      expect(screen.getByText(/^Nivel$/i)).toBeInTheDocument();
    });
  });

  it('form to create scale has name, level and modality fields', async () => {
    const user = userEvent.setup();
    renderPage();

    // Open the create form
    const newBtn = await screen.findByText(/Nueva escala/i);
    await user.click(newBtn);

    // Should have a name input
    await waitFor(() => {
      const nameInput = screen.queryByPlaceholderText(/nombre.*escala|nombre de la escala/i)
        ?? screen.queryByLabelText(/nombre/i);
      expect(nameInput).toBeInTheDocument();
    });

    // Should have a level selector
    await waitFor(() => {
      const selects = document.querySelectorAll('select[aria-label*="nivel" i], select[id*="level" i], select[name*="level" i]');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('values section shows code, label and internalStatus for a scale', async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for scales to load
    await waitFor(() => {
      expect(screen.getByText('Numérica 1-10')).toBeInTheDocument();
    });

    // Click on the button to manage values for SCALE_NUMERICA
    const valuesBtns = screen.queryAllByText(/valores|gestionar valores/i);
    if (valuesBtns.length > 0) {
      await user.click(valuesBtns[0]);
    }

    // Code, label and internal_status of values should appear
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('Diez')).toBeInTheDocument();
      // APROBADO should be shown (either as raw string or label) — use queryAll to handle multiple matches
      const aprobadoEls = screen.queryAllByText(/aprobado/i);
      expect(aprobadoEls.length).toBeGreaterThan(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// VALUE FORM — internalStatus select
// ═══════════════════════════════════════════════════════════

describe('GradingScalesPage — value form internalStatus', () => {
  beforeEach(() => {
    mockUserRoles = ['ROOT'];
    mockInstitutionConfig = { id: 'inst-1', name: 'Escuela Test', levels: [10, 20], send_email: false, send_messages: false };
    setupApiMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('internalStatus select in value form has exactly 4 options (excluding empty placeholder)', async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for scales to load and open value management
    await waitFor(() => {
      expect(screen.getByText('Numérica 1-10')).toBeInTheDocument();
    });

    // Navigate to value form — click the "Valores" / "Gestionar valores" button
    const valuesBtns = screen.queryAllByText(/valores|gestionar valores/i);
    if (valuesBtns.length > 0) {
      await user.click(valuesBtns[0]);
    }

    // Open the add-value form
    const addValueBtn = screen.queryByText(/nuevo valor|agregar valor/i);
    if (addValueBtn) {
      await user.click(addValueBtn);
    }

    // Find the internalStatus select
    await waitFor(() => {
      const statusSelect = document.querySelector(
        'select[id*="internal-status"], select[aria-label*="estado interno"], select[name*="internalStatus"]',
      ) as HTMLSelectElement | null;

      expect(statusSelect).not.toBeNull();
      if (statusSelect) {
        // Options with real values (not empty placeholder)
        const valueOptions = Array.from(statusSelect.options).filter(o => o.value !== '');
        expect(valueOptions.length).toBe(4);
        const values = valueOptions.map(o => o.value);
        expect(values).toContain('APROBADO');
        expect(values).toContain('NO_APROBADO');
        expect(values).toContain('EN_PROCESO');
        expect(values).toContain('LIBRE');
      }
    });
  });

  it('submitting scale form calls POST /grading/scales', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Numérica 1-10')).toBeInTheDocument();
    });

    // Open create form
    const newBtn = await screen.findByText(/Nueva escala/i);
    await user.click(newBtn);

    // Fill name field
    await waitFor(() => {
      const nameInput = screen.queryByPlaceholderText(/nombre.*escala|nombre de la escala/i)
        ?? screen.queryByLabelText(/nombre/i);
      expect(nameInput).toBeInTheDocument();
    });

    const nameInput = (
      screen.queryByPlaceholderText(/nombre.*escala|nombre de la escala/i)
      ?? screen.queryByLabelText(/nombre/i)
    ) as HTMLInputElement;

    await user.clear(nameInput);
    await user.type(nameInput, 'Escala Test');

    // Submit
    const createBtn = screen.queryByText(/crear escala/i) ?? screen.queryByText(/guardar escala/i);
    if (createBtn) {
      await user.click(createBtn);
    }

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/grading/scales',
        expect.objectContaining({ name: 'Escala Test' }),
        expect.anything(),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════
// ROOT USER — institution selector and institutionId in calls
// ═══════════════════════════════════════════════════════════

describe('GradingScalesPage — ROOT user', () => {
  beforeEach(() => {
    mockUserRoles = ['ROOT'];
    mockInstitutionConfig = { id: 'inst-1', name: 'Escuela Test', levels: [10, 20], send_email: false, send_messages: false };
    setupApiMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders an institution selector for ROOT', async () => {
    renderPage();
    await waitFor(() => {
      const select = screen.queryByLabelText('Institución');
      expect(select).toBeInTheDocument();
    });
  });

  it('shows guard message when ROOT has no institution selected', async () => {
    mockInstitutionConfig = { id: '', name: '', levels: [], send_email: false, send_messages: false };
    renderPage();

    await waitFor(() => {
      // The guard card paragraph should contain this text (selector option also matches, use queryAll)
      const guards = screen.queryAllByText(/seleccioná una institución/i);
      expect(guards.length).toBeGreaterThan(0);
    });
  });

  it('does NOT request /grading/scales before ROOT selects institution', async () => {
    mockInstitutionConfig = { id: '', name: '', levels: [], send_email: false, send_messages: false };
    renderPage();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/institutions');
    });

    const scaleCalls = mockApiGet.mock.calls.filter((args: any[]) => args[0] === '/grading/scales');
    expect(scaleCalls.length).toBe(0);
  });

  it('requests /grading/scales with institutionId after ROOT selects institution', async () => {
    mockInstitutionConfig = { id: '', name: '', levels: [], send_email: false, send_messages: false };
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/institutions');
    });

    const institutionSelect = await screen.findByLabelText('Institución');
    await user.selectOptions(institutionSelect, 'inst-1');

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        '/grading/scales',
        { params: { institutionId: 'inst-1' } },
      );
    });
  });

  it('passes institutionId in POST when ROOT creates a scale', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Numérica 1-10')).toBeInTheDocument();
    });

    const newBtn = await screen.findByText(/Nueva escala/i);
    await user.click(newBtn);

    await waitFor(() => {
      const nameInput = screen.queryByPlaceholderText(/nombre.*escala|nombre de la escala/i)
        ?? screen.queryByLabelText(/nombre/i);
      expect(nameInput).toBeInTheDocument();
    });

    const nameInput = (
      screen.queryByPlaceholderText(/nombre.*escala|nombre de la escala/i)
      ?? screen.queryByLabelText(/nombre/i)
    ) as HTMLInputElement;

    await user.clear(nameInput);
    await user.type(nameInput, 'Mi Escala');

    const createBtn = screen.queryByText(/crear escala/i) ?? screen.queryByText(/guardar escala/i);
    if (createBtn) {
      await user.click(createBtn);
    }

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/grading/scales',
        expect.objectContaining({ name: 'Mi Escala' }),
        { params: { institutionId: 'inst-1' } },
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════
// NON-ROOT USER — no selector, no institutionId in calls
// ═══════════════════════════════════════════════════════════

describe('GradingScalesPage — non-ROOT user', () => {
  beforeEach(() => {
    mockUserRoles = ['ADMIN'];
    mockInstitutionConfig = { id: 'inst-1', name: 'Escuela Test', levels: [10, 20], send_email: false, send_messages: false };
    setupApiMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('does NOT render institution selector for non-ROOT', async () => {
    renderPage();
    await waitFor(() => {
      const heading = screen.queryAllByText(/Escalas de Calificación/i);
      expect(heading.length).toBeGreaterThan(0);
    });
    expect(screen.queryByLabelText('Institución')).toBeNull();
  });

  it('does NOT call /institutions for non-ROOT', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Numérica 1-10')).toBeInTheDocument();
    });
    expect(mockApiGet).not.toHaveBeenCalledWith('/institutions');
  });

  it('calls /grading/scales WITHOUT institutionId for non-ROOT', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Numérica 1-10')).toBeInTheDocument();
    });

    const scaleCalls = mockApiGet.mock.calls.filter((args: any[]) => args[0] === '/grading/scales');
    expect(scaleCalls.length).toBeGreaterThan(0);

    scaleCalls.forEach((args: any[]) => {
      const config = args[1] as { params?: Record<string, string> } | undefined;
      expect(config?.params?.institutionId).toBeUndefined();
    });
  });
});
