/**
 * PR-4 [RED] — useAttendanceMonthStatus hook.
 * GET/PATCH /course-cycles/:ccId/asistencia-mensual/estado (backend from PR-3b, apply-progress #1648).
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
import { useAttendanceMonthStatus } from '../useAttendanceMonthStatus';

function setupMocks(status: 'OPEN' | 'CLOSED' = 'OPEN') {
  vi.clearAllMocks();
  (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { data: { courseCycleId: 'cc-1', year: 2026, month: 3, status, closedAt: null, closedBy: null } },
  });
  (apiClient.patch as ReturnType<typeof vi.fn>).mockImplementation(
    (_url: string, body: { year: number; month: number; status: 'OPEN' | 'CLOSED' }) =>
      Promise.resolve({
        data: {
          data: {
            courseCycleId: 'cc-1',
            year: body.year,
            month: body.month,
            status: body.status,
            closedAt: body.status === 'CLOSED' ? '2026-03-15T00:00:00.000Z' : null,
            closedBy: body.status === 'CLOSED' ? 'user-1' : null,
          },
        },
      }),
  );
}

describe('useAttendanceMonthStatus', () => {
  beforeEach(() => {
    setupMocks();
  });

  it('AMS-1: GETs the current status on mount', async () => {
    setupMocks('CLOSED');
    const { result } = renderHook(() => useAttendanceMonthStatus('cc-1', 2026, 3));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiClient.get).toHaveBeenCalledWith('/course-cycles/cc-1/asistencia-mensual/estado?year=2026&month=3');
    expect(result.current.status).toBe('CLOSED');
  });

  it('AMS-2: does not fetch when ccId is empty/null', () => {
    renderHook(() => useAttendanceMonthStatus('', 2026, 3));
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('AMS-3: refetches when year/month change', async () => {
    const { result, rerender } = renderHook(
      ({ y, m }) => useAttendanceMonthStatus('cc-1', y, m),
      { initialProps: { y: 2026, m: 3 } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiClient.get).toHaveBeenCalledTimes(1);

    rerender({ y: 2026, m: 4 });
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
    expect(apiClient.get).toHaveBeenLastCalledWith('/course-cycles/cc-1/asistencia-mensual/estado?year=2026&month=4');
  });

  it('AMS-4: setStatus PATCHes to CLOSED and updates local state on success', async () => {
    const { result } = renderHook(() => useAttendanceMonthStatus('cc-1', 2026, 3));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok = false;
    await act(async () => {
      ok = await result.current.setStatus('CLOSED');
    });

    expect(ok).toBe(true);
    expect(apiClient.patch).toHaveBeenCalledWith('/course-cycles/cc-1/asistencia-mensual/estado', {
      year: 2026,
      month: 3,
      status: 'CLOSED',
    });
    expect(result.current.status).toBe('CLOSED');
    expect(result.current.closedAt).toBe('2026-03-15T00:00:00.000Z');
  });

  it('AMS-5: setStatus surfaces a 403 error message (rank guard rejection)', async () => {
    (apiClient.patch as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { data: { error: { message: 'No tenés permisos para esta acción' } } },
    });
    const { result } = renderHook(() => useAttendanceMonthStatus('cc-1', 2026, 3));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok = true;
    await act(async () => {
      ok = await result.current.setStatus('CLOSED');
    });

    expect(ok).toBe(false);
    expect(result.current.error).toMatch(/permisos/i);
    // state must not have changed optimistically
    expect(result.current.status).toBe('OPEN');
  });

  it('AMS-6: reload() re-fetches the current status', async () => {
    const { result } = renderHook(() => useAttendanceMonthStatus('cc-1', 2026, 3));
    await waitFor(() => expect(result.current.loading).toBe(false));

    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { data: { courseCycleId: 'cc-1', year: 2026, month: 3, status: 'CLOSED', closedAt: null, closedBy: null } },
    });
    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.status).toBe('CLOSED');
  });
});
