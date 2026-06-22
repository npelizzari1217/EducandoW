/**
 * T17 Web tests — esOptativa badge and toggle on StudyPlansPage.
 * TDD: tests are written RED before implementing the badge/toggle UI in study-plans.tsx.
 *
 * Coverage:
 * - Badge "Optativa" renders when esOptativa === true (MGC-R16, MGC-S38)
 * - No "Optativa" badge when esOptativa === false (MGC-S28)
 * - Toggle calls apiClient.post with esOptativa flipped and refreshes list
 * - Hint text "aplica en la próxima generación de CC" visible (D6)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
}));

// ── Mock hooks ──

vi.mock('../../../hooks/use-api', () => ({
  useApiList: () => ({
    data: [{ id: 'plan-1', name: 'Plan Secundario', level: 3, modality: 0, active: true, institutionId: 'inst-1' }],
    loading: false,
    reload: vi.fn(),
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
    update: vi.fn().mockResolvedValue(true),
    setUpdateError: vi.fn(),
  }),
  extractErrorMessage: (e: unknown) => String(e),
}));

// ── Mock auth ──

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'user-admin',
      email: 'admin@edu.com',
      name: 'Admin',
      role: 'ADMIN',
      roles: ['ADMIN'],
      institutionId: 'inst-1',
      userLevels: [],
    },
    logout: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    accessToken: 'fake-token',
  }),
}));

// ── Mock institution ──

vi.mock('../../../context/institution-context', () => ({
  useInstitution: () => ({
    config: { id: 'inst-1', name: 'Escuela Test' },
    isLoading: false,
    error: null,
    reload: vi.fn(),
    clear: vi.fn(),
  }),
}));

// ── Mock complex components ──

vi.mock('../../../components/ui/premium-header', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="premium-header">{children}</div>,
}));

vi.mock('../../../components/reports/StudyPlanPrintView', () => ({
  default: () => <div data-testid="print-view" />,
}));

vi.mock('../../../components/reports/StudyPlanDetailPrintView', () => ({
  StudyPlanDetailPrintLoader: () => <div data-testid="detail-print-view" />,
}));

vi.mock('../../../components/reports/PremiumPrintReport', () => ({
  buildBranding: () => ({}),
}));

vi.mock('./components/SubjectCompetenciesManager', () => ({
  SubjectCompetenciesManager: () => <div data-testid="competencies-manager" />,
}));

// Import React after mocks
import React from 'react';

// ── Fixtures ──

const COURSES_RESPONSE = {
  data: {
    data: [{
      id: 'course-1',
      studyPlanId: 'plan-1',
      courseSectionId: 'cs-1',
      courseSectionName: 'Sección A',
      courseGrade: '1er año',
      courseDivision: 'A',
      subjectCount: 2,
    }],
  },
};

const SUBJECTS_WITH_OPTATIVA = {
  data: {
    data: [
      { id: 'ps-1', subjectId: 'sub-1', subjectName: 'Matemática', hoursPerWeek: 4, esOptativa: true },
      { id: 'ps-2', subjectId: 'sub-2', subjectName: 'Lengua', hoursPerWeek: 3, esOptativa: false },
    ],
  },
};

const SUBJECTS_OBLIGATORIA_ONLY = {
  data: {
    data: [
      { id: 'ps-3', subjectId: 'sub-3', subjectName: 'Historia', hoursPerWeek: 2, esOptativa: false },
    ],
  },
};

function setupApiMock(subjectsResponse = SUBJECTS_WITH_OPTATIVA) {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPatch.mockReset();
  mockApiDelete.mockReset();

  mockApiGet.mockImplementation((url: string) => {
    if (url === '/institutions') return Promise.resolve({ data: { data: [{ id: 'inst-1', name: 'Escuela Test' }] } });
    if (url === '/course-sections') return Promise.resolve({ data: { data: [] } });
    if (url === '/academic-cycles') return Promise.resolve({ data: { data: [] } });
    if (url.startsWith('/study-plans/plan-1/courses')) return Promise.resolve(COURSES_RESPONSE);
    if (url.startsWith('/study-plan-courses/course-1/subjects')) return Promise.resolve(subjectsResponse);
    return Promise.resolve({ data: { data: [] } });
  });

  mockApiPost.mockResolvedValue({ data: { data: { ok: true } } });
}

// ── Dynamic import ──

let StudyPlansPage: React.ComponentType;

beforeEach(async () => {
  if (!StudyPlansPage) {
    const mod = await import('../study-plans');
    StudyPlansPage = mod.default;
  }
  setupApiMock();
});

afterEach(() => {
  cleanup();
});

async function renderAndExpandToSubjects(subjectsResponse = SUBJECTS_WITH_OPTATIVA) {
  setupApiMock(subjectsResponse);
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <StudyPlansPage />
    </MemoryRouter>,
  );

  // Wait for plan to appear and click to expand
  await waitFor(() => {
    expect(screen.getByText('Plan Secundario')).toBeInTheDocument();
  });

  // Click plan header to expand (triggers fetchPlanCourses)
  const planHeader = screen.getByText('Plan Secundario');
  await user.click(planHeader);

  // Wait for courses to appear and click to expand
  await waitFor(() => {
    expect(screen.getByText('Sección A')).toBeInTheDocument();
  });

  // Click course row header to expand (triggers fetchCourseSubjects)
  const courseHeader = screen.getByText('Sección A');
  await user.click(courseHeader);

  return user;
}

// ═══════════════════════════════════════════════════════════
// T17 — Badge and toggle tests
// ═══════════════════════════════════════════════════════════

describe('StudyPlansPage — esOptativa badge', () => {
  it('shows Optativa badge when esOptativa is true (MGC-R16, MGC-S38)', async () => {
    await renderAndExpandToSubjects(SUBJECTS_WITH_OPTATIVA);

    await waitFor(() => {
      expect(screen.getByText('Matemática')).toBeInTheDocument();
    });

    // Matemática has esOptativa: true → badge should be visible
    await waitFor(() => {
      const badge = screen.queryByText('Optativa');
      expect(badge).toBeInTheDocument();
    });
  });

  it('does NOT show Optativa badge when esOptativa is false (MGC-S28)', async () => {
    await renderAndExpandToSubjects(SUBJECTS_OBLIGATORIA_ONLY);

    await waitFor(() => {
      expect(screen.getByText('Historia')).toBeInTheDocument();
    });

    // Historia has esOptativa: false → no badge
    await waitFor(() => {
      const badge = screen.queryByText('Optativa');
      expect(badge).not.toBeInTheDocument();
    });
  });

  it('shows hint text about next CC generation (D6)', async () => {
    await renderAndExpandToSubjects(SUBJECTS_WITH_OPTATIVA);

    await waitFor(() => {
      expect(screen.getByText('Matemática')).toBeInTheDocument();
    });

    await waitFor(() => {
      const hints = screen.queryAllByText(/próxima generación de CC/i);
      expect(hints.length).toBeGreaterThan(0);
    });
  });
});

describe('StudyPlansPage — esOptativa toggle', () => {
  it('toggle calls apiClient.post with esOptativa: true when subject is currently false', async () => {
    // Use subjects where sub-2 has esOptativa: false
    const subjectsWithFalse = {
      data: {
        data: [{ id: 'ps-2', subjectId: 'sub-2', subjectName: 'Lengua', hoursPerWeek: 3, esOptativa: false }],
      },
    };
    const user = await renderAndExpandToSubjects(subjectsWithFalse);

    await waitFor(() => {
      expect(screen.getByText('Lengua')).toBeInTheDocument();
    });

    // Click the toggle button for Lengua (esOptativa: false → should flip to true)
    const toggleBtn = await screen.findByRole('button', { name: /marcar.*optativa/i });
    await user.click(toggleBtn);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/study-plan-courses/course-1/subjects',
        expect.objectContaining({ subjectId: 'sub-2', esOptativa: true }),
        expect.anything(),
      );
    });
  });

  it('toggle calls apiClient.post with esOptativa: false when subject is currently true', async () => {
    const subjectsWithTrue = {
      data: {
        data: [{ id: 'ps-1', subjectId: 'sub-1', subjectName: 'Matemática', hoursPerWeek: 4, esOptativa: true }],
      },
    };
    const user = await renderAndExpandToSubjects(subjectsWithTrue);

    await waitFor(() => {
      expect(screen.getByText('Matemática')).toBeInTheDocument();
    });

    // Click the toggle button for Matemática (esOptativa: true → should flip to false)
    const toggleBtn = await screen.findByRole('button', { name: /marcar.*obligatoria/i });
    await user.click(toggleBtn);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/study-plan-courses/course-1/subjects',
        expect.objectContaining({ subjectId: 'sub-1', esOptativa: false }),
        expect.anything(),
      );
    });
  });

  it('after toggle, refreshes subjects list (fetchCourseSubjects called again)', async () => {
    const subjectsWithFalse = {
      data: {
        data: [{ id: 'ps-2', subjectId: 'sub-2', subjectName: 'Lengua', hoursPerWeek: 3, esOptativa: false }],
      },
    };
    const user = await renderAndExpandToSubjects(subjectsWithFalse);

    await waitFor(() => {
      expect(screen.getByText('Lengua')).toBeInTheDocument();
    });

    const getCallsBefore = mockApiGet.mock.calls.filter((c: unknown[]) =>
      typeof c[0] === 'string' && c[0].includes('/study-plan-courses/course-1/subjects')
    ).length;

    const toggleBtn = await screen.findByRole('button', { name: /marcar.*optativa/i });
    await user.click(toggleBtn);

    await waitFor(() => {
      const getCallsAfter = mockApiGet.mock.calls.filter((c: unknown[]) =>
        typeof c[0] === 'string' && c[0].includes('/study-plan-courses/course-1/subjects')
      ).length;
      expect(getCallsAfter).toBeGreaterThan(getCallsBefore);
    });
  });
});
