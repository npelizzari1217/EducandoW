import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../context/institution-context', () => ({
  InstitutionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useInstitution: () => ({
    config: { id: 'inst-1', name: 'Escuela Test', levels: [20], send_email: false, send_messages: false },
    isLoading: false,
  }),
}));

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'admin@edu.com',
      name: 'Admin',
      role: 'ADMIN',
      roles: ['ADMIN'],
      modules: [],
      levels: [20],
    },
    logout: vi.fn(),
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    accessToken: 'token',
  }),
}));

import CompetencyGradingPage from '../competency-grading';

describe('CompetencyGradingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing with a page heading', () => {
    render(
      <MemoryRouter>
        <CompetencyGradingPage />
      </MemoryRouter>,
    );
    // Page must render a heading for "Calificación de Competencias"
    expect(
      screen.getByRole('heading', { name: /calificaci[oó]n de competencias/i }),
    ).toBeInTheDocument();
  });

  it('renders the CourseCycleSubjectSelector section', () => {
    render(
      <MemoryRouter>
        <CompetencyGradingPage />
      </MemoryRouter>,
    );
    // The selector's first dropdown must be present
    expect(screen.getByRole('combobox', { name: /ciclo lectivo/i })).toBeInTheDocument();
  });

  it('renders a grid placeholder slot (no grid yet — PR 2b)', () => {
    render(
      <MemoryRouter>
        <CompetencyGradingPage />
      </MemoryRouter>,
    );
    // Before any selection, the grid area shows a placeholder slot
    expect(screen.getByTestId('grading-placeholder')).toBeInTheDocument();
  });
});
