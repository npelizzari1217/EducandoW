/**
 * RecordSubjectAttendanceDayUseCase — unit tests (TDD RED, T-14).
 *
 * Covers (R-48):
 *   RSA-T01: happy path — D3 user, valid day + statusCode → row updated
 *   RSA-T02: register row not found → NotFoundError (ADR-4)
 *   RSA-T03: day out of range → ValidationError
 *   RSA-T04: invalid statusCode → ValidationError
 *   RSA-T05: D3 (ADMIN) bypasses Door 2
 *   RSA-T06: teacher with group + student in group → success
 *   RSA-T07: teacher with group but student NOT in group → ForbiddenError
 *   RSA-T08: teacher with no group for this materia → ForbiddenError
 *   RSA-T09: month closed → MonthClosedError (UNCONDITIONAL — incl. D3/ROOT, PR-3b)
 *
 * Result-shape migration (asistencia-result-migration, Slice 3): `execute` no longer throws —
 * every error path returns `err(...)`, every success path returns `ok(...)`. Covers BOTH auth
 * paths: Door 2 (`checkDoor2`, 6 Forbidden branches) and admin-bypass (`resolveCourseCycleId`,
 * Forbidden + NotFound branches).
 *
 * Pattern: mocked repos + TenantContext, no NestJS, no DB.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import {
  NotFoundError,
  ValidationError,
  DayNotAssignableError,
  StatusNotAssignableError,
  MonthClosedError,
  AttendanceMonthStatus,
} from '@educandow/domain';
import { DayMap, AsistenciaXMateriaXAlumnoXCursoXCiclo, Id, AttendanceTypeCode } from '@educandow/domain';
import { ForbiddenError } from '../../shared/errors/forbidden-error';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: { getClient: vi.fn() },
}));

import { TenantContext } from '../../../infrastructure/auth/tenant.context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let RecordSubjectAttendanceDayUseCase: any;
beforeAll(async () => {
  const mod = await import('../record-subject-attendance-day.use-case');
  RecordSubjectAttendanceDayUseCase = mod.RecordSubjectAttendanceDayUseCase;
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MXCC_ID = 'mx-1';
const STUDENT_ID = 'stu-1';
const YEAR = 2026;
const MONTH = 6; // June = 30 days
const GRUPO_ID = 'grp-1';
const DOCENTE_ID = 'dxc-1';

function makeRow(): AsistenciaXMateriaXAlumnoXCursoXCiclo {
  return AsistenciaXMateriaXAlumnoXCursoXCiclo.reconstruct({
    id: Id.reconstruct('row-m-1'),
    materiaXCursoXCicloId: MXCC_ID,
    studentId: STUDENT_ID,
    year: YEAR,
    month: MONTH,
    days: DayMap.empty(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

const validAttendanceTypes = [
  { id: 'at-1', code: AttendanceTypeCode.reconstruct('P'), active: true, assignable: true },
  { id: 'at-2', code: AttendanceTypeCode.reconstruct('A'), active: true, assignable: true },
];

/** Full catalog with non-assignable system types — used for GUARD tests. */
const fullCatalog = [
  ...validAttendanceTypes,
  { id: 'at-3', code: AttendanceTypeCode.reconstruct('SAB'), active: true, assignable: false },
  { id: 'at-4', code: AttendanceTypeCode.reconstruct('DOM'), active: true, assignable: false },
  { id: 'at-5', code: AttendanceTypeCode.reconstruct('X'), active: true, assignable: false },
];

// ── Factory ───────────────────────────────────────────────────────────────────

