/**
 * Tests for useStudentGrades hook.
 * Covers: basic load, ROOT institutionId threading (ROOT fetch + mutation params).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// ── Mock apiClient ──────────────────────────────────────────────────────────────
vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

// ── Fixtures ────────────────────────────────────────────────────────────────────

const mockScales = [
  {
    id: 'scale-1',
    name: 'Escala Primario',
    values: [
      { id: 'gsv-1', code: 'MB', label: 'Muy Bueno', internal_status: 'APROBADO', sort_order: 1 },
      { id: 'gsv-2', code: 'B',  label: 'Bueno',     internal_status: 'APROBADO', sort_order: 2 },
    ],
  },
];

const mockByStudentResponse = {
  courseCycleId: 'cc-1',
  studentId: 'stu-1',
  subjects: [
    {
      subjectId: 'sub-1',
      subjectName: 'Matemática',
      periods: [
        { periodOrdinal: 1, periodName: '1er Trimestre' },
        { periodOrdinal: 2, periodName: '2do Trimestre' },
      ],
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
      ],
      finalGrades: [
        {
          type: 'FINAL',
          gradeScaleValueId: null,
          gradeCode: null,
          internalStatus: null,
          passed: null,
        },
      ],
      competencyValuations: [
        {
          valuationId: 'val-1',
          studentId: 'stu-1',
          competencyId: 'comp-1',
          competencyName: 'Comprensión',
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
import { useStudentGrades } from '../components/use-student-grades';

const defaultOptions = {
  courseCycleId: 'cc-1',
  studentId: 'stu-1',
  level: 2,
  modality: 0 as number | null,
};

function setupMocks() {
  vi.clearAllMocks();
  (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url === '/grading/subject-grades/by-student') {
      return Promise.resolve({ data: { data: mockByStudentResponse } });
    }
    if (url === '/grading/scales') {
      return Promise.resolve({ data: { data: mockScales } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
  (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: null } });
  (apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: null } });
}

// ── Basic load tests ────────────────────────────────────────────────────────────

describe('useStudentGrades', () => {
  beforeEach(() => {
    setupMocks();
  });

  it('SGS-1: fires 2 parallel fetches on mount (by-student + scales)', async () => {
    const { result } = renderHook(() => useStudentGrades(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/grading/subject-grades/by-student',
      expect.objectContaining({ params: expect.objectContaining({ courseCycleId: 'cc-1', studentId: 'stu-1' }) }),
    );
    expect(apiClient.get).toHaveBeenCalledWith(
      '/grading/scales',
      expect.anything(),
    );
  });

  it('SGS-2: populates subjects with saveState=idle on load', async () => {
    const { result } = renderHook(() => useStudentGrades(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subjects).toHaveLength(1);
    expect(result.current.subjects[0].subjectId).toBe('sub-1');
    expect(result.current.subjects[0].periodGrades[0].saveState).toBe('idle');
    expect(result.current.subjects[0].finalGrades[0].saveState).toBe('idle');
  });

  it('SGS-3: populates scaleValues sorted by sort_order', async () => {
    const { result } = renderHook(() => useStudentGrades(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.scaleValues).toHaveLength(2);
    expect(result.current.scaleValues[0].code).toBe('MB');
    expect(result.current.scaleValues[1].code).toBe('B');
  });

  it('SGS-4: starts loading=true on mount', () => {
    const { result } = renderHook(() => useStudentGrades(defaultOptions));
    expect(result.current.loading).toBe(true);
  });

  it('SGS-5: updatePeriodGrade calls PUT /grading/subject-grades with { items } wrapper', async () => {
    const { result } = renderHook(() => useStudentGrades(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updatePeriodGrade('sub-1', 1, { gradeScaleValueId: 'gsv-2' });
    });

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/grading/subject-grades',
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              courseCycleId: 'cc-1',
              subjectId: 'sub-1',
              studentId: 'stu-1',
              gradeScaleValueId: 'gsv-2',
            }),
          ]),
        }),
        expect.objectContaining({ params: expect.anything() }),
      );
    });
  });

  it('SGS-6: updateFinalGrade calls PUT /grading/subject-final-grades', async () => {
    const { result } = renderHook(() => useStudentGrades(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateFinalGrade('sub-1', 'FINAL', { gradeScaleValueId: 'gsv-1' });
    });

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/grading/subject-final-grades',
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              courseCycleId: 'cc-1',
              subjectId: 'sub-1',
              studentId: 'stu-1',
              type: 'FINAL',
              gradeScaleValueId: 'gsv-1',
            }),
          ]),
        }),
        expect.objectContaining({ params: expect.anything() }),
      );
    });
  });

  it('SGS-7: updateImprimible calls PATCH /competency-valuations/:uuid/periods/:pid', async () => {
    const { result } = renderHook(() => useStudentGrades(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateImprimible('val-1', 'pi-1', true);
    });

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/competency-valuations/val-1/periods/pi-1',
        { imprimible: true },
        expect.objectContaining({ params: expect.anything() }),
      );
    });
  });
});

// ── ROOT institutionId threading ───────────────────────────────────────────────

describe('useStudentGrades - ROOT institutionId threading', () => {
  beforeEach(() => {
    setupMocks();
  });

  it('ROOT-1: when institutionId provided, both GETs include institutionId param', async () => {
    const { result } = renderHook(() =>
      useStudentGrades({ ...defaultOptions, institutionId: 'inst-root-42' }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiClient.get).toHaveBeenCalledWith(
      '/grading/subject-grades/by-student',
      expect.objectContaining({ params: expect.objectContaining({ institutionId: 'inst-root-42' }) }),
    );
    expect(apiClient.get).toHaveBeenCalledWith(
      '/grading/scales',
      expect.objectContaining({ params: expect.objectContaining({ institutionId: 'inst-root-42' }) }),
    );
  });

  it('ROOT-2: when institutionId absent, no fetch includes institutionId', async () => {
    const { result } = renderHook(() => useStudentGrades(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const calls = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls as Array<[string, { params?: Record<string, string> }?]>;
    for (const [, config] of calls) {
      expect(config?.params?.institutionId).toBeUndefined();
    }
  });

  it('ROOT-3: updatePeriodGrade PUT includes institutionId in params when ROOT', async () => {
    const { result } = renderHook(() =>
      useStudentGrades({ ...defaultOptions, institutionId: 'inst-root-42' }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updatePeriodGrade('sub-1', 1, { gradeScaleValueId: 'gsv-2' });
    });

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/grading/subject-grades',
        expect.anything(),
        expect.objectContaining({ params: expect.objectContaining({ institutionId: 'inst-root-42' }) }),
      );
    });
  });

  it('ROOT-4: updatePeriodGrade PUT does NOT include institutionId when non-ROOT', async () => {
    const { result } = renderHook(() => useStudentGrades(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updatePeriodGrade('sub-1', 1, { gradeScaleValueId: 'gsv-2' });
    });

    await waitFor(() => {
      const putCalls = (apiClient.put as ReturnType<typeof vi.fn>).mock.calls as Array<[string, object, { params?: Record<string, string> }?]>;
      for (const [, , config] of putCalls) {
        expect(config?.params?.institutionId).toBeUndefined();
      }
    });
  });

  it('ROOT-5: updateImprimible PATCH includes institutionId when ROOT', async () => {
    const { result } = renderHook(() =>
      useStudentGrades({ ...defaultOptions, institutionId: 'inst-root-42' }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateImprimible('val-1', 'pi-1', true);
    });

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/competency-valuations/val-1/periods/pi-1',
        { imprimible: true },
        expect.objectContaining({ params: expect.objectContaining({ institutionId: 'inst-root-42' }) }),
      );
    });
  });
});

// ── Error handling (blindaje del allSettled) ─────────────────────────────────────

describe('useStudentGrades - error handling', () => {
  beforeEach(() => {
    setupMocks();
  });

  it('SGS-ERR-1: setea error (no queda mudo) si falla el fetch requerido de notas', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/grading/subject-grades/by-student') return Promise.reject(new Error('boom'));
      if (url === '/grading/scales') return Promise.resolve({ data: { data: mockScales } });
      return Promise.resolve({ data: { data: [] } });
    });

    const { result } = renderHook(() => useStudentGrades(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).not.toBe('');
    expect(result.current.subjects).toHaveLength(0);
  });

  it('SGS-ERR-2: setea error si falla el fetch requerido de escalas', async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/grading/scales') return Promise.reject(new Error('boom'));
      if (url === '/grading/subject-grades/by-student')
        return Promise.resolve({ data: { data: mockByStudentResponse } });
      return Promise.resolve({ data: { data: [] } });
    });

    const { result } = renderHook(() => useStudentGrades(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).not.toBe('');
  });

  it('SGS-ERR-3: sin fallas, error queda vacío', async () => {
    const { result } = renderHook(() => useStudentGrades(defaultOptions));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('');
  });
});
