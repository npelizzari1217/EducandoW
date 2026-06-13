/**
 * Grupo filter tests for SubjectGradingBySubjectPage.
 *
 * Covers:
 * - GRP-1/2: management user sees "Todos" + grupo list in selector
 * - GRP-3: management selecting a grupo fetches alumnos and filters the grid
 * - GRP-4: management "Todos" → all students shown (no filter)
 * - GRP-D1: docente sees grupo selector WITHOUT "Todos" option
 * - GRP-D2: docente with 1 grupo auto-selects and fetches alumnos
 * - GRP-D3: grid filters to docente's grupo students
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Mutable user (allows per-test role switching) ──────────────────────────────

let mockUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  name: 'Admin User',
  role: 'ADMIN',
  roles: ['ADMIN'] as string[],
  institutionId: 'inst-1',
};

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn().mockResolvedValue({ data: { data: null } }),
  },
}));

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn(),
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    accessToken: 'token-test',
  }),
}));

vi.mock('../../../context/institution-context', () => ({
  InstitutionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useInstitution: () => ({
    config: { id: 'inst-1', name: 'Escuela Test', levels: [20], send_email: false, send_messages: false },
    isLoading: false,
  }),
}));

// Minimal CGG mock to keep tests focused on grupo feature
vi.mock('../components/CompetencyGradingGrid', () => ({
  CompetencyGradingGrid: () => <div data-testid="mock-cgg">Competency Grid</div>,
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const mockCourseCycles = [
  { uuid: 'cc-1', courseName: '1er Año A', level: 20, modality: 0 },
];

const mockSubjects = [
  { subjectId: 'sub-1', subjectName: 'Matemática', studyPlanSubjectId: 'sps-1' },
];

const mockMaterias = [
  { id: 'mat-1', subjectId: 'sub-1', subjectName: 'Matemática' },
];

const mockGrupos = [
  { id: 'g-1', name: 'Grupo A', docenteName: 'Ana García' },
  { id: 'g-2', name: 'Grupo B', docenteName: 'Carlos López' },
];

const mockSingleGrupo = [
  { id: 'g-1', name: 'Grupo A', docenteName: 'Ana García' },
];

// Only s-1 belongs to grupo g-1; s-2 is in a different grupo
const mockGrupoG1Alumnos = [
  { id: 'ag-1', studentId: 's-1', studentName: 'Ana García' },
];

const mockStudents = [
  { studentId: 's-1', firstName: 'Ana', lastName: 'García' },
  { studentId: 's-2', firstName: 'Pedro', lastName: 'López' },
];

// Both students returned by the subject-grades endpoint
const mockSubjectGradesResponse = {
  periods: [{ periodOrdinal: 1, periodName: '1er Trimestre' }],
  students: [
    {
      studentId: 's-1',
      firstName: 'Ana',
      lastName: 'García',
      periodGrades: [{ periodOrdinal: 1, gradeScaleValueId: null, gradeCode: null, internalStatus: null, pa: false, ppi: false, pp: false }],
      finalGrades: [{ type: 'FINAL', gradeScaleValueId: null, gradeCode: null, internalStatus: null, passed: null }],
      competencyValuations: [],
    },
    {
      studentId: 's-2',
      firstName: 'Pedro',
      lastName: 'López',
      periodGrades: [{ periodOrdinal: 1, gradeScaleValueId: null, gradeCode: null, internalStatus: null, pa: false, ppi: false, pp: false }],
      finalGrades: [{ type: 'FINAL', gradeScaleValueId: null, gradeCode: null, internalStatus: null, passed: null }],
      competencyValuations: [],
    },
  ],
};

import apiClient from '../../../api/client';
import SubjectGradingBySubjectPage from '../subject-grading-by-subject';

// ── Mock factory ───────────────────────────────────────────────────────────────

function setupMocks(opts: { grupos?: typeof mockGrupos; grupoAlumnos?: typeof mockGrupoG1Alumnos } = {}) {
  const grupos = opts.grupos ?? mockGrupos;
  const grupoAlumnos = opts.grupoAlumnos ?? mockGrupoG1Alumnos;

  vi.clearAllMocks();

  (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation(
    (url: string) => {
      if (url === '/course-cycles') return Promise.resolve({ data: { data: mockCourseCycles } });
      if (url === '/institutions') return Promise.resolve({ data: { data: [{ id: 'inst-1', name: 'Escuela Test' }] } });
      if (url === '/course-cycles/cc-1/subjects') return Promise.resolve({ data: { data: mockSubjects } });
      if (url === '/course-cycles/cc-1/materias') return Promise.resolve({ data: { data: mockMaterias } });
      if (url === '/course-cycles/cc-1/materias/mat-1/grupos') return Promise.resolve({ data: { data: grupos } });
      if (url === '/grupos/g-1/alumnos') return Promise.resolve({ data: grupoAlumnos });
      if (url === '/grupos/g-2/alumnos') return Promise.resolve({ data: [] });
      if (url === '/course-cycles/cc-1/students') return Promise.resolve({ data: { data: mockStudents } });
      if (url === '/subject-competencies') return Promise.resolve({ data: { data: [] } });
      if (url === '/grading/period-templates') return Promise.resolve({ data: { data: [] } });
      if (url === '/grading/scales') return Promise.resolve({ data: { data: [] } });
      if (url === '/competency-valuations') return Promise.resolve({ data: { data: [] } });
      if (url === '/grading/subject-grades') return Promise.resolve({ data: { data: mockSubjectGradesResponse } });
      return Promise.resolve({ data: { data: [] } });
    },
  );
  (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: null } });
}

function renderPage() {
  return render(<MemoryRouter><SubjectGradingBySubjectPage /></MemoryRouter>);
}

async function selectCCAndSubject() {
  await waitFor(() => screen.getByText('1er Año A'));
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /ciclo de curso/i }), 'cc-1');
  await waitFor(() => screen.getByText('Matemática'));
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /materia/i }), 'sub-1');
}

// ── Management tests ───────────────────────────────────────────────────────────

describe('SubjectGradingBySubjectPage — Grupo filter (management)', () => {
  beforeEach(() => {
    mockUser = { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'ADMIN', roles: ['ADMIN'], institutionId: 'inst-1' };
    setupMocks();
  });

  // GRP-1: materias endpoint is called to resolve materiaId after materia selected
  it('GRP-1: calls /course-cycles/:cc/materias to resolve materiaId after subject selected', async () => {
    renderPage();
    await selectCCAndSubject();

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/course-cycles/cc-1/materias',
        expect.anything(),
      );
    });
  });

  // GRP-2: management user sees "Todos" option AND individual grupos in the selector
  it('GRP-2: management user sees "Todos" option plus all grupos in selector', async () => {
    renderPage();
    await selectCCAndSubject();

    await waitFor(() => screen.getByTestId('sbs-grupo-select'));

    const select = screen.getByTestId('sbs-grupo-select');
    expect(select).toBeInTheDocument();
    // "Todos" must be present for management
    expect(screen.getByRole('option', { name: /todos/i })).toBeInTheDocument();
    // Individual grupos must be present
    expect(screen.getByRole('option', { name: /grupo a/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /grupo b/i })).toBeInTheDocument();
  });

  // GRP-3: selecting a specific grupo fetches alumnos and filters the grid
  it('GRP-3: selecting a grupo fetches alumnos and filters grid to that grupo\'s students', async () => {
    renderPage();
    await selectCCAndSubject();

    await waitFor(() => screen.getByTestId('sbs-grupo-select'));

    // Default: "Todos" selected → both students visible
    await waitFor(() => screen.getByTestId('subject-period-grades-section'));
    expect(screen.getAllByText('Ana García').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pedro López').length).toBeGreaterThan(0);

    // Select Grupo A (only s-1 is in it)
    await userEvent.selectOptions(screen.getByTestId('sbs-grupo-select'), 'g-1');

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/grupos/g-1/alumnos', expect.anything());
    });

    // Only Ana García (s-1) should be visible; Pedro López (s-2) filtered out
    await waitFor(() => {
      expect(screen.getAllByText('Ana García').length).toBeGreaterThan(0);
      expect(screen.queryByText('Pedro López')).not.toBeInTheDocument();
    });
  });

  // GRP-4: "Todos" selected → all students shown (no filter applied)
  it('GRP-4: "Todos" selected shows all students without filtering', async () => {
    renderPage();
    await selectCCAndSubject();

    await waitFor(() => screen.getByTestId('sbs-grupo-select'));
    await waitFor(() => screen.getByTestId('subject-period-grades-section'));

    // Default is "Todos" (value='') → all students shown
    const select = screen.getByTestId('sbs-grupo-select') as HTMLSelectElement;
    expect(select.value).toBe('');

    expect(screen.getAllByText('Ana García').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pedro López').length).toBeGreaterThan(0);
  });
});

// ── Docente tests ──────────────────────────────────────────────────────────────

describe('SubjectGradingBySubjectPage — Grupo filter (docente)', () => {
  beforeEach(() => {
    mockUser = { id: 'teacher-1', email: 'teacher@test.com', name: 'Docente Test', role: 'TEACHER', roles: ['TEACHER'], institutionId: 'inst-1' };
    setupMocks({ grupos: mockSingleGrupo });
  });

  // GRP-D1: docente sees grupo selector WITHOUT "Todos" option
  it('GRP-D1: docente sees grupo selector with no "Todos" option', async () => {
    renderPage();
    await selectCCAndSubject();

    await waitFor(() => screen.getByTestId('sbs-grupo-select'));

    // "Todos" must NOT be present for docente
    expect(screen.queryByRole('option', { name: /todos/i })).not.toBeInTheDocument();
    // Grupo A must be visible
    expect(screen.getByRole('option', { name: /grupo a/i })).toBeInTheDocument();
  });

  // GRP-D2: docente with 1 grupo auto-selects it and fetches alumnos
  it('GRP-D2: docente with 1 grupo auto-selects it and fetches alumnos', async () => {
    renderPage();
    await selectCCAndSubject();

    // Auto-select triggers alumnos fetch
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/grupos/g-1/alumnos', expect.anything());
    });

    // Selector should show grupo g-1 as selected
    await waitFor(() => {
      const select = screen.getByTestId('sbs-grupo-select') as HTMLSelectElement;
      expect(select.value).toBe('g-1');
    });
  });

  // GRP-D3: grid shows only the docente's grupo students after auto-select
  it('GRP-D3: grid filters to docente grupo students only (s-1 in, s-2 out)', async () => {
    renderPage();
    await selectCCAndSubject();

    // Wait for alumnos to load and grid to filter
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/grupos/g-1/alumnos', expect.anything());
    });

    await waitFor(() => screen.getByTestId('subject-period-grades-section'));

    // Ana García (s-1) is in grupo → visible (appears in period + final tables)
    expect(screen.getAllByText('Ana García').length).toBeGreaterThan(0);
    // Pedro López (s-2) is NOT in grupo → filtered out from all tables
    expect(screen.queryByText('Pedro López')).not.toBeInTheDocument();
  });
});