function makeUC({
  row = makeRow(),
  attendanceTypes = validAttendanceTypes,
  ccCycleId = 'cycle-1',
  courseCycleId = 'cc-1',
  materiaExists = true,
  docenteExists = true,
  teacherGroups = [{ id: GRUPO_ID, docenteXCicloId: DOCENTE_ID }],
  studentIdsInGroups = [STUDENT_ID],
  monthStatus = null,
}: {
  row?: AsistenciaXMateriaXAlumnoXCursoXCiclo | null;
  attendanceTypes?: typeof validAttendanceTypes;
  ccCycleId?: string;
  courseCycleId?: string;
  materiaExists?: boolean;
  docenteExists?: boolean;
  teacherGroups?: { id: string; docenteXCicloId: string }[];
  studentIdsInGroups?: string[];
  monthStatus?: AttendanceMonthStatus | null;
} = {}) {
  const mockClient = {
    materiaXCursoXCiclo: {
      findUnique: vi.fn().mockResolvedValue(materiaExists ? { courseCycleId } : null),
    },
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue({ cycleId: ccCycleId }),
    },
  };
  vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as never);

  const materiaAsistRepo = {
    findOne: vi.fn().mockResolvedValue(row),
    setDay: vi.fn().mockResolvedValue(row),
  };
  const attendanceTypeRepo = {
    list: vi.fn().mockResolvedValue(attendanceTypes),
  };
  const grupoRepo = {
    findGroupsForDocente: vi.fn().mockResolvedValue(teacherGroups),
  };
  const alumnosXGrupoRepo = {
    findStudentIdsByGrupoIds: vi.fn().mockResolvedValue(studentIdsInGroups),
  };
  const docenteRepo = {
    findByUserAndCycle: vi.fn().mockResolvedValue(
      docenteExists ? { id: DOCENTE_ID, userId: 'u1', cycleId: ccCycleId } : null,
    ),
  };
  const monthStatusRepo = {
    findOne: vi.fn().mockResolvedValue(monthStatus),
    findLatestBefore: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(undefined),
  };

  const uc = Object.create(RecordSubjectAttendanceDayUseCase.prototype);
  uc.materiaAsistRepo = materiaAsistRepo;
  uc.attendanceTypeRepo = attendanceTypeRepo;
  uc.grupoRepo = grupoRepo;
  uc.alumnosXGrupoRepo = alumnosXGrupoRepo;
  uc.docenteRepo = docenteRepo;
  uc.monthStatusRepo = monthStatusRepo;

  return {
    uc, materiaAsistRepo, attendanceTypeRepo, grupoRepo, alumnosXGrupoRepo, docenteRepo, monthStatusRepo, mockClient,
  };
}

function makeClosedMonthStatus(): AttendanceMonthStatus {
  const status = AttendanceMonthStatus.create({ courseCycleId: 'cc-1', year: YEAR, month: MONTH });
  status.close('secretario-1');
  return status;
}

