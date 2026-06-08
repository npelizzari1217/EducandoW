import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mock apiClient ───────────────────────────────────────────────────────────

vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const mockAcademicCycles = [
  { uuid: 'ac-1', name: 'Ciclo 2026', code: '2026', level: 2, modality: 0, active: true },
  { uuid: 'ac-2', name: 'Ciclo 2025', code: '2025', level: 2, modality: 0, active: false },
];

const mockCourseCycles = [
  { uuid: 'cc-1', courseName: 'Primer Año A', level: 2, active: true },
  { uuid: 'cc-2', courseName: 'Segundo Año A', level: 2, active: true },
];

const mockCycleDetail = {
  uuid: 'cc-1',
  courseName: 'Primer Año A',
  level: 2,
  modality: 0,
  studyPlanId: 'sp-1',
  active: true,
};

const mockStudyPlanDetail = {
  id: 'sp-1',
  name: 'Plan Primaria 2026',
  courses: [
    {
      id: 'sc-1',
      courseSectionName: 'Primer Año',
      subjects: [
        { id: 'sps-1', subjectId: 'sub-1', subjectName: 'Matemática' },
        { id: 'sps-2', subjectId: 'sub-2', subjectName: 'Lengua' },
      ],
    },
  ],
};

import apiClient from '../../../api/client';
import { CourseCycleSubjectSelector } from '../components/CourseCycleSubjectSelector';

// ── Helper ────────────────────────────────────────────────────────────────────

