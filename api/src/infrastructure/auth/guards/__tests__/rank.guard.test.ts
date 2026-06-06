import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { RankGuard } from '../rank.guard';
import type { ExecutionContext } from '@nestjs/common';

function createMockContext(
  handlerRef: object,
  user: { roles?: string[] } | null,
): ExecutionContext {
  return {
    getHandler: () => handlerRef,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RankGuard', () => {
  let guard: RankGuard;
  let reflector: Pick<Reflector, 'get'>;

  const handler = {};

  beforeEach(() => {
    reflector = {
      get: vi.fn(),
    };
    guard = new RankGuard(reflector as Reflector);
  });

  // ── Scenario 1: TEACHER (rank 20) passes guard for minimum rank 20 ───────────

  it('passes for TEACHER user (rank 20) when required rank is 20', () => {
    // GIVEN a TEACHER user (rank 20) sending POST /v1/student-observations
    // WHEN the rank guard evaluates the request
    (reflector.get as any).mockReturnValue(20);
    const ctx = createMockContext(handler, { roles: ['TEACHER'] });

    // THEN the guard passes
    const result = guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  // ── Scenario 2: PRECEPTOR (rank 30) passes for minimum rank 20 ───────────────

  it('passes for PRECEPTOR user (rank 30) when required rank is 20', () => {
    // GIVEN a PRECEPTOR user (rank 30) — rank 30 >= minimum 20
    (reflector.get as any).mockReturnValue(20);
    const ctx = createMockContext(handler, { roles: ['PRECEPTOR'] });

    // THEN the guard passes
    const result = guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  // ── Scenario 3: TUTOR (rank 10) receives 403 ─────────────────────────────────

  it('blocks TUTOR user (rank 10) when required rank is 20', () => {
    // GIVEN a TUTOR user (rank 10)
    // WHEN calling any observation endpoint with @Rank(20)
    (reflector.get as any).mockReturnValue(20);
    const ctx = createMockContext(handler, { roles: ['TUTOR'] });

    // THEN the guard returns false (403 Forbidden)
    const result = guard.canActivate(ctx);
    expect(result).toBe(false);
  });

  // ── STUDENT (rank 0) is also rejected ────────────────────────────────────────

  it('blocks STUDENT user (rank 0) when required rank is 20', () => {
    (reflector.get as any).mockReturnValue(20);
    const ctx = createMockContext(handler, { roles: ['STUDENT'] });

    const result = guard.canActivate(ctx);
    expect(result).toBe(false);
  });

  // ── ROOT bypasses rank check ──────────────────────────────────────────────────

  it('allows ROOT user regardless of required rank', () => {
    (reflector.get as any).mockReturnValue(99);
    const ctx = createMockContext(handler, { roles: ['ROOT'] });

    const result = guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  // ── No @Rank decorator → pass through ────────────────────────────────────────

  it('passes when no @Rank decorator is present (no metadata)', () => {
    (reflector.get as any).mockReturnValue(undefined);
    const ctx = createMockContext(handler, { roles: ['TEACHER'] });

    const result = guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  // ── No user on request → rejected ────────────────────────────────────────────

  it('blocks when user is null on the request', () => {
    (reflector.get as any).mockReturnValue(20);
    const ctx = createMockContext(handler, null);

    const result = guard.canActivate(ctx);
    expect(result).toBe(false);
  });

  // ── User with empty roles array → rejected ────────────────────────────────────

  it('blocks when user has empty roles array', () => {
    (reflector.get as any).mockReturnValue(20);
    const ctx = createMockContext(handler, { roles: [] });

    const result = guard.canActivate(ctx);
    expect(result).toBe(false);
  });

  // ── DIRECTOR (rank 50) passes for rank 20 ────────────────────────────────────

  it('passes for DIRECTOR user (rank 50) when required rank is 20', () => {
    (reflector.get as any).mockReturnValue(20);
    const ctx = createMockContext(handler, { roles: ['DIRECTOR'] });

    const result = guard.canActivate(ctx);
    expect(result).toBe(true);
  });
});