const baseInput = {
  materiaXCursoXCicloId: MXCC_ID,
  studentId: STUDENT_ID,
  year: YEAR,
  month: MONTH,
  day: 10,
  statusCode: 'P',
  userId: 'u1',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RecordSubjectAttendanceDayUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RSA-T01: happy path (D3)', () => {
    it('D3 user records day successfully', async () => {
      const { uc, materiaAsistRepo } = makeUC();
      const result = await uc.execute({ ...baseInput, userRoles: ['ADMIN'] });
      expect(materiaAsistRepo.findOne).toHaveBeenCalledWith(MXCC_ID, STUDENT_ID, YEAR, MONTH);
      expect(materiaAsistRepo.setDay).toHaveBeenCalledWith('row-m-1', 10, 'P');
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBeDefined();
    });
  });

  describe('RSA-T02: register not found → NotFoundError', () => {
    it('returns err(NotFoundError) when monthly subject register does not exist', async () => {
      const { uc } = makeUC({ row: null });
      const result = await uc.execute({ ...baseInput, userRoles: ['ADMIN'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
    });
  });

  describe('RSA-T03: day out of range → DayNotAssignableError or ValidationError', () => {
    it('returns err(DayNotAssignableError) when day=31 in June (30 days)', async () => {
      const { uc } = makeUC();
      const result = await uc.execute({ ...baseInput, day: 31, userRoles: ['ADMIN'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(DayNotAssignableError);
    });

    it('returns err(ValidationError) when day = 0', async () => {
      const { uc } = makeUC();
      const result = await uc.execute({ ...baseInput, day: 0, userRoles: ['ADMIN'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    });
  });

  describe('RSA-T04: invalid statusCode → ValidationError', () => {
    it('returns err(ValidationError) when code is not in catalog', async () => {
      const { uc } = makeUC({ attendanceTypes: [] });
      const result = await uc.execute({ ...baseInput, statusCode: 'ZZZZZ', userRoles: ['ADMIN'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    });
  });

  describe('RSA-T05: D3 bypass', () => {
    it('ADMIN bypasses Door 2 — teacher group check is not invoked', async () => {
      const { uc, grupoRepo } = makeUC();
      await uc.execute({ ...baseInput, userRoles: ['ADMIN'] });
      expect(grupoRepo.findGroupsForDocente).not.toHaveBeenCalled();
    });

    it('ROOT also bypasses Door 2', async () => {
      const { uc, grupoRepo } = makeUC();
      await uc.execute({ ...baseInput, userRoles: ['ROOT'] });
      expect(grupoRepo.findGroupsForDocente).not.toHaveBeenCalled();
    });

    it('returns err(ForbiddenError) when D3 bypass hits missing tenant client', async () => {
      const { uc } = makeUC();
      vi.mocked(TenantContext.getClient).mockReturnValue(undefined as never);
      const result = await uc.execute({ ...baseInput, userRoles: ['ADMIN'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
    });

    it('returns err(NotFoundError) when D3 bypass resolves a materia that does not exist', async () => {
      const { uc } = makeUC({ materiaExists: false });
      const result = await uc.execute({ ...baseInput, userRoles: ['ADMIN'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
    });
  });

  describe('RSA-T06: teacher with group + student in group → success', () => {
    it('teacher assigned to a group for this materia and student is in that group → success', async () => {
      const { uc, materiaAsistRepo } = makeUC({
        teacherGroups: [{ id: GRUPO_ID, docenteXCicloId: DOCENTE_ID }],
        studentIdsInGroups: [STUDENT_ID],
      });
      const result = await uc.execute({ ...baseInput, userRoles: ['TEACHER'] });
      expect(result.isOk()).toBe(true);
      expect(materiaAsistRepo.setDay).toHaveBeenCalledOnce();
    });
  });

  describe('RSA-T07: teacher with group but student NOT in group → ForbiddenError', () => {
    it('returns err(ForbiddenError) when target student is not in teacher group', async () => {
      const { uc } = makeUC({
        teacherGroups: [{ id: GRUPO_ID, docenteXCicloId: DOCENTE_ID }],
        studentIdsInGroups: ['other-student'], // student not in this group
      });
      const result = await uc.execute({ ...baseInput, userRoles: ['TEACHER'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
    });
  });

  describe('RSA-T08: teacher with no group for this materia → ForbiddenError', () => {
    it('returns err(ForbiddenError) when teacher has no groups for this materia', async () => {
      const { uc } = makeUC({ teacherGroups: [] });
      const result = await uc.execute({ ...baseInput, userRoles: ['TEACHER'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
    });

    it('returns err(ForbiddenError) when teacher is not a DocenteXCiclo in this cycle', async () => {
      const { uc } = makeUC({ docenteExists: false });
      const result = await uc.execute({ ...baseInput, userRoles: ['TEACHER'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
    });

    it('returns err(ForbiddenError) when tenant client is unavailable on Door 2 path', async () => {
      const { uc } = makeUC();
      vi.mocked(TenantContext.getClient).mockReturnValue(undefined as never);
      const result = await uc.execute({ ...baseInput, userRoles: ['TEACHER'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
    });

    it('returns err(ForbiddenError) when materia is not found on Door 2 path', async () => {
      const { uc } = makeUC({ materiaExists: false });
      const result = await uc.execute({ ...baseInput, userRoles: ['TEACHER'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
    });

    it('returns err(ForbiddenError) when courseCycle is not found on Door 2 path', async () => {
      const { uc, mockClient } = makeUC();
      vi.mocked(mockClient.courseCycle.findUnique).mockResolvedValue(null as never);
      const result = await uc.execute({ ...baseInput, userRoles: ['TEACHER'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
    });
  });

  describe('RSA-T09: month closed → MonthClosedError (UNCONDITIONAL)', () => {
    it('returns err(MonthClosedError) for D3 ADMIN when month is closed', async () => {
      const { uc } = makeUC({ monthStatus: makeClosedMonthStatus() });
      const result = await uc.execute({ ...baseInput, userRoles: ['ADMIN'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(MonthClosedError);
    });

    it('returns err(MonthClosedError) for ROOT when month is closed — no bypass', async () => {
      const { uc } = makeUC({ monthStatus: makeClosedMonthStatus() });
      const result = await uc.execute({ ...baseInput, userRoles: ['ROOT'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(MonthClosedError);
    });

    it('returns err(MonthClosedError) for teacher-with-group when month is closed', async () => {
      const { uc } = makeUC({ monthStatus: makeClosedMonthStatus() });
      const result = await uc.execute({ ...baseInput, userRoles: ['TEACHER'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(MonthClosedError);
    });

    it('does not call setDay when month is closed', async () => {
      const { uc, materiaAsistRepo } = makeUC({ monthStatus: makeClosedMonthStatus() });
      await uc.execute({ ...baseInput, userRoles: ['ADMIN'] });
      expect(materiaAsistRepo.setDay).not.toHaveBeenCalled();
    });

    it('allows recording when month is open (no status row)', async () => {
      const { uc, materiaAsistRepo } = makeUC({ monthStatus: null });
      const result = await uc.execute({ ...baseInput, userRoles: ['ADMIN'] });
      expect(result.isOk()).toBe(true);
      expect(materiaAsistRepo.setDay).toHaveBeenCalledOnce();
    });
  });

  // ── GUARD-10 + symmetry: calendar guards in subject use case (T6.2) ────────

  describe('GUARD-10: Saturday (day=4, Jan 2025) via subject use case → DayNotAssignableError', () => {
    it('returns err(DayNotAssignableError) for Saturday January 4 2025 — identical to GUARD-1', async () => {
      const { uc } = makeUC();
      const result = await uc.execute({
        ...baseInput, day: 4, year: 2025, month: 1, userRoles: ['ADMIN'],
      });
      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error).toBeInstanceOf(DayNotAssignableError);
      expect((error as DayNotAssignableError).code).toBe('DAY_NOT_ASSIGNABLE');
    });
  });

  describe('GUARD-10 mirror: non-assignable statusCode=SAB on hábil day via subject use case → StatusNotAssignableError', () => {
    it('returns err(StatusNotAssignableError) for SAB on Monday Jan 1 2025 — mirrors GUARD-5', async () => {
      const { uc } = makeUC({ attendanceTypes: fullCatalog });
      const result = await uc.execute({
        ...baseInput, day: 1, year: 2025, month: 1, statusCode: 'SAB', userRoles: ['ADMIN'],
      });
      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error).toBeInstanceOf(StatusNotAssignableError);
      expect((error as StatusNotAssignableError).code).toBe('STATUS_NOT_ASSIGNABLE');
    });
  });

  describe('GUARD-10 mirror: happy path via subject use case → resolves', () => {
    it('weekday + assignable code resolves successfully — mirrors GUARD-8', async () => {
      const { uc, materiaAsistRepo } = makeUC({ attendanceTypes: fullCatalog });
      const result = await uc.execute({
        ...baseInput, day: 1, year: 2025, month: 1, statusCode: 'P', userRoles: ['ADMIN'],
      });
      expect(result.isOk()).toBe(true);
      expect(materiaAsistRepo.setDay).toHaveBeenCalledWith('row-m-1', 1, 'P');
    });
  });

  describe('GUARD: check ordering (subject use case)', () => {
    it('day=0 → ValidationError (step 2 fires before calendar check)', async () => {
      const { uc } = makeUC();
      const result = await uc.execute({ ...baseInput, day: 0, year: 2025, month: 1, userRoles: ['ADMIN'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    });

    it('day=99 → ValidationError (step 2: 99 > 31)', async () => {
      const { uc } = makeUC();
      const result = await uc.execute({ ...baseInput, day: 99, year: 2025, month: 1, userRoles: ['ADMIN'] });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    });
  });
});
