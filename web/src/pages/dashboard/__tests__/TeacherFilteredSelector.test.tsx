import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'user-teacher-1',
      email: 'teacher@edu.com',
      name: 'María Docente',
      role: 'TEACHER',
      roles: ['TEACHER'],
    },
    logout: vi.fn(),
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    accessToken: 'token-abc',
  }),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const mockCourseCycles = [
  { uuid: 'cc-1', courseName: 'Primer Año A', level: 20, modality: 0 },
  { uuid: 'cc-2', courseName: 'Segundo Año B', level: 21, modality: 0 },
];

// REAL API shape: TeacherSubjectEntry from list-teacher-subjects-in-course-cycle.use-case.ts
// Returns { subjectId, subjectName, studyPlanSubjectId }[]
const mockSubjectsForCC1 = [
  { subjectId: 'sub-1', subjectName: 'Matemática', studyPlanSubjectId: 'sps-1' },
  { subjectId: 'sub-2', subjectName: 'Lengua', studyPlanSubjectId: 'sps-2' },
];

const mockSubjectsForCC2 = [
  { subjectId: 'sub-3', subjectName: 'Ciencias Naturales', studyPlanSubjectId: 'sps-3' },
];

import apiClient from '../../../api/client';
import { TeacherFilteredSelector } from '../components/TeacherFilteredSelector';

// ── Helpers ────────────────────────────────────────────────────────────────────

function setupDefaultMocks() {
  vi.clearAllMocks();
  (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation(
    (url: string, config?: { params?: Record<string, string> }) => {
      if (url === '/course-cycles') {
        const params = config?.params ?? {};
        if (params.teacherUserId === 'user-teacher-1' && params.role === 'subject') {
          return Promise.resolve({ data: { data: mockCourseCycles } });
        }
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === '/course-cycles/cc-1/subjects') {
        return Promise.resolve({ data: { data: mockSubjectsForCC1 } });
      }
      if (url === '/course-cycles/cc-2/subjects') {
        return Promise.resolve({ data: { data: mockSubjectsForCC2 } });
      }
      return Promise.resolve({ data: { data: [] } });
    },
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('TeacherFilteredSelector', () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  // TFS-1: calls course-cycles with teacherUserId + role=subject on mount
  it('TFS-1: fetches GET /course-cycles?teacherUserId=user-teacher-1&role=subject on mount', async () => {
    render(<TeacherFilteredSelector onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/course-cycles',
        expect.objectContaining({
          params: expect.objectContaining({
            teacherUserId: 'user-teacher-1',
            role: 'subject',
          }),
        }),
      );
    });
  });

  // TFS-2: renders CC dropdown populated with teacher's course cycles
  it('TFS-2: renders CourseCycle dropdown with teacher options after load', async () => {
    render(<TeacherFilteredSelector onSelect={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Primer Año A')).toBeInTheDocument());
    expect(screen.getByText('Segundo Año B')).toBeInTheDocument();
  });

  // TFS-3: empty state when no CCs returned
  it('TFS-3: shows empty state when teacher has no assigned course cycles', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: [] } });

    render(<TeacherFilteredSelector onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText(/no ten[eé]s materias asignadas|sin ciclos asignados/i),
      ).toBeInTheDocument();
    });
  });

  // TFS-4: selecting a CC fetches subjects with teacherUserId
  it('TFS-4: selecting a CC fetches GET /course-cycles/:id/subjects?teacherUserId=', async () => {
    render(<TeacherFilteredSelector onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Primer Año A'));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /ciclo de curso/i }),
      'cc-1',
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/course-cycles/cc-1/subjects',
        expect.objectContaining({
          params: expect.objectContaining({ teacherUserId: 'user-teacher-1' }),
        }),
      );
    });
  });

  // TFS-5: renders subject dropdown after CC selection
  it('TFS-5: renders subject dropdown populated after CC is selected', async () => {
    render(<TeacherFilteredSelector onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Primer Año A'));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /ciclo de curso/i }),
      'cc-1',
    );

    await waitFor(() => expect(screen.getByText('Matemática')).toBeInTheDocument());
    expect(screen.getByText('Lengua')).toBeInTheDocument();
  });

  // TFS-6: full selection emits complete TeacherFilteredSelectionContext
  it('TFS-6: full selection emits context with courseCycleId, subjectId, level, modality', async () => {
    const onSelect = vi.fn();
    render(<TeacherFilteredSelector onSelect={onSelect} />);

    await waitFor(() => screen.getByText('Primer Año A'));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /ciclo de curso/i }),
      'cc-1',
    );

    await waitFor(() => screen.getByText('Matemática'));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /materia/i }),
      'sub-1',
    );

    expect(onSelect).toHaveBeenCalledWith({
      courseCycleId: 'cc-1',
      subjectId: 'sub-1',
      studyPlanSubjectId: 'sps-1',
      level: 20,
      modality: 0,
    });
  });

  // TFS-7: partial selection (CC only) does not emit
  it('TFS-7: selecting only CC does not emit context', async () => {
    const onSelect = vi.fn();
    render(<TeacherFilteredSelector onSelect={onSelect} />);

    await waitFor(() => screen.getByText('Primer Año A'));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /ciclo de curso/i }),
      'cc-1',
    );

    await waitFor(() => screen.getByText('Matemática'));

    expect(onSelect).not.toHaveBeenCalled();
  });

  // TFS-8: changing CC resets subject selection
  it('TFS-8: changing CC resets subject dropdown', async () => {
    const onSelect = vi.fn();
    render(<TeacherFilteredSelector onSelect={onSelect} />);

    await waitFor(() => screen.getByText('Primer Año A'));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /ciclo de curso/i }),
      'cc-1',
    );
    await waitFor(() => screen.getByText('Matemática'));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /materia/i }),
      'sub-1',
    );
    expect(onSelect).toHaveBeenCalledTimes(1);

    onSelect.mockClear();

    // Change CC
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /ciclo de curso/i }),
      'cc-2',
    );

    // Subject should reset (new subjects for cc-2 load, old ones gone)
    await waitFor(() => screen.getByText('Ciencias Naturales'));
    expect((screen.getByRole('combobox', { name: /materia/i }) as HTMLSelectElement).value).toBe('');
    expect(onSelect).not.toHaveBeenCalled();
  });

  // TFS-9: loading state while fetching course cycles
  it('TFS-9: CC dropdown is disabled while course cycles are loading', async () => {
    let resolveCC!: (v: unknown) => void;
    (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/course-cycles') return new Promise(res => { resolveCC = res; });
      return Promise.resolve({ data: { data: [] } });
    });

    render(<TeacherFilteredSelector onSelect={vi.fn()} />);

    // While in-flight the CC dropdown must be disabled/loading
    const ccSelect = screen.getByRole('combobox', { name: /ciclo de curso/i });
    expect(ccSelect).toBeDisabled();

    resolveCC({ data: { data: mockCourseCycles } });
    await waitFor(() => expect(screen.getByRole('combobox', { name: /ciclo de curso/i })).not.toBeDisabled());
  });
});
