/**
 * Unit tests for IngresanteController.create() — role-based level enforcement.
 *
 * Covers WARNING-2 from the verify-report: SC-LVL-01..04 at the controller layer.
 * Follows the pattern of competency.controller.spec.ts (Object.create + direct call).
 *
 * Scenarios:
 *   SC-LVL-01 ROOT       → allLevels=true  → body.level passes through unchanged
 *   SC-LVL-02 ADMIN      → allLevels=true  → body.level passes through unchanged
 *   SC-LVL-04a DIRECTOR  → allLevels=false → body.level overridden with compositeLevels[0]
 *   SC-LVL-04b SECRETARIO → allLevels=false → body.level overridden with compositeLevels[0]
 *   SC-LVL-err empty compositeLevels → BadRequestException thrown before use-case call
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ok } from '@educandow/domain';
import { IngresanteController } from '../ingresante.controller';

// TenantContext is imported at the module level by ingresante.controller (used in promote()).
// Mock it so the controller module loads cleanly in unit-test context.
vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn().mockReturnValue(null),
    getInstitutionId: vi.fn().mockReturnValue(null),
  },
}));

// ---------------------------------------------------------------------------
// Minimal Ingresante-like shape for toDto() inside the controller
// ---------------------------------------------------------------------------
function makeFakeIngresante() {
  return {
    id: { get: () => 'ing-1' },
    firstName: 'Juan',
    lastName: 'Pérez',
    dni: '12345678',
    birthDate: null,
    address: null,
    phone: null,
    email: null,
    cycleId: null,
    level: { toString: () => 'PRIMARIO', modalityCode: 0 },
    status: { value: 'INSCRIPTO' },
  };
}

// ---------------------------------------------------------------------------
// Controller builder — bypasses NestJS DI, injects only what create() needs
// ---------------------------------------------------------------------------
function buildController(mockCreateUC: { execute: ReturnType<typeof vi.fn> }) {
  const ctrl = Object.create(IngresanteController.prototype) as IngresanteController;
  const mocks = ctrl as unknown as Record<string, unknown>;
  mocks['createUC'] = mockCreateUC;
  mocks['updateStatusUC'] = { execute: vi.fn() };
  mocks['listUC'] = { execute: vi.fn() };
  mocks['promoteUC'] = { execute: vi.fn() };
  return ctrl;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const BASE_BODY = {
  firstName: 'Juan',
  lastName: 'Pérez',
  dni: '12345678',
  level: 'SECUNDARIO', // arbitrary starting value — some tests will verify it's preserved, others that it's replaced
  cycleId: '550e8400-e29b-41d4-a716-446655440000',
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe('IngresanteController — create() role-based level enforcement', () => {
  let mockCreateUC: { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateUC = { execute: vi.fn().mockResolvedValue(ok(makeFakeIngresante())) };
  });

  // ── SC-LVL-01: ROOT — allLevels path — body.level untouched ────────────────

  it('SC-LVL-01: ROOT user — body.level passes through unchanged to use-case', async () => {
    const ctrl = buildController(mockCreateUC);
    const user = { userId: 'root-1', roles: ['ROOT'], levels: [] };
    const body = { ...BASE_BODY, level: 'SECUNDARIO' };

    await ctrl.create(body as any, user as any);

    expect(mockCreateUC.execute).toHaveBeenCalledOnce();
    expect(mockCreateUC.execute).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'SECUNDARIO' }),
    );
  });

  // ── SC-LVL-02: ADMIN — allLevels path — body.level untouched ───────────────

  it('SC-LVL-02: ADMIN user — body.level passes through unchanged to use-case', async () => {
    const ctrl = buildController(mockCreateUC);
    const user = { userId: 'admin-1', roles: ['ADMIN'], levels: [] };
    const body = { ...BASE_BODY, level: 'PRIMARIO' };

    await ctrl.create(body as any, user as any);

    expect(mockCreateUC.execute).toHaveBeenCalledOnce();
    expect(mockCreateUC.execute).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'PRIMARIO' }),
    );
  });

  // ── SC-LVL-04a: DIRECTOR — composite level overrides body.level ─────────────

  it('SC-LVL-04a: DIRECTOR user — body.level overridden with Level.reconstruct(compositeLevels[0]).toString()', async () => {
    const ctrl = buildController(mockCreateUC);
    // levels[0] = 20 → LevelType.PRIMARIO → Level.reconstruct(20).toString() === 'PRIMARIO'
    const user = { userId: 'dir-1', roles: ['DIRECTOR'], levels: [20] };
    const body = { ...BASE_BODY, level: 'INICIAL' }; // intentionally different — controller must override

    await ctrl.create(body as any, user as any);

    expect(mockCreateUC.execute).toHaveBeenCalledOnce();
    expect(mockCreateUC.execute).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'PRIMARIO' }), // LevelType[20] === 'PRIMARIO'
    );
  });

  // ── SC-LVL-04b: SECRETARIO — composite level overrides body.level ───────────

  it('SC-LVL-04b: SECRETARIO user — body.level overridden with Level.reconstruct(compositeLevels[0]).toString()', async () => {
    const ctrl = buildController(mockCreateUC);
    // levels[0] = 30 → LevelType.SECUNDARIO → Level.reconstruct(30).toString() === 'SECUNDARIO'
    const user = { userId: 'sec-1', roles: ['SECRETARIO'], levels: [30] };
    const body = { ...BASE_BODY, level: 'PRIMARIO' }; // intentionally different — controller must override

    await ctrl.create(body as any, user as any);

    expect(mockCreateUC.execute).toHaveBeenCalledOnce();
    expect(mockCreateUC.execute).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'SECUNDARIO' }), // LevelType[30] === 'SECUNDARIO'
    );
  });

  // ── SC-LVL-err: empty compositeLevels → BadRequestException — UC never called

  it('SC-LVL-err: user with empty compositeLevels throws BadRequestException before calling use-case', async () => {
    const ctrl = buildController(mockCreateUC);
    const user = { userId: 'dir-2', roles: ['DIRECTOR'], levels: [] }; // no assigned levels

    await expect(ctrl.create(BASE_BODY as any, user as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(mockCreateUC.execute).not.toHaveBeenCalled();
  });
});