function setupDefaultMocks() {
  vi.clearAllMocks();
  (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string, _config?: { params?: Record<string, string> }) => {
    if (url === '/academic-cycles') {
      return Promise.resolve({ data: { data: mockAcademicCycles } });
    }
    if (url === '/course-cycles') {
      return Promise.resolve({ data: { data: mockCourseCycles } });
    }
    if (url === '/course-cycles/cc-1') {
      return Promise.resolve({ data: { data: mockCycleDetail } });
    }
    if (url === '/course-cycles/cc-2') {
      return Promise.resolve({ data: { data: { ...mockCycleDetail, uuid: 'cc-2', courseName: 'Segundo Año A' } } });
    }
    if (url.startsWith('/study-plans/')) {
      return Promise.resolve({ data: { data: mockStudyPlanDetail } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CourseCycleSubjectSelector', () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  // CCSS-1: happy path — full cascade selection emits complete context
  it('CCSS-1: selecting all 3 levels emits complete context with non-null fields', async () => {
    const onSelect = vi.fn();
    render(<CourseCycleSubjectSelector onSelect={onSelect} />);

    // Wait for academic cycles to load
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /ciclo lectivo/i })).toBeInTheDocument();
    });
    await waitFor(() => screen.getByText('Ciclo 2026'));

    // Select academic cycle
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /ciclo lectivo/i }), 'ac-1');

    // Wait for course cycles to load
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /ciclo de curso/i })).not.toBeDisabled();
    });
    await waitFor(() => screen.getByText('Primer Año A'));

    // Select course cycle
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /ciclo de curso/i }), 'cc-1');

    // Wait for subjects to load
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /materia/i })).not.toBeDisabled();
    });
    await waitFor(() => screen.getByText('Matemática'));

    // Select subject
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /materia/i }), 'sps-1');

    // Should emit full context
    expect(onSelect).toHaveBeenCalledWith({
      courseCycleId: 'cc-1',
      studyPlanId: 'sp-1',
      studyPlanSubjectId: 'sps-1',
      level: 2,
      modality: 0,
    });
  });

  // CCSS-2: changing academic cycle resets course cycle and subject
  it('CCSS-2: changing AcademicCycle resets CourseCycle and Subject', async () => {
    const onSelect = vi.fn();
    render(<CourseCycleSubjectSelector onSelect={onSelect} />);

    await waitFor(() => screen.getByText('Ciclo 2026'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /ciclo lectivo/i }), 'ac-1');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /ciclo de curso/i })).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /ciclo de curso/i }), 'cc-1');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /materia/i })).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /materia/i }), 'sps-1');

    onSelect.mockClear();

    // Change academic cycle
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /ciclo lectivo/i }), 'ac-2');

    await waitFor(() => {
      expect((screen.getByRole('combobox', { name: /ciclo de curso/i }) as HTMLSelectElement).value).toBe('');
    });
    expect((screen.getByRole('combobox', { name: /materia/i }) as HTMLSelectElement).value).toBe('');
    // No emit on reset
    expect(onSelect).not.toHaveBeenCalled();
  });

  // CCSS-3: changing course cycle resets subject
  it('CCSS-3: changing CourseCycle resets Subject', async () => {
    const onSelect = vi.fn();
    render(<CourseCycleSubjectSelector onSelect={onSelect} />);

    await waitFor(() => screen.getByText('Ciclo 2026'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /ciclo lectivo/i }), 'ac-1');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /ciclo de curso/i })).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /ciclo de curso/i }), 'cc-1');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /materia/i })).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /materia/i }), 'sps-1');

    onSelect.mockClear();

    // Change course cycle
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /ciclo de curso/i }), 'cc-2');

    await waitFor(() => {
      expect((screen.getByRole('combobox', { name: /materia/i }) as HTMLSelectElement).value).toBe('');
    });
    // No emit on reset
    expect(onSelect).not.toHaveBeenCalled();
  });

  // CCSS-4: loading state while fetching CourseCycle options
  it('CCSS-4: shows loading state while CourseCycle options are fetching', async () => {
    let resolveCC!: (v: unknown) => void;
    (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/academic-cycles') return Promise.resolve({ data: { data: mockAcademicCycles } });
      if (url === '/course-cycles') return new Promise(res => { resolveCC = res; });
      return Promise.resolve({ data: { data: [] } });
    });

    render(<CourseCycleSubjectSelector onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Ciclo 2026'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /ciclo lectivo/i }), 'ac-1');

    // While in-flight: course cycle dropdown must be disabled/non-interactive
    const ccSelect = screen.getByRole('combobox', { name: /ciclo de curso/i });
    expect(ccSelect).toBeDisabled();

    // Resolve and confirm it unblocks
    resolveCC({ data: { data: mockCourseCycles } });
    await waitFor(() => expect(screen.getByRole('combobox', { name: /ciclo de curso/i })).not.toBeDisabled());
  });

  // CCSS-5: empty state when no course cycles
  it('CCSS-5: shows empty state message when no CourseCycles available', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/academic-cycles') return Promise.resolve({ data: { data: mockAcademicCycles } });
      if (url === '/course-cycles') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: [] } });
    });

    render(<CourseCycleSubjectSelector onSelect={vi.fn()} />);
    await waitFor(() => screen.getByText('Ciclo 2026'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /ciclo lectivo/i }), 'ac-1');

    await waitFor(() => {
      expect(screen.getByText(/sin ciclos|no hay ciclos/i)).toBeInTheDocument();
    });
  });

  // CCSS-6: error state with retry affordance
  it('CCSS-6: shows error indicator and retry button when CourseCycle fetch fails', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/academic-cycles') return Promise.resolve({ data: { data: mockAcademicCycles } });
      if (url === '/course-cycles') return Promise.reject(new Error('Network error'));
      return Promise.resolve({ data: { data: [] } });
    });

    render(<CourseCycleSubjectSelector onSelect={vi.fn()} />);
    await waitFor(() => screen.getByText('Ciclo 2026'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /ciclo lectivo/i }), 'ac-1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    });
  });

  // CCSS-7: partial selection (cycle + course, no subject) does NOT emit
  it('CCSS-7: partial selection (AC + CC, no Subject) does not emit', async () => {
    const onSelect = vi.fn();
    render(<CourseCycleSubjectSelector onSelect={onSelect} />);

    await waitFor(() => screen.getByText('Ciclo 2026'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /ciclo lectivo/i }), 'ac-1');
    await waitFor(() => expect(screen.getByRole('combobox', { name: /ciclo de curso/i })).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /ciclo de curso/i }), 'cc-1');

    // After selecting cycle + course but no subject: no emit
    await waitFor(() => expect(screen.getByRole('combobox', { name: /materia/i })).not.toBeDisabled());
    expect(onSelect).not.toHaveBeenCalled();
  });
});
