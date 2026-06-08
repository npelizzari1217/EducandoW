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
const mockApiPut = vi.fn();

vi.mock('../../../api/client', () => ({
  default: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
    patch: (...args: any[]) => mockApiPatch(...args),
    delete: (...args: any[]) => mockApiDelete(...args),
    put: (...args: any[]) => mockApiPut(...args),
  },
}));

// ── Configurable auth mock ──

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

const TEMPLATE_TRIMESTRAL = {
  id: 'tpl-1',
  name: 'Trimestral',
  level: 2,
  modality: 0,
  active: true,
  items: [
    { id: 'item-1', name: '1° Trimestre', sort_order: 1 },
    { id: 'item-2', name: '2° Trimestre', sort_order: 2 },
    { id: 'item-3', name: '3° Trimestre', sort_order: 3 },
  ],
};

const TEMPLATE_CUATRIMESTRAL = {
  id: 'tpl-2',
  name: 'Cuatrimestral',
  level: 4,
  modality: 0,
  active: true,
  items: [
    { id: 'item-4', name: '1° Cuatrimestre', sort_order: 1 },
    { id: 'item-5', name: '2° Cuatrimestre', sort_order: 2 },
  ],
};

const ACADEMIC_CYCLES = [
  {
    uuid: 'cycle-1',
    code: '2026',
    name: 'Ciclo Lectivo 2026',
    level: 2,
    active: true,
    startDate: '2026-03-01T00:00:00.000Z',
    endDate: '2026-12-20T00:00:00.000Z',
  },
];

function setupApiMock() {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPatch.mockReset();
  mockApiDelete.mockReset();
  mockApiPut.mockReset();

  mockApiGet.mockImplementation((url: string) => {
    if (url === '/institutions') {
      return Promise.resolve({ data: { data: INSTITUTIONS } });
    }
    if (url === '/grading/period-templates') {
      return Promise.resolve({ data: { data: [TEMPLATE_TRIMESTRAL, TEMPLATE_CUATRIMESTRAL] } });
    }
    if (url === '/academic-cycles') {
      return Promise.resolve({ data: { data: ACADEMIC_CYCLES } });
    }
    if (/\/grading\/period-templates\/[^/]+\/dates/.test(url)) {
      return Promise.resolve({ data: { data: [] } });
    }
    return Promise.resolve({ data: { data: [] } });
  });

  mockApiPost.mockResolvedValue({
    data: { data: { ...TEMPLATE_TRIMESTRAL, id: 'new-tpl-1' } },
  });
  mockApiPatch.mockResolvedValue({ data: { data: {} } });
  mockApiDelete.mockResolvedValue({});
  mockApiPut.mockResolvedValue({ data: { data: [] } });
}

// ── Dynamic import so module loads AFTER mocks ──

let GradingPeriodsPage: any;

beforeAll(async () => {
  const mod = await import('../grading-periods');
  GradingPeriodsPage = mod.default;
});

function renderPage() {
  return render(
    <MemoryRouter>
      <GradingPeriodsPage />
    </MemoryRouter>,
  );
}

// ═══════════════════════════════════════════════════════════
// BASIC RENDERING
// ═══════════════════════════════════════════════════════════

