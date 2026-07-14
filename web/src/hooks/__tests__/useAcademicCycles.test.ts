/**
 * useDeleteAcademicCycle — delete URL construction
 *
 * Regression for "borrar un ciclo lectivo no hace nada": when an institutionId
 * was present, the hook baked it into the URL string BEFORE useApiDelete appended
 * `/${id}`, producing `/academic-cycles?institutionId=XXX/uuid` — a malformed URL
 * where the id lands inside the query string. The tenant guard then rejected it
 * with 403 and the swallowed error made the UI silently do nothing.
 *
 * The id MUST live in the path and institutionId MUST travel as an axios param.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { mockDelete } = vi.hoisted(() => ({ mockDelete: vi.fn() }));

vi.mock('../../api/client', () => ({
  default: { delete: mockDelete },
}));

import { useDeleteAcademicCycle } from '../useAcademicCycles';

describe('useDeleteAcademicCycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDelete.mockResolvedValue({ status: 204 });
  });

  it('puts the id in the path and sends institutionId as an axios param', async () => {
    const { result } = renderHook(() => useDeleteAcademicCycle('inst-9'));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.del('cycle-uuid-1');
    });

    expect(mockDelete).toHaveBeenCalledWith('/academic-cycles/cycle-uuid-1', {
      params: { institutionId: 'inst-9' },
    });
    expect(ok).toBe(true);
  });

  it('without institutionId, deletes by id and sends no params', async () => {
    const { result } = renderHook(() => useDeleteAcademicCycle());

    await act(async () => {
      await result.current.del('cycle-uuid-2');
    });

    expect(mockDelete).toHaveBeenCalledWith('/academic-cycles/cycle-uuid-2', undefined);
  });
});
