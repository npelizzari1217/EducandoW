/**
 * Tests for IngresantesPage and AceptadosPanel.
 *
 * Follows the pattern of observations-by-cycle.test.tsx:
 *   - mock apiClient (hoisted) + adaptListResponse
 *   - do NOT mock use-api so useApiList / useApiCreate run for real
 *   - import page components LAST
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

// ── Hoisted apiClient mock ────────────────────────────────────────────────────

const { mockApiGet, mockApiPost, mockApiPatch } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
}));

vi.mock('../../../api/client', () => ({
  default: { get: mockApiGet, post: mockApiPost, patch: mockApiPatch },
}));

// ── adaptListResponse mock ────────────────────────────────────────────────────

vi.mock('../../../api/adapters/index', () => ({
  adaptListResponse: (res: unknown) => {
    const r = res as { data?: { data?: unknown } };
    const d = r?.data?.data;
    return Array.isArray(d) ? d : [];
  },
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────

let mockModules: { moduleCode: string; actions: string[] }[] = [];
// Mutable so individual test suites can switch user roles and userLevels.
// Defaults to ADMIN (allLevels) so existing tests are unaffected.
let mockUserRoles: string[] = ['ADMIN'];
let mockUserUserLevels: { level: number; modality: number }[] | undefined = undefined;

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'admin@test.com',
      name: 'Admin',
      role: 'ADMIN',
      get roles() { return mockUserRoles; },
      get modules() { return mockModules; },
      levels: [],
      get userLevels() { return mockUserUserLevels; },
    },
    logout: vi.fn(),
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    accessToken: 'fake-token',
  }),
}));

// ── Institution mock ──────────────────────────────────────────────────────────

vi.mock('../../../context/institution-context', () => ({
  useInstitution: () => ({
    config: { id: 'inst-1', name: 'Escuela Test' },
    isLoading: false,
    error: null,
    reload: vi.fn(),
    clear: vi.fn(),
  }),
}));

// ── useTheme mock ─────────────────────────────────────────────────────────────

vi.mock('../../../hooks/use-theme', () => ({
  useTheme: () => ({ theme: {}, setTheme: vi.fn(), applyHeaderColors: vi.fn() }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_CYCLE = { uuid: 'cycle-2026', code: '2026', name: 'Ciclo Lectivo 2026' };

const MOCK_INGRESANTE_INSCRIPTO = {
  id: 'ing-1',
  firstName: 'Juan',
  lastName: 'Pérez',
  dni: '12345678',
  birthDate: null,
  address: null,
  phone: null,
  email: null,
  cycleId: null,
  level: 'PRIMARIO',
  modality: 0,
  status: 'INSCRIPTO',
};

const MOCK_INGRESANTE_ACEPTADO = {
  ...MOCK_INGRESANTE_INSCRIPTO,
  id: 'ing-aceptado',
  status: 'ACEPTADO',
};

// ── Page + component imports (AFTER all mocks) ────────────────────────────────

import IngresantesPage from '../ingresantes';
import { AceptadosPanel } from '../components/AceptadosPanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderIngresantesPage() {
  return render(
    <MemoryRouter>
      <IngresantesPage />
    </MemoryRouter>,
  );
}

function renderAceptadosPanel(onStudentAdded?: () => void) {
  return render(
    <MemoryRouter>
      <AceptadosPanel onStudentAdded={onStudentAdded} />
    </MemoryRouter>,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: IngresantesPage
// ─────────────────────────────────────────────────────────────────────────────

describe('IngresantesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRoles = ['ADMIN'];
    mockUserUserLevels = undefined;
    mockModules = [
      { moduleCode: 'ENROLLMENTS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
      { moduleCode: 'STUDENTS',    actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
    ];
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/ingresantes') return Promise.resolve({ data: { data: [MOCK_INGRESANTE_INSCRIPTO] } });
      if (url === '/academic-cycles') return Promise.resolve({ data: { data: [MOCK_CYCLE] } });
      return Promise.resolve({ data: { data: [] } });
    });
    mockApiPost.mockResolvedValue({ data: {} });
    mockApiPatch.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    cleanup();
  });

  // ── ING-1: list renders with status badge ─────────────────────────────────

  it('ING-1: renders ingresante list with name and status badge', async () => {
    renderIngresantesPage();

    await waitFor(() => {
      expect(screen.getByText('Pérez, Juan')).toBeInTheDocument();
    });

    expect(screen.getByText('Inscripto')).toBeInTheDocument();
    expect(screen.getByText(/DNI: 12345678/)).toBeInTheDocument();
  });

  // ── ING-2: create form POSTs correct body (incl. cycleId + level) ─────────

  it('ING-2: submitting the form POSTs with firstName, lastName, dni, cycleId, and level', async () => {
    const user = userEvent.setup();

    // No ingresantes initially to avoid DOM noise
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/ingresantes') return Promise.resolve({ data: { data: [] } });
      if (url === '/academic-cycles') return Promise.resolve({ data: { data: [MOCK_CYCLE] } });
      return Promise.resolve({ data: { data: [] } });
    });

    renderIngresantesPage();

    // Wait for cycle dropdown to load (cycles fetched in useEffect)
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/academic-cycles', expect.anything());
    });

    // Open form
    await user.click(screen.getByRole('button', { name: /nuevo ingresante/i }));

    // Fill required fields
    await user.type(screen.getByLabelText('Nombre'), 'María');
    await user.type(screen.getByLabelText('Apellido'), 'González');
    await user.type(screen.getByLabelText('DNI'), '87654321');

    // Select ciclo lectivo
    const cycleSelect = screen.getByLabelText('Ciclo lectivo') as HTMLSelectElement;
    await user.selectOptions(cycleSelect, 'cycle-2026');

    // Select nivel
    const nivelSelect = screen.getByLabelText('Nivel') as HTMLSelectElement;
    await user.selectOptions(nivelSelect, 'PRIMARIO');

    // Submit
    await user.click(screen.getByRole('button', { name: /crear ingresante/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/ingresantes',
        expect.objectContaining({
          firstName: 'María',
          lastName: 'González',
          dni: '87654321',
          cycleId: 'cycle-2026',
          level: 'PRIMARIO',
        }),
        expect.anything(),
      );
    });
  });

  // ── ING-3: advance status PATCHes next status ─────────────────────────────

  it('ING-3: clicking "Avanzar" on INSCRIPTO sends PATCH with PAGO_MATRICULA', async () => {
    const user = userEvent.setup();
    renderIngresantesPage();

    await waitFor(() => {
      expect(screen.getByText('Pérez, Juan')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /avanzar/i }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith(
        '/ingresantes/ing-1/status',
        { status: 'PAGO_MATRICULA' },
      );
    });
  });

  // ── ING-4: "Nuevo ingresante" button hidden without ENROLLMENTS CREATE ─────

  it('ING-4: "Nuevo ingresante" button is absent when user lacks ENROLLMENTS CREATE', () => {
    mockModules = [
      { moduleCode: 'ENROLLMENTS', actions: ['READ'] }, // CREATE intentionally absent
    ];

    renderIngresantesPage();

    expect(
      screen.queryByRole('button', { name: /nuevo ingresante/i }),
    ).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: AceptadosPanel — dar de alta desde Alumnos
// ─────────────────────────────────────────────────────────────────────────────

describe('AceptadosPanel — Alumnos integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRoles = ['ADMIN'];
    mockUserUserLevels = undefined;
    mockModules = [
      { moduleCode: 'STUDENTS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
    ];
    mockApiGet.mockImplementation((url: string, config?: { params?: Record<string, string> }) => {
      if (url === '/ingresantes') {
        const status = config?.params?.status;
        if (status === 'ACEPTADO') {
          return Promise.resolve({ data: { data: [MOCK_INGRESANTE_ACEPTADO] } });
        }
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: { data: [] } });
    });
    mockApiPost.mockResolvedValue({
      data: { studentId: 'stu-new', enrollmentId: 'enr-new' },
    });
  });

  afterEach(() => {
    cleanup();
  });

  // ── ALTA-1: renders ACEPTADO list and "Dar de alta" calls POST promote ─────

  it('ALTA-1: renders ACEPTADO ingresantes and "Dar de alta" calls POST /ingresantes/:id/promote', async () => {
    const user = userEvent.setup();
    const onStudentAdded = vi.fn();

    renderAceptadosPanel(onStudentAdded);

    // Ingresante renders after async fetch
    await waitFor(() => {
      expect(screen.getByText('Pérez, Juan')).toBeInTheDocument();
    });

    // Click "Dar de alta"
    const btn = screen.getByRole('button', { name: /dar de alta/i });
    await user.click(btn);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/ingresantes/ing-aceptado/promote');
    });

    // Callback fired
    expect(onStudentAdded).toHaveBeenCalledTimes(1);
  });

  // ── ALTA-2: panel is hidden without STUDENTS CREATE permission ─────────────

  it('ALTA-2: panel renders nothing when user lacks STUDENTS CREATE', () => {
    mockModules = [
      { moduleCode: 'STUDENTS', actions: ['READ'] }, // no CREATE
    ];

    const { container } = renderAceptadosPanel();
    expect(container).toBeEmptyDOMElement();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: IngresantesPage — DIRECTOR/SECRETARIO level-locked scenario
// SUGGESTION-2: verify the F-1 fixed-level path renders a disabled input
// ─────────────────────────────────────────────────────────────────────────────

describe('IngresantesPage — DIRECTOR level-locked scenario (SUGGESTION-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // DIRECTOR: not ROOT, not ADMIN → isAllLevels=false
    // userLevels[0].level === 2 → levelCode 2 = PRIMARIO base → label 'Primario'
    mockUserRoles = ['DIRECTOR'];
    mockUserUserLevels = [{ level: 2, modality: 0 }];
    mockModules = [
      { moduleCode: 'ENROLLMENTS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
      { moduleCode: 'STUDENTS',    actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
    ];
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/ingresantes') return Promise.resolve({ data: { data: [] } });
      if (url === '/academic-cycles') return Promise.resolve({ data: { data: [MOCK_CYCLE] } });
      return Promise.resolve({ data: { data: [] } }); // /institutions catch-all
    });
    mockApiPost.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    mockUserRoles = ['ADMIN'];
    mockUserUserLevels = undefined;
    cleanup();
  });

  // ── ING-5: DIRECTOR sees a disabled level input (not a dropdown) ────────────

  it('ING-5: DIRECTOR user — Nivel field is a disabled input auto-set to their level label', async () => {
    const user = userEvent.setup();
    renderIngresantesPage();

    // Wait for the page to mount (button depends on modules, not async data)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nuevo ingresante/i })).toBeInTheDocument();
    });

    // Open the create form
    await user.click(screen.getByRole('button', { name: /nuevo ingresante/i }));

    // Nivel field must be a disabled <input>, not a <select>
    const nivelInput = screen.getByLabelText('Nivel') as HTMLInputElement;
    expect(nivelInput.tagName).toBe('INPUT');
    expect(nivelInput.disabled).toBe(true);

    // Shows the human-readable label derived from userLevels[0].level === 2 (PRIMARIO base)
    // LEVEL_CATALOG.find(e => e.levelCode === 2 && e.modalityCode === 0) → label: 'Primario'
    expect(nivelInput).toHaveValue('Primario');
  });

  // ── ING-6: DIRECTOR — cannot change Nivel (disabled), can select cycle ──────

  it('ING-6: DIRECTOR user — Nivel input is not interactive (disabled attribute present)', async () => {
    const user = userEvent.setup();
    renderIngresantesPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nuevo ingresante/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /nuevo ingresante/i }));

    const nivelInput = screen.getByLabelText('Nivel') as HTMLInputElement;
    // Disabled means the attribute is set — user cannot type or interact
    expect(nivelInput).toBeDisabled();
  });
});