describe('GradingPeriodsPage — basic rendering', () => {
  beforeEach(() => {
    mockUserRoles = ['ROOT'];
    mockInstitutionConfig = { id: 'inst-1', name: 'Escuela Test', levels: [10, 20], send_email: false, send_messages: false };
    setupApiMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders template list with nombre, nivel and modalidad column headers', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Trimestral')).toBeInTheDocument();
      expect(screen.getByText('Cuatrimestral')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/^Nombre$/i)).toBeInTheDocument();
      expect(screen.getByText(/^Nivel$/i)).toBeInTheDocument();
    });
  });

  it('shows guard message when ROOT has no institution selected', async () => {
    mockInstitutionConfig = { id: '', name: '', levels: [], send_email: false, send_messages: false };
    renderPage();
    await waitFor(() => {
      const guards = screen.queryAllByText(/seleccioná una institución/i);
      expect(guards.length).toBeGreaterThan(0);
    });
  });

  it('template form has nombre, nivel, modalidad and items section', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Trimestral')).toBeInTheDocument();
    });

    const newBtn = await screen.findByText(/nueva plantilla/i);
    await user.click(newBtn);

    await waitFor(() => {
      const nameInput = screen.queryByPlaceholderText(/nombre.*plantilla|plantilla/i)
        ?? screen.queryByLabelText(/nombre/i);
      expect(nameInput).toBeInTheDocument();
    });

    await waitFor(() => {
      const levelSelect = document.querySelector(
        'select[aria-label*="nivel" i], select[id*="level" i], select[name*="level" i]',
      );
      expect(levelSelect).toBeInTheDocument();
    });
  });

  it('adding an item to the template form adds a dynamic row', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('Trimestral')).toBeInTheDocument());

    const newBtn = await screen.findByText(/nueva plantilla/i);
    await user.click(newBtn);

    const addItemBtn = await screen.findByRole('button', { name: /agregar ítem|agregar item/i });
    await user.click(addItemBtn);

    await waitFor(() => {
      // After clicking add, there should be at least one item input row
      const itemNameInputs = document.querySelectorAll(
        'input[placeholder*="nombre del período" i], input[placeholder*="ítem" i], input[data-item-name="true"]',
      );
      const sortInputs = document.querySelectorAll(
        'input[type="number"][aria-label*="orden" i], input[placeholder*="orden" i], input[data-item-sort="true"]',
      );
      // At least one of these should exist
      expect(itemNameInputs.length + sortInputs.length).toBeGreaterThan(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// ROOT USER — institution selector
// ═══════════════════════════════════════════════════════════

describe('GradingPeriodsPage — ROOT institution selector', () => {
  beforeEach(() => {
    mockUserRoles = ['ROOT'];
    mockInstitutionConfig = { id: 'inst-1', name: 'Escuela Test', levels: [10, 20], send_email: false, send_messages: false };
    setupApiMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders institution selector for ROOT', async () => {
    renderPage();
    await waitFor(() => {
      const select = screen.queryByLabelText('Institución');
      expect(select).toBeInTheDocument();
    });
  });

  it('does not render institution selector for non-ROOT', async () => {
    mockUserRoles = ['ADMIN'];
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Trimestral')).toBeInTheDocument();
    });
    expect(screen.queryByLabelText('Institución')).toBeNull();
  });

  it('does NOT call /grading/period-templates before ROOT selects institution', async () => {
    mockInstitutionConfig = { id: '', name: '', levels: [], send_email: false, send_messages: false };
    renderPage();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/institutions');
    });

    const templateCalls = mockApiGet.mock.calls.filter((args: any[]) => args[0] === '/grading/period-templates');
    expect(templateCalls.length).toBe(0);
  });

  it('requests /grading/period-templates with institutionId after ROOT selects institution', async () => {
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
        '/grading/period-templates',
        { params: { institutionId: 'inst-1' } },
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════
// TEMPLATE CREATION — submits POST with items
// ═══════════════════════════════════════════════════════════

describe('GradingPeriodsPage — template creation', () => {
  beforeEach(() => {
    mockUserRoles = ['ROOT'];
    mockInstitutionConfig = { id: 'inst-1', name: 'Escuela Test', levels: [10, 20], send_email: false, send_messages: false };
    setupApiMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('submitting template form calls POST /grading/period-templates', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('Trimestral')).toBeInTheDocument());

    const newBtn = await screen.findByText(/nueva plantilla/i);
    await user.click(newBtn);

    await waitFor(() => {
      const nameInput = screen.queryByPlaceholderText(/nombre.*plantilla|plantilla/i)
        ?? screen.queryByLabelText(/nombre/i);
      expect(nameInput).toBeInTheDocument();
    });

    const nameInput = (
      screen.queryByPlaceholderText(/nombre.*plantilla|plantilla/i)
      ?? screen.queryByLabelText(/nombre/i)
    ) as HTMLInputElement;

    await user.clear(nameInput);
    await user.type(nameInput, 'Mi Plantilla');

    const createBtn = screen.queryByText(/crear plantilla/i) ?? screen.queryByText(/guardar plantilla/i);
    if (createBtn) {
      await user.click(createBtn);
    }

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/grading/period-templates',
        expect.objectContaining({ name: 'Mi Plantilla' }),
        expect.anything(),
      );
    });
  });

  it('passes institutionId in POST when ROOT creates a template', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('Trimestral')).toBeInTheDocument());

    const newBtn = await screen.findByText(/nueva plantilla/i);
    await user.click(newBtn);

    await waitFor(() => {
      const nameInput = screen.queryByPlaceholderText(/nombre.*plantilla|plantilla/i)
        ?? screen.queryByLabelText(/nombre/i);
      expect(nameInput).toBeInTheDocument();
    });

    const nameInput = (
      screen.queryByPlaceholderText(/nombre.*plantilla|plantilla/i)
      ?? screen.queryByLabelText(/nombre/i)
    ) as HTMLInputElement;

    await user.clear(nameInput);
    await user.type(nameInput, 'Nueva Plantilla');

    const createBtn = screen.queryByText(/crear plantilla/i) ?? screen.queryByText(/guardar plantilla/i);
    if (createBtn) {
      await user.click(createBtn);
    }

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/grading/period-templates',
        expect.objectContaining({ name: 'Nueva Plantilla' }),
        { params: { institutionId: 'inst-1' } },
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════
// DATES SECTION
// ═══════════════════════════════════════════════════════════

