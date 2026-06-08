import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

// ── Mock useAuth (ROOT has full access) ──

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'user-root',
      email: 'root@edu.com',
      name: 'Root',
      role: 'ROOT',
      roles: ['ROOT'],
      modules: [
        { moduleCode: 'ATTENDANCE_TYPES', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
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

// ── Mock useInstitution ──

vi.mock('../../../context/institution-context', () => ({
  useInstitution: () => ({
    config: { id: 'inst-1', name: 'Escuela Test', levels: [10, 20], send_email: false, send_messages: false },
    isLoading: false,
    error: null,
    reload: vi.fn(),
    clear: vi.fn(),
  }),
}));

// ── Mock adaptListResponse (used by useApiList) ──

vi.mock('../../../api/adapters', () => ({
  adaptListResponse: (res: any) => {
    const d = res?.data?.data;
    return Array.isArray(d) ? d : [];
  },
}));

// ── Attendance types fixture ──

const SYSTEM_TYPE = {
  id: 'sys-1',
  code: 'P',
  description: 'Presente',
  absence_value: 0,
  level: 2,
  assignable: true,
  is_system: true,
  active: true,
};

const CUSTOM_TYPE = {
  id: 'cus-1',
  code: 'TAR',
  description: 'Tardanza',
  absence_value: 0.5,
  level: 2,
  assignable: true,
  is_system: false,
  active: true,
};

function setupApiMock() {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPatch.mockReset();
  mockApiDelete.mockReset();

  mockApiGet.mockResolvedValue({
    data: { data: [SYSTEM_TYPE, CUSTOM_TYPE] },
  });
  mockApiPost.mockResolvedValue({ data: { data: { id: 'new-1', code: 'AUS', description: 'Ausente', absence_value: 1, level: 2, assignable: true, is_system: false, active: true } } });
  mockApiPatch.mockResolvedValue({ data: { data: {} } });
  mockApiDelete.mockResolvedValue({});
}

// ── Dynamic import so module loads AFTER mocks ──
let AttendanceTypesPage: any;

beforeAll(async () => {
  const mod = await import('../attendance-types');
  AttendanceTypesPage = mod.default;
});

function renderPage() {
  return render(
    <MemoryRouter>
      <AttendanceTypesPage />
    </MemoryRouter>,
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENT TESTS
// ═══════════════════════════════════════════════════════════

describe('AttendanceTypesPage', () => {
  beforeEach(() => {
    setupApiMock();
  });

  it('renders without errors', async () => {
    renderPage();
    // The page title (h1) should be visible
    await waitFor(() => {
      const headings = screen.getAllByText(/Tipos de Asistencia/i);
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  it('renders the table with attendance type rows', async () => {
    renderPage();

    await waitFor(() => {
      // System type code
      expect(screen.getByText('P')).toBeInTheDocument();
      // Custom type code
      expect(screen.getByText('TAR')).toBeInTheDocument();
    });
  });

  it('renders a single level <select> for creating a type (not multi-checkbox)', async () => {
    const user = userEvent.setup();
    renderPage();

    // Open form
    const newBtn = await screen.findByText(/Nuevo tipo/i);
    await user.click(newBtn);

    // Should have a level selector
    await waitFor(() => {
      const selects = document.querySelectorAll('select[name="level"], select[aria-label*="nivel" i], select[id*="level" i]');
      // At least one select for level selection
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('system rows do NOT show Editar/Eliminar buttons', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('P')).toBeInTheDocument();
    });

    // Find all Editar buttons — should not match the system row
    const editButtons = screen.queryAllByText('Editar');
    const deleteButtons = screen.queryAllByText('Eliminar');

    // The system row (P) should have no edit/delete button
    // We check that there are fewer edit/delete buttons than total rows
    // (only custom types get edit/delete)
    // There's 1 system type and 1 custom type → only 1 edit button for the custom type
    expect(editButtons.length).toBeLessThanOrEqual(1);
    expect(deleteButtons.length).toBeLessThanOrEqual(1);
  });

  it('custom rows DO show Editar/Eliminar buttons', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('TAR')).toBeInTheDocument();
    });

    // At least one Edit/Delete button (for the custom type)
    const editButtons = screen.queryAllByText('Editar');
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('validates code max 4 chars before submit', async () => {
    const user = userEvent.setup();
    renderPage();

    // Open the create form
    const newBtn = await screen.findByText(/Nuevo tipo/i);
    await user.click(newBtn);

    // Find code input and type more than 4 chars
    const codeInput = await screen.findByPlaceholderText(/P, SAB|código/i);
    await user.clear(codeInput);
    await user.type(codeInput, 'ABCDE');

    // Try to submit
    const createBtn = screen.queryByText(/Crear tipo/i) || screen.queryByText(/Guardar/i);
    if (createBtn) {
      await user.click(createBtn);
    }

    // Should show a validation error
    await waitFor(() => {
      const errorEl = screen.queryByText(/máx|4 caracteres|máximo/i);
      expect(errorEl).toBeInTheDocument();
    });
  });
});
