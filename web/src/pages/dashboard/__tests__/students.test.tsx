import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ── Mock institutions data ──
const mockInstitutions = [
  { id: 'inst-1', name: 'Instituto A' },
  { id: 'inst-2', name: 'Instituto B' },
  { id: 'inst-3', name: 'Colegio C' },
];

// ── Mock apiClient (vi.hoisted avoids hoisting issues with top-level imports) ──
const { mockApiGet, mockApiPost, mockApiPatch, mockApiDelete, mockStudentUpdate } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiDelete: vi.fn(),
  // Persistent spy for the useApiUpdate.update function so Bug 6 test can inspect its arguments
  mockStudentUpdate: vi.fn().mockResolvedValue(true),
}));

vi.mock('/home/usuario/proyectos/educandow/web/src/api/client', () => ({
  default: {
    get: mockApiGet,
    post: mockApiPost,
    patch: mockApiPatch,
    delete: mockApiDelete,
  },
}));

// ── Configurable student list for tests ──
let mockStudentList: unknown[] = [];

// ── Mock useApiList / useApiDelete / useApiCreate ──
vi.mock('/home/usuario/proyectos/educandow/web/src/hooks/use-api', () => ({
  useApiList: () => ({
    data: mockStudentList,
    loading: false,
    error: '',
    reload: vi.fn(),
  }),
  useApiDelete: () => ({
    deleting: false,
    del: vi.fn().mockResolvedValue(true),
  }),
  useApiCreate: () => ({
    creating: false,
    createError: '',
    create: vi.fn().mockResolvedValue(true),
    setCreateError: vi.fn(),
  }),
  useApiUpdate: () => ({
    updating: false,
    updateError: '',
    update: mockStudentUpdate,
    setUpdateError: vi.fn(),
  }),
  extractErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'API error'),
}));

// ── Configurable auth mock (ROOT vs non-ROOT) ──
let mockRoles: string[] = ['ROOT'];
let mockInstitutionId: string | undefined = 'inst-1';

function setAuthMock(roles: string[], institutionId?: string) {
  mockRoles = roles;
  mockInstitutionId = institutionId;
}

vi.mock('/home/usuario/proyectos/educandow/web/src/context/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'test@school.edu',
      name: 'Test User',
      role: mockRoles[0] ?? 'TEACHER',
      // Crucial: the component accesses (user as any).roles
      get roles() { return mockRoles; },
      institutionId: mockInstitutionId,
    },
    logout: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    accessToken: 'fake-token',
  }),
}));

// ── Mock useInstitution ──
let mockInstitutionConfig = { id: 'inst-1', name: 'Instituto A' };

vi.mock('/home/usuario/proyectos/educandow/web/src/context/institution-context', () => ({
  useInstitution: () => ({
    config: mockInstitutionConfig,
    isLoading: false,
    error: null,
    reload: vi.fn(),
    clear: vi.fn(),
  }),
}));

// ── Mock use-theme (needed by Card component) ──
vi.mock('/home/usuario/proyectos/educandow/web/src/hooks/use-theme', () => ({
  useTheme: () => ({
    theme: {},
    setTheme: vi.fn(),
    applyHeaderColors: vi.fn(),
  }),
}));

// ── Import LAST (after all mocks are set up) ──
import StudentsPage from '../students';

function renderStudents() {
  return render(
    <MemoryRouter>
      <StudentsPage />
    </MemoryRouter>,
  );
}

