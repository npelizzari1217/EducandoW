/**
 * PR6-T1 [RED] — Integration tests for SubjectGradingByCourse page ("Alumnos por Curso").
 * Specs: ES-R2 (CORRECTED: all competencies), ES-R5, ES-R6, ES-R10, TIA-R9
 *
 * REAL API contracts (verified — mock EXACT shapes):
 * - GET /course-cycles?teacherUserId=&role=homeroom
 *     → { data: [{ uuid, courseName, level, modality }] }
 * - GET /course-cycles/:id/students
 *     → { data: { data: [{ studentId, firstName, lastName }] } }
 * - GET /grading/subject-grades/by-student?courseCycleId=&studentId=
 *     → { data: { courseCycleId, studentId, subjects: SubjectEntry[] } }
 *     SubjectEntry: { subjectId, subjectName, periods[], periodGrades[], finalGrades[], competencyValuations[] }
 *     periodGrades[]: { periodOrdinal, gradeScaleValueId, gradeCode, internalStatus, pa, ppi, pp }
 *     finalGrades[]:  { type, gradeScaleValueId, gradeCode, internalStatus, passed }
 *     competencyValuations[]: { valuationId, studentId, competencyId,
 *                               periodValuations[{ periodItemId, gradeScaleValueId, gradeCode,
 *                                                  internalStatus, modificable, imprimible }] }
 * - PUT /grading/subject-grades   → { items: [{ courseCycleId, subjectId, studentId, periodOrdinal, ...flags }] }
 * - PUT /grading/subject-final-grades → { items: [{ courseCycleId, subjectId, studentId, type, ... }] }
 * - PATCH /competency-valuations/:uuid/periods/:periodItemId → { imprimible?: boolean }
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
    patch: vi.fn().mockResolvedValue({ data: { data: null } }),
  },
}));

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'teacher-hm-1',
      email: 'homeroom@edu.com',
      name: 'Docente a Cargo',
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

// ── Fixtures ───────────────────────────────────────────────────────────────────

/**
 * Primario homeroom CC (level=23 → Math.floor(23/10)===2) +
 * non-Primario homeroom CC (level=30 → Math.floor(30/10)===3) — page must filter it out.
 */
const mockHomeroomCCs = [
  { uuid: 'cc-hm-1', courseName: '3° A', level: 23, modality: 1 },
  { uuid: 'cc-hm-sec', courseName: 'Sec 1° A', level: 30, modality: 0 },
];

const mockStudents = [
  { studentId: 'stu-ana', firstName: 'Ana', lastName: 'García' },
  { studentId: 'stu-carlos', firstName: 'Carlos', lastName: 'López' },
];

const mockScales = [
  {
    id: 'scale-1',
    name: 'Escala Primario',
    values: [
      { id: 'gsv-mb', code: 'MB', label: 'Muy Bueno', internal_status: 'APROBADO', sort_order: 1 },
      { id: 'gsv-b', code: 'B', label: 'Bueno', internal_status: 'APROBADO', sort_order: 2 },
    ],
  },
];

/**
 * REAL shape of GET /grading/subject-grades/by-student response body's `data` field.
 * Source: api/src/application/grading/get-subject-grades-by-student.use-case.ts
 *   SubjectGradesByStudentResult.subjects → SubjectEntry[]
 *   Each SubjectEntry: subjectId, subjectName, periods[], periodGrades[], finalGrades[], competencyValuations[]
 *   competencyValuations[]: CompetencyValuationWithPeriods
 *     (valuationId, studentId, competencyId, periodValuations[{ periodItemId, ..., imprimible }])
 */
const mockByStudentResponse = {
  courseCycleId: 'cc-hm-1',
  studentId: 'stu-ana',
  subjects: [
    {
      subjectId: 'sub-math',
      subjectName: 'Matemática',
      periods: [
        { periodOrdinal: 1, periodName: '1er Trimestre' },
        { periodOrdinal: 2, periodName: '2do Trimestre' },
      ],
      periodGrades: [
        {
          periodOrdinal: 1,
          gradeScaleValueId: 'gsv-mb',
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
      /** ALL competencies — no imprimible pre-filter (ES-R2 CORRECTED) */
      competencyValuations: [
        {
          valuationId: 'cv-1',
          studentId: 'stu-ana',
          competencyId: 'comp-uuid-1',
          competencyName: 'Resolución de problemas',
          periodValuations: [
            {
              periodItemId: 'pi-uuid-1',
              gradeScaleValueId: null,
              gradeCode: null,
              internalStatus: null,
              modificable: true,
              imprimible: false,
            },
          ],
        },
        {
          valuationId: 'cv-2',
          studentId: 'stu-ana',
          competencyId: 'comp-uuid-2',
          competencyName: 'Comunicación oral',
          periodValuations: [
            {
              periodItemId: 'pi-uuid-1',
              gradeScaleValueId: 'gsv-mb',
              gradeCode: 'MB',
              internalStatus: 'APROBADO',
              modificable: true,
              imprimible: true,
            },
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
        if (params.teacherUserId === 'teacher-hm-1' && params.role === 'homeroom') {
          return Promise.resolve({ data: { data: mockHomeroomCCs } });
        }
        return Promise.resolve({ data: { data: [] } });
      }
      if (url === '/course-cycles/cc-hm-1/students') {
        return Promise.resolve({ data: { data: mockStudents } });
      }
      if (url === '/grading/subject-grades/by-student') {
        return Promise.resolve({ data: { data: mockByStudentResponse } });
      }
      if (url === '/grading/scales') {
        return Promise.resolve({ data: { data: mockScales } });
      }
      return Promise.resolve({ data: { data: [] } });
    },
  );
  (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: null } });
  (apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: null } });
}

