/**
 * T2.7.1 — EnsureAttendanceTypesForLevelUseCase tests (RED → GREEN).
 * Uses a mock PrismaService (getTenantClient).
 *
 * REQ-9: exactly 4 codes (SAB, DOM, P, X) per pedagogical level.
 * REQ-11: idempotent — re-running the same level does not duplicate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnsureAttendanceTypesForLevelUseCase } from '../use-cases/ensure-attendance-types-for-level.use-case';
import { EducationalLevelCode, AttendanceBehaviorValue } from '@educandow/domain';

// ── Mock PrismaService ────────────────────────────────────────

function makeUpsert() {
  return vi.fn().mockResolvedValue({});
}

function makeTenantClient() {
  return {
    attendanceType: {
      upsert: makeUpsert(),
    },
  };
}

function makePrismaService(tenantClient = makeTenantClient()) {
  return {
    getTenantClient: vi.fn().mockReturnValue(tenantClient),
  };
}

// ─────────────────────────────────────────────────────────────

describe('EnsureAttendanceTypesForLevelUseCase', () => {
  let prismaService: ReturnType<typeof makePrismaService>;
  let upsertFn: ReturnType<typeof vi.fn>;
  let useCase: EnsureAttendanceTypesForLevelUseCase;

  beforeEach(() => {
    upsertFn = makeUpsert();
    const tenantClient = { attendanceType: { upsert: upsertFn } };
    prismaService = makePrismaService(tenantClient as any);
    useCase = new EnsureAttendanceTypesForLevelUseCase(prismaService as any);
  });

  it('creates exactly 4 system types for a single pedagogical level', async () => {
    await useCase.ensure('educandow_test', [EducationalLevelCode.SECUNDARIO]);

    expect(upsertFn).toHaveBeenCalledTimes(4);
  });

  it('creates 8 records for two distinct levels (PRIMARIO + SECUNDARIO)', async () => {
    await useCase.ensure('educandow_test', [
      EducationalLevelCode.PRIMARIO,
      EducationalLevelCode.SECUNDARIO,
    ]);

    expect(upsertFn).toHaveBeenCalledTimes(8);
  });

  it('uses upsert with update:{} (idempotent — does not overwrite existing values)', async () => {
    await useCase.ensure('educandow_test', [EducationalLevelCode.PRIMARIO]);

    const calls = upsertFn.mock.calls;
    for (const [arg] of calls) {
      expect(arg.update).toEqual({});
    }
  });

  it('ignores ADMINISTRACION (level=9) — creates 0 records for it', async () => {
    await useCase.ensure('educandow_test', [EducationalLevelCode.ADMINISTRACION]);

    expect(upsertFn).not.toHaveBeenCalled();
  });

  it('creates only 4 records when ADMINISTRACION is mixed with SECUNDARIO', async () => {
    await useCase.ensure('educandow_test', [
      EducationalLevelCode.ADMINISTRACION,
      EducationalLevelCode.SECUNDARIO,
    ]);

    expect(upsertFn).toHaveBeenCalledTimes(4);
  });

  it('upserts with exact values: SAB code, assignable=false, absenceValue=0, isSystem=true', async () => {
    await useCase.ensure('educandow_test', [EducationalLevelCode.PRIMARIO]);

    const calls = upsertFn.mock.calls;
    const sabCall = calls.find(([arg]) => arg.create?.code === 'SAB');
    expect(sabCall).toBeDefined();
    const create = sabCall![0].create;
    expect(create.description).toBe('Sábado');
    expect(create.assignable).toBe(false);
    expect(create.absenceValue).toBe(0);
    expect(create.isSystem).toBe(true);
    expect(create.active).toBe(true);
    expect(create.level).toBe(EducationalLevelCode.PRIMARIO);
    expect(create.behavior).toBe(AttendanceBehaviorValue.NO_ELEGIBLE);
  });

  it('upserts with exact values: DOM code — Domingo', async () => {
    await useCase.ensure('educandow_test', [EducationalLevelCode.PRIMARIO]);
    const calls = upsertFn.mock.calls;
    const domCall = calls.find(([arg]) => arg.create?.code === 'DOM');
    expect(domCall).toBeDefined();
    const create = domCall![0].create;
    expect(create.description).toBe('Domingo');
    expect(create.assignable).toBe(false);
    expect(create.absenceValue).toBe(0);
    expect(create.isSystem).toBe(true);
    expect(create.active).toBe(true);
    expect(create.behavior).toBe(AttendanceBehaviorValue.NO_ELEGIBLE);
  });

  it('upserts with exact values: P — Presente, assignable=true', async () => {
    await useCase.ensure('educandow_test', [EducationalLevelCode.PRIMARIO]);
    const calls = upsertFn.mock.calls;
    const pCall = calls.find(([arg]) => arg.create?.code === 'P');
    expect(pCall).toBeDefined();
    const create = pCall![0].create;
    expect(create.description).toBe('Presente');
    expect(create.assignable).toBe(true);
    expect(create.absenceValue).toBe(0);
    expect(create.isSystem).toBe(true);
    expect(create.active).toBe(true);
    expect(create.behavior).toBe(AttendanceBehaviorValue.NO_COMPUTA);
  });

  it('upserts with exact values: X — Día no utilizado, assignable=false', async () => {
    await useCase.ensure('educandow_test', [EducationalLevelCode.PRIMARIO]);
    const calls = upsertFn.mock.calls;
    const xCall = calls.find(([arg]) => arg.create?.code === 'X');
    expect(xCall).toBeDefined();
    const create = xCall![0].create;
    expect(create.description).toBe('Día no utilizado');
    expect(create.assignable).toBe(false);
    expect(create.absenceValue).toBe(0);
    expect(create.isSystem).toBe(true);
    expect(create.active).toBe(true);
    expect(create.behavior).toBe(AttendanceBehaviorValue.NO_ELEGIBLE);
  });

  it('is idempotent: running twice calls upsert twice (idempotency guaranteed by upsert, not by skipping)', async () => {
    await useCase.ensure('educandow_test', [EducationalLevelCode.SECUNDARIO]);
    await useCase.ensure('educandow_test', [EducationalLevelCode.SECUNDARIO]);

    // 4 types × 2 runs = 8 upsert calls (each is idempotent at DB level via @@unique)
    expect(upsertFn).toHaveBeenCalledTimes(8);
  });

  it('uses where with level_code composite unique key', async () => {
    await useCase.ensure('educandow_test', [EducationalLevelCode.SECUNDARIO]);
    const calls = upsertFn.mock.calls;
    for (const [arg] of calls) {
      expect(arg.where).toHaveProperty('level_code');
      const levelCode = arg.where.level_code;
      expect(levelCode.level).toBe(EducationalLevelCode.SECUNDARIO);
      expect(typeof levelCode.code).toBe('string');
    }
  });

  it('uses PrismaService.getTenantClient with the dbName (not TenantContext)', async () => {
    await useCase.ensure('educandow_abc123', [EducationalLevelCode.PRIMARIO]);
    expect(prismaService.getTenantClient).toHaveBeenCalledWith('educandow_abc123');
  });
});
