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

// ── Mock adaptListResponse (used by useApiList) ──

vi.mock('../../../api/adapters/index', () => ({
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
  behavior: 'NO_COMPUTA',
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
  behavior: 'TARDE_JUSTIFICADA',
  assignable: true,
  is_system: false,
  active: true,
};

const INSTITUTIONS = [
  { id: 'inst-1', name: 'Escuela Test' },
  { id: 'inst-2', name: 'Colegio Otro' },
];

function setupApiMock() {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPatch.mockReset();
  mockApiDelete.mockReset();

  mockApiGet.mockImplementation((url: string) => {
    if (url === '/institutions') {
      return Promise.resolve({ data: { data: INSTITUTIONS } });
    }
    return Promise.resolve({ data: { data: [SYSTEM_TYPE, CUSTOM_TYPE] } });
  });
  mockApiPost.mockResolvedValue({
    data: {
      data: {
        id: 'new-1',
        code: 'AUS',
        description: 'Ausente',
        absence_value: 1,
        level: 2,
        behavior: 'AUSENTE_INJUSTIFICADO',
        assignable: true,
        is_system: false,
        active: true,
      },
    },
  });
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
// EXISTING COMPONENT TESTS (must remain green)
// ═══════════════════════════════════════════════════════════

describe('AttendanceTypesPage', () => {
  beforeEach(() => {
    mockUserRoles = ['ROOT'];
    mockInstitutionConfig = { id: 'inst-1', name: 'Escuela Test', levels: [10, 20], send_email: false, send_messages: false };
    setupApiMock();
  });

  afterEach(() => {
    cleanup();
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

// ═══════════════════════════════════════════════════════════
// BEHAVIOR SELECTOR — T2.6/T2.7 (PR2, asistencia-behavior-e-impresion)
// ═══════════════════════════════════════════════════════════

describe('AttendanceTypesPage — behavior selector', () => {
  beforeEach(() => {
    mockUserRoles = ['ROOT'];
    mockInstitutionConfig = { id: 'inst-1', name: 'Escuela Test', levels: [10, 20], send_email: false, send_messages: false };
    setupApiMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a behavior <select> with the 7 labeled options on create', async () => {
    const user = userEvent.setup();
    renderPage();

    const newBtn = await screen.findByText(/Nuevo tipo/i);
    await user.click(newBtn);

    const behaviorSelect = await screen.findByLabelText(/comportamiento/i) as HTMLSelectElement;
    const optionValues = Array.from(behaviorSelect.options).map((o) => o.value);
    expect(optionValues).toEqual([
      'AUSENTE_INJUSTIFICADO',
      'AUSENTE_JUSTIFICADO',
      'NO_ELEGIBLE',
      'NO_COMPUTA',
      'TARDE_INJUSTIFICADA',
      'TARDE_JUSTIFICADA',
      'DIA_NO_HABIL',
    ]);
  });

  it('no longer renders an "asignable" boolean input', async () => {
    const user = userEvent.setup();
    renderPage();

    const newBtn = await screen.findByText(/Nuevo tipo/i);
    await user.click(newBtn);

    expect(screen.queryByText(/Asignable manualmente/i)).not.toBeInTheDocument();
  });

  it('submitting create sends behavior (not assignable) in the payload', async () => {
    const user = userEvent.setup();
    renderPage();

    const newBtn = await screen.findByText(/Nuevo tipo/i);
    await user.click(newBtn);

    const codeInput = await screen.findByPlaceholderText(/P, SAB/i);
    await user.type(codeInput, 'AUS');
    const textboxes = screen.getAllByRole('textbox');
    await user.type(textboxes[1], 'Ausente');

    const behaviorSelect = await screen.findByLabelText(/comportamiento/i) as HTMLSelectElement;
    await user.selectOptions(behaviorSelect, 'AUSENTE_JUSTIFICADO');

    await user.click(screen.getByText(/Crear tipo/i));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/attendance-types',
        expect.objectContaining({ behavior: 'AUSENTE_JUSTIFICADO' }),
        expect.any(Object),
      );
    });
    const payload = mockApiPost.mock.calls[0][1];
    expect(payload.assignable).toBeUndefined();
  });

  it('renders behavior column with a readable label in the table', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('TAR')).toBeInTheDocument();
    });

    // CUSTOM_TYPE has behavior = TARDE_JUSTIFICADA
    expect(screen.getByText('Tarde Justificada')).toBeInTheDocument();
  });

  it('editing a custom type pre-fills the behavior selector with its current value', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('TAR')).toBeInTheDocument();
    });

    const editBtns = screen.getAllByText('Editar');
    await user.click(editBtns[0]);

    const behaviorSelect = await screen.findByLabelText(/comportamiento/i) as HTMLSelectElement;
    expect(behaviorSelect.value).toBe('TARDE_JUSTIFICADA');
  });
});

// ═══════════════════════════════════════════════════════════
// ROOT USER — institution selector and institutionId in calls
// ═══════════════════════════════════════════════════════════

