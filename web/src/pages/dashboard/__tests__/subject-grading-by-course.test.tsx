/**
 * PR6-T1 [GREEN] — Integration tests for SubjectGradingByCourse page ("Alumnos por Curso").
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
      // Observations endpoint
      if (url.match(/\/students\/stu-[^/]+\/observations/)) {
        return Promise.resolve({ data: { data: [] } });
      }
      // Legajo student detail endpoint
      if (url.match(/\/students\/stu-[^/]+$/) && !url.includes('/course-cycles')) {
        return Promise.resolve({ data: { data: null } });
      }
      // Legajo sub-resources
      if (url === '/enrollments' || url === '/notas' || url === '/attendance') {
        return Promise.resolve({ data: { data: [] } });
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

/** Selects the CC and waits for the student list to appear. */
async function selectCC() {
  await waitFor(() => screen.getByText('3° A'));

  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: /ciclo de curso/i }),
    'cc-hm-1',
  );

  // Wait for student list to appear
  await waitFor(() => screen.getByTestId('student-list'));
}

/** Opens the grades modal for the given student. */
async function openGradesModal(studentFirstName: string) {
  await selectCC();

  // Wait for student rows to render
  await waitFor(() => screen.getByText(studentFirstName));

  // Find the row containing the student and click "Calificaciones"
  const row = screen.getByText(studentFirstName).closest('tr')!;
  const calificacionesBtn = within(row).getByRole('button', { name: /calificaciones/i });
  await userEvent.click(calificacionesBtn);

  // Wait for dialog to open
  await waitFor(() => screen.getByRole('dialog'));
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

  // SBC-5: student list appears after CC selection
  it('SBC-5: student list appears and is populated after CC selection', async () => {
    renderPage();
    await waitFor(() => screen.getByText('3° A'));

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /ciclo de curso/i }),
      'cc-hm-1',
    );

    await waitFor(() => {
      // non-ROOT: no institutionId param (tenant resolved from JWT). ROOT passes { params: { institutionId } }.
      expect(apiClient.get).toHaveBeenCalledWith('/course-cycles/cc-hm-1/students', undefined);
    });

    await waitFor(() => screen.getByTestId('student-list'));

    // Students appear in the table
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('García')).toBeInTheDocument();
    expect(screen.getByText('Carlos')).toBeInTheDocument();
    expect(screen.getByText('López')).toBeInTheDocument();
  });

  // SBC-6: student list shows without modal after CC selection
  it('SBC-6: student list shown when CC selected (no modal open by default)', async () => {
    renderPage();
    await waitFor(() => screen.getByText('3° A'));

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /ciclo de curso/i }),
      'cc-hm-1',
    );

    await waitFor(() => screen.getByTestId('student-list'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // SBC-7: materias table renders with subject rows and period columns after modal opened
  it('SBC-7: materias table renders with subject row and period column headers after opening grades modal', async () => {
    renderPage();
    await openGradesModal('Ana');

    await waitFor(() =>
      expect(screen.getByTestId('materias-table')).toBeInTheDocument(),
    );

    const materiasTable = screen.getByTestId('materias-table');
    // Subject name visible as a row cell
    expect(within(materiasTable).getByText('Matemática')).toBeInTheDocument();
    // Period names visible as column headers
    expect(within(materiasTable).getByText('1er Trimestre')).toBeInTheDocument();
    expect(within(materiasTable).getByText('2do Trimestre')).toBeInTheDocument();
  });

  // SBC-8: materias table shows final grade columns
  it('SBC-8: materias table shows Nota Final, Diciembre, Marzo, Definitiva column headers', async () => {
    renderPage();
    await openGradesModal('Ana');

    await waitFor(() =>
      expect(screen.getByTestId('materias-table')).toBeInTheDocument(),
    );

    const materiasTable = screen.getByTestId('materias-table');
    expect(within(materiasTable).getByText('Nota Final')).toBeInTheDocument();
    expect(within(materiasTable).getByText('Diciembre')).toBeInTheDocument();
    expect(within(materiasTable).getByText('Marzo')).toBeInTheDocument();
    expect(within(materiasTable).getByText('Definitiva')).toBeInTheDocument();
  });

  // SBC-9: PA/PPI/PP checkboxes are dropped in the new layout
  it('SBC-9: PA/PPI/PP checkboxes are not rendered in the new table layout', async () => {
    renderPage();
    await openGradesModal('Ana');

    await waitFor(() =>
      expect(screen.getByTestId('materias-table')).toBeInTheDocument(),
    );

    expect(screen.queryAllByRole('checkbox', { name: /\bPA\b/i })).toHaveLength(0);
    expect(screen.queryAllByRole('checkbox', { name: /\bPPI\b/i })).toHaveLength(0);
    expect(screen.queryAllByRole('checkbox', { name: /\bPP\b/i })).toHaveLength(0);
  });

  // SBC-10: competencias table renders with competency names and no Imprimir toggles
  it('SBC-10: competencias table renders with competency names and no Imprimir checkboxes', async () => {
    renderPage();
    await openGradesModal('Ana');

    await waitFor(() =>
      expect(screen.getByTestId('competencias-table')).toBeInTheDocument(),
    );

    // Competency names visible as row cells
    expect(screen.getByText('Resolución de problemas')).toBeInTheDocument();
    expect(screen.getByText('Comunicación oral')).toBeInTheDocument();

    // No Imprimir checkboxes in new layout
    expect(screen.queryAllByRole('checkbox', { name: /imprimir/i })).toHaveLength(0);
  });

  // SBC-11: competency grade select change calls PATCH with gradeScaleValueId
  it('SBC-11: changing competency grade select issues PATCH with gradeScaleValueId', async () => {
    renderPage();
    await openGradesModal('Ana');

    await waitFor(() =>
      expect(screen.getByTestId('competencias-table')).toBeInTheDocument(),
    );

    const competenciasTable = screen.getByTestId('competencias-table');
    const compSelects = within(competenciasTable).getAllByRole('combobox');
    expect(compSelects.length).toBeGreaterThan(0);

    // cv-1 / pi-uuid-1 is the first select (gradeScaleValueId: null → change to gsv-mb)
    await userEvent.selectOptions(compSelects[0], 'gsv-mb');

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/competency-valuations\/cv-1\/periods\/pi-uuid-1/),
        expect.objectContaining({ gradeScaleValueId: 'gsv-mb' }),
        expect.objectContaining({ params: expect.anything() }),
      );
    });
  });

  // SBC-12: inline save — period grade change triggers PUT /grading/subject-grades with items wrapper
  it('SBC-12: changing period grade dropdown triggers PUT /grading/subject-grades with items wrapper', async () => {
    renderPage();
    await openGradesModal('Ana');

    await waitFor(() =>
      expect(screen.getByTestId('materias-table')).toBeInTheDocument(),
    );

    // Find grade dropdowns for period bimesters in the materias table
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
        expect.objectContaining({ params: expect.anything() }),
      );
    });
  });

  // SBC-13: competencias table renders human-readable name, NOT the raw UUID
  it('SBC-13: competencias table renders human-readable competency name (not raw ID)', async () => {
    renderPage();
    await openGradesModal('Ana');

    await waitFor(() =>
      expect(screen.getByTestId('competencias-table')).toBeInTheDocument(),
    );

    // 'Resolución de problemas' is the name for cv-1 — must be visible
    expect(screen.getByText('Resolución de problemas')).toBeInTheDocument();
    // Raw competencyId UUIDs must NOT be visible as standalone text
    expect(screen.queryByText('comp-uuid-1')).not.toBeInTheDocument();
  });

  // SBC-14: after CC selection, student list shows rows for all students
  it('SBC-14: after CC selection, student list shows rows for all students', async () => {
    renderPage();
    await selectCC();

    await waitFor(() => screen.getByTestId('student-list'));

    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('García')).toBeInTheDocument();
    expect(screen.getByText('Carlos')).toBeInTheDocument();
    expect(screen.getByText('López')).toBeInTheDocument();
  });

  // SBC-15: clicking "Calificaciones" opens a modal with correct title
  it('SBC-15: clicking Calificaciones on a student opens the grades modal', async () => {
    renderPage();
    await selectCC();

    await waitFor(() => screen.getByText('Ana'));

    const row = screen.getByText('Ana').closest('tr')!;
    const calificacionesBtn = within(row).getByRole('button', { name: /calificaciones/i });
    await userEvent.click(calificacionesBtn);

    await waitFor(() => screen.getByRole('dialog'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // The modal title contains both "Calificaciones" and the student name
    expect(screen.getByRole('heading', { name: /calificaciones.*ana/i })).toBeInTheDocument();
  });

  // SBC-16: clicking "Observaciones" opens the observations modal
  it('SBC-16: clicking Observaciones on a student opens the observations modal', async () => {
    renderPage();
    await selectCC();

    await waitFor(() => screen.getByText('Ana'));

    const row = screen.getByText('Ana').closest('tr')!;
    const observacionesBtn = within(row).getByRole('button', { name: /observaciones/i });
    await userEvent.click(observacionesBtn);

    await waitFor(() => screen.getByRole('dialog'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Title contains "Observaciones" and student name
    expect(screen.getByRole('heading', { name: /observaciones.*ana/i })).toBeInTheDocument();
  });

  // SBC-17: clicking "Legajo" opens the legajo modal
  it('SBC-17: clicking Legajo on a student opens the legajo modal', async () => {
    renderPage();
    await selectCC();

    await waitFor(() => screen.getByText('Ana'));

    const row = screen.getByText('Ana').closest('tr')!;
    const legajoBtn = within(row).getByRole('button', { name: /legajo/i });
    await userEvent.click(legajoBtn);

    await waitFor(() => screen.getByRole('dialog'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Title contains "Legajo"
    expect(screen.getByRole('heading', { name: /legajo.*ana/i })).toBeInTheDocument();
  });

  // SBC-18: closing the modal returns to the student list
  it('SBC-18: closing the modal returns to the student list view', async () => {
    renderPage();
    await selectCC();

    await waitFor(() => screen.getByText('Ana'));

    const row = screen.getByText('Ana').closest('tr')!;
    const calificacionesBtn = within(row).getByRole('button', { name: /calificaciones/i });
    await userEvent.click(calificacionesBtn);

    await waitFor(() => screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click close button
    const closeBtn = screen.getByRole('button', { name: /cerrar/i });
    await userEvent.click(closeBtn);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Student list still visible
    expect(screen.getByTestId('student-list')).toBeInTheDocument();
  });
});
