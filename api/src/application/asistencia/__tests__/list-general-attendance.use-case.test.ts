/**
 * ListGeneralAttendanceUseCase — unit tests (TDD RED, T-16).
 *
 * Covers:
 *   LGA-T01: D3 user returns all rows for CC+month
 *   LGA-T02: preceptor (Door 2) returns rows
 *   LGA-T03: non-preceptor TEACHER → ForbiddenError
 *   LGA-T04: empty result (month not generated) → returns []
 *
 * Pattern: mocked repos + TenantContext, no NestJS, no DB.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { ForbiddenError } from '@educandow/domain';
import { DayMap, AsistenciaXAlumnoXCursoXCiclo, Id } from '@educandow/domain';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: { getClient: vi.fn() },
}));

import { TenantContext } from '../../../infrastructure/auth/tenant.context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ListGeneralAttendanceUseCase: any;
beforeAll(async () => {
  const mod = await import('../list-general-attendance.use-case');
  ListGeneralAttendanceUseCase = mod.ListGeneralAttendanceUseCase;
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CC_ID = 'cc-1';
const YEAR = 2026;
const MONTH = 6;

function makeRows(count: number): AsistenciaXAlumnoXCursoXCiclo[] {
  return Array.from({ length: count }, (_, i) =>
    AsistenciaXAlumnoXCursoXCiclo.reconstruct({
      id: Id.reconstruct(`row-${i}`),
      courseCycleId: CC_ID,
      studentId: `stu-${i}`,
      year: YEAR,
      month: MONTH,
      days: DayMap.empty(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
}

// ── Factory ───────────────────────────────────────────────────────────────────

function makeUC({
  rows = makeRows(2),
  ccCycleId = 'cycle-1',
  docenteExists = true,
  isPreceptor = true,
}: {
  rows?: AsistenciaXAlumnoXCursoXCiclo[];
  ccCycleId?: string;
  docenteExists?: boolean;
  isPreceptor?: boolean;
} = {}) {
  const mockClient = {
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue({ cycleId: ccCycleId }),
    },
  };
  vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as never);

  const generalRepo = {
    findByScopeAndMonth: vi.fn().mockResolvedValue(rows),
  };
  const docenteRepo = {
    findByUserAndCycle: vi.fn().mockResolvedValue(
      docenteExists ? { id: 'dxc-1', userId: 'u1', cycleId: ccCycleId } : null,
    ),
  };
  const asignacionRepo = {
    isPreceptor: vi.fn().mockResolvedValue(isPreceptor),
  };

  const uc = Object.create(ListGeneralAttendanceUseCase.prototype);
  uc.generalRepo = generalRepo;
  uc.docenteRepo = docenteRepo;
  uc.asignacionRepo = asignacionRepo;

  return { uc, generalRepo, docenteRepo, asignacionRepo };
}

const baseInput = { courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ListGeneralAttendanceUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('LGA-T01: D3 user returns all rows', () => {
    it('SECRETARIO gets all rows without Door 2 check', async () => {
      const { uc, generalRepo, asignacionRepo } = makeUC({ rows: makeRows(3) });
      const result = await uc.execute({ ...baseInput, userRoles: ['SECRETARIO'] });
      expect(result).toHaveLength(3);
      expect(generalRepo.findByScopeAndMonth).toHaveBeenCalledWith(CC_ID, YEAR, MONTH, undefined);
      expect(asignacionRepo.isPreceptor).not.toHaveBeenCalled();
    });
  });

  describe('LGA-T02: preceptor (Door 2) returns rows', () => {
    it('preceptor can list general attendance for their CC', async () => {
      const { uc, generalRepo } = makeUC({ isPreceptor: true });
      const result = await uc.execute({ ...baseInput, userRoles: ['TEACHER'] });
      expect(result).toHaveLength(2);
      expect(generalRepo.findByScopeAndMonth).toHaveBeenCalledOnce();
    });
  });

  describe('LGA-T03: non-preceptor TEACHER → ForbiddenError', () => {
    it('throws ForbiddenError when teacher is not a preceptor', async () => {
      const { uc } = makeUC({ isPreceptor: false });
      await expect(
        uc.execute({ ...baseInput, userRoles: ['TEACHER'] }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe('LGA-T04: empty result', () => {
    it('returns empty array when month not generated (no error)', async () => {
      const { uc } = makeUC({ rows: [] });
      const result = await uc.execute({ ...baseInput, userRoles: ['ADMIN'] });
      expect(result).toEqual([]);
    });
  });
});