describe('AttendanceTypesPage — ROOT user', () => {
  beforeEach(() => {
    mockUserRoles = ['ROOT'];
    mockInstitutionConfig = { id: 'inst-1', name: 'Escuela Test', levels: [10, 20], send_email: false, send_messages: false };
    setupApiMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders an institution selector (combobox) for ROOT', async () => {
    renderPage();

    // The institution selector should be visible
    await waitFor(() => {
      const select = screen.queryByLabelText('Institución');
      expect(select).toBeInTheDocument();
    });
  });

  it('populates institution selector with options fetched from /institutions', async () => {
    renderPage();

    // Wait for institutions to load
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/institutions');
    });

    // Institution names should appear as options (use getAllByText since the name may
    // also appear in PremiumHeader's institution display)
    await waitFor(() => {
      expect(screen.getAllByText('Escuela Test').length).toBeGreaterThan(0);
      // "Colegio Otro" only appears inside the selector options
      expect(screen.getByText('Colegio Otro')).toBeInTheDocument();
    });
  });

  it('does NOT request /attendance-types before ROOT selects an institution', async () => {
    // ROOT starts with no pre-selected institution
    mockInstitutionConfig = { id: '', name: '', levels: [], send_email: false, send_messages: false };

    renderPage();

    // Wait for /institutions to be fetched
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/institutions');
    });

    // /attendance-types should NOT have been called yet
    const attendanceCalls = mockApiGet.mock.calls.filter((args: any[]) => args[0] === '/attendance-types');
    expect(attendanceCalls.length).toBe(0);
  });

  it('requests /attendance-types with institutionId after ROOT selects an institution', async () => {
    // ROOT starts with no pre-selected institution
    mockInstitutionConfig = { id: '', name: '', levels: [], send_email: false, send_messages: false };
    const user = userEvent.setup();

    renderPage();

    // Wait for institutions list to load
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/institutions');
    });

    // Find institution selector and select an institution
    const institutionSelect = await screen.findByLabelText('Institución');
    await user.selectOptions(institutionSelect, 'inst-1');

    // Now /attendance-types should be called with institutionId
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        '/attendance-types',
        { params: { institutionId: 'inst-1' } },
      );
    });
  });

  it('passes institutionId in POST when ROOT creates a type', async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for data to load (ROOT starts with inst-1)
    await waitFor(() => {
      expect(screen.getByText('TAR')).toBeInTheDocument();
    });

    // Open create form
    const newBtn = await screen.findByText(/Nuevo tipo/i);
    await user.click(newBtn);

    // Fill form
    const codeInput = await screen.findByPlaceholderText(/P, SAB/i);
    await user.type(codeInput, 'AUS');

    // Description is the second textbox (the Input component doesn't add htmlFor
    // without an id/name prop, so we locate it by position)
    const textboxes = screen.getAllByRole('textbox');
    const descInput = textboxes[1];
    await user.type(descInput, 'Ausente');

    // Submit
    const createBtn = screen.getByText(/Crear tipo/i);
    await user.click(createBtn);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/attendance-types',
        expect.objectContaining({ code: 'AUS' }),
        { params: { institutionId: 'inst-1' } },
      );
    });
  });

  it('passes institutionId in PATCH when ROOT edits a type', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('TAR')).toBeInTheDocument();
    });

    // Click Editar on the custom type row
    const editBtns = screen.getAllByText('Editar');
    await user.click(editBtns[0]);

    // Save without changes
    const saveBtn = await screen.findByText(/Guardar cambios/i);
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith(
        `/attendance-types/${CUSTOM_TYPE.id}`,
        expect.any(Object),
        { params: { institutionId: 'inst-1' } },
      );
    });
  });

  it('passes institutionId in DELETE when ROOT deletes a type', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('TAR')).toBeInTheDocument();
    });

    // Click the Eliminar button in the table row (first match)
    const allEliminarBtns = screen.getAllByText('Eliminar');
    await user.click(allEliminarBtns[0]);

    // Confirm in modal
    await waitFor(() => {
      expect(screen.getByText('Confirmar eliminación')).toBeInTheDocument();
    });

    // Click the confirm Eliminar button inside the modal
    const modalEliminarBtns = screen.getAllByText('Eliminar');
    // The last button should be the modal confirm
    await user.click(modalEliminarBtns[modalEliminarBtns.length - 1]);

    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledWith(
        `/attendance-types/${CUSTOM_TYPE.id}`,
        { params: { institutionId: 'inst-1' } },
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════
// NON-ROOT USER — no selector, no institutionId in calls
// ═══════════════════════════════════════════════════════════

describe('AttendanceTypesPage — non-ROOT user', () => {
  beforeEach(() => {
    mockUserRoles = ['TEACHER'];
    mockInstitutionConfig = { id: 'inst-1', name: 'Escuela Test', levels: [10, 20], send_email: false, send_messages: false };
    setupApiMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('does NOT render an institution selector for non-ROOT', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/Tipos de Asistencia/i).length).toBeGreaterThan(0);
    });

    // No institution selector (label "Institución" linked to a select)
    expect(screen.queryByLabelText('Institución')).toBeNull();
  });

  it('does NOT call /institutions for non-ROOT', async () => {
    renderPage();

    await waitFor(() => {
      // Page renders and attendance-types are loaded
      expect(screen.getByText('P')).toBeInTheDocument();
    });

    // /institutions should NOT be called
    expect(mockApiGet).not.toHaveBeenCalledWith('/institutions');
  });

  it('calls /attendance-types WITHOUT institutionId for non-ROOT', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('P')).toBeInTheDocument();
    });

    // /attendance-types was called
    const attendanceCalls = mockApiGet.mock.calls.filter((args: any[]) => args[0] === '/attendance-types');
    expect(attendanceCalls.length).toBeGreaterThan(0);

    // None of the calls included an institutionId param
    attendanceCalls.forEach((args: any[]) => {
      const config = args[1] as { params?: Record<string, string> } | undefined;
      expect(config?.params?.institutionId).toBeUndefined();
    });
  });
});
