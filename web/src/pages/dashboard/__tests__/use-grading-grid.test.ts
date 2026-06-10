import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// ── Mock apiClient ─────────────────────────────────────────────────────────────
vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const mockStudents = [
  { studentId: 's-1', firstName: 'Ana', lastName: 'García' },
  { studentId: 's-2', firstName: 'Luis', lastName: 'López' },
];

const mockCompetencies = [
  { uuid: 'c-1', studyPlanSubjectId: 'sps-1', name: 'Competencia 1', active: true },
  { uuid: 'c-2', studyPlanSubjectId: 'sps-1', name: 'Competencia 2', active: true },
];

const mockTemplates = [
  {
    id: 'tpl-1',
    name: 'Template Primario',
    level: 2,
    modality: 0,
    active: true,
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
    level: 2,
    modality: 0,
    active: true,
    values: [
      { id: 'gsv-1', scale_id: 'scale-1', code: 'MB', label: 'Muy Bueno', internal_status: 'APROBADO', sort_order: 1, active: true },
      { id: 'gsv-2', scale_id: 'scale-1', code: 'B',  label: 'Bueno',     internal_status: 'APROBADO', sort_order: 2, active: true },
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
        gradeScaleValueId: 'gsv-1',
        gradeCode: 'MB',
        internalStatus: 'APROBADO',
        modificable: true,
        imprimible: true,
      },
    ],
  },
  {
    valuationId: 'val-2',
    studentId: 's-1',
    competencyId: 'c-2',
    periodValuations: [],
  },
];

import apiClient from '../../../api/client';
import { useGradingGrid } from '../components/use-grading-grid';

const defaultOptions = {
  courseCycleId: 'cc-1',
  studyPlanSubjectId: 'sps-1',
  level: 2,
  modality: 0 as number | null,
};

