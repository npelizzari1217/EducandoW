import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock dependencies
const mockAuth = {
  accessToken: 'token123' as string | null,
  user: { id: 'u1', email: 'a@b.com', name: 'A', role: 'ADMIN' } as object | null,
  sessionStatus: 'active' as 'active' | 'expired',
};

const mockConfig = { session_timeout_minutes: 20 as number | undefined };

vi.mock('../../context/auth-context', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../../context/institution-context', () => ({
  useInstitution: () => ({ config: mockConfig }),
}));

const mockRemoveToken = vi.fn();
vi.mock('../../api/token', () => ({
  removeToken: () => mockRemoveToken(),
}));

const mockRequireRelogin = vi.fn(() => Promise.resolve());
vi.mock('../../api/session-manager', () => ({
  sessionManager: { requireRelogin: () => mockRequireRelogin() },
}));

import { useIdleTimer } from '../use-idle-timer';

describe('useIdleTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockAuth.accessToken = 'token123';
    mockAuth.user = { id: 'u1', email: 'a@b.com', name: 'A', role: 'ADMIN' };
    mockAuth.sessionStatus = 'active';
    mockConfig.session_timeout_minutes = 20;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires after the configured timeout', () => {
    renderHook(() => useIdleTimer());

    vi.advanceTimersByTime(20 * 60 * 1000);

    expect(mockRemoveToken).toHaveBeenCalledTimes(1);
    expect(mockRequireRelogin).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire if user is active before timeout', () => {
    renderHook(() => useIdleTimer());

    // Simulate activity at 10 min
    vi.advanceTimersByTime(10 * 60 * 1000);
    act(() => { window.dispatchEvent(new MouseEvent('mousemove')); });

    // Advance another 19 min (total 29 min from start, 19 min from last activity)
    vi.advanceTimersByTime(19 * 60 * 1000);

    expect(mockRemoveToken).not.toHaveBeenCalled();
  });

  it('fires after inactivity period post-reset', () => {
    renderHook(() => useIdleTimer());

    // Activity at 10 min → resets timer
    vi.advanceTimersByTime(10 * 60 * 1000);
    act(() => { window.dispatchEvent(new MouseEvent('click')); });

    // Full timeout after last activity
    vi.advanceTimersByTime(20 * 60 * 1000 + 1000);

    expect(mockRemoveToken).toHaveBeenCalledTimes(1);
  });

  it('does nothing when session is not active', () => {
    mockAuth.sessionStatus = 'expired';
    renderHook(() => useIdleTimer());

    vi.advanceTimersByTime(30 * 60 * 1000);

    expect(mockRemoveToken).not.toHaveBeenCalled();
  });

  it('does nothing when no accessToken', () => {
    mockAuth.accessToken = null;
    renderHook(() => useIdleTimer());

    vi.advanceTimersByTime(30 * 60 * 1000);

    expect(mockRemoveToken).not.toHaveBeenCalled();
  });

  it('uses default 20-min timeout when session_timeout_minutes is undefined', () => {
    mockConfig.session_timeout_minutes = undefined;
    renderHook(() => useIdleTimer());

    vi.advanceTimersByTime(20 * 60 * 1000);

    expect(mockRemoveToken).toHaveBeenCalledTimes(1);
  });

  it('cleans up timer and listeners on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { unmount } = renderHook(() => useIdleTimer());
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
