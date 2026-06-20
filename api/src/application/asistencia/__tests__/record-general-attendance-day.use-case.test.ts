/**
 * RecordGeneralAttendanceDayUseCase — unit tests (TDD RED, T-12).
 *
 * Covers (R-48):
 *   RGA-T01: happy path — valid day + valid statusCode → row updated
 *   RGA-T02: register row not found → NotFoundError (ADR-4)
 *   RGA-T03: day out of range (> daysInMonth) → ValidationError
 *   RGA-T04: day < 1 → ValidationError
 *   RGA-T05: invalid statusCode (not in AttendanceType catalog) → ValidationError
 *   RGA-T06: D3 (SECRETARIO) bypasses Door 2 preceptor check
 *   RGA-T07: non-preceptor TEACHER → ForbiddenError
 *
 * Pattern: mocked repos + TenantContext, no NestJS, no DB.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { ForbiddenError, NotFoundError, ValidationError } from '@educandow/domain';
import { DayMap, AsistenciaXAlumnoXCursoXCiclo, Id, AttendanceTypeCode } from '@educandow/domain';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: { getClient: vi.fn() },
}));

import { TenantContext } from '../../../infrastructure/auth/tenant.context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let RecordGeneralAttendanceDayUseCase: any;
beforeAll(async () => {
  const mod = await import('../record-general-attendance-day.use-case');
  RecordGeneralAttendanceDayUseCase = mod.RecordGeneralAttendanceDayUseCase;
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CC_ID = 'cc-1';
const STUDENT_ID = 'stu-1';
const YEAR = 2026;
const MONTH = 6; // June = 30 days

function makeRow(): AsistenciaXAlumnoXCursoXCiclo {
  return AsistenciaXAlumnoXCursoXCiclo.reconstruct({
    id: Id.reconstruct('row-1'),
    courseCycleId: CC_ID,
    studentId: STUDENT_ID,
    year: YEAR,
    month: MONTH,
    days: DayMap.empty(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

const validAttendanceTypes = [
  { id: 'at-1', code: AttendanceTypeCode.reconstruct('P'), level: 1, active: true },
  { id: 'at-2', code: AttendanceTypeCode.reconstruct('A'), level: 1, active: true },
];

// ── Factory ───────────────────────────────────────────────────────────────────

function makeUC({
  row = makeRow(),
  attendanceTypes = validAttendanceTypes,
  ccCycleId = 'cycle-1',
  docenteId = 'dxc-1',
  docenteExists = true,
  isPreceptor = true,
}: {
  row?: AsistenciaXAlumnoXCursoXCiclo | null;
  attendanceTypes?: typeof validAttendanceTypes;
  ccCycleId?: string;
  docenteId?: string;
  docenteExists?: boolean;
  isPreceptor?: boolean;
} = {}) {
  const mockClient = {
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue(ccCycleId ? { cycleId: ccCycleId } : null),
    },
  };
  vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as never);

  const generalRepo = {
    findOne: vi.fn().mockResolvedValue(row),
    setDay: vi.fn().mockResolvedValue(row), // returns the (mocked) updated row
  };
  const attendanceTypeRepo = {
    list: vi.fn().mockResolvedValue(attendanceTypes),
  };
  const docenteRepo = {
    findByUserAndCycle: vi.fn().mockResolvedValue(
      docenteExists ? { id: docenteId, userId: 'u1', cycleId: ccCycleId } : null,
    ),
  };
  const asignacionRepo = {
    isPreceptor: vi.fn().mockResolvedValue(isPreceptor),
  };

  const uc = Object.create(RecordGeneralAttendanceDayUseCase.prototype);
  uc.generalRepo = generalRepo;
  uc.attendanceTypeRepo = attendanceTypeRepo;
  uc.docenteRepo = docenteRepo;
  uc.asignacionRepo = asignacionRepo;

  return { uc, generalRepo, attendanceTypeRepo, docenteRepo, asignacionRepo, mockClient };
}

const baseInput = {
  courseCycleId: CC_ID,
  studentId: STUDENT_ID,
  year: YEAR,
  month: MONTH,
  day: 15,
  statusCode: 'P',
  userId: 'u1',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RecordGeneralAttendanceDayUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RGA-T01: happy path', () => {
    it('calls setDay with correct args and returns updated row for D3 user', async () => {
      const { uc, generalRepo } = makeUC();

      const result = await uc.execute({ ...baseInput, userRoles: ['SECRETARIO'] });

      expect(generalRepo.findOne).toHaveBeenCalledWith(CC_ID, STUDENT_ID, YEAR, MONTH);
      expect(generalRepo.setDay).toHaveBeenCalledWith('row-1', 15, 'P');
      expect(result).toBeDefined();
    });
  });

  describe('RGA-T02: register not found → NotFoundError', () => {
    it('throws NotFoundError when row does not exist (month not generated)', async () => {
      const { uc } = makeUC({ row: null });

      await expect(
        uc.execute({ ...baseInput, userRoles: ['SECRETARIO'] }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('does not call setDay when row is not found', async () => {
      const { uc, generalRepo } = makeUC({ row: null });
      try { await uc.execute({ ...baseInput, userRoles: ['SECRETARIO'] }); } catch { /* expected */ }
      expect(generalRepo.setDay).not.toHaveBeenCalled();
    });
  });

  describe('RGA-T03/T04: day out of range → ValidationError', () => {
    it('throws ValidationError when day > daysInMonth (June has 30 days)', async () => {
      const { uc } = makeUC();
      await expect(
        uc.execute({ ...baseInput, day: 31, userRoles: ['SECRETARIO'] }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when day = 0', async () => {
      const { uc } = makeUC();
      await expect(
        uc.execute({ ...baseInput, day: 0, userRoles: ['SECRETARIO'] }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when day is negative', async () => {
      const { uc } = makeUC();
      await expect(
        uc.execute({ ...baseInput, day: -1, userRoles: ['SECRETARIO'] }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('accepts day = 30 (last day of June)', async () => {
      const { uc, generalRepo } = makeUC();
      await expect(
        uc.execute({ ...baseInput, day: 30, userRoles: ['SECRETARIO'] }),
      ).resolves.toBeDefined();
      expect(generalRepo.setDay).toHaveBeenCalledWith('row-1', 30, 'P');
    });
  });

  describe('RGA-T05: invalid statusCode → ValidationError', () => {
    it('throws ValidationError when statusCode is not in AttendanceType catalog', async () => {
      const { uc } = makeUC({ attendanceTypes: [] }); // empty catalog
      await expect(
        uc.execute({ ...baseInput, statusCode: 'ZZZZ', userRoles: ['SECRETARIO'] }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('accepts a code that exists in the catalog', async () => {
      const { uc } = makeUC();
      await expect(
        uc.execute({ ...baseInput, statusCode: 'A', userRoles: ['SECRETARIO'] }),
      ).resolves.toBeDefined();
    });
  });

  describe('RGA-T06: D3 bypass', () => {
    it('SECRETARIO bypasses Door 2 — preceptor check is not invoked', async () => {
      const { uc, asignacionRepo } = makeUC();
      await uc.execute({ ...baseInput, userRoles: ['SECRETARIO'] });
      expect(asignacionRepo.isPreceptor).not.toHaveBeenCalled();
    });

    it('ROOT bypasses Door 2', async () => {
      const { uc, asignacionRepo } = makeUC();
      await uc.execute({ ...baseInput, userRoles: ['ROOT'] });
      expect(asignacionRepo.isPreceptor).not.toHaveBeenCalled();
    });
  });

  describe('RGA-T07: non-preceptor TEACHER → ForbiddenError', () => {
    it('throws ForbiddenError when teacher is not a preceptor for this CC', async () => {
      const { uc } = makeUC({ isPreceptor: false });
      await expect(
        uc.execute({ ...baseInput, userRoles: ['TEACHER'] }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('preceptor can record — no ForbiddenError', async () => {
      const { uc, generalRepo } = makeUC({ isPreceptor: true });
      await expect(
        uc.execute({ ...baseInput, userRoles: ['TEACHER'] }),
      ).resolves.toBeDefined();
      expect(generalRepo.setDay).toHaveBeenCalledOnce();
    });
  });
});
