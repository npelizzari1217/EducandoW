import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ── Mock apiClient ──
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiPut = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../../api/client', () => ({
  default: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
    patch: (...args: any[]) => mockApiPatch(...args),
    put: (...args: any[]) => mockApiPut(...args),
    delete: (...args: any[]) => mockApiDelete(...args),
  },
}));

// ── Mock useAuth ──
const mockUser = {
  id: 'user-1',
  email: 'admin@school.edu',
  name: 'Admin User',
  role: 'ADMIN',
  roles: ['ADMIN'],
  modules: [
    { moduleCode: 'USERS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
  ],
};

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
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
    config: {
      id: 'inst-1',
      name: 'Escuela Test',
      levels: [10],
      send_email: false,
      send_messages: false,
    },
    isLoading: false,
    error: null,
    reload: vi.fn(),
    clear: vi.fn(),
  }),
}));

// ── Dynamic import so module loads AFTER mocks ──
let booleansToModuleAccess: any;
let moduleAccessToBooleans: any;
let ProfilesPage: any;

beforeAll(async () => {
  const mod = await import('../profiles');
  booleansToModuleAccess = mod.booleansToModuleAccess;
  moduleAccessToBooleans = mod.moduleAccessToBooleans;
  ProfilesPage = mod.default;
});

// ── Helpers ──
function setupApiMock() {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPatch.mockReset();
  mockApiPut.mockReset();
  mockApiDelete.mockReset();

  // Default: profiles list + modules list
  mockApiGet.mockImplementation((url: string) => {
    if (url === '/profiles') {
      return Promise.resolve({
        data: {
          data: [
            { id: 'p1', name: 'Admin', _count: { permissions: 5 }, institutionId: null, createdAt: '2024-01-01', updatedAt: '2024-01-02' },
            { id: 'p2', name: 'Docente', _count: { permissions: 3 }, institutionId: null, createdAt: '2024-01-01', updatedAt: '2024-01-02' },
          ],
        },
      });
    }
    if (url === '/modules') {
      return Promise.resolve({
        data: {
          data: [
            { id: 'm1', code: 'STUDENTS', name: 'Estudiantes', active: true, actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'], createdAt: '2024-01-01', updatedAt: '2024-01-01' },
            { id: 'm2', code: 'TEACHERS', name: 'Docentes', active: true, actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'], createdAt: '2024-01-01', updatedAt: '2024-01-01' },
            { id: 'm3', code: 'USERS', name: 'Usuarios', active: true, actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'], createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          ],
        },
      });
    }
    if (url === '/profiles/p1') {
      return Promise.resolve({
        data: {
          data: { id: 'p1', name: 'Admin', institutionId: null, _count: { permissions: 5 }, createdAt: '2024-01-01', updatedAt: '2024-01-02' },
        },
      });
    }
    if (url === '/profiles/p1/permissions') {
      return Promise.resolve({
        data: {
          data: [
            { moduleId: 'm1', moduleCode: 'STUDENTS', moduleName: 'Estudiantes', canRead: true, canCreate: true, canEdit: false, canDelete: false, canPrint: false },
            { moduleId: 'm3', moduleCode: 'USERS', moduleName: 'Usuarios', canRead: true, canCreate: false, canEdit: false, canDelete: false, canPrint: false },
          ],
        },
      });
    }
    return Promise.reject(new Error('Not found'));
  });

  mockApiPost.mockResolvedValue({ data: { data: { id: 'p3' } } });
  mockApiPatch.mockResolvedValue({ data: { data: {} } });
  mockApiPut.mockResolvedValue({ data: { data: {} } });
  mockApiDelete.mockResolvedValue({ data: { data: {} } });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilesPage />
    </MemoryRouter>,
  );
}

// ═══════════════════════════════════════════════════════════
// UNIT TESTS — Pure Functions
// ═══════════════════════════════════════════════════════════

describe('booleansToModuleAccess', () => {
  it('converts permission rows with mixed flags to ModuleAccessItem[]', () => {
    const permissions = [
      { moduleId: 'm1', moduleCode: 'STUDENTS', moduleName: 'Estudiantes', canRead: true, canCreate: true, canEdit: false, canDelete: false, canPrint: false },
      { moduleId: 'm2', moduleCode: 'TEACHERS', moduleName: 'Docentes', canRead: false, canCreate: false, canEdit: true, canDelete: true, canPrint: true },
    ];

    const result = booleansToModuleAccess(permissions);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ moduleCode: 'STUDENTS', actions: ['READ', 'CREATE'] });
    expect(result[1]).toEqual({ moduleCode: 'TEACHERS', actions: ['UPDATE', 'DELETE', 'PRINT'] });
  });

  it('filters out rows where all booleans are false', () => {
    const permissions = [
      { moduleId: 'm1', moduleCode: 'STUDENTS', moduleName: 'Estudiantes', canRead: false, canCreate: false, canEdit: false, canDelete: false, canPrint: false },
      { moduleId: 'm2', moduleCode: 'TEACHERS', moduleName: 'Docentes', canRead: true, canCreate: false, canEdit: false, canDelete: false, canPrint: false },
    ];

    const result = booleansToModuleAccess(permissions);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ moduleCode: 'TEACHERS', actions: ['READ'] });
  });

  it('returns empty array when all permissions are all-false', () => {
    const permissions = [
      { moduleId: 'm1', moduleCode: 'STUDENTS', moduleName: 'Estudiantes', canRead: false, canCreate: false, canEdit: false, canDelete: false, canPrint: false },
    ];

    const result = booleansToModuleAccess(permissions);

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    const result = booleansToModuleAccess([]);
    expect(result).toEqual([]);
  });

  it('handles all-true flags producing all 5 actions', () => {
    const permissions = [
      { moduleId: 'm1', moduleCode: 'MODULES', moduleName: 'Módulos', canRead: true, canCreate: true, canEdit: true, canDelete: true, canPrint: true },
    ];

    const result = booleansToModuleAccess(permissions);

    expect(result[0].actions).toEqual(['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT']);
  });
});

