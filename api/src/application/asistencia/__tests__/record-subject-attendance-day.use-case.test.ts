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
 *
 * Pattern: mocked repos + TenantContext, no NestJS, no DB.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  DayNotAssignableError,
  StatusNotAssignableError,
} from '@educandow/domain';
import { DayMap, AsistenciaXMateriaXAlumnoXCursoXCiclo, Id, AttendanceTypeCode } from '@educandow/domain';

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
  docenteExists = true,
  teacherGroups = [{ id: GRUPO_ID, docenteXCicloId: DOCENTE_ID }],
  studentIdsInGroups = [STUDENT_ID],
}: {
  row?: AsistenciaXMateriaXAlumnoXCursoXCiclo | null;
  attendanceTypes?: typeof validAttendanceTypes;
  ccCycleId?: string;
  courseCycleId?: string;
  docenteExists?: boolean;
  teacherGroups?: { id: string; docenteXCicloId: string }[];
  studentIdsInGroups?: string[];
} = {}) {
  const mockClient = {
    materiaXCursoXCiclo: {
      findUnique: vi.fn().mockResolvedValue({ courseCycleId }),
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

  const uc = Object.create(RecordSubjectAttendanceDayUseCase.prototype);
  uc.materiaAsistRepo = materiaAsistRepo;
  uc.attendanceTypeRepo = attendanceTypeRepo;
  uc.grupoRepo = grupoRepo;
  uc.alumnosXGrupoRepo = alumnosXGrupoRepo;
  uc.docenteRepo = docenteRepo;

  return { uc, materiaAsistRepo, attendanceTypeRepo, grupoRepo, alumnosXGrupoRepo, docenteRepo, mockClient };
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
      expect(result).toBeDefined();
    });
  });

  describe('RSA-T02: register not found → NotFoundError', () => {
    it('throws NotFoundError when monthly subject register does not exist', async () => {
      const { uc } = makeUC({ row: null });
      await expect(
        uc.execute({ ...baseInput, userRoles: ['ADMIN'] }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('RSA-T03: day out of range → DayNotAssignableError or ValidationError', () => {
    it('throws DayNotAssignableError when day=31 in June (30 days)', async () => {
      const { uc } = makeUC();
      await expect(
        uc.execute({ ...baseInput, day: 31, userRoles: ['ADMIN'] }),
      ).rejects.toBeInstanceOf(DayNotAssignableError);
    });

    it('throws ValidationError when day = 0', async () => {
      const { uc } = makeUC();
      await expect(
        uc.execute({ ...baseInput, day: 0, userRoles: ['ADMIN'] }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('RSA-T04: invalid statusCode → ValidationError', () => {
    it('throws ValidationError when code is not in catalog', async () => {
      const { uc } = makeUC({ attendanceTypes: [] });
      await expect(
        uc.execute({ ...baseInput, statusCode: 'ZZZZZ', userRoles: ['ADMIN'] }),
      ).rejects.toBeInstanceOf(ValidationError);
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
  });

  describe('RSA-T06: teacher with group + student in group → success', () => {
    it('teacher assigned to a group for this materia and student is in that group → success', async () => {
      const { uc, materiaAsistRepo } = makeUC({
        teacherGroups: [{ id: GRUPO_ID, docenteXCicloId: DOCENTE_ID }],
        studentIdsInGroups: [STUDENT_ID],
      });
      await expect(
        uc.execute({ ...baseInput, userRoles: ['TEACHER'] }),
      ).resolves.toBeDefined();
      expect(materiaAsistRepo.setDay).toHaveBeenCalledOnce();
    });
  });

  describe('RSA-T07: teacher with group but student NOT in group → ForbiddenError', () => {
    it('throws ForbiddenError when target student is not in teacher group', async () => {
      const { uc } = makeUC({
        teacherGroups: [{ id: GRUPO_ID, docenteXCicloId: DOCENTE_ID }],
        studentIdsInGroups: ['other-student'], // student not in this group
      });
      await expect(
        uc.execute({ ...baseInput, userRoles: ['TEACHER'] }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe('RSA-T08: teacher with no group for this materia → ForbiddenError', () => {
    it('throws ForbiddenError when teacher has no groups for this materia', async () => {
      const { uc } = makeUC({ teacherGroups: [] });
      await expect(
        uc.execute({ ...baseInput, userRoles: ['TEACHER'] }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('throws ForbiddenError when teacher is not a DocenteXCiclo in this cycle', async () => {
      const { uc } = makeUC({ docenteExists: false });
      await expect(
        uc.execute({ ...baseInput, userRoles: ['TEACHER'] }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  // ── GUARD-10 + symmetry: calendar guards in subject use case (T6.2) ────────

  describe('GUARD-10: Saturday (day=4, Jan 2025) via subject use case → DayNotAssignableError', () => {
    it('throws DayNotAssignableError for Saturday January 4 2025 — identical to GUARD-1', async () => {
      const { uc } = makeUC();
      const err = await uc.execute({
        ...baseInput, day: 4, year: 2025, month: 1, userRoles: ['ADMIN'],
      }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(DayNotAssignableError);
      expect((err as DayNotAssignableError).code).toBe('DAY_NOT_ASSIGNABLE');
    });
  });

  describe('GUARD-10 mirror: non-assignable statusCode=SAB on hábil day via subject use case → StatusNotAssignableError', () => {
    it('throws StatusNotAssignableError for SAB on Monday Jan 1 2025 — mirrors GUARD-5', async () => {
      const { uc } = makeUC({ attendanceTypes: fullCatalog });
      const err = await uc.execute({
        ...baseInput, day: 1, year: 2025, month: 1, statusCode: 'SAB', userRoles: ['ADMIN'],
      }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(StatusNotAssignableError);
      expect((err as StatusNotAssignableError).code).toBe('STATUS_NOT_ASSIGNABLE');
    });
  });

  describe('GUARD-10 mirror: happy path via subject use case → resolves', () => {
    it('weekday + assignable code resolves successfully — mirrors GUARD-8', async () => {
      const { uc, materiaAsistRepo } = makeUC({ attendanceTypes: fullCatalog });
      await expect(
        uc.execute({ ...baseInput, day: 1, year: 2025, month: 1, statusCode: 'P', userRoles: ['ADMIN'] }),
      ).resolves.toBeDefined();
      expect(materiaAsistRepo.setDay).toHaveBeenCalledWith('row-m-1', 1, 'P');
    });
  });

  describe('GUARD: check ordering (subject use case)', () => {
    it('day=0 → ValidationError (step 2 fires before calendar check)', async () => {
      const { uc } = makeUC();
      await expect(
        uc.execute({ ...baseInput, day: 0, year: 2025, month: 1, userRoles: ['ADMIN'] }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('day=99 → ValidationError (step 2: 99 > 31)', async () => {
      const { uc } = makeUC();
      await expect(
        uc.execute({ ...baseInput, day: 99, year: 2025, month: 1, userRoles: ['ADMIN'] }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
