/**
 * Tests for the period dates section integrated into AcademicCyclesPage.
 * Covers the new "Períodos" action and dates management card.
 * The existing firstBim..fourthBim functionality is NOT tested here (not broken).
 */
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

// ── Auth mock ──

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'user-admin',
      email: 'admin@edu.com',
      name: 'Admin',
      role: 'ADMIN',
      roles: ['ADMIN'],
      modules: [
        { moduleCode: 'COURSES', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
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

// ── Institution mock ──

vi.mock('../../../context/institution-context', () => ({
  useInstitution: () => ({
    config: {
      id: 'inst-1',
      name: 'Escuela Test',
      levels: [10, 20],
      send_email: false,
      send_messages: false,
    },
    isLoading: false,
    error: null,
    reload: vi.fn(),
    clear: vi.fn(),
  }),
}));

// ── Mock adapters ──

vi.mock('../../../api/adapters/index', () => ({
  adaptListResponse: (res: any) => {
    const d = res?.data?.data;
    return Array.isArray(d) ? d : [];
  },
}));

// ── Fixtures ──

const CYCLE_2026 = {
  uuid: 'cycle-uuid-1',
  code: '2026',
  name: 'Ciclo Lectivo 2026',
  level: 2,
  active: true,
  startDate: '2026-03-01T00:00:00.000Z',
  endDate: '2026-12-20T00:00:00.000Z',
  firstBimonthStart: null,
  firstBimonthEnd: null,
  secondBimonthStart: null,
  secondBimonthEnd: null,
  thirdBimonthStart: null,
  thirdBimonthEnd: null,
  fourthBimonthStart: null,
  fourthBimonthEnd: null,
};

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

function setupApiMock() {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPatch.mockReset();
  mockApiDelete.mockReset();
  mockApiPut.mockReset();

  mockApiGet.mockImplementation((url: string) => {
    if (url === '/academic-cycles') {
      return Promise.resolve({ data: { data: [CYCLE_2026] } });
    }
    if (url === '/grading/period-templates') {
      return Promise.resolve({ data: { data: [TEMPLATE_TRIMESTRAL] } });
    }
    if (/\/grading\/period-templates\/[^/]+\/dates/.test(url)) {
      return Promise.resolve({ data: { data: [] } });
    }
    return Promise.resolve({ data: { data: [] } });
  });

  mockApiPost.mockResolvedValue({ data: { data: {} } });
  mockApiPatch.mockResolvedValue({ data: { data: {} } });
  mockApiDelete.mockResolvedValue({});
  mockApiPut.mockResolvedValue({ data: { data: [] } });
}

// ── Dynamic import ──

let AcademicCyclesPage: any;

beforeAll(async () => {
  const mod = await import('../academic-cycles');
  AcademicCyclesPage = mod.default;
});

function renderPage() {
  return render(
    <MemoryRouter>
      <AcademicCyclesPage />
    </MemoryRouter>,
  );
}

// ═══════════════════════════════════════════════════════════
// PERIOD DATES SECTION — integration tests
// ═══════════════════════════════════════════════════════════

describe('AcademicCyclesPage — period dates section', () => {
  beforeEach(() => {
    setupApiMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders cycle list and shows Períodos button per row', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Ciclo Lectivo 2026')).toBeInTheDocument();
    });
    await waitFor(() => {
      const periodsBtns = screen.queryAllByText(/^Períodos$/i);
      expect(periodsBtns.length).toBeGreaterThan(0);
    });
  });

  it('clicking Períodos opens the period dates section for that cycle', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Ciclo Lectivo 2026')).toBeInTheDocument();
    });

    const periodsBtn = await screen.findByText(/^Períodos$/i);
    await user.click(periodsBtn);

    await waitFor(() => {
      // Find the heading element specifically (avoids matching container divs)
      const heading = screen.queryByRole('heading', { name: /Fechas de Períodos/i });
      expect(heading).toBeInTheDocument();
    });
  });

  it('loads period templates for the cycle level when section opens', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Ciclo Lectivo 2026')).toBeInTheDocument();
    });

    const periodsBtn = await screen.findByText(/^Períodos$/i);
    await user.click(periodsBtn);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        '/grading/period-templates',
        expect.objectContaining({ params: expect.objectContaining({ level: '2' }) }),
      );
    });
  });

  it('shows template items with date inputs when template is auto-selected (single template)', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Ciclo Lectivo 2026')).toBeInTheDocument();
    });

    const periodsBtn = await screen.findByText(/^Períodos$/i);
    await user.click(periodsBtn);

    // With a single template, it auto-selects and shows date inputs
    await waitFor(() => {
      const dateInputs = document.querySelectorAll('input[type="date"]');
      // At least 2 date inputs (1 start + 1 end per item), up to 6 for 3 items
      expect(dateInputs.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows template item names in the dates section', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Ciclo Lectivo 2026')).toBeInTheDocument();
    });

    const periodsBtn = await screen.findByText(/^Períodos$/i);
    await user.click(periodsBtn);

    await waitFor(() => {
      expect(screen.getByText('1° Trimestre')).toBeInTheDocument();
      expect(screen.getByText('2° Trimestre')).toBeInTheDocument();
      expect(screen.getByText('3° Trimestre')).toBeInTheDocument();
    });
  });

  it('clicking "Guardar fechas de períodos" calls PUT /grading/period-templates/:id/dates', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Ciclo Lectivo 2026')).toBeInTheDocument();
    });

    const periodsBtn = await screen.findByText(/^Períodos$/i);
    await user.click(periodsBtn);

    // Wait for dates section to be ready
    await waitFor(() => {
      const saveBtn = screen.queryByText(/guardar fechas de períodos/i);
      expect(saveBtn).toBeInTheDocument();
    });

    const saveBtn = screen.getByText(/guardar fechas de períodos/i);
    await user.click(saveBtn);

    await waitFor(() => {
      const putCalls = mockApiPut.mock.calls.filter((args: any[]) =>
        typeof args[0] === 'string' &&
        args[0].includes('/grading/period-templates/') &&
        args[0].includes('/dates'),
      );
      expect(putCalls.length).toBeGreaterThan(0);
    });
  });

  it('clicking Períodos again on same cycle closes the section (toggle)', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Ciclo Lectivo 2026')).toBeInTheDocument();
    });

    const periodsBtn = await screen.findByText(/^Períodos$/i);

    // Open
    await user.click(periodsBtn);
    await waitFor(() => {
      const heading = screen.queryByRole('heading', { name: /Fechas de Períodos/i });
      expect(heading).toBeInTheDocument();
    });

    // Close
    await user.click(periodsBtn);
    await waitFor(() => {
      const heading = screen.queryByRole('heading', { name: /Fechas de Períodos/i });
      expect(heading).not.toBeInTheDocument();
    });
  });
});
