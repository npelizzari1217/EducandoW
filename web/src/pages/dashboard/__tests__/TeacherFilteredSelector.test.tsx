import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Mutable user ref — lets ROOT and non-ROOT describe blocks swap the user
// without re-importing the module.
let currentUser = {
  id: 'user-teacher-1',
  email: 'teacher@edu.com',
  name: 'María Docente',
  role: 'TEACHER',
  roles: ['TEACHER'],
} as { id: string; email: string; name: string; role: string; roles: string[] };

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: currentUser,
    logout: vi.fn(),
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    accessToken: 'token-abc',
  }),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const teacherUser = {
  id: 'user-teacher-1',
  email: 'teacher@edu.com',
  name: 'María Docente',
  role: 'TEACHER',
  roles: ['TEACHER'],
};

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
    currentUser = teacherUser;
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
      institutionId: undefined,
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

// ── PR5-T7 [RED]: Secundario inclusion tests ───────────────────────────────────

const mockCourseCyclesWithSecundario = [
  { uuid: 'cc-prim-1', courseName: 'Primario 1er Año', level: 20, modality: 0 },
  { uuid: 'cc-sec-1',  courseName: 'Secundario 1er Año', level: 30, modality: 0 },
  { uuid: 'cc-ter-1',  courseName: 'Terciario 1er Año', level: 40, modality: 0 },
];

const isPrimarioOrSecundario = (cc: { level: number }) =>
  [2, 3].includes(Math.floor(cc.level / 10));

describe('TeacherFilteredSelector — Secundario inclusion', () => {
  beforeEach(() => {
    currentUser = {
      id: 'user-teacher-1',
      email: 'teacher@edu.com',
      name: 'María Docente',
      role: 'TEACHER',
      roles: ['TEACHER'],
    };
    vi.clearAllMocks();
    (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, config?: { params?: Record<string, string> }) => {
        if (url === '/course-cycles') {
          const params = config?.params ?? {};
          if (params.teacherUserId === 'user-teacher-1') {
            return Promise.resolve({ data: { data: mockCourseCyclesWithSecundario } });
          }
          return Promise.resolve({ data: { data: [] } });
        }
        if (url.startsWith('/course-cycles/') && url.endsWith('/subjects')) {
          return Promise.resolve({
            data: { data: [{ subjectId: 'sub-1', subjectName: 'Matemática', studyPlanSubjectId: 'sps-1' }] },
          });
        }
        return Promise.resolve({ data: { data: [] } });
      },
    );
  });

  // TFS-SEC-1: with isPrimarioOrSecundario filter, Primario and Secundario CCs both appear
  it('TFS-SEC-1: Primario (level=20) and Secundario (level=30) CCs appear with isPrimarioOrSecundario filter', async () => {
    render(<TeacherFilteredSelector onSelect={vi.fn()} filterCourseCycle={isPrimarioOrSecundario} />);

    await waitFor(() => expect(screen.getByText('Primario 1er Año')).toBeInTheDocument());
    expect(screen.getByText('Secundario 1er Año')).toBeInTheDocument();
  });

  // TFS-SEC-2: Terciario CCs are excluded from the dropdown with isPrimarioOrSecundario filter
  it('TFS-SEC-2: Terciario (level=40) CC is excluded with isPrimarioOrSecundario filter', async () => {
    render(<TeacherFilteredSelector onSelect={vi.fn()} filterCourseCycle={isPrimarioOrSecundario} />);

    await waitFor(() => expect(screen.getByText('Primario 1er Año')).toBeInTheDocument());
    expect(screen.queryByText('Terciario 1er Año')).not.toBeInTheDocument();
  });

  // TFS-SEC-3: selecting a Secundario CC emits context with level=30
  it('TFS-SEC-3: selecting a Secundario CC emits context with level=30', async () => {
    const onSelect = vi.fn();
    render(<TeacherFilteredSelector onSelect={onSelect} filterCourseCycle={isPrimarioOrSecundario} />);

    await waitFor(() => screen.getByText('Secundario 1er Año'));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /ciclo de curso/i }),
      'cc-sec-1',
    );

    await waitFor(() => screen.getByText('Matemática'));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /materia/i }),
      'sub-1',
    );

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        courseCycleId: 'cc-sec-1',
        level: 30,
      }),
    );
  });
});

// ── ROOT user tests ────────────────────────────────────────────────────────────

const rootUser = {
  id: 'root-user-1',
  email: 'root@edu.com',
  name: 'Super Admin',
  role: 'ROOT',
  roles: ['ROOT'],
};

const mockInstitutions = [
  { id: 'inst-1', name: 'Escuela Alpha' },
  { id: 'inst-2', name: 'Escuela Beta' },
];

const mockRootCCs = [
  { uuid: 'cc-r1', courseName: '1° A', level: 20, modality: 0 },
  { uuid: 'cc-r2', courseName: '2° B', level: 21, modality: 0 },
];

