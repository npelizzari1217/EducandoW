import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { DashboardLayout } from '../dashboard-layout';

// ── Mock heavy dependencies ───────────────────────────────────────────────────

vi.mock('../sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));

vi.mock('../../ui/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock('../active-institution-selector', () => ({
  ActiveInstitutionSelector: () => (
    <div data-testid="active-institution-selector" />
  ),
}));

vi.mock('../../../context/institution-context', () => ({
  useInstitution: () => ({ config: {} }),
}));

// ── Configurable auth / active-institution mocks ──────────────────────────────

let mockIsRoot = false;
let mockActiveId: string | null = null;

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: { roles: mockIsRoot ? ['ROOT'] : ['ADMIN'] },
  }),
}));

vi.mock('../../../context/active-institution-context', () => ({
  useActiveInstitution: () => ({
    activeId: mockActiveId,
    setActive: vi.fn(),
    clear: vi.fn(),
  }),
}));

// ── Helper: render DashboardLayout at a given path with a child outlet ────────

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route
            path="*"
            element={<div data-testid="page-content">Page Content</div>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DashboardLayout — ROOT tenant guard (W-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRoot = false;
    mockActiveId = null;
  });

  it('non-ROOT user → page content renders, guard prompt absent', () => {
    mockIsRoot = false;
    mockActiveId = null;
    renderAt('/students');

    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    expect(
      screen.queryByText(/Seleccioná una institución para ver y editar sus datos/),
    ).toBeNull();
  });

  it('ROOT with activeId set → page content renders on tenant route', () => {
    mockIsRoot = true;
    mockActiveId = 'inst-123';
    renderAt('/students');

    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    expect(
      screen.queryByText(/Seleccioná una institución para ver y editar sus datos/),
    ).toBeNull();
  });

  it('ROOT with no activeId on a TENANT route → guard prompt shown, page content hidden', () => {
    mockIsRoot = true;
    mockActiveId = null;
    renderAt('/students');

    expect(
      screen.getByText('Seleccioná una institución para ver y editar sus datos'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('page-content')).toBeNull();
  });

  it('ROOT with no activeId on /institutions (MASTER route) → page content renders, no guard', () => {
    mockIsRoot = true;
    mockActiveId = null;
    renderAt('/institutions');

    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    expect(
      screen.queryByText(/Seleccioná una institución para ver y editar sus datos/),
    ).toBeNull();
  });
});
