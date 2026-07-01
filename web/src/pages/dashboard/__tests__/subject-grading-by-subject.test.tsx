/**
 * PR5-T5 [RED] — Integration tests for SubjectGradingBySubject page.
 * Specs: ES-R1 (CORRECTED), ES-R4, ES-R6, ES-R7, ES-R8, ES-R10, ES-R11
 *
 * REAL API contracts (verified — mock EXACT shapes):
 * - GET /course-cycles?teacherUserId=&role=subject → { data: [{ uuid, courseName, level, modality }] }
 * - GET /course-cycles/:id/subjects?teacherUserId= → { data: [{ subjectId, subjectName, studyPlanSubjectId }] }
 * - GET /grading/subject-grades?courseCycleId=&subjectId= → { data: { periods[], students[] } }
 *   students[].periodGrades[], .finalGrades[], .competencyValuations[{ ..., periodValuations[{ imprimible }] }]
 * - PUT /grading/subject-grades → { items: [{ courseCycleId, subjectId, studentId, periodOrdinal, ...flags }] }
 * - PUT /grading/subject-final-grades → { items: [{ courseCycleId, subjectId, studentId, type, ... }] }
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn().mockResolvedValue({ data: { data: null } }),
  },
}));

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'teacher-1',
      email: 'teacher@edu.com',
      name: 'Docente Test',
      role: 'TEACHER',
      roles: ['TEACHER'],
    },
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
    config: {
      id: 'inst-1',
      name: 'Escuela Test',
      levels: [20],
      send_email: false,
      send_messages: false,
    },
    isLoading: false,
  }),
}));

// Mock CompetencyGradingGrid to avoid double-hooking in page tests
vi.mock('../components/CompetencyGradingGrid', () => ({
  CompetencyGradingGrid: (props: { studyPlanSubjectId: string }) => (
    <div data-testid="mock-cgg" data-sps-id={props.studyPlanSubjectId}>
      Competency Grid
    </div>
  ),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

// Primario CC (level=20) + non-Primario CC (level=30) — page must filter
const mockCourseCycles = [
  { uuid: 'cc-prim-1', courseName: '1er Año A', level: 20, modality: 0 },
  { uuid: 'cc-sec-1', courseName: 'Sec 1er Año', level: 30, modality: 0 },
];

const mockSubjects = [
  { subjectId: 'sub-1', subjectName: 'Matemática', studyPlanSubjectId: 'sps-1' },
];

const mockStudents = [
  { studentId: 's-1', firstName: 'Ana', lastName: 'García' },
];

const mockCompetencies = [
  { uuid: 'c-1', studyPlanSubjectId: 'sps-1', name: 'Comprensión', active: true },
  { uuid: 'c-2', studyPlanSubjectId: 'sps-1', name: 'Aplicación', active: true },
];

const mockTemplates = [
  {
    id: 'tpl-1',
    name: 'Template Primario',
    level: 2,
    modality: 0,
    items: [
      { id: 'pi-1', name: '1er Trimestre', sort_order: 1 },
      { id: 'pi-2', name: '2do Trimestre', sort_order: 2 },
    ],
  },
];

const mockScales = [
  {
    id: 'scale-1',
    name: 'Escala Primario',
    values: [
      { id: 'gsv-1', code: 'MB', label: 'Muy Bueno', internal_status: 'APROBADO', sort_order: 1 },
      { id: 'gsv-2', code: 'B', label: 'Bueno', internal_status: 'APROBADO', sort_order: 2 },
    ],
  },
];

const mockValuations = [
  {
    valuationId: 'val-1',
    studentId: 's-1',
    competencyId: 'c-1',
    periodValuations: [
      { periodItemId: 'pi-1', gradeScaleValueId: null, gradeCode: null, internalStatus: null, modificable: true, imprimible: true },
    ],
  },
  {
    valuationId: 'val-2',
    studentId: 's-1',
    competencyId: 'c-2',
    periodValuations: [],
  },
];

// REAL API shape — no top-level competencies[], imprimible on periodValuations[]
// gradingPhase (PR-1b/PR-2, Capacidad A) — BIM_1 keeps existing period-1 mutation tests editable.
const mockSubjectGradesResponse = {
  gradingPhase: 'BIM_1',
  periods: [
    { periodOrdinal: 1, periodName: '1er Trimestre' },
    { periodOrdinal: 2, periodName: '2do Trimestre' },
  ],
  students: [
    {
      studentId: 's-1',
      firstName: 'Ana',
      lastName: 'García',
      periodGrades: [
        {
          periodOrdinal: 1,
          gradeScaleValueId: 'gsv-1',
          gradeCode: 'MB',
          internalStatus: 'APROBADO',
          pa: false,
          ppi: false,
          pp: false,
        },
        {
          periodOrdinal: 2,
          gradeScaleValueId: null,
          gradeCode: null,
          internalStatus: null,
          pa: true,
          ppi: false,
          pp: false,
        },
      ],
      finalGrades: [
        { type: 'FINAL', gradeScaleValueId: null, gradeCode: null, internalStatus: null, passed: null },
        { type: 'DICIEMBRE', gradeScaleValueId: null, gradeCode: null, internalStatus: null, passed: null },
        { type: 'MARZO', gradeScaleValueId: null, gradeCode: null, internalStatus: null, passed: null },
        { type: 'DEFINITIVA', gradeScaleValueId: null, gradeCode: null, internalStatus: null, passed: null },
      ],
      competencyValuations: [
        {
          valuationId: 'val-1',
          studentId: 's-1',
          competencyId: 'c-1',
          periodValuations: [
            { periodItemId: 'pi-1', gradeScaleValueId: null, gradeCode: null, internalStatus: null, modificable: true, imprimible: true },
          ],
        },
        {
          valuationId: 'val-2',
          studentId: 's-1',
          competencyId: 'c-2',
          periodValuations: [
            { periodItemId: 'pi-1', gradeScaleValueId: null, gradeCode: null, internalStatus: null, modificable: true, imprimible: false },
          ],
        },
      ],
    },
  ],
};

import apiClient from '../../../api/client';

// ── Setup ──────────────────────────────────────────────────────────────────────

function setupDefaultMocks() {
  vi.clearAllMocks();
  (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation(
    (url: string, config?: { params?: Record<string, string> }) => {
      const params = config?.params ?? {};

      if (url === '/course-cycles') {
        if (params.teacherUserId === 'teacher-1' && params.role === 'subject') {
          return Promise.resolve({ data: { data: mockCourseCycles } });
        }
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === '/course-cycles/cc-prim-1/subjects') {
        return Promise.resolve({ data: { data: mockSubjects } });
      }
      if (url === '/course-cycles/cc-sec-1/subjects') {
        return Promise.resolve({ data: { data: mockSubjects } });
      }
      if (url === '/course-cycles/cc-prim-1/students') {
        return Promise.resolve({ data: { data: mockStudents } });
      }
      if (url === '/subject-competencies') {
        return Promise.resolve({ data: { data: mockCompetencies } });
      }
      if (url === '/grading/period-templates') {
        return Promise.resolve({ data: { data: mockTemplates } });
      }
      if (url === '/grading/scales') {
        return Promise.resolve({ data: { data: mockScales } });
      }
      if (url === '/competency-valuations') {
        return Promise.resolve({ data: { data: mockValuations } });
      }
      if (url === '/grading/subject-grades') {
        return Promise.resolve({ data: { data: mockSubjectGradesResponse } });
      }
      return Promise.resolve({ data: { data: [] } });
    },
  );
  (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: null } });
}

import SubjectGradingBySubjectPage from '../subject-grading-by-subject';

function renderPage() {
  return render(
    <MemoryRouter>
      <SubjectGradingBySubjectPage />
    </MemoryRouter>,
  );
}

// Helper: perform full CC + subject selection
async function selectCCAndSubject() {
  await waitFor(() => screen.getByText('1er Año A'));

  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: /ciclo de curso/i }),
    'cc-prim-1',
  );

  await waitFor(() => screen.getByText('Matemática'));
  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: /materia/i }),
    'sub-1',
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SubjectGradingBySubjectPage', () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  // SBS-1: page renders heading
  it('SBS-1: renders Alumnos por Materia heading', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /alumnos por materia/i }),
    ).toBeInTheDocument();
  });

  // SBS-2: TeacherFilteredSelector is present with CC dropdown
  it('SBS-2: renders TeacherFilteredSelector with Ciclo de Curso dropdown', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /ciclo de curso/i })).toBeInTheDocument(),
    );
  });

  // SBS-3: placeholder shown before any selection
  it('SBS-3: shows placeholder before selection is made', async () => {
    renderPage();
    await waitFor(() => screen.getByText('1er Año A'));
    expect(screen.getByTestId('grading-placeholder')).toBeInTheDocument();
  });

  // SBS-4: Primario+Secundario — both level=20 and level=30 CCs appear; Terciario+ excluded
  it('SBS-4: Primario (level=20) and Secundario (level=30) CCs both appear; filter is isPrimarioOrSecundario', async () => {
    renderPage();
    await waitFor(() => screen.getByText('1er Año A'));
    // Primario CC appears
    expect(screen.getByText('1er Año A')).toBeInTheDocument();
    // Secundario CC (level=30) ALSO appears now that filter is generalized
    expect(screen.getByText('Sec 1er Año')).toBeInTheDocument();
  });

  // SBS-5: empty state when teacher has no assigned course cycles
  it('SBS-5: empty state shown when teacher has no CCs', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: [] } });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/no ten[eé]s materias asignadas/i),
      ).toBeInTheDocument();
    });
  });

  // SBS-6: period grade section visible after full selection
  it('SBS-6: period grade section renders after CC + subject selected', async () => {
    renderPage();
    await selectCCAndSubject();

    await waitFor(() =>
      expect(screen.getByTestId('subject-period-grades-section')).toBeInTheDocument(),
    );
  });

  // SBS-7: final grade section shows 4 grade types per student
  it('SBS-7: final grade section shows FINAL, DICIEMBRE, MARZO, DEFINITIVA', async () => {
    renderPage();
    await selectCCAndSubject();

    await waitFor(() => {
      expect(screen.getByTestId('subject-final-grades-section')).toBeInTheDocument();
    });

    // All 4 final grade types must be shown as column headers within the section
    const finalSection = screen.getByTestId('subject-final-grades-section');
    expect(within(finalSection).getByText('FINAL')).toBeInTheDocument();
    expect(within(finalSection).getByText('DICIEMBRE')).toBeInTheDocument();
    expect(within(finalSection).getByText('MARZO')).toBeInTheDocument();
    expect(within(finalSection).getByText('DEFINITIVA')).toBeInTheDocument();
  });

  // SBS-8: PA/PPI/PP toggles visible per student per period
  it('SBS-8: PA/PPI/PP toggles visible in period grades section', async () => {
    renderPage();
    await selectCCAndSubject();

    await waitFor(() =>
      expect(screen.getByTestId('subject-period-grades-section')).toBeInTheDocument(),
    );

    // PA/PPI/PP checkboxes must be rendered
    const paCheckboxes = screen.getAllByRole('checkbox', { name: /\bPA\b/i });
    const ppiCheckboxes = screen.getAllByRole('checkbox', { name: /\bPPI\b/i });
    const ppCheckboxes = screen.getAllByRole('checkbox', { name: /\bPP\b/i });

    expect(paCheckboxes.length).toBeGreaterThan(0);
    expect(ppiCheckboxes.length).toBeGreaterThan(0);
    expect(ppCheckboxes.length).toBeGreaterThan(0);
  });

  // SBS-9: competency section visible (mocked CGG present)
  it('SBS-9: competency section (CompetencyGradingGrid) is rendered after selection', async () => {
    renderPage();
    await selectCCAndSubject();

    await waitFor(() =>
      expect(screen.getByTestId('mock-cgg')).toBeInTheDocument(),
    );

    // CGG receives the correct studyPlanSubjectId
    expect(screen.getByTestId('mock-cgg').getAttribute('data-sps-id')).toBe('sps-1');
  });

  // SBS-10: inline PA toggle triggers PUT /grading/subject-grades with { items } wrapper
  it('SBS-10: toggling PA checkbox triggers PUT /grading/subject-grades with items wrapper', async () => {
    renderPage();
    await selectCCAndSubject();

    await waitFor(() =>
      expect(screen.getByTestId('subject-period-grades-section')).toBeInTheDocument(),
    );

    // Find a PA checkbox for period 1 (pa=false, so toggling → true)
    const paCheckboxes = screen.getAllByRole('checkbox', { name: /\bPA\b/i });
    await userEvent.click(paCheckboxes[0]);

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/grading/subject-grades',
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              courseCycleId: 'cc-prim-1',
              subjectId: 'sub-1',
              studentId: 's-1',
            }),
          ]),
        }),
        expect.objectContaining({ params: expect.anything() }),
      );
    });
  });

  // SBS-11: period grade change triggers PUT /grading/subject-grades
  it('SBS-11: changing period grade dropdown triggers PUT /grading/subject-grades', async () => {
    renderPage();
    await selectCCAndSubject();

    await waitFor(() =>
      expect(screen.getByTestId('subject-period-grades-section')).toBeInTheDocument(),
    );

    // Find a period grade dropdown (for student s-1, period 1)
    const periodSelect = screen.getByRole('combobox', {
      name: /nota.*s-1.*periodo.*1|periodo.*1.*s-1|nota período 1/i,
    });
    await userEvent.selectOptions(periodSelect, 'gsv-2');

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/grading/subject-grades',
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              courseCycleId: 'cc-prim-1',
              subjectId: 'sub-1',
            }),
          ]),
        }),
        expect.objectContaining({ params: expect.anything() }),
      );
    });
  });
});

// ── PR5-T7 [RED]: Secundario + condicion tests ─────────────────────────────────

describe('SubjectGradingBySubjectPage — Secundario + condicion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string, config?: { params?: Record<string, string> }) => {
        const params = config?.params ?? {};

        if (url === '/course-cycles') {
          if (params.teacherUserId === 'teacher-1' && params.role === 'subject') {
            return Promise.resolve({ data: { data: mockCourseCycles } });
          }
          return Promise.resolve({ data: { data: [] } });
        }
        if (url === '/course-cycles/cc-prim-1/subjects') {
          return Promise.resolve({ data: { data: mockSubjects } });
        }
        if (url === '/course-cycles/cc-sec-1/subjects') {
          return Promise.resolve({ data: { data: mockSubjects } });
        }
        if (url === '/course-cycles/cc-prim-1/students') {
          return Promise.resolve({ data: { data: mockStudents } });
        }
        if (url === '/course-cycles/cc-sec-1/students') {
          return Promise.resolve({ data: { data: mockStudents } });
        }
        if (url === '/subject-competencies') {
          return Promise.resolve({ data: { data: mockCompetencies } });
        }
        if (url === '/grading/period-templates') {
          return Promise.resolve({ data: { data: mockTemplates } });
        }
        if (url === '/grading/scales') {
          return Promise.resolve({ data: { data: mockScales } });
        }
        if (url === '/competency-valuations') {
          return Promise.resolve({ data: { data: mockValuations } });
        }
        if (url === '/grading/subject-grades') {
          // CIERRE — SEC-2/SEC-3 exercise the FINAL row's condición select, which is
          // gated to CIERRE only (Capacidad A, PR-2).
          return Promise.resolve({ data: { data: { ...mockSubjectGradesResponse, gradingPhase: 'CIERRE' } } });
        }
        return Promise.resolve({ data: { data: [] } });
      },
    );
    (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: null } });
  });

  // SEC-1: Secundario CC (level=30) now appears in the CC dropdown (filter generalized)
  it('SEC-1: Secundario CC (level=30) appears alongside Primario in CC dropdown', async () => {
    render(
      <MemoryRouter>
        <SubjectGradingBySubjectPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('1er Año A')).toBeInTheDocument());
    // After T8, Secundario CC must also appear
    expect(screen.getByText('Sec 1er Año')).toBeInTheDocument();
  });

  // SEC-2: Condición select renders on the FINAL row of the finals table
  it('SEC-2: condición select renders on the FINAL-row cell of the finals table', async () => {
    render(
      <MemoryRouter>
        <SubjectGradingBySubjectPage />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByText('1er Año A'));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /ciclo de curso/i }),
      'cc-prim-1',
    );
    await waitFor(() => screen.getByText('Matemática'));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /materia/i }),
      'sub-1',
    );

    await waitFor(() =>
      expect(screen.getByTestId('subject-final-grades-section')).toBeInTheDocument(),
    );

    // Condición select must exist on the FINAL row
    expect(screen.getByRole('combobox', { name: /condición/i })).toBeInTheDocument();
  });

  // SEC-3: selecting PREVIA from condición select fires updateSubjectFinalGrade with condicion
  it('SEC-3: selecting PREVIA from condición select calls PUT with condicion field', async () => {
    render(
      <MemoryRouter>
        <SubjectGradingBySubjectPage />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByText('1er Año A'));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /ciclo de curso/i }),
      'cc-prim-1',
    );
    await waitFor(() => screen.getByText('Matemática'));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /materia/i }),
      'sub-1',
    );

    await waitFor(() =>
      expect(screen.getByTestId('subject-final-grades-section')).toBeInTheDocument(),
    );

    const condicionSelect = screen.getByRole('combobox', { name: /condición/i });
    await userEvent.selectOptions(condicionSelect, 'PREVIA');

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/grading/subject-final-grades',
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              condicion: 'PREVIA',
            }),
          ]),
        }),
        expect.objectContaining({ params: expect.anything() }),
      );
    });
  });
});

// ── Grading phase gating (Capacidad A — PR-2) ──────────────────────────────────

function mockGetWithGradingPhase(gradingPhase: string | null) {
  (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation(
    (url: string, config?: { params?: Record<string, string> }) => {
      const params = config?.params ?? {};
      if (url === '/course-cycles') {
        if (params.teacherUserId === 'teacher-1' && params.role === 'subject') {
          return Promise.resolve({ data: { data: mockCourseCycles } });
        }
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === '/course-cycles/cc-prim-1/subjects') return Promise.resolve({ data: { data: mockSubjects } });
      if (url === '/course-cycles/cc-prim-1/students') return Promise.resolve({ data: { data: mockStudents } });
      if (url === '/subject-competencies') return Promise.resolve({ data: { data: mockCompetencies } });
      if (url === '/grading/period-templates') return Promise.resolve({ data: { data: mockTemplates } });
      if (url === '/grading/scales') return Promise.resolve({ data: { data: mockScales } });
      if (url === '/competency-valuations') return Promise.resolve({ data: { data: mockValuations } });
      if (url === '/grading/subject-grades') {
        return Promise.resolve({ data: { data: { ...mockSubjectGradesResponse, gradingPhase } } });
      }
      return Promise.resolve({ data: { data: [] } });
    },
  );
}

describe('SubjectGradingBySubjectPage — grading phase gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: null } });
  });

  // GP-1: active phase period column enabled (select + PA/PPI/PP); other periods disabled
  it('GP-1: only the active phase period column is enabled (select + PA/PPI/PP checkboxes)', async () => {
    mockGetWithGradingPhase('BIM_1');
    renderPage();
    await selectCCAndSubject();

    await waitFor(() => expect(screen.getByTestId('subject-period-grades-section')).toBeInTheDocument());

    const period1Select = screen.getByRole('combobox', { name: /nota período 1/i });
    const period2Select = screen.getByRole('combobox', { name: /nota período 2/i });
    expect(period1Select).not.toBeDisabled();
    expect(period2Select).toBeDisabled();

    // PA/PPI/PP for period 2 must also be locked (single upsert item covers the whole period row)
    const paCheckboxes = screen.getAllByRole('checkbox', { name: /\bPA\b/i });
    expect(paCheckboxes[1]).toBeDisabled();
    expect(paCheckboxes[0]).not.toBeDisabled();
  });

  // GP-2: gradingPhase NULL blocks every period column
  it('GP-2: gradingPhase NULL disables every period column', async () => {
    mockGetWithGradingPhase(null);
    renderPage();
    await selectCCAndSubject();

    await waitFor(() => expect(screen.getByTestId('subject-period-grades-section')).toBeInTheDocument());

    expect(screen.getByRole('combobox', { name: /nota período 1/i })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /nota período 2/i })).toBeDisabled();
  });

  // GP-3: special/final grades disabled outside CIERRE
  it('GP-3: final grade selects are disabled when the phase is a bimester (not CIERRE)', async () => {
    mockGetWithGradingPhase('BIM_1');
    renderPage();
    await selectCCAndSubject();

    await waitFor(() => expect(screen.getByTestId('subject-final-grades-section')).toBeInTheDocument());

    const finalSection = screen.getByTestId('subject-final-grades-section');
    expect(within(finalSection).getByRole('combobox', { name: /Nota final FINAL/i })).toBeDisabled();
  });

  // GP-4: special/final grades enabled ONLY during CIERRE
  it('GP-4: final grade selects are enabled during CIERRE', async () => {
    mockGetWithGradingPhase('CIERRE');
    renderPage();
    await selectCCAndSubject();

    await waitFor(() => expect(screen.getByTestId('subject-final-grades-section')).toBeInTheDocument());

    const finalSection = screen.getByTestId('subject-final-grades-section');
    expect(within(finalSection).getByRole('combobox', { name: /Nota final FINAL/i })).not.toBeDisabled();
    // Bimester periods stay locked during CIERRE
    expect(screen.getByRole('combobox', { name: /nota período 1/i })).toBeDisabled();
  });

  // GP-5: visible indicator of the active phase
  it('GP-5: shows a visible indicator of the active grading phase', async () => {
    mockGetWithGradingPhase('BIM_2');
    renderPage();
    await selectCCAndSubject();

    await waitFor(() => expect(screen.getByTestId('subject-period-grades-section')).toBeInTheDocument());
    expect(screen.getByTestId('grading-phase-indicator')).toHaveTextContent(/2do Bimestre/i);
  });

  // GP-6: indicator shows "Sin fase activada" when null
  it('GP-6: indicator shows "Sin fase activada" when gradingPhase is null', async () => {
    mockGetWithGradingPhase(null);
    renderPage();
    await selectCCAndSubject();

    await waitFor(() => expect(screen.getByTestId('subject-period-grades-section')).toBeInTheDocument());
    expect(screen.getByTestId('grading-phase-indicator')).toHaveTextContent(/sin fase activada/i);
  });
});