describe('TeacherFilteredSelector — ROOT user', () => {
  beforeEach(() => {
    currentUser = rootUser;
    vi.clearAllMocks();
    (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, config?: { params?: Record<string, string> }) => {
        if (url === '/institutions') {
          return Promise.resolve({ data: { data: mockInstitutions } });
        }
        if (url === '/course-cycles') {
          const params = config?.params ?? {};
          if (params.institutionId === 'inst-1' && params.role === 'subject') {
            return Promise.resolve({ data: { data: mockRootCCs } });
          }
          return Promise.resolve({ data: { data: [] } });
        }
        if (url.startsWith('/course-cycles/') && url.endsWith('/subjects')) {
          return Promise.resolve({
            data: {
              data: [{ subjectId: 'sub-r1', subjectName: 'Matemática ROOT', studyPlanSubjectId: 'sps-r1' }],
            },
          });
        }
        return Promise.resolve({ data: { data: [] } });
      },
    );
  });

  afterEach(() => {
    currentUser = teacherUser;
  });

  // TFS-ROOT-1: ROOT shows institution combobox; CC dropdown not shown until institution selected
  it('TFS-ROOT-1: ROOT user sees institution combobox and no CC dropdown before selecting institution', async () => {
    render(<TeacherFilteredSelector onSelect={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('combobox', { name: /institución/i })).toBeInTheDocument());
    expect(screen.queryByRole('combobox', { name: /ciclo de curso/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('tfs-institution-prompt')).toBeInTheDocument();
  });

  // TFS-ROOT-2: selecting institution fetches /course-cycles with institutionId, NOT teacherUserId
  it('TFS-ROOT-2: selecting institution fetches /course-cycles with institutionId and no teacherUserId', async () => {
    render(<TeacherFilteredSelector onSelect={vi.fn()} />);

    await waitFor(() => screen.getByRole('combobox', { name: /institución/i }));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /institución/i }),
      'inst-1',
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/course-cycles',
        expect.objectContaining({
          params: expect.objectContaining({ institutionId: 'inst-1', role: 'subject' }),
        }),
      );
    });

    // The /course-cycles call must NOT contain teacherUserId
    const ccCall = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls.find(
      (args) => args[0] === '/course-cycles',
    );
    expect(ccCall?.[1]?.params).not.toHaveProperty('teacherUserId');
  });

  // TFS-ROOT-3: CC dropdown appears after institution is selected
  it('TFS-ROOT-3: CC dropdown appears after institution is selected and CCs are loaded', async () => {
    render(<TeacherFilteredSelector onSelect={vi.fn()} />);

    await waitFor(() => screen.getByRole('combobox', { name: /institución/i }));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /institución/i }),
      'inst-1',
    );

    await waitFor(() => expect(screen.getByRole('combobox', { name: /ciclo de curso/i })).toBeInTheDocument());
    expect(screen.getByText('1° A')).toBeInTheDocument();
    expect(screen.getByText('2° B')).toBeInTheDocument();
  });

  // TFS-ROOT-4: full ROOT selection emits context with institutionId, no teacherUserId for subjects
  it('TFS-ROOT-4: full ROOT selection emits context with institutionId; subjects fetched with institutionId', async () => {
    const onSelect = vi.fn();
    render(<TeacherFilteredSelector onSelect={onSelect} />);

    await waitFor(() => screen.getByRole('combobox', { name: /institución/i }));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /institución/i }),
      'inst-1',
    );

    await waitFor(() => screen.getByText('1° A'));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /ciclo de curso/i }),
      'cc-r1',
    );

    // Subjects fetch must use institutionId, not teacherUserId
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/course-cycles/cc-r1/subjects',
        expect.objectContaining({
          params: expect.objectContaining({ institutionId: 'inst-1' }),
        }),
      );
    });
    const subCall = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls.find(
      (args) => args[0] === '/course-cycles/cc-r1/subjects',
    );
    expect(subCall?.[1]?.params).not.toHaveProperty('teacherUserId');

    await waitFor(() => screen.getByText('Matemática ROOT'));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /materia/i }),
      'sub-r1',
    );

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        courseCycleId: 'cc-r1',
        subjectId: 'sub-r1',
        institutionId: 'inst-1',
      }),
    );
  });

  // TFS-ROOT-5: non-ROOT shows no institution combobox and fetches with teacherUserId (regression guard)
  it('TFS-ROOT-5: non-ROOT user shows no institution combobox and fetches with teacherUserId', async () => {
    currentUser = teacherUser;
    (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, config?: { params?: Record<string, string> }) => {
        if (url === '/course-cycles') {
          const params = config?.params ?? {};
          if (params.teacherUserId === 'user-teacher-1') {
            return Promise.resolve({ data: { data: mockCourseCycles } });
          }
          return Promise.resolve({ data: { data: [] } });
        }
        return Promise.resolve({ data: { data: [] } });
      },
    );

    render(<TeacherFilteredSelector onSelect={vi.fn()} />);

    expect(screen.queryByRole('combobox', { name: /institución/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/course-cycles',
        expect.objectContaining({
          params: expect.objectContaining({ teacherUserId: 'user-teacher-1' }),
        }),
      );
    });
  });
});