describe('StudentsPage — institución filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentList = []; // reset per test
    // Default: ROOT user, institutions API returns list
    setAuthMock(['ROOT'], 'inst-1');
    mockInstitutionConfig = { id: 'inst-1', name: 'Instituto A' };
    mockApiGet.mockResolvedValue({ data: { data: mockInstitutions } });
  });

  // ── T1: ROOT sees dropdown with institution names ──
  it('ROOT sees a select dropdown with institution names fetched from the API', async () => {
    renderStudents();

    // Wait for the institutions fetch to complete and render
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    // All three institutions should appear as options (may also appear in header)
    expect(screen.getAllByText('Instituto A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Instituto B').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Colegio C').length).toBeGreaterThan(0);

    // "Todas las instituciones" option should exist
    expect(screen.getByText('Todas las instituciones')).toBeInTheDocument();

    // The select element should NOT be disabled for ROOT
    const select = screen.getByRole('combobox');
    expect(select).not.toBeDisabled();
  });

  // ── T2: Non-ROOT sees disabled input with institution name ──
  it('non-ROOT sees a disabled input showing their institution name', async () => {
    setAuthMock(['TEACHER'], 'inst-2');
    mockInstitutionConfig = { id: 'inst-2', name: 'Instituto B' };

    renderStudents();

    await waitFor(() => {
      // Non-ROOT should see a disabled text input with institution name
      const disabledInput = screen.getByDisplayValue('Instituto B');
      expect(disabledInput).toBeInTheDocument();
      expect(disabledInput).toBeDisabled();
    });

    // No "Todas las instituciones" option for non-ROOT
    expect(screen.queryByText('Todas las instituciones')).not.toBeInTheDocument();
  });

  // ── T3: Non-ROOT without institution shows empty disabled input ──
  it('non-ROOT without assigned institution shows empty disabled input', async () => {
    setAuthMock(['TEACHER'], undefined);
    mockInstitutionConfig = { id: '', name: '' };

    renderStudents();

    await waitFor(() => {
      const disabledInput = screen.getByDisplayValue('');
      expect(disabledInput).toBeDisabled();
    });
  });

  // ── T4: ROOT can select a different institution ──
  it('ROOT can change the institution filter via dropdown', async () => {
    renderStudents();

    await waitFor(() => {
      expect(screen.getByText('Instituto A')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    // Initial value is user's institution
    expect(select.value).toBe('inst-1');
  });

  // ── T5: API is called on mount ──
  it('fetches institutions from /institutions on mount', async () => {
    renderStudents();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/institutions');
    });
  });

  // ── T6: API returns empty list — still renders dropdown for ROOT ──
  it('ROOT still sees dropdown even when API returns no institutions', async () => {
    mockApiGet.mockResolvedValue({ data: { data: [] } });

    renderStudents();

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    // "Todas las instituciones" option still present
    expect(screen.getByText('Todas las instituciones')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).not.toBeDisabled();
  });

  // ── T7: Non-ROOT without institution config shows institutionId as fallback ──
  it('non-ROOT without institution config shows institutionId as fallback text', async () => {
    setAuthMock(['TEACHER'], 'inst-xyz');
    mockInstitutionConfig = { id: '', name: '' };

    renderStudents();

    await waitFor(() => {
      const disabledInput = screen.getByDisplayValue('inst-xyz');
      expect(disabledInput).toBeDisabled();
    });
  });
});

