/**
 * CascadeStudentMateriasCompetenciasUseCase — unit tests (TDD RED, T-16).
 *
 * Covers:
 *   UC-01: bridge row not found → NotFoundError
 *   UC-02: IDOR — row.courseCycleId !== ccId → NotFoundError
 *   UC-03: zero materias → success, all counts zero
 *   UC-04: happy path — N materias + active competencies → counts match inserts
 *   UC-05: idempotent re-run (upsertMany returns count=0, bulkCreate returns count=0)
 *   UC-06: grade preservation is structural (cascade never touches CompetenciaPeriodo children)
 *
 * Pattern: mocked repositories, no NestJS bootstrap, no DB.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { NotFoundError, SubjectCompetency, Id } from '@educandow/domain';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let CascadeStudentMateriasCompetenciasUseCase: any;

beforeAll(async () => {
  const mod = await import(
    '../cascade-student-materias-competencias.use-case'
  );
  CascadeStudentMateriasCompetenciasUseCase =
    mod.CascadeStudentMateriasCompetenciasUseCase;
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const bridgeRow = {
  id: 'acc-1',
  courseCycleId: 'cc-1',
  studentId: 'stu-1',
  printable: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Materia objects with studyPlanSubjectId (plain domain shape)
const materia1 = { id: 'mxcc-1', courseCycleId: 'cc-1', subjectId: 'sub-1', studyPlanSubjectId: 'sps-1' };
const materia2 = { id: 'mxcc-2', courseCycleId: 'cc-1', subjectId: 'sub-2', studyPlanSubjectId: 'sps-2' };

// Proper SubjectCompetency domain objects (required because cascade calls c.id.get())
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
    findById: vi.fn().mockResolvedValue(bridgeRow),
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

  const uc = Object.create(CascadeStudentMateriasCompetenciasUseCase.prototype);
  uc.alumnosCCRepo = alumnosCCRepo;
  uc.materiaRepo = materiaRepo;
  uc.alumnosXMateriaRepo = alumnosXMateriaRepo;
  uc.competencyRepo = competencyRepo;
  uc.competenciaRepo = competenciaRepo;
  return { uc, alumnosCCRepo, materiaRepo, alumnosXMateriaRepo, competencyRepo, competenciaRepo };
}

// ── UC-01: bridge row not found ───────────────────────────────────────────────

describe('CascadeStudentMateriasCompetenciasUseCase — UC-01: bridge row not found', () => {
  it('throws NotFoundError when bridge row does not exist', async () => {
    const { uc } = makeUC({
      alumnosCCRepo: { findById: vi.fn().mockResolvedValue(null) },
    });

    await expect(uc.execute({ id: 'acc-999', ccId: 'cc-1' })).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ── UC-02: IDOR guard ─────────────────────────────────────────────────────────

describe('CascadeStudentMateriasCompetenciasUseCase — UC-02: IDOR guard', () => {
  it('throws NotFoundError when bridge row belongs to a different courseCycle', async () => {
    const rowOtherCC = { ...bridgeRow, courseCycleId: 'cc-OTHER' };
    const { uc } = makeUC({
      alumnosCCRepo: { findById: vi.fn().mockResolvedValue(rowOtherCC) },
    });

    // Row exists but belongs to 'cc-OTHER', not 'cc-1'
    await expect(uc.execute({ id: 'acc-1', ccId: 'cc-1' })).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ── UC-03: zero materias ──────────────────────────────────────────────────────

describe('CascadeStudentMateriasCompetenciasUseCase — UC-03: zero materias', () => {
  it('returns all-zero counts when the course cycle has no materias', async () => {
    const { uc, alumnosXMateriaRepo, competenciaRepo } = makeUC({
      materiaRepo: { findByCourseCycleId: vi.fn().mockResolvedValue([]) },
    });

    const result = await uc.execute({ id: 'acc-1', ccId: 'cc-1' });

    expect(result).toEqual({
      materiasCreated: 0,
      materiasSkipped: 0,
      competenciasCreated: 0,
      competenciasSkipped: 0,
    });

    // No DB writes attempted when there are no materias
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((alumnosXMateriaRepo as any).upsertMany).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((competenciaRepo as any).bulkCreate).not.toHaveBeenCalled();
  });
});

// ── UC-04: happy path ─────────────────────────────────────────────────────────

describe('CascadeStudentMateriasCompetenciasUseCase — UC-04: happy path', () => {
  it('upserts 2 MateriasXAlumno + 3 Competencias and returns correct counts', async () => {
    const { uc, alumnosXMateriaRepo, competenciaRepo } = makeUC({
      alumnosXMateriaRepo: { upsertMany: vi.fn().mockResolvedValue({ count: 2 }) },
      competenciaRepo: { bulkCreate: vi.fn().mockResolvedValue({ count: 3 }) },
    });

    const result = await uc.execute({ id: 'acc-1', ccId: 'cc-1' });

    // Materia upsert called with both materias for the student
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((alumnosXMateriaRepo as any).upsertMany).toHaveBeenCalledWith([
      { materiaXCursoXCicloId: 'mxcc-1', studentId: 'stu-1' },
      { materiaXCursoXCicloId: 'mxcc-2', studentId: 'stu-1' },
    ]);

    // bulkCreate called once with 3 competency valuations (all for stu-1, cc-1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cRepo = competenciaRepo as any;
    expect(cRepo.bulkCreate).toHaveBeenCalledTimes(1);
    const createdValuations = cRepo.bulkCreate.mock.calls[0][0];
    expect(createdValuations).toHaveLength(3);
    expect(createdValuations.map((v: { competencyId: string }) => v.competencyId).sort()).toEqual(
      ['comp-1', 'comp-2', 'comp-3'].sort()
    );

    expect(result).toEqual({
      materiasCreated: 2,
      materiasSkipped: 0,    // 2 requested, 2 created → 0 skipped
      competenciasCreated: 3,
      competenciasSkipped: 0, // 3 requested, 3 created → 0 skipped
    });
  });

  it('resolves competencies per unique studyPlanSubjectId from materias', async () => {
    const { uc, competencyRepo } = makeUC();

    await uc.execute({ id: 'acc-1', ccId: 'cc-1' });

    // Two unique SPS IDs (sps-1, sps-2) → 2 calls to findActiveByStudyPlanSubject
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = competencyRepo as any;
    expect(repo.findActiveByStudyPlanSubject).toHaveBeenCalledTimes(2);
    const calledWith = repo.findActiveByStudyPlanSubject.mock.calls
      .map((c: [string]) => c[0])
      .sort();
    expect(calledWith).toEqual(['sps-1', 'sps-2']);
  });
});

// ── UC-05: idempotent re-run ──────────────────────────────────────────────────

describe('CascadeStudentMateriasCompetenciasUseCase — UC-05: idempotent re-run', () => {
  it('returns zero *Created counts when all rows already exist (skipDuplicates)', async () => {
    // upsertMany returns count=0 (nothing new inserted) → all 2 materias were skipped
    // bulkCreate returns count=0 (nothing new inserted) → all 3 competencias were skipped
    const { uc } = makeUC({
      alumnosXMateriaRepo: { upsertMany: vi.fn().mockResolvedValue({ count: 0 }) },
      competenciaRepo: { bulkCreate: vi.fn().mockResolvedValue({ count: 0 }) },
    });

    const result = await uc.execute({ id: 'acc-1', ccId: 'cc-1' });

    expect(result).toEqual({
      materiasCreated: 0,
      materiasSkipped: 2,     // 2 materias, all skipped
      competenciasCreated: 0,
      competenciasSkipped: 3, // 3 competencias, all skipped
    });
  });

  it('partial re-run: 1 new materia + 2 new competencias when CC grows', async () => {
    // Simulate: 2 materias in CC, but only 1 is new (1 already existed)
    // 3 competencies total, 2 already existed
    const { uc } = makeUC({
      alumnosXMateriaRepo: { upsertMany: vi.fn().mockResolvedValue({ count: 1 }) },
      competenciaRepo: { bulkCreate: vi.fn().mockResolvedValue({ count: 2 }) },
    });

    const result = await uc.execute({ id: 'acc-1', ccId: 'cc-1' });

    expect(result).toEqual({
      materiasCreated: 1,
      materiasSkipped: 1,
      competenciasCreated: 2,
      competenciasSkipped: 1,
    });
  });
});

// ── UC-06: grade preservation is structural ───────────────────────────────────

describe('CascadeStudentMateriasCompetenciasUseCase — UC-06: grade preservation', () => {
  it('never calls any method that could touch CompetenciaPeriodo children', async () => {
    const { uc, competenciaRepo } = makeUC();

    await uc.execute({ id: 'acc-1', ccId: 'cc-1' });

    // The only methods called on competenciaRepo are bulkCreate (parent creation)
    // Repo never exposes a "createPeriod" or "save" that would touch period children
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = competenciaRepo as any;
    expect(repo.bulkCreate).toHaveBeenCalledTimes(1);
    // No other methods called: no save, no delete, no period creation
    const calledMethods = Object.keys(repo).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (k) => typeof (repo as any)[k]?.mock !== 'undefined' && (repo as any)[k].mock.calls.length > 0
    );
    expect(calledMethods).toEqual(['bulkCreate']);
  });
});