function setupMocks() {
  vi.clearAllMocks();
  (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url === '/course-cycles/cc-1/students') {
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
    return Promise.resolve({ data: { data: [] } });
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useGradingGrid', () => {
  beforeEach(() => {
    setupMocks();
  });

  it('fires exactly 5 parallel fetches on mount', async () => {
    const { result } = renderHook(() => useGradingGrid(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiClient.get).toHaveBeenCalledWith('/course-cycles/cc-1/students');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/subject-competencies',
      expect.objectContaining({ params: { studyPlanSubjectId: 'sps-1' } }),
    );
    expect(apiClient.get).toHaveBeenCalledWith('/grading/period-templates', expect.anything());
    expect(apiClient.get).toHaveBeenCalledWith('/grading/scales', expect.anything());
    expect(apiClient.get).toHaveBeenCalledWith(
      '/competency-valuations',
      expect.objectContaining({ params: expect.objectContaining({ courseCycleId: 'cc-1' }) }),
    );
    expect((apiClient.get as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(5);
  });

  it('activePeriodItemId defaults to first period item after load', async () => {
    const { result } = renderHook(() => useGradingGrid(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.activePeriodItemId).toBe('pi-1');
  });

  it('cells Map is keyed ${valuationId}:${periodItemId} with correct CellState', async () => {
    const { result } = renderHook(() => useGradingGrid(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // val-1 × pi-1: has existing grade data
    expect(result.current.cells.has('val-1:pi-1')).toBe(true);
    const cellWithGrade = result.current.cells.get('val-1:pi-1')!;
    expect(cellWithGrade.gradeCode).toBe('MB');
    expect(cellWithGrade.gradeScaleValueId).toBe('gsv-1');
    expect(cellWithGrade.internalStatus).toBe('APROBADO');
    expect(cellWithGrade.modificable).toBe(true);
    expect(cellWithGrade.saveState).toBe('idle');

    // val-1 × pi-2: no periodValuation → empty placeholder
    expect(result.current.cells.has('val-1:pi-2')).toBe(true);
    const emptyCell = result.current.cells.get('val-1:pi-2')!;
    expect(emptyCell.gradeCode).toBeNull();
    expect(emptyCell.gradeScaleValueId).toBeNull();
    expect(emptyCell.saveState).toBe('idle');

    // val-2 × pi-1: valuation with no period grades → empty
    expect(result.current.cells.has('val-2:pi-1')).toBe(true);
  });

  it('switchPeriod updates activePeriodItemId without triggering new fetches (CGG-2)', async () => {
    const { result } = renderHook(() => useGradingGrid(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const prevCallCount = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls.length;

    act(() => {
      result.current.switchPeriod('pi-2');
    });

    expect(result.current.activePeriodItemId).toBe('pi-2');
    // No new fetches triggered
    expect((apiClient.get as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(prevCallCount);
  });

  it('populates scaleValues sorted by sort_order', async () => {
    const { result } = renderHook(() => useGradingGrid(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.scaleValues).toHaveLength(2);
    expect(result.current.scaleValues[0].code).toBe('MB');
    expect(result.current.scaleValues[1].code).toBe('B');
  });

  it('populates periodItems sorted by sort_order', async () => {
    const { result } = renderHook(() => useGradingGrid(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.periodItems).toHaveLength(2);
    expect(result.current.periodItems[0].id).toBe('pi-1');
    expect(result.current.periodItems[1].id).toBe('pi-2');
  });

  it('starts loading=true on mount', () => {
    const { result } = renderHook(() => useGradingGrid(defaultOptions));
    expect(result.current.loading).toBe(true);
  });
});

// ── Subject-grade channels (PR5-T3 RED) ────────────────────────────────────────

// REAL API shape: SubjectGradesBySubjectResult from get-subject-grades-by-subject.use-case.ts
// No top-level competencies[]. imprimible lives in students[].competencyValuations[].periodValuations[].
const mockSubjectGradesResponse = {
  periods: [
    { periodOrdinal: 1, periodName: '1er Trimestre' },
    { periodOrdinal: 2, periodName: '2do Trimestre' },
  ],
  // NO competencies[] field — that field does not exist in the real API
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
          pp: true,
        },
        {
          periodOrdinal: 2,
          gradeScaleValueId: null,
          gradeCode: null,
          internalStatus: null,
          pa: false,
          ppi: false,
          pp: false,
        },
      ],
      finalGrades: [
        {
          type: 'FINAL',
          gradeScaleValueId: null,
          gradeCode: null,
          internalStatus: null,
          passed: null,
        },
        {
          type: 'DICIEMBRE',
          gradeScaleValueId: 'gsv-2',
          gradeCode: 'B',
          internalStatus: 'APROBADO',
          passed: false,
        },
      ],
      // imprimible comes from CompetencyValuationWithPeriods[].periodValuations[].imprimible
      competencyValuations: [
        {
          valuationId: 'val-1',
          studentId: 's-1',
          competencyId: 'c-1',
          periodValuations: [
            {
              periodItemId: 'pi-1',
              gradeScaleValueId: 'gsv-1',
              gradeCode: 'MB',
              internalStatus: 'APROBADO',
              modificable: true,
              imprimible: true,
            },
          ],
        },
        {
          valuationId: 'val-2',
          studentId: 's-1',
          competencyId: 'c-2',
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
    {
      studentId: 's-2',
      firstName: 'Luis',
      lastName: 'López',
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
      finalGrades: [],
      competencyValuations: [],
    },
  ],
};

const optionsWithSubjectId = {
  ...defaultOptions,
  subjectId: 'subj-1',
};

function setupMocksWithSubjectGrades() {
  vi.clearAllMocks();
  (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url === '/course-cycles/cc-1/students') {
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
  });
  (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: null } });
}

describe('useGradingGrid - subject-grade channels', () => {
  beforeEach(() => {
    setupMocksWithSubjectGrades();
  });

  // SGC-1: fires 6 parallel fetches when subjectId is provided
  it('SGC-1: fires GET /grading/subject-grades when subjectId option is provided', async () => {
    const { result } = renderHook(() => useGradingGrid(optionsWithSubjectId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiClient.get).toHaveBeenCalledWith(
      '/grading/subject-grades',
      expect.objectContaining({
        params: expect.objectContaining({
          courseCycleId: 'cc-1',
          subjectId: 'subj-1',
        }),
      }),
    );
  });

  // SGC-2: does NOT fetch /grading/subject-grades when subjectId is absent
  it('SGC-2: does NOT fetch /grading/subject-grades when subjectId is absent', async () => {
    const { result } = renderHook(() => useGradingGrid(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const calls = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls.map((args: unknown[]) => args[0] as string);
    expect(calls).not.toContain('/grading/subject-grades');
  });

  // SGC-3: subjectGradePeriods populated from response
  it('SGC-3: subjectGradePeriods contains snapshotted period list', async () => {
    const { result } = renderHook(() => useGradingGrid(optionsWithSubjectId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subjectGradePeriods).toHaveLength(2);
    expect(result.current.subjectGradePeriods[0].periodOrdinal).toBe(1);
    expect(result.current.subjectGradePeriods[0].periodName).toBe('1er Trimestre');
    expect(result.current.subjectGradePeriods[1].periodOrdinal).toBe(2);
  });

  // SGC-4: subjectPeriodGradeCells Map keyed studentId:periodOrdinal
  it('SGC-4: subjectPeriodGradeCells Map is keyed studentId:periodOrdinal with correct data', async () => {
    const { result } = renderHook(() => useGradingGrid(optionsWithSubjectId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subjectPeriodGradeCells.has('s-1:1')).toBe(true);
    const cell = result.current.subjectPeriodGradeCells.get('s-1:1')!;
    expect(cell.gradeCode).toBe('MB');
    expect(cell.gradeScaleValueId).toBe('gsv-1');
    expect(cell.internalStatus).toBe('APROBADO');
    expect(cell.pa).toBe(false);
    expect(cell.ppi).toBe(false);
    expect(cell.pp).toBe(true);
    expect(cell.saveState).toBe('idle');

    // Empty period for s-1
    expect(result.current.subjectPeriodGradeCells.has('s-1:2')).toBe(true);
    const emptyCell = result.current.subjectPeriodGradeCells.get('s-1:2')!;
    expect(emptyCell.gradeCode).toBeNull();
    expect(emptyCell.pa).toBe(false);
  });

  // SGC-5: subjectFinalGradeCells Map keyed studentId:type
  it('SGC-5: subjectFinalGradeCells Map is keyed studentId:type with correct data', async () => {
    const { result } = renderHook(() => useGradingGrid(optionsWithSubjectId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subjectFinalGradeCells.has('s-1:FINAL')).toBe(true);
    const finalCell = result.current.subjectFinalGradeCells.get('s-1:FINAL')!;
    expect(finalCell.gradeScaleValueId).toBeNull();
    expect(finalCell.passed).toBeNull();
    expect(finalCell.saveState).toBe('idle');

    expect(result.current.subjectFinalGradeCells.has('s-1:DICIEMBRE')).toBe(true);
    const dicCell = result.current.subjectFinalGradeCells.get('s-1:DICIEMBRE')!;
    expect(dicCell.gradeCode).toBe('B');
    expect(dicCell.passed).toBe(false);
  });

  // SGC-6: competencies include imprimible boolean when subjectId provided
  it('SGC-6: competencies include imprimible boolean when subjectId is provided', async () => {
    const { result } = renderHook(() => useGradingGrid(optionsWithSubjectId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // The hook should expose imprimible per competency
    const comp1 = result.current.competencies.find(c => c.uuid === 'c-1');
    expect(comp1).toBeDefined();
    expect((comp1 as { imprimible?: boolean }).imprimible).toBe(true);

    const comp2 = result.current.competencies.find(c => c.uuid === 'c-2');
    expect(comp2).toBeDefined();
    expect((comp2 as { imprimible?: boolean }).imprimible).toBe(false);
  });

  // SGC-7: empty Maps when subjectId absent
  it('SGC-7: subjectPeriodGradeCells and subjectFinalGradeCells are empty when subjectId absent', async () => {
    const { result } = renderHook(() => useGradingGrid(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subjectPeriodGradeCells.size).toBe(0);
    expect(result.current.subjectFinalGradeCells.size).toBe(0);
    expect(result.current.subjectGradePeriods).toHaveLength(0);
  });

  // SGC-8: updateSubjectPeriodGrade optimistically updates cell and calls PUT
  it('SGC-8: updateSubjectPeriodGrade updates cell and calls PUT /grading/subject-grades', async () => {
    const { result } = renderHook(() => useGradingGrid(optionsWithSubjectId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateSubjectPeriodGrade('s-1:2', { gradeScaleValueId: 'gsv-1' });
    });

    await waitFor(() => {
      // W1: assert { items: [...] } wrapper — a flat payload would cause 400 at the Zod boundary
      expect(apiClient.put).toHaveBeenCalledWith(
        '/grading/subject-grades',
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              courseCycleId: 'cc-1',
              subjectId: 'subj-1',
              studentId: 's-1',
              periodOrdinal: 2,
              gradeScaleValueId: 'gsv-1',
            }),
          ]),
        }),
      );
    });
  });

  // SGC-9: updateSubjectFinalGrade calls PUT /grading/subject-final-grades
  it('SGC-9: updateSubjectFinalGrade calls PUT /grading/subject-final-grades', async () => {
    const { result } = renderHook(() => useGradingGrid(optionsWithSubjectId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateSubjectFinalGrade('s-1:FINAL', { gradeScaleValueId: 'gsv-1' });
    });

    await waitFor(() => {
      // W1: assert { items: [...] } wrapper + no null gradeScaleValueId (DTO rejects null for finals)
      expect(apiClient.put).toHaveBeenCalledWith(
        '/grading/subject-final-grades',
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              courseCycleId: 'cc-1',
              subjectId: 'subj-1',
              studentId: 's-1',
              type: 'FINAL',
              gradeScaleValueId: 'gsv-1',
            }),
          ]),
        }),
      );
    });
  });

  // SGC-10: saveSubjectGrades saves all dirty period grade cells
  it('SGC-10: saveSubjectGrades calls PUT for all dirty period grade cells', async () => {
    const { result } = renderHook(() => useGradingGrid(optionsWithSubjectId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Mark a cell dirty
    act(() => {
      result.current.updateSubjectPeriodGrade('s-2:1', { gradeScaleValueId: 'gsv-2', saveState: 'dirty' });
    });

    await act(async () => {
      await result.current.saveSubjectGrades();
    });

    // W1: assert { items: [...] } wrapper in batch save path too
    expect(apiClient.put).toHaveBeenCalledWith(
      '/grading/subject-grades',
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ studentId: 's-2' }),
        ]),
      }),
    );
  });
});