import SubjectGradingByCoursePage from '../subject-grading-by-course';

function renderPage() {
  return render(
    <MemoryRouter>
      <SubjectGradingByCoursePage />
    </MemoryRouter>,
  );
}

/** Performs full CC + student selection. Caller waits for grading grid. */
async function selectCCAndStudent() {
  // Wait for CC options to appear
  await waitFor(() => screen.getByText('3° A'));

  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: /ciclo de curso/i }),
    'cc-hm-1',
  );

  // Student picker should appear; wait for it
  await waitFor(() => screen.getByRole('combobox', { name: /alumno/i }));

  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: /alumno/i }),
    'stu-ana',
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SubjectGradingByCoursePage', () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  // SBC-1: page renders heading
  it('SBC-1: renders Alumnos por Curso heading', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /alumnos por curso/i }),
    ).toBeInTheDocument();
  });

  // SBC-2: CC dropdown fetches with role=homeroom
  it('SBC-2: CC dropdown fetches GET /course-cycles?role=homeroom on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/course-cycles',
        expect.objectContaining({
          params: expect.objectContaining({
            teacherUserId: 'teacher-hm-1',
            role: 'homeroom',
          }),
        }),
      );
    });
  });

  // SBC-3: Primario+Secundario — both level=20 and level=30 homeroom CCs appear; filter generalized
  it('SBC-3: Primario (level=20) and Secundario (level=30) homeroom CCs both appear', async () => {
    renderPage();
    await waitFor(() => screen.getByText('3° A'));
    // Primario CC appears
    expect(screen.getByText('3° A')).toBeInTheDocument();
    // Secundario CC (level=30) ALSO appears now that filter is generalized
    expect(screen.getByText('Sec 1° A')).toBeInTheDocument();
  });

  // SBC-4: empty state when teacher has no homeroom CCs (after homeroom filter returns empty)
  it('SBC-4: empty state shown when teacher has no homeroom CCs', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: [] } });
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/no ten[eé]s ciclos|no ten[eé]s materias/i),
      ).toBeInTheDocument();
    });
  });

  // SBC-5: student picker populated from homeroom CC's students after CC selection
  it('SBC-5: student picker appears and is populated after CC selection', async () => {
    renderPage();
    await waitFor(() => screen.getByText('3° A'));

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /ciclo de curso/i }),
      'cc-hm-1',
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/course-cycles/cc-hm-1/students');
    });

    await waitFor(() => screen.getByRole('combobox', { name: /alumno/i }));

    // Students appear in the dropdown
    expect(screen.getByText('Ana García')).toBeInTheDocument();
    expect(screen.getByText('Carlos López')).toBeInTheDocument();
  });

  // SBC-6: placeholder shown before student is selected
  it('SBC-6: placeholder shown when CC selected but student not yet chosen', async () => {
    renderPage();
    await waitFor(() => screen.getByText('3° A'));

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /ciclo de curso/i }),
      'cc-hm-1',
    );

    await waitFor(() => screen.getByRole('combobox', { name: /alumno/i }));
    expect(screen.getByTestId('grading-placeholder')).toBeInTheDocument();
  });

  // SBC-7: period grades section renders per subject after student selected
  it('SBC-7: period grades section renders after CC + student selected', async () => {
    renderPage();
    await selectCCAndStudent();

    await waitFor(() =>
      expect(screen.getByTestId('student-period-grades-section')).toBeInTheDocument(),
    );

    // Subject name visible
    expect(screen.getByText('Matemática')).toBeInTheDocument();
    // Period names visible as column headers
    expect(screen.getByText('1er Trimestre')).toBeInTheDocument();
    expect(screen.getByText('2do Trimestre')).toBeInTheDocument();
  });

  // SBC-8: final grades section with 4 types per subject
  it('SBC-8: final grades section shows FINAL, DICIEMBRE, MARZO, DEFINITIVA', async () => {
    renderPage();
    await selectCCAndStudent();

    await waitFor(() =>
      expect(screen.getByTestId('student-final-grades-section')).toBeInTheDocument(),
    );

    const finalSection = screen.getByTestId('student-final-grades-section');
    expect(within(finalSection).getByText('FINAL')).toBeInTheDocument();
    expect(within(finalSection).getByText('DICIEMBRE')).toBeInTheDocument();
    expect(within(finalSection).getByText('MARZO')).toBeInTheDocument();
    expect(within(finalSection).getByText('DEFINITIVA')).toBeInTheDocument();
  });

  // SBC-9: PA/PPI/PP toggles present in period grades
  it('SBC-9: PA/PPI/PP checkboxes visible in period grades section', async () => {
    renderPage();
    await selectCCAndStudent();

    await waitFor(() =>
      expect(screen.getByTestId('student-period-grades-section')).toBeInTheDocument(),
    );

    const paCheckboxes = screen.getAllByRole('checkbox', { name: /\bPA\b/i });
    const ppiCheckboxes = screen.getAllByRole('checkbox', { name: /\bPPI\b/i });
    const ppCheckboxes = screen.getAllByRole('checkbox', { name: /\bPP\b/i });

    expect(paCheckboxes.length).toBeGreaterThan(0);
    expect(ppiCheckboxes.length).toBeGreaterThan(0);
    expect(ppCheckboxes.length).toBeGreaterThan(0);
  });

  // SBC-10: competency section renders with "Imprimir" toggle per valuation period
  it('SBC-10: competency section renders with Imprimir toggle per competency valuation', async () => {
    renderPage();
    await selectCCAndStudent();

    await waitFor(() =>
      expect(screen.getByTestId('competency-section')).toBeInTheDocument(),
    );

    // Each competency valuation × periodValuation should have an "Imprimir" checkbox
    const imprimirCheckboxes = screen.getAllByRole('checkbox', { name: /imprimir/i });
    expect(imprimirCheckboxes.length).toBeGreaterThan(0);

    // Pre-existing imprimible=true for cv-2 should be checked
    const checkedBoxes = imprimirCheckboxes.filter(
      (cb) => (cb as HTMLInputElement).checked,
    );
    expect(checkedBoxes.length).toBeGreaterThan(0);
  });

  // SBC-11: clicking Imprimir toggle calls PATCH /competency-valuations/:uuid/periods/:pid
  it('SBC-11: clicking Imprimir toggle issues PATCH with imprimible', async () => {
    renderPage();
    await selectCCAndStudent();

    await waitFor(() =>
      expect(screen.getByTestId('competency-section')).toBeInTheDocument(),
    );

    const imprimirCheckboxes = screen.getAllByRole('checkbox', { name: /imprimir/i });
    // cv-1 has imprimible=false → clicking toggles it to true
    const uncheckedBox = imprimirCheckboxes.find(
      (cb) => !(cb as HTMLInputElement).checked,
    );
    expect(uncheckedBox).toBeDefined();
    await userEvent.click(uncheckedBox!);

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/competency-valuations\/cv-1\/periods\/pi-uuid-1/),
        expect.objectContaining({ imprimible: true }),
      );
    });
  });

  // SBC-12: inline save — period grade change triggers PUT /grading/subject-grades with items wrapper
  it('SBC-12: changing period grade dropdown triggers PUT /grading/subject-grades with items wrapper', async () => {
    renderPage();
    await selectCCAndStudent();

    await waitFor(() =>
      expect(screen.getByTestId('student-period-grades-section')).toBeInTheDocument(),
    );

    // Find grade dropdown for subject math, period 1
    const gradeDropdowns = screen.getAllByRole('combobox', {
      name: /nota.*período|nota.*period|período.*nota/i,
    });
    expect(gradeDropdowns.length).toBeGreaterThan(0);

    await userEvent.selectOptions(gradeDropdowns[0], 'gsv-b');

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/grading/subject-grades',
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              courseCycleId: 'cc-hm-1',
              subjectId: 'sub-math',
              studentId: 'stu-ana',
            }),
          ]),
        }),
      );
    });
  });

  // SBC-13: competency section renders human-readable name, NOT the raw UUID
  it('SBC-13: competency section renders human-readable competency name (not raw ID)', async () => {
    renderPage();
    await selectCCAndStudent();

    await waitFor(() =>
      expect(screen.getByTestId('competency-section')).toBeInTheDocument(),
    );

    // 'Resolución de problemas' is the name for cv-1 — must be visible
    expect(screen.getByText('Resolución de problemas')).toBeInTheDocument();
    // Raw competencyId UUIDs must NOT be visible as standalone text
    expect(screen.queryByText('comp-uuid-1')).not.toBeInTheDocument();
  });
});