// ── Code-review bug fix tests ─────────────────────────────────────────────────
describe('StudentsPage — code-review bug fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthMock(['ADMIN'], 'inst-1');
    mockInstitutionConfig = { id: 'inst-1', name: 'Instituto A' };
    mockApiGet.mockResolvedValue({ data: { data: [] } });
    mockApiPost.mockResolvedValue({ status: 201, data: { data: {} } });
    mockApiPatch.mockResolvedValue({ status: 200, data: { data: {} } });
  });

  // Bug 6 RED: clearing fatherEmail in edit mode must send raw '' (not undefined)
  it('(Bug6) clearing fatherEmail in edit mode calls update with fatherEmail as empty string', async () => {
    const studentWithEmail = {
      id: 's1',
      firstName: 'Juan',
      lastName: 'Pérez',
      dni: '12345678',
      fullName: 'Pérez, Juan',
      fatherEmail: 'padre@example.com',
      motherEmail: null,
    };
    mockStudentList = [studentWithEmail];
    mockStudentUpdate.mockResolvedValue(true);

    renderStudents();

    // Trigger edit for the student (opens the student form modal)
    const editBtn = await screen.findByRole('button', { name: 'Editar' });
    await userEvent.click(editBtn);

    // Find the fatherEmail input (labeled "Email del Padre") pre-filled with existing value
    const fatherEmailInput = await screen.findByDisplayValue('padre@example.com') as HTMLInputElement;
    await userEvent.clear(fatherEmailInput);
    expect(fatherEmailInput.value).toBe('');

    // Submit the form
    const saveBtn = screen.getByRole('button', { name: /guardar cambios/i });
    await userEvent.click(saveBtn);

    // Bug 6: with the bug, `fatherEmail: '' || undefined` → key absent from body
    // After fix, `fatherEmail: ''` is sent → update receives body with fatherEmail: ''
    await waitFor(() => {
      expect(mockStudentUpdate).toHaveBeenCalled();
    });
    const calledBody = mockStudentUpdate.mock.calls[0][1];
    expect(calledBody).toHaveProperty('fatherEmail', '');
  });

  // Bug 7 RED: portal-link (userId set) must NOT require fullName/mobile
  it('(Bug7) portal-link guardian save (userId provided) does not block on missing fullName/mobile', async () => {
    const mockStudent7 = { id: 's1', fullName: 'Juan Pérez', dni: '12345678' };
    mockStudentList = [mockStudent7];

    mockApiGet.mockImplementation((url: string) => {
      if (url === '/institutions') return Promise.resolve({ data: { data: [] } });
      if (url === '/students/s1') return Promise.resolve({ data: { data: { ...mockStudent7, fatherEmail: null, motherEmail: null } } });
      if (url === '/students/s1/guardians') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: [] } });
    });

    renderStudents();

    const tutoresBtn = await screen.findByRole('button', { name: 'Tutores' });
    await userEvent.click(tutoresBtn);

    const agregarBtn = await screen.findByRole('button', { name: /agregar tutor/i });
    await userEvent.click(agregarBtn);

    // Fill userId (labeled "ID de cuenta (opcional)") and relationship ONLY — no fullName, no mobile
    const userIdInput = screen.getByLabelText('ID de cuenta (opcional)');
    await userEvent.type(userIdInput, '11111111-1111-1111-1111-111111111111');
    await userEvent.type(screen.getByLabelText('Parentesco'), 'padre');

    const saveBtn = screen.getByRole('button', { name: /guardar tutor/i });
    await userEvent.click(saveBtn);

    // Bug 7: with the bug, shows "El nombre completo es requerido" and blocks POST
    // After fix, POST is called with userId+relationship
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalled();
    });
    // No "El nombre completo es requerido" error
    expect(screen.queryByText('El nombre completo es requerido')).not.toBeInTheDocument();
  });
});

