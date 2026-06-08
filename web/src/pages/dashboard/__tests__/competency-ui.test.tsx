import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mock setup ──────────────────────────────────────────────────────────────

vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

vi.mock('../../../hooks/use-api', () => ({
  extractErrorMessage: (e: unknown) => {
    const err = e as { message?: string };
    return err?.message ?? 'Error';
  },
  useApiCreate: vi.fn(() => ({
    creating: false,
    createError: '',
    create: vi.fn().mockResolvedValue(true),
    setCreateError: vi.fn(),
  })),
  useApiDelete: vi.fn(() => ({
    deleting: false,
    del: vi.fn().mockResolvedValue(true),
  })),
  useApiUpdate: vi.fn(() => ({
    updating: false,
    updateError: '',
    update: vi.fn().mockResolvedValue(true),
    setUpdateError: vi.fn(),
  })),
}));

vi.mock('../../../context/institution-context', () => ({
  InstitutionProvider: ({ children }: any) => <>{children}</>,
  useInstitution: () => ({
    config: { id: 'inst-1', name: 'Test Institution', levels: [2], send_email: false, send_messages: false },
    isLoading: false,
  }),
}));

// ── Fixture data ────────────────────────────────────────────────────────────

const mockPlans = [
  { id: 'plan-1', name: 'Plan Primaria 2026' },
  { id: 'plan-2', name: 'Plan Secundaria 2026' },
];

const mockPlanDetail = {
  id: 'plan-1',
  name: 'Plan Primaria 2026',
  courses: [
    {
      id: 'course-1',
      courseSectionName: '1er Año A',
      subjects: [
        { id: 'sps-1', subjectId: 'sub-1', subjectName: 'Matemática' },
        { id: 'sps-2', subjectId: 'sub-2', subjectName: 'Lengua' },
      ],
    },
    {
      id: 'course-2',
      courseSectionName: '2do Año A',
      subjects: [
        { id: 'sps-3', subjectId: 'sub-3', subjectName: 'Historia' },
      ],
    },
  ],
};

const apiClient = (await import('../../../api/client')).default;

// ── PlanCourseSubjectSelector ───────────────────────────────────────────────

import { PlanCourseSubjectSelector } from '../components/PlanCourseSubjectSelector';
import { CopyCompetenciesDialog } from '../components/CopyCompetenciesDialog';
import { CompetenciesPage } from '../competencies';

describe('PlanCourseSubjectSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/study-plans') return Promise.resolve({ data: { data: mockPlans } });
      if (url.startsWith('/study-plans/')) return Promise.resolve({ data: { data: mockPlanDetail } });
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it('renders plan dropdown on mount and calls GET /study-plans', async () => {
    render(<PlanCourseSubjectSelector onSubjectSelect={vi.fn()} />);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/study-plans');
    });

    expect(screen.getByRole('combobox', { name: /plan de estudios/i })).toBeInTheDocument();
  });

  it('selecting a plan calls GET /study-plans/:id and enables course dropdown', async () => {
    render(<PlanCourseSubjectSelector onSubjectSelect={vi.fn()} />);

    // Wait for plans to load
    await waitFor(() => screen.getByText('Plan Primaria 2026'));

    const planSelect = screen.getByRole('combobox', { name: /plan de estudios/i });
    await userEvent.selectOptions(planSelect, 'plan-1');

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/study-plans/plan-1');
    });

    // Course dropdown becomes enabled with options
    await waitFor(() => {
      const courseSelect = screen.getByRole('combobox', { name: /curso/i });
      expect(courseSelect).not.toBeDisabled();
    });

    expect(screen.getByText('1er Año A')).toBeInTheDocument();
  });

  it('selecting a course populates subject dropdown from inline subjects (no extra fetch)', async () => {
    render(<PlanCourseSubjectSelector onSubjectSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Plan Primaria 2026'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /plan de estudios/i }), 'plan-1');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /curso/i })).not.toBeDisabled());

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /curso/i }), 'course-1');

    // Subjects appear (derived from plan detail, no extra API call for subjects)
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /materia/i })).not.toBeDisabled();
    });

    // Verify no extra API call for subjects
    const getCalls = (apiClient.get as any).mock.calls.map((c: unknown[]) => c[0]);
    expect(getCalls.filter((u: string) => u.includes('subjects')).length).toBe(0);

    expect(screen.getByText('Matemática')).toBeInTheDocument();
    expect(screen.getByText('Lengua')).toBeInTheDocument();
  });

  it('changing plan resets course and subject selections', async () => {
    render(<PlanCourseSubjectSelector onSubjectSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Plan Primaria 2026'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /plan de estudios/i }), 'plan-1');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /curso/i })).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /curso/i }), 'course-1');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /materia/i })).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /materia/i }), 'sps-1');

    // Change plan → resets course + subject
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /plan de estudios/i }), 'plan-2');

    await waitFor(() => {
      expect((screen.getByRole('combobox', { name: /curso/i }) as HTMLSelectElement).value).toBe('');
    });
    expect((screen.getByRole('combobox', { name: /materia/i }) as HTMLSelectElement).value).toBe('');
  });

  it('changing course resets subject selection', async () => {
    render(<PlanCourseSubjectSelector onSubjectSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Plan Primaria 2026'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /plan de estudios/i }), 'plan-1');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /curso/i })).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /curso/i }), 'course-1');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /materia/i })).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /materia/i }), 'sps-1');
    expect((screen.getByRole('combobox', { name: /materia/i }) as HTMLSelectElement).value).toBe('sps-1');

    // Change course → resets subject
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /curso/i }), 'course-2');

    await waitFor(() => {
      expect((screen.getByRole('combobox', { name: /materia/i }) as HTMLSelectElement).value).toBe('');
    });
  });
});