describe('moduleAccessToBooleans', () => {
  const modules = [
    { id: 'm1', code: 'STUDENTS', name: 'Estudiantes', active: true, actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'], createdAt: '', updatedAt: '' },
    { id: 'm2', code: 'TEACHERS', name: 'Docentes', active: true, actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'], createdAt: '', updatedAt: '' },
    { id: 'm3', code: 'USERS', name: 'Usuarios', active: true, actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'], createdAt: '', updatedAt: '' },
  ];

  it('converts ModuleAccessItem[] to boolean permission objects', () => {
    const items = [
      { moduleCode: 'STUDENTS', actions: ['READ', 'CREATE'] },
      { moduleCode: 'TEACHERS', actions: ['UPDATE', 'DELETE', 'PRINT'] },
    ];

    const result = moduleAccessToBooleans(items, modules);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      moduleId: 'm1',
      canRead: true, canCreate: true, canEdit: false, canDelete: false, canPrint: false,
    });
    expect(result[1]).toEqual({
      moduleId: 'm2',
      canRead: false, canCreate: false, canEdit: true, canDelete: true, canPrint: true,
    });
  });

  it('returns empty array for empty items', () => {
    const result = moduleAccessToBooleans([], modules);
    expect(result).toEqual([]);
  });

  it('handles items with all 5 actions', () => {
    const items = [
      { moduleCode: 'USERS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
    ];

    const result = moduleAccessToBooleans(items, modules);

    expect(result[0]).toEqual({
      moduleId: 'm3',
      canRead: true, canCreate: true, canEdit: true, canDelete: true, canPrint: true,
    });
  });

  it('leaves moduleId empty if moduleCode not found in modules list', () => {
    const items = [
      { moduleCode: 'NONEXISTENT', actions: ['READ'] },
    ];

    const result = moduleAccessToBooleans(items, modules);

    expect(result[0].moduleId).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════
// COMPONENT TESTS — ProfilesPage
// ═══════════════════════════════════════════════════════════

describe('ProfilesPage component', () => {
  beforeEach(() => {
    setupApiMock();
  });

  it('renders the page title "Perfiles de Usuario"', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Perfiles de Usuario')).toBeInTheDocument();
    });
  });

  it('renders the subtitle about permission templates', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Plantillas de permisos/)).toBeInTheDocument();
    });
  });

  it('renders "Nuevo Perfil" button', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo Perfil')).toBeInTheDocument();
    });
  });

  it('shows profile names in the table after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Docente')).toBeInTheDocument();
    });
  });

  it('shows module count in the table', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('toggles form visibility when clicking "Nuevo Perfil"', async () => {
    const user = userEvent.setup();
    renderPage();

    const btn = await screen.findByText('Nuevo Perfil');
    await user.click(btn);

    // After clicking, button changes to "Cancelar"
    await waitFor(() => {
      expect(screen.getByText('Cancelar')).toBeInTheDocument();
    });
  });

  it('toggles form visibility when clicking "Cancelar"', async () => {
    const user = userEvent.setup();
    renderPage();

    // Open form
    const newBtn = await screen.findByText('Nuevo Perfil');
    await user.click(newBtn);

    // Close form
    const cancelBtn = await screen.findByText('Cancelar');
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.getByText('Nuevo Perfil')).toBeInTheDocument();
    });
  });

  it('does not show form by default', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });

    // The form Card should not be visible initially
    expect(screen.queryByText('Guardar')).not.toBeInTheDocument();
  });

  it('shows "No hay perfiles" when profile list is empty', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/profiles') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === '/modules') {
        return Promise.resolve({
          data: {
            data: [
              { id: 'm1', code: 'STUDENTS', name: 'Estudiantes', active: true, actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'], createdAt: '2024-01-01', updatedAt: '2024-01-01' },
            ],
          },
        });
      }
      return Promise.reject(new Error('Not found'));
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No hay perfiles')).toBeInTheDocument();
    });
  });

  it('shows error message when creating profile fails with empty name', async () => {
    const user = userEvent.setup();
    renderPage();

    // Open form
    const newBtn = await screen.findByText('Nuevo Perfil');
    await user.click(newBtn);

    // Try to save without name
    const saveBtn = await screen.findByText('Crear perfil');
    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    });
  });
});