// ── Code-review bug fixes round 2 ────────────────────────────────────────────
describe('StudentsPage — code-review round-2 bug fixes', () => {
  const mockStudentBase = { id: 's1', fullName: 'Juan Pérez', dni: '12345678' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentList = [mockStudentBase];
    setAuthMock(['ADMIN'], 'inst-1');
    mockInstitutionConfig = { id: 'inst-1', name: 'Instituto A' };
    mockApiPost.mockResolvedValue({ status: 201, data: { data: {} } });
    mockApiPatch.mockResolvedValue({ status: 200, data: { data: {} } });

    mockApiGet.mockImplementation((url: string) => {
      if (url === '/institutions') return Promise.resolve({ data: { data: [] } });
      if (url === '/students/s1') return Promise.resolve({ data: { data: { ...mockStudentBase, fatherEmail: null, motherEmail: null } } });
      if (url === '/students/s1/guardians') return Promise.resolve({ data: { data: [
        { id: 'g1', userId: null, fullName: 'Ana García', mobile: '+5491112345678', email: 'ana@example.com', relationship: 'abuela', active: true, isFinancialResponsible: false, isAuthorizedToPickUp: false },
      ] } });
      return Promise.resolve({ data: { data: [] } });
    });
  });

  // Bug 3 RED→GREEN: clearing a tutor's email in edit mode must send null (not undefined)
  it('(Bug3) clearing tutor email in edit mode sends null in PATCH body', async () => {
    renderStudents();

    const tutoresBtn = await screen.findByRole('button', { name: 'Tutores' });
    await userEvent.click(tutoresBtn);

    // Wait for guardian list to load and click the guardian's Edit button
    // There are two "Editar" buttons: one for the student row, one for the guardian
    const editBtns = await screen.findAllByRole('button', { name: 'Editar' });
    // Last "Editar" is in the guardian table
    await userEvent.click(editBtns[editBtns.length - 1]);

    // Email input is pre-filled with 'ana@example.com'
    const emailInput = await screen.findByDisplayValue('ana@example.com') as HTMLInputElement;
    await userEvent.clear(emailInput);
    expect(emailInput.value).toBe('');

    const saveTutorBtn = screen.getByRole('button', { name: /guardar tutor/i });
    await userEvent.click(saveTutorBtn);

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalled();
    });
    const patchBody = mockApiPatch.mock.calls[0][1];
    // Bug 3: with the bug, email: '' || undefined → key absent → no clear
    // After fix: email: '' || null → email: null → explicit clear
    expect(patchBody).toHaveProperty('email', null);
  });

  // Bug 4 RED→GREEN: on 409 TUTOR_DUPLICATE_NAME, UI shows override button that re-POSTs with allowDuplicate:true
  it('(Bug4) on 409 TUTOR_DUPLICATE_NAME UI shows confirm button and re-POSTs with allowDuplicate:true', async () => {
    // First POST: fail with TUTOR_DUPLICATE_NAME (as extractErrorMessage mock returns e.message)
    mockApiPost.mockRejectedValueOnce(new Error('TUTOR_DUPLICATE_NAME'));
    // Second POST: succeed
    mockApiPost.mockResolvedValue({ status: 201, data: { data: {} } });

    // No guardians in list for this test (we're creating)
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/institutions') return Promise.resolve({ data: { data: [] } });
      if (url === '/students/s1') return Promise.resolve({ data: { data: { ...mockStudentBase, fatherEmail: null, motherEmail: null } } });
      if (url === '/students/s1/guardians') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: [] } });
    });

    renderStudents();

    const tutoresBtn = await screen.findByRole('button', { name: 'Tutores' });
    await userEvent.click(tutoresBtn);

    const agregarBtn = await screen.findByRole('button', { name: /agregar tutor/i });
    await userEvent.click(agregarBtn);

    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Ana García');
    await userEvent.type(screen.getByLabelText('Móvil'), '+5491155554444');
    await userEvent.type(screen.getByLabelText('Parentesco'), 'tutor');

    const saveTutorBtn = screen.getByRole('button', { name: /guardar tutor/i });
    await userEvent.click(saveTutorBtn);

    // After 409, "Confirmar de todas formas" button must appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmar de todas formas/i })).toBeInTheDocument();
    });

    // Click confirm — second POST must include allowDuplicate: true
    await userEvent.click(screen.getByRole('button', { name: /confirmar de todas formas/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledTimes(2);
    });
    const secondCallBody = mockApiPost.mock.calls[1][1];
    expect(secondCallBody).toMatchObject({ allowDuplicate: true });
  });
});