// ── CopyCompetenciesDialog ──────────────────────────────────────────────────

describe('CopyCompetenciesDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/study-plans') return Promise.resolve({ data: { data: mockPlans } });
      if (url.startsWith('/study-plans/')) return Promise.resolve({ data: { data: mockPlanDetail } });
      return Promise.resolve({ data: { data: [] } });
    });
    (apiClient.post as any).mockResolvedValue({ data: { data: { copied: 3, skipped: 1 } } });
  });

  const selectSourceSubject = async () => {
    await waitFor(() => screen.getByText('Plan Primaria 2026'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /plan de estudios/i }), 'plan-1');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /curso/i })).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /curso/i }), 'course-1');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /materia/i })).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /materia/i }), 'sps-1');
  };

  it('renders source drill-down selector (calls GET /study-plans on mount)', async () => {
    render(
      <CopyCompetenciesDialog
        targetStudyPlanSubjectId="sps-target"
        onSuccess={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/study-plans');
    });

    expect(screen.getByRole('combobox', { name: /plan de estudios/i })).toBeInTheDocument();
  });

  it('confirm button calls POST /subject-competencies/copy with source and target IDs', async () => {
    render(
      <CopyCompetenciesDialog
        targetStudyPlanSubjectId="sps-target"
        onSuccess={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await selectSourceSubject();

    const confirmBtn = screen.getByRole('button', { name: /copiar competencias/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/subject-competencies/copy', {
        sourceStudyPlanSubjectId: 'sps-1',
        targetStudyPlanSubjectId: 'sps-target',
      });
    });
  });

  it('on success calls onSuccess and shows copied/skipped feedback', async () => {
    const onSuccess = vi.fn();
    render(
      <CopyCompetenciesDialog
        targetStudyPlanSubjectId="sps-target"
        onSuccess={onSuccess}
        onClose={vi.fn()}
      />,
    );

    await selectSourceSubject();
    await userEvent.click(screen.getByRole('button', { name: /copiar competencias/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });

    // Shows result feedback with counts
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it('shows zero-results message when copied === 0 and skipped === 0', async () => {
    (apiClient.post as any).mockResolvedValue({ data: { data: { copied: 0, skipped: 0 } } });

    render(
      <CopyCompetenciesDialog
        targetStudyPlanSubjectId="sps-target"
        onSuccess={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await selectSourceSubject();
    await userEvent.click(screen.getByRole('button', { name: /copiar competencias/i }));

    await waitFor(() => {
      expect(screen.getByText(/sin competencias activas|no hay competencias/i)).toBeInTheDocument();
    });
  });
});

// ── CompetenciesPage ────────────────────────────────────────────────────────

describe('CompetenciesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/study-plans') return Promise.resolve({ data: { data: mockPlans } });
      if (url.startsWith('/study-plans/')) return Promise.resolve({ data: { data: mockPlanDetail } });
      if (url === '/subject-competencies') return Promise.resolve({ data: { data: [] } });
      if (url === '/competency-valuations') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: [] } });
    });
  });

  const selectSubject = async () => {
    await waitFor(() => screen.getByText('Plan Primaria 2026'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /plan de estudios/i }), 'plan-1');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /curso/i })).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /curso/i }), 'course-1');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /materia/i })).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /materia/i }), 'sps-1');
  };

  it('Tab 1 calls /subject-competencies with studyPlanSubjectId — never calls dead route', async () => {
    render(<CompetenciesPage />);

    await selectSubject();

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/subject-competencies',
        expect.objectContaining({ params: expect.objectContaining({ studyPlanSubjectId: 'sps-1' }) }),
      );
    });

    // Dead route must NOT be called
    const allUrls = (apiClient.get as any).mock.calls.map((c: unknown[]) => c[0] as string);
    expect(allUrls.some((u: string) => u.includes('/subjects/') && u.includes('/competencies'))).toBe(false);
  });

  it('VTC-1/VTC-2: "Valoraciones por Alumno" tab is absent after cleanup', async () => {
    render(<CompetenciesPage />);
    // After VTC cleanup: the tab button must NOT be in the DOM
    expect(screen.queryByRole('button', { name: /valoraciones por alumno/i })).not.toBeInTheDocument();
  });

  it('shows Copy button on Tab 1 when a subject is selected', async () => {
    render(<CompetenciesPage />);

    await selectSubject();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copiar desde otro curso/i })).toBeInTheDocument();
    });
  });
});
