/**
 * ListSubjectAttendanceUseCase — unit tests (TDD RED → GREEN, T-18 + T-BE-3b).
 *
 * Covers (R-49 — group filter):
 *   LSA-T01: no grupoId → all enriched materia rows returned (no-group fallback)
 *   LSA-T02: grupoId provided → only group's student enriched rows returned
 *   LSA-T03: grupoId provided but group has no students → empty array
 *   LSA-T04: D3 user returns rows without Door 2
 *   LSA-T05: TEACHER with group in materia → success
 *   LSA-T06: TEACHER with no group in materia → ForbiddenError
 *
 * Pattern: mocked repos + TenantContext, no NestJS, no DB.
 * The mock stubs findByScopeAndMonthEnriched (NOT findByScopeAndMonth).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { ForbiddenError } from '@educandow/domain';
import { DayMap, AsistenciaXMateriaXAlumnoXCursoXCiclo, Id } from '@educandow/domain';
import type { EnrichedMateriaAttendance } from '@educandow/domain';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: { getClient: vi.fn() },
}));

import { TenantContext } from '../../../infrastructure/auth/tenant.context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ListSubjectAttendanceUseCase: any;
beforeAll(async () => {
  const mod = await import('../list-subject-attendance.use-case');
  ListSubjectAttendanceUseCase = mod.ListSubjectAttendanceUseCase;
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MXCC_ID = 'mx-1';
const YEAR = 2026;
const MONTH = 6;
const GRUPO_ID = 'grp-1';
const DOCENTE_ID = 'dxc-1';

function makeEnrichedRow(studentId: string, studentName = `Alumno, ${studentId}`): EnrichedMateriaAttendance {
  return {
    attendance: AsistenciaXMateriaXAlumnoXCursoXCiclo.reconstruct({
      id: Id.reconstruct(`row-${studentId}`),
      materiaXCursoXCicloId: MXCC_ID,
      studentId,
      year: YEAR,
      month: MONTH,
      days: DayMap.empty(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    studentName,
  };
}

// Enriched rows for stu-1 (group A) and stu-2 (group B)
const enrichedStu1 = makeEnrichedRow('stu-1', 'García, Ana');
const enrichedStu2 = makeEnrichedRow('stu-2', 'Zelaya, Luis');

// ── Factory ───────────────────────────────────────────────────────────────────

function makeUC({
  allEnrichedRows = [enrichedStu1, enrichedStu2],
  filteredEnrichedRows = [enrichedStu1],
  studentIdsInGroup = ['stu-1'],
  teacherGroups = [{ id: GRUPO_ID, docenteXCicloId: DOCENTE_ID }],
  docenteExists = true,
  ccCycleId = 'cycle-1',
  courseCycleId = 'cc-1',
}: {
  allEnrichedRows?: EnrichedMateriaAttendance[];
  filteredEnrichedRows?: EnrichedMateriaAttendance[];
  studentIdsInGroup?: string[];
  teacherGroups?: { id: string; docenteXCicloId: string }[];
  docenteExists?: boolean;
  ccCycleId?: string;
  courseCycleId?: string;
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

  /**
   * findByScopeAndMonthEnriched: returns allEnrichedRows when no studentIds filter,
   * or filteredEnrichedRows when studentIds filter is applied.
   */
  const materiaAsistRepo = {
    findByScopeAndMonthEnriched: vi.fn().mockImplementation(
      (_mxccId: string, _year: number, _month: number, studentIds?: string[]) =>
        Promise.resolve(studentIds ? filteredEnrichedRows : allEnrichedRows),
    ),
  };
  const grupoRepo = {
    findGroupsForDocente: vi.fn().mockResolvedValue(teacherGroups),
    findByMateria: vi.fn().mockResolvedValue(teacherGroups),
  };
  const alumnosXGrupoRepo = {
    findStudentIdsByGrupoIds: vi.fn().mockResolvedValue(studentIdsInGroup),
    findByGrupo: vi.fn().mockResolvedValue(studentIdsInGroup.map((id) => ({ alumnosXMateriaXCursoXCicloId: id }))),
  };
  const docenteRepo = {
    findByUserAndCycle: vi.fn().mockResolvedValue(
      docenteExists ? { id: DOCENTE_ID, userId: 'u1', cycleId: ccCycleId } : null,
    ),
  };

  const uc = Object.create(ListSubjectAttendanceUseCase.prototype);
  uc.materiaAsistRepo = materiaAsistRepo;
  uc.grupoRepo = grupoRepo;
  uc.alumnosXGrupoRepo = alumnosXGrupoRepo;
  uc.docenteRepo = docenteRepo;

  return { uc, materiaAsistRepo, grupoRepo, alumnosXGrupoRepo, docenteRepo };
}