// ── Code-review bug fixes round 3 ────────────────────────────────────────────
describe('StudentsPage — code-review round-3 bug fixes', () => {
  const mockStudentBase = { id: 's1', fullName: 'Juan Pérez', dni: '12345678' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentList = [mockStudentBase];
    setAuthMock(['ADMIN'], 'inst-1');
    mockInstitutionConfig = { id: 'inst-1', name: 'Instituto A' };
    mockApiPost.mockResolvedValue({ status: 201, data: { data: {} } });
    mockApiPatch.mockResolvedValue({ status: 200, data: { data: {} } });

    mockApiGet.mockImplementation((url: string) => {
      if (url === '/institutions') return Promise.resolve({ data: { data: [] } });
      if (url === '/students/s1') return Promise.resolve({ data: { data: { ...mockStudentBase, fatherEmail: null, motherEmail: null } } });
      if (url === '/students/s1/guardians') return Promise.resolve({ data: { data: [
        { id: 'g1', userId: null, fullName: 'Ana García', mobile: '+5491112345678', email: null, relationship: 'abuela', active: true, isFinancialResponsible: false, isAuthorizedToPickUp: false },
      ] } });
      return Promise.resolve({ data: { data: [] } });
    });
  });

  // Fix #4 (round-3) RED: edit mode TUTOR_DUPLICATE_NAME must show friendly message, not raw code
  // RED (before fix): setGuardianError gets raw 'TUTOR_DUPLICATE_NAME' string
  // GREEN (after fix): shows 'Ya existe un tutor activo con ese nombre.'
  it('(Round3-Fix4) editing guardian into a duplicate name shows friendly message not raw TUTOR_DUPLICATE_NAME code', async () => {
    // PATCH returns TUTOR_DUPLICATE_NAME error
    mockApiPatch.mockRejectedValueOnce(new Error('TUTOR_DUPLICATE_NAME'));

    renderStudents();

    const tutoresBtn = await screen.findByRole('button', { name: 'Tutores' });
    await userEvent.click(tutoresBtn);

    // Click the last "Editar" button — the one in the guardian table
    const editBtns = await screen.findAllByRole('button', { name: 'Editar' });
    await userEvent.click(editBtns[editBtns.length - 1]);

    // fullName input is pre-filled with 'Ana García'
    const fullNameInput = await screen.findByDisplayValue('Ana García') as HTMLInputElement;
    await userEvent.clear(fullNameInput);
    await userEvent.type(fullNameInput, 'María García');

    const saveTutorBtn = screen.getByRole('button', { name: /guardar tutor/i });
    await userEvent.click(saveTutorBtn);

    // Must NOT show the raw code
    await waitFor(() => {
      expect(screen.queryByText('TUTOR_DUPLICATE_NAME')).not.toBeInTheDocument();
    });
    // Must show the friendly message
    await waitFor(() => {
      expect(screen.getByText(/ya existe un tutor activo con ese nombre/i)).toBeInTheDocument();
    });
  });
});

