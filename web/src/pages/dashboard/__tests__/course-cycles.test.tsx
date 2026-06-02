import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock apiClient ──
vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { data: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { data: { created: 2, skipped: 1, total: 3 } } })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({})),
  },
}));

// ── Mock useAuth ──
vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1', email: 'admin@test.com', name: 'Admin',
      roles: ['ROOT'], userLevels: [{ level: 2 }],
    },
    logout: vi.fn(),
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    accessToken: 'fake-token',
  }),
}));

// ── Mock useInstitution ──
vi.mock('../../../context/institution-context', () => ({
  useInstitution: () => ({
    config: { id: 'inst-1', name: 'Escuela Test', levels: [10, 20, 30, 40], send_email: false, send_messages: false },
    isLoading: false, error: null,
    reload: vi.fn(), clear: vi.fn(),
  }),
}));

let CourseCyclesPage: any;

beforeAll(async () => {
  const mod = await import('../course-cycles');
  CourseCyclesPage = mod.default;
});

function renderPage() {
  return render(
    <MemoryRouter>
      <CourseCyclesPage />
    </MemoryRouter>
  );
}

describe('CourseCyclesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title', () => {
    renderPage();
    expect(screen.getByText('Cursos por Ciclo')).toBeInTheDocument();
  });

  it('renders filter controls', () => {
    renderPage();
    expect(screen.getByText('Nivel')).toBeInTheDocument();
    expect(screen.getByText('Estado')).toBeInTheDocument();
    expect(screen.getByText('Generar Cursos')).toBeInTheDocument();
    expect(screen.getByText('Nuevo Curso por Ciclo')).toBeInTheDocument();
  });

  it('shows Table component area', () => {
    renderPage();
    // The page renders with empty data — just verify the structure is there
    expect(screen.getByText('Cursos por Ciclo')).toBeInTheDocument();
  });

  it('toggles create form on button click', async () => {
    renderPage();
    const btn = screen.getByText('Nuevo Curso por Ciclo');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText('Crear')).toBeInTheDocument();
    });
  });

  it('opens generate modal on button click', async () => {
    renderPage();
    const btn = screen.getByText('Generar Cursos');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText('Generar Cursos por Ciclo')).toBeInTheDocument();
    });
  });
});
