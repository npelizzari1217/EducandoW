/**
 * W1-fix integration test — asserts no redundant fetches when CompetencyGradingGrid
 * is rendered inside SubjectGradingBySubjectPage.
 *
 * This file intentionally does NOT mock CompetencyGradingGrid so the real component
 * (and its useGradingGrid call) is exercised. Before the injectedGrid fix the
 * endpoints /subject-competencies and /competency-valuations were called TWICE
 * (once by SubjectGradingGrid's hook, once by CGG's own hook). After the fix they
 * must be called exactly ONCE.
 *
 * RED before fix, GREEN after.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ── Mocks (no CompetencyGradingGrid mock — real component must run) ────────────

vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn().mockResolvedValue({ data: { data: null } }),
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

// ── Fixtures ───────────────────────────────────────────────────────────────────

const mockCourseCycles = [
  { uuid: 'cc-prim-1', courseName: '1er Año A', level: 20, modality: 0 },
];

const mockSubjects = [
  { subjectId: 'sub-1', subjectName: 'Matemática', studyPlanSubjectId: 'sps-1' },
];

const mockStudents = [
  { studentId: 's-1', firstName: 'Ana', lastName: 'García' },
];

const mockCompetencies = [
  { uuid: 'c-1', studyPlanSubjectId: 'sps-1', name: 'Comprensión', active: true },
];

const mockTemplates = [
  {
    id: 'tpl-1',
    name: 'Template Primario',
    level: 2,
    modality: 0,
    items: [
      { id: 'pi-1', name: '1er Trimestre', sort_order: 1 },
    ],
  },
];

const mockScales = [
  {
    id: 'scale-1',
    name: 'Escala Primario',
    values: [
      { id: 'gsv-1', code: 'MB', label: 'Muy Bueno', internal_status: 'APROBADO', sort_order: 1 },
    ],
  },
];

const mockValuations = [
  {
    valuationId: 'val-1',
    studentId: 's-1',
    competencyId: 'c-1',
    periodValuations: [
      {
        periodItemId: 'pi-1',
        gradeScaleValueId: null,
        gradeCode: null,
        internalStatus: null,
        modificable: true,
        imprimible: false,
      },
    ],
  },
];

const mockSubjectGradesResponse = {
  periods: [{ periodOrdinal: 1, periodName: '1er Trimestre' }],
  students: [
    {
      studentId: 's-1',
      firstName: 'Ana',
      lastName: 'García',
      periodGrades: [
        {
          periodOrdinal: 1,
          gradeScaleValueId: null,
          gradeCode: null,
          internalStatus: null,
          pa: false,
          ppi: false,
          pp: false,
        },
      ],
      finalGrades: [
        { type: 'FINAL', gradeScaleValueId: null, gradeCode: null, internalStatus: null, passed: null },
      ],
      competencyValuations: [
        {
          valuationId: 'val-1',
          studentId: 's-1',
          competencyId: 'c-1',
          periodValuations: [
            {
              periodItemId: 'pi-1',
              gradeScaleValueId: null,
              gradeCode: null,
              internalStatus: null,
              modificable: true,
              imprimible: false,
            },
          ],
        },
      ],
    },
  ],
};

import apiClient from '../../../api/client';
import SubjectGradingBySubjectPage from '../subject-grading-by-subject';

// ── Setup ──────────────────────────────────────────────────────────────────────

function setupMocks() {
  vi.clearAllMocks();
  (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation(
    (url: string) => {
      if (url === '/course-cycles') {
        return Promise.resolve({ data: { data: mockCourseCycles } });
      }
      if (url === '/course-cycles/cc-prim-1/subjects') {
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
  (apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: null } });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SubjectGradingBySubjectPage />
    </MemoryRouter>,
  );
}

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

describe('W1-fix: CompetencyGradingGrid uses injectedGrid — no redundant fetches', () => {
  beforeEach(() => setupMocks());

  // SBS-W1: /subject-competencies must be fetched exactly once.
  // RED: before fix, CGG calls useGradingGrid independently → 2 calls.
  // GREEN: after fix, CGG receives injectedGrid → only SubjectGradingGrid's hook fires → 1 call.
  it('SBS-W1: /subject-competencies is called exactly once after the full grid renders', async () => {
    renderPage();
    await selectCCAndSubject();

    // SubjectGradingGrid shows period-grades section once its hook settles
    await waitFor(() => screen.getByTestId('subject-period-grades-section'));

    // CGG renders its table (role=grid) once all data is available
    await waitFor(() =>
      screen.getByRole('grid', { name: /grilla de calificación de competencias/i }),
    );

    const competencyCalls = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls.filter(
      (args: unknown[]) => args[0] === '/subject-competencies',
    );
    expect(competencyCalls).toHaveLength(1);
  });

  // SBS-W1b: /competency-valuations must be fetched exactly once.
  it('SBS-W1b: /competency-valuations is called exactly once after the full grid renders', async () => {
    renderPage();
    await selectCCAndSubject();

    await waitFor(() => screen.getByTestId('subject-period-grades-section'));
    await waitFor(() =>
      screen.getByRole('grid', { name: /grilla de calificación de competencias/i }),
    );

    const valuationCalls = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls.filter(
      (args: unknown[]) => args[0] === '/competency-valuations',
    );
    expect(valuationCalls).toHaveLength(1);
  });
});
