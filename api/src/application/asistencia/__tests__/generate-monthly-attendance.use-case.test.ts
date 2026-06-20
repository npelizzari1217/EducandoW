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
 *
 * Pattern: mocked repos + mocked TenantContext; no NestJS bootstrap, no DB.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { ForbiddenError, NotFoundError } from '@educandow/domain';

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

function makeUC({
  ccExists = true,
  alumnos = enrolled,
  mxccs = materias,
  alumnosXMateriaFn = alumnosXMateriaForId,
  generalResult = { created: 2, skipped: 0 },
  materiaResult = { created: 3, skipped: 0 },
}: {
  ccExists?: boolean;
  alumnos?: typeof enrolled;
  mxccs?: typeof materias;
  alumnosXMateriaFn?: (id: string) => { materiaXCursoXCicloId: string; studentId: string }[];
  generalResult?: { created: number; skipped: number };
  materiaResult?: { created: number; skipped: number };
} = {}) {
  const mockClient = {
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue(ccExists ? { uuid: CC_ID } : null),
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

  const uc = Object.create(GenerateMonthlyAttendanceUseCase.prototype);
  uc.alumnosCCRepo = alumnosCCRepo;
  uc.mxccRepo = mxccRepo;
  uc.alumnosXMateriaRepo = alumnosXMateriaRepo;
  uc.generalRepo = generalRepo;
  uc.materiaAsistRepo = materiaAsistRepo;

  return { uc, mockClient, alumnosCCRepo, mxccRepo, alumnosXMateriaRepo, generalRepo, materiaAsistRepo };
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

      expect(result).toEqual({
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

      expect(result).toEqual({
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

      expect(result).toEqual({
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
});