// ── Guardian panel tests (PR3) ────────────────────────────────────────────────
describe('StudentsPage — guardian panel (PR3)', () => {
  const mockStudent = { id: 's1', fullName: 'Juan Pérez', dni: '12345678' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentList = [mockStudent];
    setAuthMock(['ADMIN'], 'inst-1');
    mockInstitutionConfig = { id: 'inst-1', name: 'Instituto A' };

    // Default mocks: institutions, student detail with emails, empty guardians list
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/institutions') return Promise.resolve({ data: { data: [] } });
      if (url === '/students/s1') return Promise.resolve({ data: { data: { ...mockStudent, fatherEmail: 'padre@example.com', motherEmail: 'madre@example.com' } } });
      if (url === '/students/s1/guardians') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: [] } });
    });

    mockApiPost.mockResolvedValue({ status: 201, data: { data: { id: 'g-new', userId: null } } });
    mockApiPatch.mockResolvedValue({ status: 200, data: { data: {} } });
    mockApiDelete.mockResolvedValue({ status: 204, data: {} });
  });

  // ── T3.1-A: Guardian list shows account-less tutor with "Sin cuenta" badge and free-text relationship ──
  it('renders an account-less tutor with free-text relationship and "Sin cuenta" badge', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/institutions') return Promise.resolve({ data: { data: [] } });
      if (url === '/students/s1') return Promise.resolve({ data: { data: { ...mockStudent, fatherEmail: 'padre@example.com' } } });
      if (url === '/students/s1/guardians') return Promise.resolve({ data: { data: [
        { id: 'g1', userId: null, fullName: 'Ana García', mobile: '+5491112345678', email: 'ana@example.com', relationship: 'abuela', active: true, isFinancialResponsible: false, isAuthorizedToPickUp: false },
      ] } });
      return Promise.resolve({ data: { data: [] } });
    });

    renderStudents();

    const tutoresBtn = await screen.findByRole('button', { name: 'Tutores' });
    await userEvent.click(tutoresBtn);

    await waitFor(() => {
      expect(screen.getByText('Ana García')).toBeInTheDocument();
    });

    // Free-text relationship rendered as-is
    expect(screen.getByText('abuela')).toBeInTheDocument();

    // "Sin cuenta" badge for null userId
    expect(screen.getByText('Sin cuenta')).toBeInTheDocument();
  });

  // ── T3.2-A: Form requires relationship — error shown when empty ──
  it('shows error and blocks submit when relationship field is empty', async () => {
    renderStudents();

    const tutoresBtn = await screen.findByRole('button', { name: 'Tutores' });
    await userEvent.click(tutoresBtn);

    const agregarBtn = await screen.findByRole('button', { name: /agregar tutor/i });
    await userEvent.click(agregarBtn);

    // Fill fullName and mobile, leave relationship empty
    const fullNameInput = screen.getByLabelText('Nombre completo');
    await userEvent.type(fullNameInput, 'Pedro Rodríguez');

    const mobileInput = screen.getByLabelText('Móvil');
    await userEvent.type(mobileInput, '+5491187654321');

    // Submit without relationship
    const saveBtn = screen.getByRole('button', { name: /guardar tutor/i });
    await userEvent.click(saveBtn);

    // Error about parentesco must appear; POST must not be called
    await waitFor(() => {
      expect(screen.getByText('El parentesco es requerido')).toBeInTheDocument();
    });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  // ── T3.2-B: Create calls POST without userId when userId is empty; treats 201 as success ──
  it('calls POST without userId and treats HTTP 201 as success', async () => {
    renderStudents();

    const tutoresBtn = await screen.findByRole('button', { name: 'Tutores' });
    await userEvent.click(tutoresBtn);

    const agregarBtn = await screen.findByRole('button', { name: /agregar tutor/i });
    await userEvent.click(agregarBtn);

    // Fill required fields — userId left empty (study tutor path)
    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Lucía García');
    await userEvent.type(screen.getByLabelText('Móvil'), '+5491155554444');
    await userEvent.type(screen.getByLabelText('Parentesco'), 'tutor');

    const saveBtn = screen.getByRole('button', { name: /guardar tutor/i });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/students/s1/guardians',
        expect.not.objectContaining({ userId: expect.anything() }),
      );
    });

    // Form should close on success (button disappears)
    await waitFor(() => {
      expect(screen.queryByLabelText('Nombre completo')).not.toBeInTheDocument();
    });
  });

  // ── T3.3: Email pre-fill from fatherEmail when relationship matches ──
  it('pre-fills email from fatherEmail when relationship is "padre" and does not overwrite user input', async () => {
    renderStudents();

    const tutoresBtn = await screen.findByRole('button', { name: 'Tutores' });
    await userEvent.click(tutoresBtn);

    // Wait for student detail to load (async)
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/students/s1');
    });

    const agregarBtn = await screen.findByRole('button', { name: /agregar tutor/i });
    await userEvent.click(agregarBtn);

    const relationshipInput = screen.getByLabelText('Parentesco');

    // Type "padre" — should trigger pre-fill from fatherEmail
    await userEvent.type(relationshipInput, 'padre');

    await waitFor(() => {
      const emailInput = screen.getByLabelText('Email del tutor') as HTMLInputElement;
      expect(emailInput.value).toBe('padre@example.com');
    });

    // User can still override the pre-filled value
    const emailInput = screen.getByLabelText('Email del tutor') as HTMLInputElement;
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, 'otro@example.com');
    expect(emailInput.value).toBe('otro@example.com');
  });
});

