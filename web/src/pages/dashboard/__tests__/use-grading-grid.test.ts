import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// ── Mock apiClient ─────────────────────────────────────────────────────────────
vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
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
