/**
 * Tests for delete error surfacing in the generic CRUD page used by
 * pedagogy-pages.tsx (SubjectsPage instantiates the shared GenericPage).
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
        { moduleCode: 'PEDAGOGY', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
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

const SUBJECT_MATEMATICA = {
  id: 'subj-1',
  name: 'Matemática',
  level: 'INICIAL',
};

function setupApiMock() {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPatch.mockReset();
  mockApiDelete.mockReset();
  mockApiPut.mockReset();

  mockApiGet.mockImplementation((url: string) => {
    if (url === '/subjects') {
      return Promise.resolve({ data: { data: [SUBJECT_MATEMATICA] } });
    }
    return Promise.resolve({ data: { data: [] } });
  });

  mockApiPost.mockResolvedValue({ data: { data: {} } });
  mockApiPatch.mockResolvedValue({ data: { data: {} } });
  mockApiDelete.mockResolvedValue({});
  mockApiPut.mockResolvedValue({ data: { data: [] } });
}

// ── Dynamic import ──

let SubjectsPage: any;

beforeAll(async () => {
  const mod = await import('../pedagogy-pages');
  SubjectsPage = mod.SubjectsPage;
});

function renderPage() {
  return render(
    <MemoryRouter>
      <SubjectsPage />
    </MemoryRouter>,
  );
}

// ═══════════════════════════════════════════════════════════
// DELETE ERROR SURFACING — no longer silent
// ═══════════════════════════════════════════════════════════

describe('SubjectsPage (GenericPage) — delete error surfacing', () => {
  beforeEach(() => {
    setupApiMock();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the server error when deleting a subject fails instead of doing nothing', async () => {
    mockApiDelete.mockRejectedValue({
      response: { data: { error: { message: 'No se puede eliminar: en uso' } } },
    });
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Matemática')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^Eliminar$/i }));

    await waitFor(() => {
      expect(screen.getByText(/en uso/i)).toBeInTheDocument();
    });
  });
});