const baseInput = { materiaXCursoXCicloId: MXCC_ID, year: YEAR, month: MONTH, userId: 'u1' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ListSubjectAttendanceUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('LSA-T01: no grupoId → all enriched materia rows (no-group fallback, R-23)', () => {
    it('returns all enriched rows when no grupoId is passed', async () => {
      const { uc, materiaAsistRepo } = makeUC();
      const result = await uc.execute({ ...baseInput, userRoles: ['ADMIN'] });
      expect(result).toHaveLength(2); // both stu-1 and stu-2
      expect(result[0]).toHaveProperty('attendance');
      expect(result[0]).toHaveProperty('studentName');
      // No studentIds filter passed to repo
      expect(materiaAsistRepo.findByScopeAndMonthEnriched).toHaveBeenCalledWith(MXCC_ID, YEAR, MONTH, undefined);
    });
  });

  describe('LSA-T02: grupoId → only group students enriched (R-22)', () => {
    it('returns only enriched stu-1 row when grupoId filters to group-A (stu-1 only)', async () => {
      const { uc, materiaAsistRepo, alumnosXGrupoRepo } = makeUC({
        studentIdsInGroup: ['stu-1'],
        filteredEnrichedRows: [enrichedStu1],
      });

      const result = await uc.execute({ ...baseInput, grupoId: GRUPO_ID, userRoles: ['ADMIN'] });

      // Group lookup was performed
      expect(alumnosXGrupoRepo.findStudentIdsByGrupoIds).toHaveBeenCalledWith([GRUPO_ID]);
      // Repo called with studentIds filter containing only stu-1
      expect(materiaAsistRepo.findByScopeAndMonthEnriched).toHaveBeenCalledWith(
        MXCC_ID, YEAR, MONTH, ['stu-1'],
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(enrichedStu1);
    });
  });

  describe('LSA-T03: grupoId with empty group → []', () => {
    it('returns empty array when group has no students', async () => {
      const { uc } = makeUC({ studentIdsInGroup: [], filteredEnrichedRows: [] });
      const result = await uc.execute({ ...baseInput, grupoId: GRUPO_ID, userRoles: ['ADMIN'] });
      expect(result).toEqual([]);
    });
  });

  describe('LSA-T04: D3 user → no Door 2 check', () => {
    it('SECRETARIO gets all rows without Door 2', async () => {
      const { uc, grupoRepo } = makeUC();
      await uc.execute({ ...baseInput, userRoles: ['SECRETARIO'] });
      expect(grupoRepo.findGroupsForDocente).not.toHaveBeenCalled();
    });
  });

  describe('LSA-T05: TEACHER with group in materia → success', () => {
    it('teacher assigned to a group for this materia can list', async () => {
      const { uc, materiaAsistRepo } = makeUC({
        teacherGroups: [{ id: GRUPO_ID, docenteXCicloId: DOCENTE_ID }],
      });
      const result = await uc.execute({ ...baseInput, userRoles: ['TEACHER'] });
      expect(materiaAsistRepo.findByScopeAndMonthEnriched).toHaveBeenCalledOnce();
      expect(result).toBeDefined();
    });
  });

  describe('LSA-T06: TEACHER with no group in materia → ForbiddenError', () => {
    it('throws ForbiddenError when teacher has no group for this materia', async () => {
      const { uc } = makeUC({ teacherGroups: [] });
      await expect(
        uc.execute({ ...baseInput, userRoles: ['TEACHER'] }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('throws ForbiddenError when teacher is not a DocenteXCiclo', async () => {
      const { uc } = makeUC({ docenteExists: false });
      await expect(
        uc.execute({ ...baseInput, userRoles: ['TEACHER'] }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
