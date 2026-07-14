/**
 * useApiDelete — error surfacing
 *
 * Previously `del` swallowed failures with `catch { return false }`, leaving the
 * UI with no way to tell the user WHY a delete failed (it just "did nothing").
 * It must expose `deleteError` like useApiCreate/useApiUpdate do, and clear it
 * at the start of each attempt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { mockDelete } = vi.hoisted(() => ({ mockDelete: vi.fn() }));

vi.mock('../../api/client', () => ({
  default: { delete: mockDelete },
}));

import { useApiDelete } from '../use-api';

describe('useApiDelete error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the server error message instead of swallowing it', async () => {
    mockDelete.mockRejectedValue({
      response: { data: { error: { message: 'No se puede borrar: tiene datos asociados' } } },
    });

    const { result } = renderHook(() => useApiDelete('/things'));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.del('id-1');
    });

    expect(ok).toBe(false);
    expect(result.current.deleteError).toBe('No se puede borrar: tiene datos asociados');
  });

  it('clears a previous error when a later delete succeeds', async () => {
    mockDelete.mockRejectedValueOnce({ response: { data: { error: { message: 'boom' } } } });
    const { result } = renderHook(() => useApiDelete('/things'));

    await act(async () => {
      await result.current.del('id-1');
    });
    expect(result.current.deleteError).toBe('boom');

    mockDelete.mockResolvedValueOnce({ status: 204 });
    await act(async () => {
      await result.current.del('id-2');
    });
    expect(result.current.deleteError).toBe('');
  });
});