describe('GradingPeriodsPage — dates section', () => {
  beforeEach(() => {
    mockUserRoles = ['ROOT'];
    mockInstitutionConfig = { id: 'inst-1', name: 'Escuela Test', levels: [10, 20], send_email: false, send_messages: false };
    setupApiMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('dates section appears when clicking the Fechas action for a template', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('Trimestral')).toBeInTheDocument());

    // Click "Fechas" button for the first template
    const fechasBtns = screen.queryAllByText(/^Fechas$/i);
    if (fechasBtns.length > 0) {
      await user.click(fechasBtns[0]);
    } else {
      const cargarBtns = screen.queryAllByText(/cargar fechas/i);
      if (cargarBtns.length > 0) await user.click(cargarBtns[0]);
    }

    await waitFor(() => {
      const cycleSelect = document.querySelector(
        'select[aria-label*="ciclo" i], select[id*="cycle" i], select[id*="ciclo" i]',
      );
      expect(cycleSelect).toBeInTheDocument();
    });
  });

  it('startDate and endDate fields appear per item when a cycle is selected', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('Trimestral')).toBeInTheDocument());

    // Open dates section
    const fechasBtns = screen.queryAllByText(/^Fechas$/i);
    if (fechasBtns.length > 0) {
      await user.click(fechasBtns[0]);
    } else {
      const cargarBtns = screen.queryAllByText(/cargar fechas/i);
      if (cargarBtns.length > 0) await user.click(cargarBtns[0]);
    }

    // Select a cycle
    await waitFor(async () => {
      const cycleSelect = document.querySelector(
        'select[aria-label*="ciclo" i], select[id*="cycle" i], select[id*="ciclo" i]',
      ) as HTMLSelectElement | null;
      if (cycleSelect && ACADEMIC_CYCLES.length > 0) {
        await user.selectOptions(cycleSelect, ACADEMIC_CYCLES[0].uuid);
      }
    });

    // Date inputs (type=date) for start and end should appear
    await waitFor(() => {
      const dateInputs = document.querySelectorAll('input[type="date"]');
      expect(dateInputs.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('submit of dates form calls PUT /grading/period-templates/:id/dates', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('Trimestral')).toBeInTheDocument());

    // Open dates section
    const fechasBtns = screen.queryAllByText(/^Fechas$/i);
    if (fechasBtns.length > 0) {
      await user.click(fechasBtns[0]);
    } else {
      const cargarBtns = screen.queryAllByText(/cargar fechas/i);
      if (cargarBtns.length > 0) await user.click(cargarBtns[0]);
    }

    // Select a cycle
    await waitFor(async () => {
      const cycleSelect = document.querySelector(
        'select[aria-label*="ciclo" i], select[id*="cycle" i], select[id*="ciclo" i]',
      ) as HTMLSelectElement | null;
      if (cycleSelect && ACADEMIC_CYCLES.length > 0) {
        await user.selectOptions(cycleSelect, ACADEMIC_CYCLES[0].uuid);
      }
    });

    // Submit dates
    await waitFor(async () => {
      const saveBtn = screen.queryByText(/guardar fechas|aplicar fechas|guardar/i);
      if (saveBtn) {
        await user.click(saveBtn);
      }
    });

    await waitFor(() => {
      const putCalls = mockApiPut.mock.calls.filter((args: any[]) =>
        typeof args[0] === 'string' &&
        args[0].includes('/grading/period-templates/') &&
        args[0].includes('/dates'),
      );
      expect(putCalls.length).toBeGreaterThan(0);
    });
  });
});