// ── Code-review bug fixes round 5 ────────────────────────────────────────────
describe('StudentsPage — code-review round-5 bug fixes', () => {
  const mockStudentBase = { id: 's1', fullName: 'Juan Pérez', dni: '12345678' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentList = [mockStudentBase];
    setAuthMock(['ADMIN'], 'inst-1');
    mockInstitutionConfig = { id: 'inst-1', name: 'Instituto A' };
    mockApiPost.mockResolvedValue({ status: 201, data: { data: {} } });
    mockApiPatch.mockResolvedValue({ status: 200, data: { data: {} } });

    mockApiGet.mockImplementation((url: string) => {
      if (url === '/institutions') return Promise.resolve({ data: { data: [] } });
      if (url === '/students/s1') return Promise.resolve({ data: { data: { ...mockStudentBase, fatherEmail: null, motherEmail: null } } });
      if (url === '/students/s1/guardians') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: [] } });
    });
  });

  // Round5-Bug5 RED: GUARDIAN_ALREADY_ASSIGNED must show friendly message, not raw code
  it('(Round5-Bug5) portal-link duplicate (GUARDIAN_ALREADY_ASSIGNED) shows friendly Spanish message, not raw code', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('GUARDIAN_ALREADY_ASSIGNED'));

    renderStudents();

    const tutoresBtn = await screen.findByRole('button', { name: 'Tutores' });
    await userEvent.click(tutoresBtn);

    const agregarBtn = await screen.findByRole('button', { name: /agregar tutor/i });
    await userEvent.click(agregarBtn);

    // Fill userId for portal-link path + relationship
    const userIdInput = screen.getByLabelText('ID de cuenta (opcional)');
    await userEvent.type(userIdInput, 'aaaa-bbbb-cccc-dddd');
    await userEvent.type(screen.getByLabelText('Parentesco'), 'padre');

    const saveTutorBtn = screen.getByRole('button', { name: /guardar tutor/i });
    await userEvent.click(saveTutorBtn);

    // Must NOT show raw code
    await waitFor(() => {
      expect(screen.queryByText('GUARDIAN_ALREADY_ASSIGNED')).not.toBeInTheDocument();
    });
    // Must show friendly message
    await waitFor(() => {
      expect(screen.getByText(/esta cuenta ya está vinculada/i)).toBeInTheDocument();
    });
  });
});

// ── Code-review bug fixes round 4 ────────────────────────────────────────────
describe('StudentsPage — code-review round-4 bug fixes', () => {
  const mockStudentBase = { id: 's1', fullName: 'Juan Pérez', dni: '12345678' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentList = [mockStudentBase];
    setAuthMock(['ADMIN'], 'inst-1');
    mockInstitutionConfig = { id: 'inst-1', name: 'Instituto A' };
    mockApiPost.mockResolvedValue({ status: 201, data: { data: {} } });
    mockApiPatch.mockResolvedValue({ status: 200, data: { data: {} } });
    mockApiDelete.mockResolvedValue({ status: 204, data: {} });

    mockApiGet.mockImplementation((url: string) => {
      if (url === '/institutions') return Promise.resolve({ data: { data: [] } });
      if (url === '/students/s1') return Promise.resolve({ data: { data: { ...mockStudentBase, fatherEmail: null, motherEmail: null } } });
      if (url === '/students/s1/guardians') return Promise.resolve({ data: { data: [
        { id: 'g1', userId: null, fullName: 'Ana García', mobile: '+5491112345678', email: 'ana@example.com', relationship: 'abuela', active: true, isFinancialResponsible: false, isAuthorizedToPickUp: false },
      ] } });
      return Promise.resolve({ data: { data: [] } });
    });
  });

  // Bug 5 RED: clearing mobile in EDIT mode must send null (not undefined)
  // (kept in round-4 describe for context cohesion)
  it('(Round4-Bug5) clearing mobile in edit mode sends null in PATCH body', async () => {
    renderStudents();

    const tutoresBtn = await screen.findByRole('button', { name: 'Tutores' });
    await userEvent.click(tutoresBtn);

    // Click the Editar button for the guardian
    const editBtns = await screen.findAllByRole('button', { name: 'Editar' });
    await userEvent.click(editBtns[editBtns.length - 1]);

    // Mobile input pre-filled with existing value — clear it
    const mobileInput = await screen.findByDisplayValue('+5491112345678') as HTMLInputElement;
    await userEvent.clear(mobileInput);
    expect(mobileInput.value).toBe('');

    const saveTutorBtn = screen.getByRole('button', { name: /guardar tutor/i });
    await userEvent.click(saveTutorBtn);

    // After fix: empty mobile in edit mode must become null (explicit clear), not undefined
    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith(
        expect.stringContaining('/guardians/g1'),
        expect.objectContaining({ mobile: null }),
      );
    });
  });
});

