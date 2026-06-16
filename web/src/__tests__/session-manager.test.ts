import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sessionManager } from '../api/session-manager';

describe('SessionManager', () => {
  beforeEach(() => {
    // Reset singleton state between tests by calling rejectRelogin if pending
    if (sessionManager.isPending) {
      sessionManager.rejectRelogin(new Error('test cleanup'));
    }
  });

  it('requireRelogin returns a promise', () => {
    const p = sessionManager.requireRelogin();
    p.catch(() => {}); // suppress unhandled rejection from cleanup
    expect(p).toBeInstanceOf(Promise);
    sessionManager.rejectRelogin();
  });

  it('requireRelogin returns the SAME promise on subsequent calls', () => {
    const p1 = sessionManager.requireRelogin();
    const p2 = sessionManager.requireRelogin();
    p1.catch(() => {}); // suppress unhandled rejection from cleanup
    expect(p1).toBe(p2);
    sessionManager.rejectRelogin();
  });

  it('resolveRelogin resolves the promise', async () => {
    const p = sessionManager.requireRelogin();
    sessionManager.resolveRelogin();
    await expect(p).resolves.toBeUndefined();
  });

  it('rejectRelogin rejects the promise', async () => {
    const p = sessionManager.requireRelogin();
    sessionManager.rejectRelogin(new Error('cancelled'));
    await expect(p).rejects.toThrow('cancelled');
  });

  it('isPending is true while pending, false after resolve', async () => {
    expect(sessionManager.isPending).toBe(false);
    sessionManager.requireRelogin();
    expect(sessionManager.isPending).toBe(true);
    sessionManager.resolveRelogin();
    expect(sessionManager.isPending).toBe(false);
  });

  it('dispatches auth:session-expired event when requireRelogin is first called', () => {
    const handler = vi.fn();
    window.addEventListener('auth:session-expired', handler);
    sessionManager.requireRelogin().catch(() => {});
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:session-expired', handler);
    sessionManager.rejectRelogin();
  });

  it('does NOT dispatch a second event for duplicate requireRelogin calls', () => {
    const handler = vi.fn();
    window.addEventListener('auth:session-expired', handler);
    sessionManager.requireRelogin().catch(() => {});
    sessionManager.requireRelogin().catch(() => {}); // same promise
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:session-expired', handler);
    sessionManager.rejectRelogin();
  });

  it('after resolve, a new requireRelogin call creates a new promise', async () => {
    const p1 = sessionManager.requireRelogin();
    sessionManager.resolveRelogin();
    await p1;

    const p2 = sessionManager.requireRelogin();
    p2.catch(() => {}); // suppress unhandled rejection
    expect(p2).not.toBe(p1);
    sessionManager.rejectRelogin();
  });
});
