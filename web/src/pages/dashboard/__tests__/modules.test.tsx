/**
 * Tests for delete error surfacing on ModulesPage.
 * Mirrors the pattern used in academic-cycles.test.tsx.
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
        { moduleCode: 'INSTITUTIONS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
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

const MODULE_STUDENTS = {
  id: 'mod-1',
  code: 'STUDENTS',
  name: 'Alumnos',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function setupApiMock() {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPatch.mockReset();
  mockApiDelete.mockReset();
  mockApiPut.mockReset();

  mockApiGet.mockImplementation((url: string) => {
    if (url === '/modules') {
      return Promise.resolve({ data: { data: [MODULE_STUDENTS] } });
    }
    return Promise.resolve({ data: { data: [] } });
  });

  mockApiPost.mockResolvedValue({ data: { data: {} } });
  mockApiPatch.mockResolvedValue({ data: { data: {} } });
  mockApiDelete.mockResolvedValue({});
  mockApiPut.mockResolvedValue({ data: { data: [] } });
}

// ── Dynamic import ──

let ModulesPage: any;

beforeAll(async () => {
  const mod = await import('../modules');
  ModulesPage = mod.default;
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ModulesPage />
    </MemoryRouter>,
  );
}

// ═══════════════════════════════════════════════════════════
// DELETE ERROR SURFACING — no longer silent
// ═══════════════════════════════════════════════════════════

describe('ModulesPage — delete error surfacing', () => {
  beforeEach(() => {
    setupApiMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the server error when deleting a module fails instead of doing nothing', async () => {
    mockApiDelete.mockRejectedValue({
      response: { data: { error: { message: 'No se puede eliminar: módulo en uso' } } },
    });
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Alumnos')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^Eliminar$/i }));

    await waitFor(() => {
      expect(screen.getByText(/módulo en uso/i)).toBeInTheDocument();
    });
  });
});
