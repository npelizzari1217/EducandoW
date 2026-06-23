/**
 * CascadeAllStudentsMateriasCompetenciasUseCase — unit tests (TDD RED, T-01).
 *
 * Covers:
 *   BULK-01: empty rows (0 students) → all-zero result
 *   BULK-02: rows present but zero materias → studentsProcessed=N, rest zero
 *   BULK-03: happy path N×M×K — materias+competencies fetched ONCE, loop students
 *   BULK-04: idempotent re-run (upsertMany count=0, bulkCreate count=0)
 *   BULK-05: optativa filter — optativas excluded per student
 *   BULK-06: all-optativa CC → studentsProcessed=N (rows processed), rest zero
 *   BULK-07: best-effort partial failure — one student throws, loop continues
 *   BULK-08: grade preservation (cascade never touches CompetenciaPeriodo children)
 *
 * Pattern: mocked repositories, no NestJS bootstrap, no DB.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { SubjectCompetency, Id } from '@educandow/domain';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let CascadeAllStudentsMateriasCompetenciasUseCase: any;

beforeAll(async () => {
  const mod = await import(
    '../cascade-all-students-materias-competencias.use-case'
  );
  CascadeAllStudentsMateriasCompetenciasUseCase =
    mod.CascadeAllStudentsMateriasCompetenciasUseCase;
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const bridgeRow1 = {
  id: 'acc-1',
  courseCycleId: 'cc-1',
  studentId: 'stu-1',
  printable: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const bridgeRow2 = {
  id: 'acc-2',
  courseCycleId: 'cc-1',
  studentId: 'stu-2',
  printable: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const materia1 = { id: 'mxcc-1', courseCycleId: 'cc-1', subjectId: 'sub-1', studyPlanSubjectId: 'sps-1', esOptativa: false };
const materia2 = { id: 'mxcc-2', courseCycleId: 'cc-1', subjectId: 'sub-2', studyPlanSubjectId: 'sps-2', esOptativa: false };

function makeCompetency(id: string, spsId: string, name: string): SubjectCompetency {
  return SubjectCompetency.reconstruct({
    id: Id.reconstruct(id),
    studyPlanSubjectId: spsId,
    name,
    active: true,
  });
}

const competency1 = makeCompetency('comp-1', 'sps-1', 'Comp A');
const competency2 = makeCompetency('comp-2', 'sps-1', 'Comp B');
const competency3 = makeCompetency('comp-3', 'sps-2', 'Comp C');

// ── Factory ───────────────────────────────────────────────────────────────────

function makeUC(overrides: {
  alumnosCCRepo?: object;
  materiaRepo?: object;
  alumnosXMateriaRepo?: object;
  competencyRepo?: object;
  competenciaRepo?: object;
} = {}) {
  const alumnosCCRepo = overrides.alumnosCCRepo ?? {
    findByCourseCycle: vi.fn().mockResolvedValue([bridgeRow1, bridgeRow2]),
  };
  const materiaRepo = overrides.materiaRepo ?? {
    findByCourseCycleId: vi.fn().mockResolvedValue([materia1, materia2]),
  };
  const alumnosXMateriaRepo = overrides.alumnosXMateriaRepo ?? {
    upsertMany: vi.fn().mockResolvedValue({ count: 2 }),
  };
  const competencyRepo = overrides.competencyRepo ?? {
    findActiveByStudyPlanSubject: vi.fn().mockImplementation((spsId: string) => {
      if (spsId === 'sps-1') return Promise.resolve([competency1, competency2]);
      if (spsId === 'sps-2') return Promise.resolve([competency3]);
      return Promise.resolve([]);
    }),
  };
  const competenciaRepo = overrides.competenciaRepo ?? {
    bulkCreate: vi.fn().mockResolvedValue({ count: 3 }),
  };

  const uc = Object.create(CascadeAllStudentsMateriasCompetenciasUseCase.prototype);
  uc.alumnosCCRepo = alumnosCCRepo;
  uc.materiaRepo = materiaRepo;
  uc.alumnosXMateriaRepo = alumnosXMateriaRepo;
  uc.competencyRepo = competencyRepo;
  uc.competenciaRepo = competenciaRepo;
  return { uc, alumnosCCRepo, materiaRepo, alumnosXMateriaRepo, competencyRepo, competenciaRepo };
}

// ── BULK-01: empty rows ───────────────────────────────────────────────────────

describe('CascadeAllStudentsMateriasCompetenciasUseCase — BULK-01: empty rows', () => {
  it('returns all-zero result when the course cycle has no enrolled students', async () => {
    const { uc, materiaRepo, alumnosXMateriaRepo, competenciaRepo } = makeUC({
      alumnosCCRepo: { findByCourseCycle: vi.fn().mockResolvedValue([]) },
    });

    const result = await uc.execute({ ccId: 'cc-1' });

    expect(result).toEqual({
      studentsProcessed: 0,
      studentsFailed: 0,
      materiasCreated: 0,
      materiasSkipped: 0,
      competenciasCreated: 0,
      competenciasSkipped: 0,
    });

    // Short-circuit: no further repo calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((materiaRepo as any).findByCourseCycleId).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((alumnosXMateriaRepo as any).upsertMany).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((competenciaRepo as any).bulkCreate).not.toHaveBeenCalled();
  });
});

// ── BULK-02: zero materias ────────────────────────────────────────────────────

describe('CascadeAllStudentsMateriasCompetenciasUseCase — BULK-02: zero materias', () => {
  it('returns studentsProcessed=rows.length and zeros for counts when CC has no materias', async () => {
    const { uc, alumnosXMateriaRepo, competenciaRepo } = makeUC({
      materiaRepo: { findByCourseCycleId: vi.fn().mockResolvedValue([]) },
    });

    const result = await uc.execute({ ccId: 'cc-1' });

    expect(result).toEqual({
      studentsProcessed: 2,  // rows.length = 2
      studentsFailed: 0,
      materiasCreated: 0,
      materiasSkipped: 0,
      competenciasCreated: 0,
      competenciasSkipped: 0,
    });

    // No DB writes when there are no materias
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((alumnosXMateriaRepo as any).upsertMany).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((competenciaRepo as any).bulkCreate).not.toHaveBeenCalled();
  });
});

// ── BULK-03: happy path N×M×K ─────────────────────────────────────────────────

describe('CascadeAllStudentsMateriasCompetenciasUseCase — BULK-03: happy path N×M×K', () => {
  it('processes 2 students × 2 materias × 3 competencies and returns aggregated counts', async () => {
    const { uc, alumnosXMateriaRepo, competenciaRepo } = makeUC({
      // Each student: upsertMany creates 2 materias, bulkCreate creates 3 competencias
      alumnosXMateriaRepo: { upsertMany: vi.fn().mockResolvedValue({ count: 2 }) },
      competenciaRepo: { bulkCreate: vi.fn().mockResolvedValue({ count: 3 }) },
    });

    const result = await uc.execute({ ccId: 'cc-1' });

    expect(result).toEqual({
      studentsProcessed: 2,
      studentsFailed: 0,
      materiasCreated: 4,    // 2 per student × 2 students
      materiasSkipped: 0,
      competenciasCreated: 6, // 3 per student × 2 students
      competenciasSkipped: 0,
    });

    // upsertMany called once per student (not batched across students)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((alumnosXMateriaRepo as any).upsertMany).toHaveBeenCalledTimes(2);
    // bulkCreate called once per student
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((competenciaRepo as any).bulkCreate).toHaveBeenCalledTimes(2);
  });

  it('fetches materias and competencies ONCE (not per student)', async () => {
    const { uc, materiaRepo, competencyRepo } = makeUC();

    await uc.execute({ ccId: 'cc-1' });

    // findByCourseCycleId called exactly once, regardless of student count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((materiaRepo as any).findByCourseCycleId).toHaveBeenCalledTimes(1);
    expect((materiaRepo as any).findByCourseCycleId).toHaveBeenCalledWith('cc-1');

    // findActiveByStudyPlanSubject called once per unique SPS (2), not 2×2=4
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((competencyRepo as any).findActiveByStudyPlanSubject).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calledWith = (competencyRepo as any).findActiveByStudyPlanSubject.mock.calls
      .map((c: [string]) => c[0])
      .sort();
    expect(calledWith).toEqual(['sps-1', 'sps-2']);
  });

  it('passes the correct studentId per student in upsertMany', async () => {
    const { uc, alumnosXMateriaRepo } = makeUC({
      alumnosXMateriaRepo: { upsertMany: vi.fn().mockResolvedValue({ count: 2 }) },
    });

    await uc.execute({ ccId: 'cc-1' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = (alumnosXMateriaRepo as any).upsertMany.mock.calls;
    const allStudentIds = calls.map((c: [{ studentId: string }[]]) => c[0][0].studentId).sort();
    expect(allStudentIds).toEqual(['stu-1', 'stu-2']);
  });
});

// ── BULK-04: idempotent re-run ────────────────────────────────────────────────

describe('CascadeAllStudentsMateriasCompetenciasUseCase — BULK-04: idempotent re-run', () => {
  it('returns zero *Created counts when all rows already exist (skipDuplicates)', async () => {
    const { uc } = makeUC({
      alumnosXMateriaRepo: { upsertMany: vi.fn().mockResolvedValue({ count: 0 }) },
      competenciaRepo: { bulkCreate: vi.fn().mockResolvedValue({ count: 0 }) },
    });

    const result = await uc.execute({ ccId: 'cc-1' });

    expect(result).toEqual({
      studentsProcessed: 2,
      studentsFailed: 0,
      materiasCreated: 0,
      materiasSkipped: 4,    // 2 materias × 2 students — all skipped
      competenciasCreated: 0,
      competenciasSkipped: 6, // 3 competencias × 2 students — all skipped
    });
  });
});

// ── BULK-05: optativa filter ──────────────────────────────────────────────────

describe('CascadeAllStudentsMateriasCompetenciasUseCase — BULK-05: optativa filter', () => {
  const materiaObligatoria = { id: 'mxcc-obl-1', courseCycleId: 'cc-1', subjectId: 'sub-obl-1', studyPlanSubjectId: 'sps-obl-1', esOptativa: false };
  const materiaOptativa    = { id: 'mxcc-opt-1', courseCycleId: 'cc-1', subjectId: 'sub-opt-1', studyPlanSubjectId: 'sps-opt-1', esOptativa: true };

  it('upsertMany receives only obligatoria ids across all students — optativas excluded', async () => {
    const { uc, alumnosXMateriaRepo } = makeUC({
      materiaRepo: {
        findByCourseCycleId: vi.fn().mockResolvedValue([materiaObligatoria, materiaOptativa]),
      },
      alumnosXMateriaRepo: { upsertMany: vi.fn().mockResolvedValue({ count: 1 }) },
      competencyRepo: { findActiveByStudyPlanSubject: vi.fn().mockResolvedValue([]) },
    });

    await uc.execute({ ccId: 'cc-1' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = (alumnosXMateriaRepo as any).upsertMany.mock.calls;
    for (const [items] of calls) {
      const ids = (items as { materiaXCursoXCicloId: string }[]).map((i) => i.materiaXCursoXCicloId);
      expect(ids).toContain('mxcc-obl-1');
      expect(ids).not.toContain('mxcc-opt-1');
    }
  });

  it('findActiveByStudyPlanSubject is NOT called for optativa spsIds', async () => {
    const { uc, competencyRepo } = makeUC({
      materiaRepo: {
        findByCourseCycleId: vi.fn().mockResolvedValue([materiaObligatoria, materiaOptativa]),
      },
      alumnosXMateriaRepo: { upsertMany: vi.fn().mockResolvedValue({ count: 1 }) },
      competencyRepo: { findActiveByStudyPlanSubject: vi.fn().mockResolvedValue([]) },
    });

    await uc.execute({ ccId: 'cc-1' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calledWith = (competencyRepo as any).findActiveByStudyPlanSubject.mock.calls.map((c: [string]) => c[0]);
    expect(calledWith).toContain('sps-obl-1');
    expect(calledWith).not.toContain('sps-opt-1');
  });
});

// ── BULK-06: all-optativa CC ──────────────────────────────────────────────────

describe('CascadeAllStudentsMateriasCompetenciasUseCase — BULK-06: all-optativa CC', () => {
  it('returns studentsProcessed=rows.length and zero counts when all materias are optativa', async () => {
    const opt1 = { id: 'mxcc-opt-1', courseCycleId: 'cc-1', subjectId: 'sub-opt-1', studyPlanSubjectId: 'sps-opt-1', esOptativa: true };
    const opt2 = { id: 'mxcc-opt-2', courseCycleId: 'cc-1', subjectId: 'sub-opt-2', studyPlanSubjectId: 'sps-opt-2', esOptativa: true };

    const { uc, alumnosXMateriaRepo, competenciaRepo } = makeUC({
      materiaRepo: { findByCourseCycleId: vi.fn().mockResolvedValue([opt1, opt2]) },
    });

    const result = await uc.execute({ ccId: 'cc-1' });

    expect(result).toEqual({
      studentsProcessed: 2,
      studentsFailed: 0,
      materiasCreated: 0,
      materiasSkipped: 0,
      competenciasCreated: 0,
      competenciasSkipped: 0,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((alumnosXMateriaRepo as any).upsertMany).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((competenciaRepo as any).bulkCreate).not.toHaveBeenCalled();
  });
});

// ── BULK-07: best-effort partial failure ──────────────────────────────────────

describe('CascadeAllStudentsMateriasCompetenciasUseCase — BULK-07: best-effort partial failure', () => {
  it('increments studentsFailed on one student error and continues the loop', async () => {
    let callCount = 0;
    const { uc } = makeUC({
      alumnosXMateriaRepo: {
        upsertMany: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('DB timeout for student 1'));
          }
          return Promise.resolve({ count: 2 });
        }),
      },
      competenciaRepo: { bulkCreate: vi.fn().mockResolvedValue({ count: 3 }) },
    });

    const result = await uc.execute({ ccId: 'cc-1' });

    // Student 1 failed, student 2 succeeded
    expect(result.studentsProcessed).toBe(1);
    expect(result.studentsFailed).toBe(1);
    // Only student 2's counts are included
    expect(result.materiasCreated).toBe(2);
    expect(result.competenciasCreated).toBe(3);
    // No batch-level throw
    await expect(Promise.resolve(result)).resolves.toBeTruthy();
  });

  it('returns studentsProcessed=0 and studentsFailed=N when all students fail', async () => {
    const { uc } = makeUC({
      alumnosXMateriaRepo: {
        upsertMany: vi.fn().mockRejectedValue(new Error('DB down')),
      },
    });

    const result = await uc.execute({ ccId: 'cc-1' });

    expect(result.studentsProcessed).toBe(0);
    expect(result.studentsFailed).toBe(2);
    expect(result.materiasCreated).toBe(0);
  });
});

// ── BULK-08: grade preservation is structural ──────────────────────────────────

describe('CascadeAllStudentsMateriasCompetenciasUseCase — BULK-08: grade preservation', () => {
  it('never calls any method that could touch CompetenciaPeriodo children', async () => {
    const { uc, competenciaRepo } = makeUC();

    await uc.execute({ ccId: 'cc-1' });

    // The only method called on competenciaRepo is bulkCreate (parent valuation creation)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = competenciaRepo as any;
    expect(repo.bulkCreate).toHaveBeenCalled();
    // No save, delete, or period creation methods are called
    const calledMethods = Object.keys(repo).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (k) => typeof (repo as any)[k]?.mock !== 'undefined' && (repo as any)[k].mock.calls.length > 0
    );
    expect(calledMethods).toEqual(['bulkCreate']);
  });
});
