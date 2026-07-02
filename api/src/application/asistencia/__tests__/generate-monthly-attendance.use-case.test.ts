/**
 * GenerateMonthlyAttendanceUseCase — unit tests (TDD RED, T-10).
 *
 * Covers:
 *   GEN-T01: non-admin role (TEACHER) → ForbiddenError
 *   GEN-T02: CourseCycle not found → NotFoundError
 *   GEN-T03: happy path — 2 students, 2 materias, 3 student-materia pairs → correct counts
 *   GEN-T04: zero enrolled students → all-zero counts, no error (R-13)
 *   GEN-T05: idempotent re-run → all-zero created, non-zero skipped
 *   GEN-T06: generateMany never updates/deletes existing rows (structural assertion, ADR-3)
 *   GEN-T07: previous generated month still open → PreviousMonthOpenError (first month exempt)
 *   GEN-T08: after materializing, upserts an OPEN status row iff none exists yet (idempotent)
 *
 * Pattern: mocked repos + mocked TenantContext; no NestJS bootstrap, no DB.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import {
  ForbiddenError,
  NotFoundError,
  buildLockedDayMap,
  fillHabilVacios,
  AttendanceMonthStatus,
  PreviousMonthOpenError,
  PresenteTypeNotFoundError,
} from '@educandow/domain';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: { getClient: vi.fn() },
}));

import { TenantContext } from '../../../infrastructure/auth/tenant.context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GenerateMonthlyAttendanceUseCase: any;
beforeAll(async () => {
  const mod = await import('../generate-monthly-attendance.use-case');
  GenerateMonthlyAttendanceUseCase = mod.GenerateMonthlyAttendanceUseCase;
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CC_ID = 'cc-1';
const YEAR = 2026;
const MONTH = 6;

/** Minimal AlumnosXCursoXCiclo-shaped objects (getters accessed by use-case) */
const enrolled = [
  { courseCycleId: CC_ID, studentId: 'stu-1', printable: false },
  { courseCycleId: CC_ID, studentId: 'stu-2', printable: false },
];

/** Minimal MateriaXCursoXCiclo-shaped objects */
const materias = [
  { id: 'mx-1', courseCycleId: CC_ID },
  { id: 'mx-2', courseCycleId: CC_ID },
];

/** MateriasXAlumnoXCursoXCiclo rows per materia */
function alumnosXMateriaForId(id: string) {
  if (id === 'mx-1') return [{ materiaXCursoXCicloId: 'mx-1', studentId: 'stu-1' }, { materiaXCursoXCicloId: 'mx-1', studentId: 'stu-2' }];
  if (id === 'mx-2') return [{ materiaXCursoXCicloId: 'mx-2', studentId: 'stu-1' }];
  return [];
}

// ── Factory ───────────────────────────────────────────────────────────────────

