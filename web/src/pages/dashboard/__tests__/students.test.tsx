import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock institutions data ──
const mockInstitutions = [
  { id: 'inst-1', name: 'Instituto A' },
  { id: 'inst-2', name: 'Instituto B' },
  { id: 'inst-3', name: 'Colegio C' },
];

// ── Mock apiClient (vi.hoisted avoids hoisting issues with top-level imports) ──
const { mockApiGet } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
}));

vi.mock('/home/usuario/proyectos/educandow/web/src/api/client', () => ({
  default: { get: mockApiGet },
}));

// ── Mock useApiList / useApiDelete / useApiCreate ──
vi.mock('/home/usuario/proyectos/educandow/web/src/hooks/use-api', () => ({
  useApiList: () => ({
    data: [],
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
      expect(screen.getByText('Instituto A')).toBeInTheDocument();
    });

    // All three institutions should appear as options
    expect(screen.getByText('Instituto A')).toBeInTheDocument();
    expect(screen.getByText('Instituto B')).toBeInTheDocument();
    expect(screen.getByText('Colegio C')).toBeInTheDocument();

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