// ── Code-review bug fixes round 6 ────────────────────────────────────────────
describe('StudentsPage — code-review round-6 bug fixes', () => {
  const mockStudentBase = { id: 's1', fullName: 'Juan Pérez', dni: '12345678' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStudentList = [mockStudentBase];
    setAuthMock(['ADMIN'], 'inst-1');
    mockInstitutionConfig = { id: 'inst-1', name: 'Instituto A' };
    mockApiPost.mockResolvedValue({ status: 201, data: { data: {} } });
    mockApiPatch.mockResolvedValue({ status: 200, data: { data: {} } });
    mockApiDelete.mockResolvedValue({ status: 204, data: {} });

    mockApiGet.mockImplementation((url: string) => {
      if (url === '/institutions') return Promise.resolve({ data: { data: [] } });
      if (url === '/students/s1') return Promise.resolve({ data: { data: { ...mockStudentBase, fatherEmail: null, motherEmail: null } } });
      if (url === '/students/s1/guardians') return Promise.resolve({ data: { data: [
        { id: 'g1', userId: null, fullName: 'Ana García', mobile: '+5491112345678', email: null, relationship: 'abuela', active: true, isFinancialResponsible: false, isAuthorizedToPickUp: false },
      ] } });
      return Promise.resolve({ data: { data: [] } });
    });
  });

  // Round6-Fix2 RED: edit mode TUTOR_DUPLICATE_NAME must show "Confirmar de todas formas" button
  it('(Round6-Fix2) editing guardian into duplicate name shows override button and re-PATCHes with allowDuplicate:true', async () => {
    // First PATCH: fail with TUTOR_DUPLICATE_NAME
    mockApiPatch.mockRejectedValueOnce(new Error('TUTOR_DUPLICATE_NAME'));
    // Second PATCH (after override): succeed
    mockApiPatch.mockResolvedValue({ status: 200, data: { data: {} } });

    renderStudents();

    const tutoresBtn = await screen.findByRole('button', { name: 'Tutores' });
    await userEvent.click(tutoresBtn);

    // Enter edit mode
    const editBtns = await screen.findAllByRole('button', { name: 'Editar' });
    await userEvent.click(editBtns[editBtns.length - 1]);

    // Change the name to something that conflicts
    const fullNameInput = await screen.findByDisplayValue('Ana García') as HTMLInputElement;
    await userEvent.clear(fullNameInput);
    await userEvent.type(fullNameInput, 'María García');

    const saveTutorBtn = screen.getByRole('button', { name: /guardar tutor/i });
    await userEvent.click(saveTutorBtn);

    // "Confirmar de todas formas" must appear in edit mode
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmar de todas formas/i })).toBeInTheDocument();
    });

    // Click confirm — second PATCH must include allowDuplicate: true
    await userEvent.click(screen.getByRole('button', { name: /confirmar de todas formas/i }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledTimes(2);
    });
    const secondCallBody = mockApiPatch.mock.calls[1][1];
    expect(secondCallBody).toMatchObject({ allowDuplicate: true });
  });
});