/** Default mock AttendanceType-shaped "Presente" (only `.code.get()` is used by the use-case). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makePresente(code = 'P'): any {
  return { code: { get: () => code } };
}

function makeUC({
  ccExists = true,
  level = 30, // código COMPUESTO (Secundario común); nivel base = 3
  alumnos = enrolled,
  mxccs = materias,
  alumnosXMateriaFn = alumnosXMateriaForId,
  generalResult = { created: 2, skipped: 0 },
  materiaResult = { created: 3, skipped: 0 },
  previousMonthStatus = null,
  existingMonthStatus = null,
  presente = makePresente(),
}: {
  ccExists?: boolean;
  level?: number;
  alumnos?: typeof enrolled;
  mxccs?: typeof materias;
  alumnosXMateriaFn?: (id: string) => { materiaXCursoXCicloId: string; studentId: string }[];
  generalResult?: { created: number; skipped: number };
  materiaResult?: { created: number; skipped: number };
  previousMonthStatus?: AttendanceMonthStatus | null;
  existingMonthStatus?: AttendanceMonthStatus | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  presente?: any;
} = {}) {
  const mockClient = {
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue(ccExists ? { uuid: CC_ID, level } : null),
    },
  };
  vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as never);

  const alumnosCCRepo = {
    findByCourseCycle: vi.fn().mockResolvedValue(alumnos),
  };
  const mxccRepo = {
    findByCourseCycleId: vi.fn().mockResolvedValue(mxccs),
  };
  const alumnosXMateriaRepo = {
    findByMateria: vi.fn().mockImplementation((id: string) =>
      Promise.resolve(alumnosXMateriaFn(id)),
    ),
  };
  const generalRepo = {
    generateMany: vi.fn().mockResolvedValue(generalResult),
  };
  const materiaAsistRepo = {
    generateMany: vi.fn().mockResolvedValue(materiaResult),
  };
  const monthStatusRepo = {
    findOne: vi.fn().mockResolvedValue(existingMonthStatus),
    findLatestBefore: vi.fn().mockResolvedValue(previousMonthStatus),
    upsert: vi.fn().mockResolvedValue(undefined),
  };
  const attendanceTypeRepo = {
    findPresenteByLevel: vi.fn().mockResolvedValue(presente),
  };

  const uc = Object.create(GenerateMonthlyAttendanceUseCase.prototype);
  uc.alumnosCCRepo = alumnosCCRepo;
  uc.mxccRepo = mxccRepo;
  uc.alumnosXMateriaRepo = alumnosXMateriaRepo;
  uc.generalRepo = generalRepo;
  uc.materiaAsistRepo = materiaAsistRepo;
  uc.monthStatusRepo = monthStatusRepo;
  uc.attendanceTypeRepo = attendanceTypeRepo;

  return {
    uc, mockClient, alumnosCCRepo, mxccRepo, alumnosXMateriaRepo, generalRepo, materiaAsistRepo, monthStatusRepo,
    attendanceTypeRepo,
  };
}

function makeClosedPreviousStatus(): AttendanceMonthStatus {
  const status = AttendanceMonthStatus.create({ courseCycleId: CC_ID, year: YEAR, month: MONTH - 1 });
  status.close('secretario-1');
  return status;
}

function makeOpenPreviousStatus(): AttendanceMonthStatus {
  return AttendanceMonthStatus.create({ courseCycleId: CC_ID, year: YEAR, month: MONTH - 1 });
}

/** Closed status for the CURRENT month being generated (not the previous one). */
function makeClosedCurrentStatus(): AttendanceMonthStatus {
  const status = AttendanceMonthStatus.create({ courseCycleId: CC_ID, year: YEAR, month: MONTH });
  status.close('secretario-1');
  return status;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GenerateMonthlyAttendanceUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GEN-T01: non-admin role → ForbiddenError', () => {
    it('throws ForbiddenError when caller is a TEACHER (non-D3)', async () => {
      const { uc } = makeUC();
      await expect(
        uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['TEACHER'] }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('throws ForbiddenError when caller has no role at all', async () => {
      const { uc } = makeUC();
      await expect(
        uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: [] }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe('GEN-T02: CourseCycle not found → NotFoundError', () => {
    it('throws NotFoundError when CC does not exist', async () => {
      const { uc } = makeUC({ ccExists: false });
      await expect(
        uc.execute({ courseCycleId: 'unknown-cc', year: YEAR, month: MONTH, userId: 'u1', userRoles: ['SECRETARIO'] }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('GEN-T03: happy path', () => {
    it('returns correct counts for 2 enrolled students and 3 student-materia pairs', async () => {
      const { uc, generalRepo, materiaAsistRepo, alumnosXMateriaRepo } = makeUC({
        generalResult: { created: 2, skipped: 0 },
        materiaResult: { created: 3, skipped: 0 },
      });

      const result = await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['SECRETARIO'] });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual({
        generalCreated: 2,
        generalSkipped: 0,
        materiaCreated: 3,
        materiaSkipped: 0,
      });

      // generateMany called once for each table
      expect(generalRepo.generateMany).toHaveBeenCalledOnce();
      expect(materiaAsistRepo.generateMany).toHaveBeenCalledOnce();

      // findByMateria called once per materia
      expect(alumnosXMateriaRepo.findByMateria).toHaveBeenCalledTimes(2);
    });

    it('general generateMany receives correct rows (courseCycleId + year + month per student)', async () => {
      const { uc, generalRepo } = makeUC();

      await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] });

      const input = generalRepo.generateMany.mock.calls[0][0] as Array<{
        courseCycleId: string; studentId: string; year: number; month: number;
      }>;
      expect(input).toHaveLength(2);
      expect(input.every((r) => r.courseCycleId === CC_ID && r.year === YEAR && r.month === MONTH)).toBe(true);
      expect(input.map((r) => r.studentId).sort()).toEqual(['stu-1', 'stu-2']);
    });

    it('materia generateMany receives correct rows (materiaXCursoXCicloId + studentId + year + month)', async () => {
      const { uc, materiaAsistRepo } = makeUC();

      await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ROOT'] });

      const input = materiaAsistRepo.generateMany.mock.calls[0][0] as Array<{
        materiaXCursoXCicloId: string; studentId: string; year: number; month: number;
      }>;
      expect(input).toHaveLength(3);
      expect(input.every((r) => r.year === YEAR && r.month === MONTH)).toBe(true);
    });

    it('DIRECTOR (D3) can generate — no ForbiddenError', async () => {
      const { uc } = makeUC();
      await expect(
        uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['DIRECTOR'] }),
      ).resolves.toBeDefined();
    });
  });

  describe('GEN-T04: zero enrolled students', () => {
    it('succeeds with all-zero counts when no students are enrolled', async () => {
      const { uc, generalRepo, materiaAsistRepo } = makeUC({
        alumnos: [],
        mxccs: [],
        alumnosXMateriaFn: () => [],
      });

      const result = await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual({
        generalCreated: 0,
        generalSkipped: 0,
        materiaCreated: 0,
        materiaSkipped: 0,
      });
      expect(generalRepo.generateMany).not.toHaveBeenCalled();
      expect(materiaAsistRepo.generateMany).not.toHaveBeenCalled();
    });
  });

  describe('GEN-T05: idempotent re-run', () => {
    it('returns zero created and N skipped when all rows already exist', async () => {
      const { uc } = makeUC({
        generalResult: { created: 0, skipped: 2 },
        materiaResult: { created: 0, skipped: 3 },
      });

      const result = await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['SECRETARIO'] });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual({
        generalCreated: 0,
        generalSkipped: 2,
        materiaCreated: 0,
        materiaSkipped: 3,
      });
    });
  });

  describe('GEN-T06: status preservation is structural', () => {
    it('only generateMany is called on repos — no update or delete methods', async () => {
      const { uc, generalRepo, materiaAsistRepo } = makeUC();

      await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ROOT'] });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generalCalled = Object.keys(generalRepo).filter((k) => (generalRepo as any)[k]?.mock?.calls?.length > 0);
      expect(generalCalled).toEqual(['generateMany']);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const materiaCalled = Object.keys(materiaAsistRepo).filter((k) => (materiaAsistRepo as any)[k]?.mock?.calls?.length > 0);
      expect(materiaCalled).toEqual(['generateMany']);
    });
  });

  describe('GEN-T07: previous generated month still open → PreviousMonthOpenError', () => {
    it('throws PreviousMonthOpenError when the latest generated month is open', async () => {
      const { uc } = makeUC({ previousMonthStatus: makeOpenPreviousStatus() });
      await expect(
        uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['SECRETARIO'] }),
      ).rejects.toBeInstanceOf(PreviousMonthOpenError);
    });

    it('does not call generateMany when previous month is open', async () => {
      const { uc, generalRepo, materiaAsistRepo } = makeUC({ previousMonthStatus: makeOpenPreviousStatus() });
      try {
        await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['SECRETARIO'] });
      } catch { /* expected */ }
      expect(generalRepo.generateMany).not.toHaveBeenCalled();
      expect(materiaAsistRepo.generateMany).not.toHaveBeenCalled();
    });

    it('allows generation when previous generated month is closed', async () => {
      const { uc } = makeUC({ previousMonthStatus: makeClosedPreviousStatus() });
      await expect(
        uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['SECRETARIO'] }),
      ).resolves.toBeDefined();
    });

    it('first-ever month (no previous generated) is exempt — no previous row', async () => {
      const { uc } = makeUC({ previousMonthStatus: null });
      await expect(
        uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['SECRETARIO'] }),
      ).resolves.toBeDefined();
    });
  });

  describe('GEN-T08: upserts an OPEN status row iff none exists yet', () => {
    it('creates a new OPEN status row when none exists for this CC+month', async () => {
      const { uc, monthStatusRepo } = makeUC({ existingMonthStatus: null });
      await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['SECRETARIO'] });

      expect(monthStatusRepo.upsert).toHaveBeenCalledTimes(1);
      const upserted = monthStatusRepo.upsert.mock.calls[0][0] as AttendanceMonthStatus;
      expect(upserted.isClosed()).toBe(false);
      expect(upserted.courseCycleId).toBe(CC_ID);
      expect(upserted.year).toBe(YEAR);
      expect(upserted.month).toBe(MONTH);
    });

    it('does NOT touch an existing status row (idempotent regeneration never reopens/recloses)', async () => {
      const { uc, monthStatusRepo } = makeUC({ existingMonthStatus: makeClosedPreviousStatus() });
      await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['SECRETARIO'] });

      expect(monthStatusRepo.upsert).not.toHaveBeenCalled();
    });

    it('creates the status row even with zero enrollment (month is still "generated")', async () => {
      const { uc, monthStatusRepo } = makeUC({
        alumnos: [], mxccs: [], alumnosXMateriaFn: () => [], existingMonthStatus: null,
      });
      await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['SECRETARIO'] });

      expect(monthStatusRepo.upsert).toHaveBeenCalledTimes(1);
    });
  });

  // ── GEN-1..5: lockedMap injection (T5.1) ──────────────────────────────────

  describe('GEN-1: Jan 2025 — general rows contain fillHabilVacios(lockedMap, "P") (hábiles filled, SAB/DOM preserved)', () => {
    it('each row has days = fillHabilVacios(lockedMap, "P", 2025, 1); no X entries', async () => {
      const { uc, generalRepo } = makeUC();

      await uc.execute({ courseCycleId: CC_ID, year: 2025, month: 1, userId: 'u1', userRoles: ['ADMIN'] });

      const rows: Array<{ days: Record<string, string> }> = generalRepo.generateMany.mock.calls[0][0];
      expect(rows).toHaveLength(2);

      const expectedTargetDays = fillHabilVacios(buildLockedDayMap(2025, 1), 'P', 2025, 1);
      for (const row of rows) {
        expect(row.days).toEqual(expectedTargetDays);
        // SAB/DOM entries present (locked, untouched by autofill)
        expect(row.days['4']).toBe('SAB');
        expect(row.days['5']).toBe('DOM');
        // Hábil weekday keys now autofilled with the resolved Presente code (ATR-R11.1)
        expect(row.days['1']).toBe('P');
        expect(row.days['2']).toBe('P');
        expect(row.days['3']).toBe('P');
        expect(row.days['6']).toBe('P');
        // No X entries (January has 31 days)
        for (let d = 1; d <= 31; d++) {
          expect(row.days[String(d)]).not.toBe('X');
        }
      }
    });
  });

  describe('GEN-2: Feb 2025 (non-leap, 28 days) — X entries for 29/30/31; hábil day 28 autofilled with "P"', () => {
    it('rows have X for days 29/30/31 and "P" for day 28 (Friday, hábil)', async () => {
      const { uc, generalRepo } = makeUC({ alumnos: [enrolled[0]] });

      await uc.execute({ courseCycleId: CC_ID, year: 2025, month: 2, userId: 'u1', userRoles: ['ADMIN'] });

      const rows: Array<{ days: Record<string, string> }> = generalRepo.generateMany.mock.calls[0][0];
      const days = rows[0].days;

      expect(days['29']).toBe('X');
      expect(days['30']).toBe('X');
      expect(days['31']).toBe('X');
      expect(days['28']).toBe('P'); // Friday — hábil, autofilled (ATR-R11.1)
    });
  });

  describe('GEN-3: Feb 2024 (leap, 29 days) — X entries for 30/31; day 29 NOT X', () => {
    it('rows have X for 30/31 but no X for 29 (day 29 exists in 2024)', async () => {
      const { uc, generalRepo } = makeUC({ alumnos: [enrolled[0]] });

      await uc.execute({ courseCycleId: CC_ID, year: 2024, month: 2, userId: 'u1', userRoles: ['ADMIN'] });

      const rows: Array<{ days: Record<string, string> }> = generalRepo.generateMany.mock.calls[0][0];
      const days = rows[0].days;

      expect(days['30']).toBe('X');
      expect(days['31']).toBe('X');
      expect(days['29']).not.toBe('X'); // day 29 exists in 2024
    });
  });

  describe('GEN-4: Apr 2025 (materia) — materia repo receives days with 31:X; hábil day 30 autofilled with "P"', () => {
    it('materiaAsistRepo receives rows with days["31"]="X" and days["30"]="P" (hábil, autofilled)', async () => {
      const { uc, materiaAsistRepo } = makeUC();

      await uc.execute({ courseCycleId: CC_ID, year: 2025, month: 4, userId: 'u1', userRoles: ['ADMIN'] });

      const rows: Array<{ days: Record<string, string> }> = materiaAsistRepo.generateMany.mock.calls[0][0];
      expect(rows.length).toBeGreaterThan(0);

      for (const row of rows) {
        expect(row.days['31']).toBe('X');
        expect(row.days['30']).toBe('P'); // day 30 exists in April, hábil, autofilled (ATR-R11.4)
      }
    });
  });

  describe('GEN-5: Dec 2025 (31 days) — SAB/DOM present; no X entries', () => {
    it('rows have SAB/DOM entries for December; no X keys present', async () => {
      const { uc, generalRepo } = makeUC({ alumnos: [enrolled[0]] });

      await uc.execute({ courseCycleId: CC_ID, year: 2025, month: 12, userId: 'u1', userRoles: ['ADMIN'] });

      const rows: Array<{ days: Record<string, string> }> = generalRepo.generateMany.mock.calls[0][0];
      const days = rows[0].days;

      // Some SAB entry (Dec 6 = SAB)
      expect(days['6']).toBe('SAB');
      // Some DOM entry (Dec 7 = DOM)
      expect(days['7']).toBe('DOM');
      // No X entries (December has 31 days)
      for (let d = 1; d <= 31; d++) {
        expect(days[String(d)]).not.toBe('X');
      }
    });
  });

  describe('GEN: same lockedMap reference used for all rows in one invocation', () => {
    it('all rows in one execute share the same days object reference', async () => {
      const { uc, generalRepo } = makeUC();

      await uc.execute({ courseCycleId: CC_ID, year: 2025, month: 1, userId: 'u1', userRoles: ['ADMIN'] });

      const rows: Array<{ days: Record<string, string> }> = generalRepo.generateMany.mock.calls[0][0];
      expect(rows).toHaveLength(2);
      // Same reference — one buildLockedDayMap call per execution
      expect(rows[0].days).toBe(rows[1].days);
    });
  });

  // ── GEN-6..GEN-9: PR-3 Application — autollenado de Presente (ATR-R11) ─────────

  describe('GEN-6: nivel sin Presente → Result.err(PresenteTypeNotFoundError), sin escritura', () => {
    it('returns err(PresenteTypeNotFoundError) when the level has no Presente type configured', async () => {
      const { uc } = makeUC({ presente: null });

      const result = await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(PresenteTypeNotFoundError);
    });

    it('does not call generateMany on either axis (no partial write)', async () => {
      const { uc, generalRepo, materiaAsistRepo } = makeUC({ presente: null });

      await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] });

      expect(generalRepo.generateMany).not.toHaveBeenCalled();
      expect(materiaAsistRepo.generateMany).not.toHaveBeenCalled();
    });

    // Regresión: CourseCycle.level es el código COMPUESTO (nivel×10+modalidad);
    // los AttendanceType se indexan por el nivel BASE (1-4). El use-case DEBE
    // convertir antes de resolver el Presente, si no findPresenteByLevel(30)
    // nunca matchea los tipos (level 3) y Generar tira un 422 espurio en prod.
    it('resolves findPresenteByLevel with the BASE educational level (1-4), not the composite CourseCycle level', async () => {
      // 30 = Secundario común → base 3
      const sec = makeUC({ presente: null, level: 30 });
      await sec.uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] });
      expect(sec.attendanceTypeRepo.findPresenteByLevel).toHaveBeenCalledWith(3);

      // 40 = Terciario → base 4
      const ter = makeUC({ presente: null, level: 40 });
      await ter.uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] });
      expect(ter.attendanceTypeRepo.findPresenteByLevel).toHaveBeenCalledWith(4);

      // 11 = Talleres de Inicial (modalidad ≠ 0) → base 1
      const tall = makeUC({ presente: null, level: 11 });
      await tall.uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] });
      expect(tall.attendanceTypeRepo.findPresenteByLevel).toHaveBeenCalledWith(1);
    });
  });

  describe('GEN-7: mes CERRADO → autollenado no-op, comportamiento preexistente de Generar intacto (ADR-4/ATR-R11.6)', () => {
    it('does not resolve Presente and does not autofill hábil days when the current month is CLOSED', async () => {
      const { uc, generalRepo, attendanceTypeRepo } = makeUC({
        existingMonthStatus: makeClosedCurrentStatus(),
      });

      const result = await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] });

      expect(result.isOk()).toBe(true);
      expect(attendanceTypeRepo.findPresenteByLevel).not.toHaveBeenCalled();

      const rows: Array<{ days: Record<string, string> }> = generalRepo.generateMany.mock.calls[0][0];
      const expectedLockedMap = buildLockedDayMap(YEAR, MONTH);
      // Plain lockedMap (no autofill) — pre-existing behavior preserved, no new bypass
      for (const row of rows) {
        expect(row.days).toEqual(expectedLockedMap);
      }
    });

    it('never returns PresenteTypeNotFoundError on a CLOSED month, even if the level has no Presente configured', async () => {
      const { uc } = makeUC({
        existingMonthStatus: makeClosedCurrentStatus(),
        presente: null,
      });

      const result = await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] });

      expect(result.isOk()).toBe(true);
    });

    it('still calls generateMany on both axes on a CLOSED month (rest of Generate unaffected)', async () => {
      const { uc, generalRepo, materiaAsistRepo } = makeUC({
        existingMonthStatus: makeClosedCurrentStatus(),
      });

      await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] });

      expect(generalRepo.generateMany).toHaveBeenCalledOnce();
      expect(materiaAsistRepo.generateMany).toHaveBeenCalledOnce();
    });
  });

  describe('GEN-8: findPresenteByLevel se resuelve una sola vez por invocación (no N+1)', () => {
    it('calls findPresenteByLevel exactly once regardless of enrolled/materia count', async () => {
      const { uc, attendanceTypeRepo } = makeUC();

      await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] });

      expect(attendanceTypeRepo.findPresenteByLevel).toHaveBeenCalledOnce();
    });
  });

  describe('GEN-9: ambos ejes (general y materia) reciben el mismo targetDays (mismo helper, ATR-R11.4)', () => {
    it('general and materia rows share the same days object reference within one invocation', async () => {
      const { uc, generalRepo, materiaAsistRepo } = makeUC();

      await uc.execute({ courseCycleId: CC_ID, year: YEAR, month: MONTH, userId: 'u1', userRoles: ['ADMIN'] });

      const generalRows: Array<{ days: Record<string, string> }> = generalRepo.generateMany.mock.calls[0][0];
      const materiaRows: Array<{ days: Record<string, string> }> = materiaAsistRepo.generateMany.mock.calls[0][0];

      expect(generalRows[0].days).toBe(materiaRows[0].days);
    });
  });
});
