import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { LevelsGuard } from '../levels.guard';
import type { ExecutionContext } from '@nestjs/common';

function createMockContext(
  handlerRef: object,
  classRef: object,
  user: { roles?: string[]; levels?: number[] } | null,
): ExecutionContext {
  return {
    getHandler: () => handlerRef,
    getClass: () => classRef,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('LevelsGuard', () => {
  let guard: LevelsGuard;
  let reflector: Pick<Reflector, 'getAllAndOverride'>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn(),
    };
    guard = new LevelsGuard(reflector as Reflector);
  });

  // Handler and class references are just sentinel objects for Reflector
  const handler = {};
  const cls = {};

  // ── Scenario 1: Matching level grants access ────────────────
  it('should return true when user has a matching level', () => {
    // GIVEN a user with levels: [10] (INICIAL)
    // AND the guard requires INICIAL (base code 1)
    (reflector.getAllAndOverride as any).mockReturnValue([1]);
    const ctx = createMockContext(handler, cls, {
      roles: ['TEACHER'],
      levels: [10],
    });

    // WHEN canActivate is called
    const result = guard.canActivate(ctx);

    // THEN the guard passes
    expect(result).toBe(true);
  });

  // ── Scenario 2: Non-matching level is rejected ──────────────
  it('should return false when user level does not match required level', () => {
    // GIVEN a user with levels: [20] (PRIMARIO only)
    // AND the guard requires INICIAL (base code 1)
    (reflector.getAllAndOverride as any).mockReturnValue([1]);
    const ctx = createMockContext(handler, cls, {
      roles: ['TEACHER'],
      levels: [20],
    });

    // WHEN canActivate is called
    const result = guard.canActivate(ctx);

    // THEN the guard rejects
    expect(result).toBe(false);
  });

  // ── Scenario 3: User with multiple levels, none match ───────
  it('should return false when user has multiple levels but none match', () => {
    // GIVEN a user with levels: [10, 20] (INICIAL + PRIMARIO)
    // AND the guard requires SECUNDARIO (base code 3)
    (reflector.getAllAndOverride as any).mockReturnValue([3]);
    const ctx = createMockContext(handler, cls, {
      roles: ['TEACHER'],
      levels: [10, 20],
    });

    // WHEN canActivate is called
    const result = guard.canActivate(ctx);

    // THEN the guard rejects
    expect(result).toBe(false);
  });

  // ── Scenario 4: ROOT bypasses level check ───────────────────
  it('should return true for ROOT users regardless of levels', () => {
    // GIVEN a ROOT user
    // AND the guard requires SECUNDARIO (base code 3)
    (reflector.getAllAndOverride as any).mockReturnValue([3]);
    const ctx = createMockContext(handler, cls, {
      roles: ['ROOT'],
      levels: [], // ROOT may not even have levels
    });

    // WHEN canActivate is called
    const result = guard.canActivate(ctx);

    // THEN the guard passes regardless
    expect(result).toBe(true);
  });

  // ── Scenario 4b: ADMIN bypasses level check ────────────────
  it('should return true for ADMIN users regardless of levels', () => {
    // GIVEN an ADMIN user without any levels assigned
    // AND the guard requires SECUNDARIO (base code 3)
    (reflector.getAllAndOverride as any).mockReturnValue([3]);
    const ctx = createMockContext(handler, cls, {
      roles: ['ADMIN'],
      levels: [], // ADMIN may not have levels (allLevels=true per access model)
    });

    // WHEN canActivate is called
    const result = guard.canActivate(ctx);

    // THEN the guard passes regardless (Puerta 2: ADMIN sees all levels)
    expect(result).toBe(true);
  });

  // ── Scenario 4c: DIRECTOR with correct level passes ─────────
  it('should return true for DIRECTOR with matching level', () => {
    // GIVEN a DIRECTOR with composite level 30 (SECUNDARIO+COMUN)
    // AND the guard requires SECUNDARIO (base code 3)
    (reflector.getAllAndOverride as any).mockReturnValue([3]);
    const ctx = createMockContext(handler, cls, {
      roles: ['DIRECTOR'],
      levels: [30],
    });

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  // ── Scenario 4d: DIRECTOR with wrong level is blocked ───────
  it('should return false for DIRECTOR with non-matching level', () => {
    // GIVEN a DIRECTOR with composite level 10 (INICIAL+COMUN)
    // AND the guard requires SECUNDARIO (base code 3)
    (reflector.getAllAndOverride as any).mockReturnValue([3]);
    const ctx = createMockContext(handler, cls, {
      roles: ['DIRECTOR'],
      levels: [10],
    });

    const result = guard.canActivate(ctx);

    expect(result).toBe(false);
  });

  // ── Scenario 4e: SECRETARIO with correct level passes ───────
  it('should return true for SECRETARIO with matching level', () => {
    // GIVEN a SECRETARIO with composite levels [20, 30]
    // AND the guard requires PRIMARIO (base code 2)
    (reflector.getAllAndOverride as any).mockReturnValue([2]);
    const ctx = createMockContext(handler, cls, {
      roles: ['SECRETARIO'],
      levels: [20, 30],
    });

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  // ── Scenario 4f: SECRETARIO with wrong level is blocked ─────
  it('should return false for SECRETARIO with non-matching level', () => {
    // GIVEN a SECRETARIO with composite level 20 (PRIMARIO only)
    // AND the guard requires INICIAL (base code 1)
    (reflector.getAllAndOverride as any).mockReturnValue([1]);
    const ctx = createMockContext(handler, cls, {
      roles: ['SECRETARIO'],
      levels: [20],
    });

    const result = guard.canActivate(ctx);

    expect(result).toBe(false);
  });

  // ── Scenario 5: No @Levels decorator → pass through ────────
  it('should return true when no @Levels metadata is present', () => {
    // GIVEN a controller with NO @Levels() decorator
    (reflector.getAllAndOverride as any).mockReturnValue(undefined);
    const ctx = createMockContext(handler, cls, {
      roles: ['TEACHER'],
      levels: [10],
    });

    // WHEN canActivate is called
    const result = guard.canActivate(ctx);

    // THEN the guard passes through (default: true)
    expect(result).toBe(true);
  });

  // Also test empty array metadata (same behavior as undefined)
  it('should return true when @Levels metadata is an empty array', () => {
    (reflector.getAllAndOverride as any).mockReturnValue([]);
    const ctx = createMockContext(handler, cls, {
      roles: ['TEACHER'],
      levels: [10],
    });

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  // ── Scenario 6: User with no levels is rejected ─────────────
  it('should return false when user has no levels assigned', () => {
    // GIVEN a user with levels: []
    // AND the guard requires INICIAL (base code 1)
    (reflector.getAllAndOverride as any).mockReturnValue([1]);
    const ctx = createMockContext(handler, cls, {
      roles: ['TEACHER'],
      levels: [],
    });

    // WHEN canActivate is called
    const result = guard.canActivate(ctx);

    // THEN the guard rejects
    expect(result).toBe(false);
  });

  // ── Edge: missing user object on request ────────────────────
  it('should return true when user is null (no authenticated user)', () => {
    (reflector.getAllAndOverride as any).mockReturnValue([1]);
    const ctx = createMockContext(handler, cls, null);

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  // ── Edge: user with no roles array (should still work) ──────
  it('should work when user has no roles array', () => {
    (reflector.getAllAndOverride as any).mockReturnValue([1]);
    const ctx = createMockContext(handler, cls, {
      levels: [10],
    } as any);

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });
});
