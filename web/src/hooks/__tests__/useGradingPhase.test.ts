/**
 * PR-2 [RED] — useGradingPhase hook.
 * GET/PATCH /course-cycles/:uuid/grading-phase (backend from PR-1, apply-progress #1648).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

import apiClient from '../../api/client';
import { useGradingPhase } from '../useGradingPhase';

function setupMocks(gradingPhase: string | null = null) {
  vi.clearAllMocks();
  (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: { gradingPhase } } });
  (apiClient.patch as ReturnType<typeof vi.fn>).mockImplementation((_url: string, body: { gradingPhase: string | null }) =>
    Promise.resolve({ data: { data: { gradingPhase: body.gradingPhase } } }),
  );
}

describe('useGradingPhase', () => {
  beforeEach(() => {
    setupMocks();
  });

  it('GP-1: GETs the current value on mount', async () => {
    setupMocks('BIM_2');
    const { result } = renderHook(() => useGradingPhase('cc-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiClient.get).toHaveBeenCalledWith('/course-cycles/cc-1/grading-phase');
    expect(result.current.gradingPhase).toBe('BIM_2');
  });

  it('GP-2: does not fetch when uuid is null', () => {
    renderHook(() => useGradingPhase(null));
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('GP-3: setPhase PATCHes and updates local state on success', async () => {
    const { result } = renderHook(() => useGradingPhase('cc-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok = false;
    await act(async () => {
      ok = await result.current.setPhase('BIM_3');
    });

    expect(ok).toBe(true);
    expect(apiClient.patch).toHaveBeenCalledWith('/course-cycles/cc-1/grading-phase', { gradingPhase: 'BIM_3' });
    expect(result.current.gradingPhase).toBe('BIM_3');
  });

  it('GP-4: setPhase surfaces a 422 error message (GradingPhaseNotApplicableError)', async () => {
    (apiClient.patch as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { data: { error: { message: 'El nivel no admite fase de calificación' } } },
    });
    const { result } = renderHook(() => useGradingPhase('cc-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok = true;
    await act(async () => {
      ok = await result.current.setPhase('BIM_1');
    });

    expect(ok).toBe(false);
    expect(result.current.error).toMatch(/no admite fase/i);
  });

  it('GP-5: setPhase surfaces a 409 error message (GradingPhaseViolationError propagated from a stale caller)', async () => {
    (apiClient.patch as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { data: { error: { message: 'Conflicto de fase' } } },
    });
    const { result } = renderHook(() => useGradingPhase('cc-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok = true;
    await act(async () => {
      ok = await result.current.setPhase('CIERRE');
    });

    expect(ok).toBe(false);
    expect(result.current.error).toMatch(/conflicto/i);
  });

  it('GP-6: reload() re-fetches the current value', async () => {
    const { result } = renderHook(() => useGradingPhase('cc-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { data: { gradingPhase: 'CIERRE' } } });
    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.gradingPhase).toBe('CIERRE');
  });
});
