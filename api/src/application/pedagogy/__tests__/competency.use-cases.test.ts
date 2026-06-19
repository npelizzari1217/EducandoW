import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AutoCreateCompetencyValuationsUC,
  CreateSubjectCompetencyUC,
  ListSubjectCompetenciesUC,
  ListCompetencyValuationsUC,
  CopySubjectCompetenciesUC,
  UpdateSubjectCompetencyUC,
  GradePeriodValuationUC,
  ListBulkCompetencyValuationsUC,
} from '../use-cases/competency.use-cases';
import type { CompetencyValuationWithPeriods } from '@educandow/domain';
import {
  SubjectCompetency,
  CompetencyValuation,
  CompetencyPeriodValuation,
  GradingPeriodTemplate,
  GradeScale,
  GradeScaleValue,
  Id,
  CompetencyValuationNotFoundError,
  PeriodItemNotInTemplateError,
  GradeScaleValueMismatchError,
  PeriodLockedError,
  ValueNotFoundError,
  PeriodTemplateNotFoundError,
} from '@educandow/domain';
import type {
  SubjectCompetencyRepository,
  CompetencyValuationRepository,
  StudyPlanRepository,
  CompetencyPeriodValuationRepository,
  CourseCycleRepository,
  GradeScaleRepository,
  GradingPeriodRepository,
} from '@educandow/domain';

// ── Mock TenantContext ────────────────────────────────────
vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

import { TenantContext } from '../../../infrastructure/auth/tenant.context';

// ── Helpers ───────────────────────────────────────────────

function makeCompetency(id: string, studyPlanSubjectId: string, name?: string): SubjectCompetency {
  return SubjectCompetency.reconstruct({
    id: Id.reconstruct(id),
    studyPlanSubjectId,
    name: name ?? `Competency ${id}`,
    active: true,
  });
}

function makeCompetencyRepo(competencies: SubjectCompetency[] = []): SubjectCompetencyRepository {
  return {
    findActiveByStudyPlanSubject: vi.fn().mockResolvedValue(competencies),
    findByStudyPlanSubject: vi.fn().mockResolvedValue(competencies),
    findByStudyPlanSubjectAndName: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as SubjectCompetencyRepository;
}

function makeValuationRepo(): CompetencyValuationRepository {
  return {
    findByStudentAndStudyPlanSubject: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    bulkCreate: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as CompetencyValuationRepository;
}

function makeStudyPlanRepo(spsIdsByPlan: string[] = []): StudyPlanRepository {
  return {
    findStudyPlanSubjectIds: vi.fn().mockResolvedValue(spsIdsByPlan),
    findStudyPlanSubjectIdsByPlan: vi.fn().mockResolvedValue(spsIdsByPlan),
    findById: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    addCourse: vi.fn().mockResolvedValue(undefined),
    removeCourse: vi.fn().mockResolvedValue(undefined),
    addSubject: vi.fn().mockResolvedValue(undefined),
    removeSubject: vi.fn().mockResolvedValue(undefined),
    findPlanCourseById: vi.fn().mockResolvedValue(null),
    findPlanCoursesByPlan: vi.fn().mockResolvedValue([]),
    saveWithLevelCascade: vi.fn().mockResolvedValue(undefined),
    getDependencies: vi.fn().mockResolvedValue({ courseCount: 0, courseCycleCount: 0 }),
  } as unknown as StudyPlanRepository;
}

function makePrismaClient(overrides: Record<string, unknown> = {}) {
  return {
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    courseSection: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    enrollment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

// ── CreateSubjectCompetencyUC ─────────────────────────────

describe('CreateSubjectCompetencyUC', () => {
  it('creates competency scoped to studyPlanSubjectId', async () => {
    const repo = makeCompetencyRepo();
    const uc = new CreateSubjectCompetencyUC(repo);
    const result = await uc.execute({ studyPlanSubjectId: 'sps-1', name: 'Lectura crítica' });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.studyPlanSubjectId).toBe('sps-1');
      expect(result.value.name).toBe('Lectura crítica');
    }
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('returns ValidationError when name is empty', async () => {
    const repo = makeCompetencyRepo();
    const uc = new CreateSubjectCompetencyUC(repo);
    const result = await uc.execute({ studyPlanSubjectId: 'sps-1', name: '' });
    expect(result.isOk()).toBe(false);
  });

  it('returns ValidationError when studyPlanSubjectId is missing', async () => {
    const repo = makeCompetencyRepo();
    const uc = new CreateSubjectCompetencyUC(repo);
    const result = await uc.execute({ studyPlanSubjectId: '', name: 'Lectura' });
    expect(result.isOk()).toBe(false);
  });
});

// ── ListSubjectCompetenciesUC ─────────────────────────────

describe('ListSubjectCompetenciesUC', () => {
  it('returns active competencies for a studyPlanSubjectId', async () => {
    const comp = makeCompetency('comp-1', 'sps-1');
    const repo = makeCompetencyRepo([comp]);
    const uc = new ListSubjectCompetenciesUC(repo);
    const result = await uc.execute('sps-1');
    expect(result).toHaveLength(1);
    expect(repo.findActiveByStudyPlanSubject).toHaveBeenCalledWith('sps-1');
  });
});

// ── AutoCreateCompetencyValuationsUC.execute({ courseCycleId }) ──
// [TDD RED→GREEN] New trigger: CourseCycle instantiation is the sole creation path.
// Old executeForSubjectAssignment / executeForEnrollment / executeForNewEnrollment removed.

describe('AutoCreateCompetencyValuationsUC.execute({ courseCycleId })', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates parent valuations for all (student × competency) pairs in a CourseCycle', async () => {
    const comp1 = makeCompetency('comp-uuid-1', 'sps-1');
    const comp2 = makeCompetency('comp-uuid-2', 'sps-1');
    const competencyRepo = makeCompetencyRepo([comp1, comp2]);
    const valuationRepo = makeValuationRepo();
    const studyPlanRepo = makeStudyPlanRepo(['sps-1']);

    const prismaClient = makePrismaClient({
      courseCycle: {
        findUnique: vi.fn().mockResolvedValue({ courseId: 'section-1', studyPlanId: 'plan-1' }),
      },
      courseSection: {
        findUnique: vi.fn().mockResolvedValue({ level: 1, grade: '1°', division: 'A', academicYear: '2026' }),
      },
      enrollment: {
        // Shape updated: helper returns { studentId, student: { firstName, lastName } }
        findMany: vi.fn().mockResolvedValue([
          { studentId: 'student-1', student: { firstName: 'Juan', lastName: 'Pérez' } },
          { studentId: 'student-2', student: { firstName: 'Ana', lastName: 'López' } },
        ]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.execute({ courseCycleId: 'cc-uuid-1' });

    expect(studyPlanRepo.findStudyPlanSubjectIdsByPlan).toHaveBeenCalledWith('plan-1');
    expect(competencyRepo.findActiveByStudyPlanSubject).toHaveBeenCalledWith('sps-1');
    expect(valuationRepo.bulkCreate).toHaveBeenCalledTimes(1);
    const created = vi.mocked(valuationRepo.bulkCreate).mock.calls[0][0];
    // 2 students × 2 competencies = 4 valuations
    expect(created).toHaveLength(4);
  });

  it('each created valuation carries the correct courseCycleId', async () => {
    const comp = makeCompetency('comp-uuid-1', 'sps-1');
    const competencyRepo = makeCompetencyRepo([comp]);
    const valuationRepo = makeValuationRepo();
    const studyPlanRepo = makeStudyPlanRepo(['sps-1']);

    const prismaClient = makePrismaClient({
      courseCycle: {
        findUnique: vi.fn().mockResolvedValue({ courseId: 'section-1', studyPlanId: 'plan-1' }),
      },
      courseSection: {
        findUnique: vi.fn().mockResolvedValue({ level: 1, grade: '1°', division: 'A', academicYear: '2026' }),
      },
      enrollment: {
        findMany: vi.fn().mockResolvedValue([
          { studentId: 'student-1', student: { firstName: 'Juan', lastName: 'Pérez' } },
        ]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.execute({ courseCycleId: 'cc-uuid-1' });

    const created = vi.mocked(valuationRepo.bulkCreate).mock.calls[0][0] as CompetencyValuation[];
    expect(created[0].courseCycleId).toBe('cc-uuid-1');
    expect(created[0].studentId).toBe('student-1');
    expect(created[0].competencyId).toBe('comp-uuid-1');
  });

  it('no-op when CourseCycle not found', async () => {
    const competencyRepo = makeCompetencyRepo([]);
    const valuationRepo = makeValuationRepo();
    const studyPlanRepo = makeStudyPlanRepo([]);

    const prismaClient = makePrismaClient({
      courseCycle: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.execute({ courseCycleId: 'cc-nonexistent' });

    expect(studyPlanRepo.findStudyPlanSubjectIdsByPlan).not.toHaveBeenCalled();
    expect(valuationRepo.bulkCreate).not.toHaveBeenCalled();
  });

  it('no-op when study plan has no subjects', async () => {
    const competencyRepo = makeCompetencyRepo([]);
    const valuationRepo = makeValuationRepo();
    const studyPlanRepo = makeStudyPlanRepo([]); // returns empty

    const prismaClient = makePrismaClient({
      courseCycle: {
        findUnique: vi.fn().mockResolvedValue({ courseId: 'section-1', studyPlanId: 'plan-1' }),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.execute({ courseCycleId: 'cc-uuid-1' });

    expect(valuationRepo.bulkCreate).not.toHaveBeenCalled();
  });

  it('no-op when no competencies configured for any subject', async () => {
    const competencyRepo = makeCompetencyRepo([]); // no competencies
    const valuationRepo = makeValuationRepo();
    const studyPlanRepo = makeStudyPlanRepo(['sps-1']);

    const prismaClient = makePrismaClient({
      courseCycle: {
        findUnique: vi.fn().mockResolvedValue({ courseId: 'section-1', studyPlanId: 'plan-1' }),
      },
      courseSection: {
        findUnique: vi.fn().mockResolvedValue({ level: 1, grade: '1°', division: 'A', academicYear: '2026' }),
      },
      enrollment: {
        findMany: vi.fn().mockResolvedValue([{ studentId: 'student-1' }]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.execute({ courseCycleId: 'cc-uuid-1' });

    expect(valuationRepo.bulkCreate).not.toHaveBeenCalled();
  });

  it('no-op when no students enrolled in the course section', async () => {
    const comp = makeCompetency('comp-uuid-1', 'sps-1');
    const competencyRepo = makeCompetencyRepo([comp]);
    const valuationRepo = makeValuationRepo();
    const studyPlanRepo = makeStudyPlanRepo(['sps-1']);

    const prismaClient = makePrismaClient({
      courseCycle: {
        findUnique: vi.fn().mockResolvedValue({ courseId: 'section-1', studyPlanId: 'plan-1' }),
      },
      courseSection: {
        findUnique: vi.fn().mockResolvedValue({ level: 1, grade: '1°', division: 'A', academicYear: '2026' }),
      },
      enrollment: {
        findMany: vi.fn().mockResolvedValue([]), // no students
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.execute({ courseCycleId: 'cc-uuid-1' });

    expect(valuationRepo.bulkCreate).not.toHaveBeenCalled();
  });

  it('calls bulkCreate with full set; skipDuplicates at DB layer handles idempotency', async () => {
    const comp = makeCompetency('comp-uuid-1', 'sps-1');
    const competencyRepo = makeCompetencyRepo([comp]);
    const valuationRepo = makeValuationRepo();
    const studyPlanRepo = makeStudyPlanRepo(['sps-1']);

    const prismaClient = makePrismaClient({
      courseCycle: {
        findUnique: vi.fn().mockResolvedValue({ courseId: 'section-1', studyPlanId: 'plan-1' }),
      },
      courseSection: {
        findUnique: vi.fn().mockResolvedValue({ level: 1, grade: '1°', division: 'A', academicYear: '2026' }),
      },
      enrollment: {
        findMany: vi.fn().mockResolvedValue([
          { studentId: 'student-1', student: { firstName: 'Juan', lastName: 'Pérez' } },
        ]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.execute({ courseCycleId: 'cc-uuid-1' });

    // bulkCreate is always called with the full set; the DB handles skipDuplicates
    expect(valuationRepo.bulkCreate).toHaveBeenCalledTimes(1);
    const created = vi.mocked(valuationRepo.bulkCreate).mock.calls[0][0];
    expect(created).toHaveLength(1);
  });

  it('handles multiple study-plan subjects with multiple competencies each', async () => {
    const comp1 = makeCompetency('comp-1', 'sps-1');
    const comp2 = makeCompetency('comp-2', 'sps-1');
    const comp3 = makeCompetency('comp-3', 'sps-2');

    const competencyRepo = {
      ...makeCompetencyRepo(),
      findActiveByStudyPlanSubject: vi.fn().mockImplementation((spsId: string) => {
        if (spsId === 'sps-1') return Promise.resolve([comp1, comp2]);
        if (spsId === 'sps-2') return Promise.resolve([comp3]);
        return Promise.resolve([]);
      }),
    } as unknown as SubjectCompetencyRepository;

    const valuationRepo = makeValuationRepo();
    const studyPlanRepo = makeStudyPlanRepo(['sps-1', 'sps-2']);

    const prismaClient = makePrismaClient({
      courseCycle: {
        findUnique: vi.fn().mockResolvedValue({ courseId: 'section-1', studyPlanId: 'plan-1' }),
      },
      courseSection: {
        findUnique: vi.fn().mockResolvedValue({ level: 1, grade: '1°', division: 'A', academicYear: '2026' }),
      },
      enrollment: {
        findMany: vi.fn().mockResolvedValue([
          { studentId: 'student-1', student: { firstName: 'Juan', lastName: 'Pérez' } },
        ]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.execute({ courseCycleId: 'cc-uuid-1' });

    const created = vi.mocked(valuationRepo.bulkCreate).mock.calls[0][0];
    // 1 student × 3 competencies (2 from sps-1 + 1 from sps-2)
    expect(created).toHaveLength(3);
  });

  // 1b-T4 regression guard: AutoCreate now uses the shared infra helper for enrollment.
  // The studentId list produced must be identical; only the internal mechanism changes.
  it('regression guard: still produces correct studentId[] after shared-helper refactor', async () => {
    const comp = makeCompetency('comp-uuid-1', 'sps-1');
    const competencyRepo = makeCompetencyRepo([comp]);
    const valuationRepo = makeValuationRepo();
    const studyPlanRepo = makeStudyPlanRepo(['sps-1']);

    const prismaClient = makePrismaClient({
      courseCycle: {
        findUnique: vi.fn().mockResolvedValue({ courseId: 'section-1', studyPlanId: 'plan-1' }),
      },
      courseSection: {
        findUnique: vi.fn().mockResolvedValue({ level: 2, grade: '2°', division: 'B', academicYear: '2026' }),
      },
      enrollment: {
        findMany: vi.fn().mockResolvedValue([
          { studentId: 'stu-a', student: { firstName: 'Mario', lastName: 'García' } },
          { studentId: 'stu-b', student: { firstName: 'Lucia', lastName: 'Martínez' } },
          { studentId: 'stu-c', student: { firstName: 'Pedro', lastName: 'Gómez' } },
        ]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.execute({ courseCycleId: 'cc-regression' });

    const created = vi.mocked(valuationRepo.bulkCreate).mock.calls[0][0] as CompetencyValuation[];
    // 3 students × 1 competency = 3 valuations
    expect(created).toHaveLength(3);
    const createdStudentIds = created.map((v) => v.studentId).sort();
    expect(createdStudentIds).toEqual(['stu-a', 'stu-b', 'stu-c'].sort());
  });
});

// ── CopySubjectCompetenciesUC ─────────────────────────────

describe('CopySubjectCompetenciesUC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copies all source competencies to target when target has none', async () => {
    const comp1 = makeCompetency('comp-1', 'sps-src', 'Lectura');
    const comp2 = makeCompetency('comp-2', 'sps-src', 'Escritura');
    const repo = makeCompetencyRepo([comp1, comp2]);
    const uc = new CopySubjectCompetenciesUC(repo);

    const result = await uc.execute({
      sourceStudyPlanSubjectId: 'sps-src',
      targetStudyPlanSubjectId: 'sps-tgt',
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.copied).toBe(2);
      expect(result.value.skipped).toBe(0);
    }
    expect(repo.save).toHaveBeenCalledTimes(2);
  });

  it('skips competencies whose name already exists in target', async () => {
    const comp1 = makeCompetency('comp-1', 'sps-src', 'Lectura');
    const comp2 = makeCompetency('comp-2', 'sps-src', 'Escritura');
    const existingInTarget = makeCompetency('comp-3', 'sps-tgt', 'Lectura');

    const repo = {
      findActiveByStudyPlanSubject: vi.fn().mockResolvedValue([comp1, comp2]),
      findByStudyPlanSubjectAndName: vi.fn().mockImplementation((_spsId: string, name: string) => {
        if (name === 'Lectura') return Promise.resolve(existingInTarget);
        return Promise.resolve(null);
      }),
      findByStudyPlanSubject: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as SubjectCompetencyRepository;

    const uc = new CopySubjectCompetenciesUC(repo);
    const result = await uc.execute({
      sourceStudyPlanSubjectId: 'sps-src',
      targetStudyPlanSubjectId: 'sps-tgt',
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.copied).toBe(1);
      expect(result.value.skipped).toBe(1);
    }
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('returns { copied: 0, skipped: 0 } when source has no active competencies', async () => {
    const repo = makeCompetencyRepo([]);
    const uc = new CopySubjectCompetenciesUC(repo);
    const result = await uc.execute({
      sourceStudyPlanSubjectId: 'sps-src',
      targetStudyPlanSubjectId: 'sps-tgt',
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.copied).toBe(0);
      expect(result.value.skipped).toBe(0);
    }
  });

  it('returns ValidationError when source === target', async () => {
    const repo = makeCompetencyRepo([]);
    const uc = new CopySubjectCompetenciesUC(repo);
    const result = await uc.execute({
      sourceStudyPlanSubjectId: 'sps-1',
      targetStudyPlanSubjectId: 'sps-1',
    });
    expect(result.isOk()).toBe(false);
  });

  it('returns ValidationError when sourceStudyPlanSubjectId is missing', async () => {
    const repo = makeCompetencyRepo([]);
    const uc = new CopySubjectCompetenciesUC(repo);
    const result = await uc.execute({
      sourceStudyPlanSubjectId: '',
      targetStudyPlanSubjectId: 'sps-tgt',
    });
    expect(result.isOk()).toBe(false);
  });

  it('returns ValidationError when targetStudyPlanSubjectId is missing', async () => {
    const repo = makeCompetencyRepo([]);
    const uc = new CopySubjectCompetenciesUC(repo);
    const result = await uc.execute({
      sourceStudyPlanSubjectId: 'sps-src',
      targetStudyPlanSubjectId: '',
    });
    expect(result.isOk()).toBe(false);
  });
});

// ── UpdateSubjectCompetencyUC ─────────────────────────────

describe('UpdateSubjectCompetencyUC', () => {
  it('returns error when renaming to an existing sibling name (Spec 3 Req 3 Scenario 2)', async () => {
    const existing = makeCompetency('comp-1', 'sps-1', 'Lectura');
    const sibling = makeCompetency('comp-2', 'sps-1', 'Escritura');
    const repo = {
      findById: vi.fn().mockResolvedValue(existing),
      findByStudyPlanSubjectAndName: vi.fn().mockResolvedValue(sibling),
      findActiveByStudyPlanSubject: vi.fn().mockResolvedValue([]),
      findByStudyPlanSubject: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as SubjectCompetencyRepository;
    const uc = new UpdateSubjectCompetencyUC(repo);
    const result = await uc.execute('comp-1', { name: 'Escritura' });
    expect(result.isOk()).toBe(false);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('does not treat renaming to own current name as a conflict (idempotent)', async () => {
    const existing = makeCompetency('comp-1', 'sps-1', 'Lectura');
    const repo = {
      findById: vi.fn().mockResolvedValue(existing),
      // findByStudyPlanSubjectAndName returns the SAME competency → same id → not a conflict
      findByStudyPlanSubjectAndName: vi.fn().mockResolvedValue(existing),
      findActiveByStudyPlanSubject: vi.fn().mockResolvedValue([]),
      findByStudyPlanSubject: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as SubjectCompetencyRepository;
    const uc = new UpdateSubjectCompetencyUC(repo);
    const result = await uc.execute('comp-1', { name: 'Lectura' });
    expect(result.isOk()).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('returns not-found error when competency does not exist', async () => {
    const repo = makeCompetencyRepo(); // findById returns null by default
    const uc = new UpdateSubjectCompetencyUC(repo);
    const result = await uc.execute('non-existent', { name: 'Test' });
    expect(result.isOk()).toBe(false);
  });
});

// ── ListCompetencyValuationsUC ────────────────────────────

describe('ListCompetencyValuationsUC', () => {
  it('calls findByStudentAndStudyPlanSubject with studyPlanSubjectId', async () => {
    const valuationRepo = makeValuationRepo();
    const uc = new ListCompetencyValuationsUC(valuationRepo);
    await uc.execute('student-1', 'sps-1');
    expect(valuationRepo.findByStudentAndStudyPlanSubject).toHaveBeenCalledWith('student-1', 'sps-1');
  });
});

// ── GradePeriodValuationUC ────────────────────────────────
// [TDD RED→GREEN] Grade a (valuation, periodItem) pair with lazy child creation.

describe('GradePeriodValuationUC', () => {
  // ── Internal helpers (scoped to this describe) ─────────

  function makeParent(): CompetencyValuation {
    return CompetencyValuation.reconstruct({
      id: Id.reconstruct('v-1'),
      competencyId: 'comp-1',
      studentId: 'student-1',
      courseCycleId: 'cc-1',
      active: true,
    });
  }

  function makeTemplate(itemIds: string[] = ['item-7']): GradingPeriodTemplate {
    return GradingPeriodTemplate.reconstruct({
      id: 'template-1',
      name: 'Template',
      level: 1,
      modality: 0,
      active: true,
      deletedAt: null,
      items: itemIds.map((id, i) => ({ id, templateId: 'template-1', name: `Item ${i + 1}`, sortOrder: i + 1 })),
    });
  }

  function makeScale(id = 'scale-1'): GradeScale {
    return GradeScale.reconstruct({ id, name: 'Scale', level: 1, modality: 0, active: true, deletedAt: null, values: [] });
  }

  function makeScaleValue(id = 'gsv-a', scaleId = 'scale-1'): GradeScaleValue {
    return GradeScaleValue.reconstruct({
      id,
      scaleId,
      code: 'MB',
      label: 'Muy Bueno',
      internalStatus: 'APROBADO',
      sortOrder: 1,
      active: true,
      deletedAt: null,
    });
  }

  function makeValRepo(val?: CompetencyValuation | null): CompetencyValuationRepository {
    return {
      findById: vi.fn().mockResolvedValue(val ?? null),
      findByStudentAndStudyPlanSubject: vi.fn().mockResolvedValue([]),
      bulkCreate: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as CompetencyValuationRepository;
  }

  function makeCCRepo(ctx?: { level: number; modality: number } | null): CourseCycleRepository {
    return {
      findGradingContextByUuid: vi.fn().mockResolvedValue(ctx ?? null),
      findById: vi.fn().mockResolvedValue(null),
      findByUuid: vi.fn().mockResolvedValue(null),
      findByPair: vi.fn().mockResolvedValue(null),
      findAll: vi.fn().mockResolvedValue({ data: [], page: 1, pageSize: 10, total: 0 }),
      save: vi.fn().mockResolvedValue(undefined),
      createMany: vi.fn().mockResolvedValue({ created: 0, updated: 0, total: 0 }),
      softDelete: vi.fn().mockResolvedValue(undefined),
    } as unknown as CourseCycleRepository;
  }

  function makeGradingPeriodRepo(template?: GradingPeriodTemplate | null): GradingPeriodRepository {
    return {
      findActiveTemplateByLevelModality: vi.fn().mockResolvedValue(template ?? null),
      findTemplateById: vi.fn().mockResolvedValue(null),
      listTemplates: vi.fn().mockResolvedValue([]),
      existsTemplateName: vi.fn().mockResolvedValue(false),
      saveTemplate: vi.fn().mockResolvedValue(undefined),
      countDatesForTemplate: vi.fn().mockResolvedValue(0),
      softDeleteTemplate: vi.fn().mockResolvedValue(undefined),
      listDates: vi.fn().mockResolvedValue([]),
      saveDates: vi.fn().mockResolvedValue(undefined),
      findDatesByCycle: vi.fn().mockResolvedValue([]),
    } as unknown as GradingPeriodRepository;
  }

  function makeGradeScaleRepo(scale?: GradeScale | null, value?: GradeScaleValue | null): GradeScaleRepository {
    return {
      findActiveByLevelModality: vi.fn().mockResolvedValue(scale ?? null),
      findValueById: vi.fn().mockResolvedValue(value ?? null),
      findById: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
      existsByName: vi.fn().mockResolvedValue(false),
      countActiveValues: vi.fn().mockResolvedValue(0),
      save: vi.fn().mockResolvedValue(undefined),
      softDelete: vi.fn().mockResolvedValue(undefined),
      saveValue: vi.fn().mockResolvedValue(undefined),
      softDeleteValue: vi.fn().mockResolvedValue(undefined),
      existsValueCode: vi.fn().mockResolvedValue(false),
    } as unknown as GradeScaleRepository;
  }

  function makePeriodRepo(child?: CompetencyPeriodValuation | null): CompetencyPeriodValuationRepository {
    return {
      findByValuationAndPeriod: vi.fn().mockResolvedValue(child ?? null),
      save: vi.fn().mockResolvedValue(undefined),
      listByValuation: vi.fn().mockResolvedValue([]),
    } as unknown as CompetencyPeriodValuationRepository;
  }

  // ── GPE-1: Happy path lazy create ─────────────────────

  it('GPE-1: lazy-creates child row and snapshots grade on first grade', async () => {
    const parent = makeParent();
    const template = makeTemplate(['item-7']);
    const scale = makeScale();
    const scaleValue = makeScaleValue('gsv-a', 'scale-1');
    const periodRepo = makePeriodRepo(); // null → lazy create

    const uc = new GradePeriodValuationUC(
      makeValRepo(parent),
      makeCCRepo({ level: 1, modality: 0 }),
      makeGradingPeriodRepo(template),
      makeGradeScaleRepo(scale, scaleValue),
      periodRepo,
    );

    const result = await uc.execute({ valuationUuid: 'v-1', periodItemId: 'item-7', gradeScaleValueId: 'gsv-a' });

    expect(result.isOk()).toBe(true);
    const child = result.unwrap();
    expect(child.valuationId).toBe('v-1');
    expect(child.periodItemId).toBe('item-7');
    expect(child.gradeCode).toBe('MB');
    expect(child.internalStatus).toBe('APROBADO');
    expect(child.gradeScaleValueId).toBe('gsv-a');
    expect(periodRepo.save).toHaveBeenCalledTimes(1);
  });

  // ── GPE-2: Update existing child row ──────────────────

  it('GPE-2: updates existing child row and re-snapshots grade', async () => {
    const parent = makeParent();
    const template = makeTemplate(['item-7']);
    const scale = makeScale();
    const newValue = makeScaleValue('gsv-mb', 'scale-1');
    const existingChild = CompetencyPeriodValuation.reconstruct({
      id: 'child-1',
      valuationId: 'v-1',
      periodItemId: 'item-7',
      gradeScaleValueId: 'gsv-old',
      gradeCode: 'B',
      internalStatus: 'APROBADO',
      modificable: true,
      imprimible: false,
    });
    const periodRepo = makePeriodRepo(existingChild);

    const uc = new GradePeriodValuationUC(
      makeValRepo(parent),
      makeCCRepo({ level: 1, modality: 0 }),
      makeGradingPeriodRepo(template),
      makeGradeScaleRepo(scale, newValue),
      periodRepo,
    );

    const result = await uc.execute({ valuationUuid: 'v-1', periodItemId: 'item-7', gradeScaleValueId: 'gsv-mb' });

    expect(result.isOk()).toBe(true);
    const child = result.unwrap();
    expect(child.id).toBe('child-1');
    expect(child.gradeCode).toBe('MB'); // re-snapshotted from gsv-mb
    expect(child.gradeScaleValueId).toBe('gsv-mb');
    expect(periodRepo.save).toHaveBeenCalledTimes(1);
  });

  // ── GPE-3: Clear grade ────────────────────────────────

  it('GPE-3: clears grade when gradeScaleValueId is null', async () => {
    const parent = makeParent();
    const template = makeTemplate(['item-7']);
    const existingChild = CompetencyPeriodValuation.reconstruct({
      id: 'child-1',
      valuationId: 'v-1',
      periodItemId: 'item-7',
      gradeScaleValueId: 'gsv-a',
      gradeCode: 'MB',
      internalStatus: 'APROBADO',
      modificable: true,
      imprimible: false,
    });
    const periodRepo = makePeriodRepo(existingChild);

    const uc = new GradePeriodValuationUC(
      makeValRepo(parent),
      makeCCRepo({ level: 1, modality: 0 }),
      makeGradingPeriodRepo(template),
      makeGradeScaleRepo(), // scale not needed for clear
      periodRepo,
    );

    const result = await uc.execute({ valuationUuid: 'v-1', periodItemId: 'item-7', gradeScaleValueId: null });

    expect(result.isOk()).toBe(true);
    const child = result.unwrap();
    expect(child.gradeScaleValueId).toBeNull();
    expect(child.gradeCode).toBeNull();
    expect(child.internalStatus).toBeNull();
    expect(periodRepo.save).toHaveBeenCalledTimes(1);
  });

  // ── GPE-4: Locked period ──────────────────────────────

  it('GPE-4: returns PeriodLockedError when child has modificable=false', async () => {
    const parent = makeParent();
    const template = makeTemplate(['item-7']);
    const scale = makeScale();
    const scaleValue = makeScaleValue();
    const lockedChild = CompetencyPeriodValuation.reconstruct({
      id: 'child-1',
      valuationId: 'v-1',
      periodItemId: 'item-7',
      gradeScaleValueId: 'gsv-a',
      gradeCode: 'MB',
      internalStatus: 'APROBADO',
      modificable: false,
      imprimible: false,
    });

    const uc = new GradePeriodValuationUC(
      makeValRepo(parent),
      makeCCRepo({ level: 1, modality: 0 }),
      makeGradingPeriodRepo(template),
      makeGradeScaleRepo(scale, scaleValue),
      makePeriodRepo(lockedChild),
    );

    const result = await uc.execute({ valuationUuid: 'v-1', periodItemId: 'item-7', gradeScaleValueId: 'gsv-a' });

    expect(result.isOk()).toBe(false);
    expect(result.unwrapErr()).toBeInstanceOf(PeriodLockedError);
  });

  // ── GPE-5: Valuation not found ────────────────────────

  it('GPE-5: returns CompetencyValuationNotFoundError when valuation not found', async () => {
    const uc = new GradePeriodValuationUC(
      makeValRepo(null),
      makeCCRepo(),
      makeGradingPeriodRepo(),
      makeGradeScaleRepo(),
      makePeriodRepo(),
    );

    const result = await uc.execute({ valuationUuid: 'nonexistent', periodItemId: 'item-7', gradeScaleValueId: 'gsv-a' });

    expect(result.isOk()).toBe(false);
    expect(result.unwrapErr()).toBeInstanceOf(CompetencyValuationNotFoundError);
  });

  // ── GPE-6: Template not configured ────────────────────

  it('GPE-6: returns PeriodTemplateNotFoundError when no active template for level+modality', async () => {
    const parent = makeParent();

    const uc = new GradePeriodValuationUC(
      makeValRepo(parent),
      makeCCRepo({ level: 1, modality: 0 }),
      makeGradingPeriodRepo(null), // no template
      makeGradeScaleRepo(),
      makePeriodRepo(),
    );

    const result = await uc.execute({ valuationUuid: 'v-1', periodItemId: 'item-7', gradeScaleValueId: 'gsv-a' });

    expect(result.isOk()).toBe(false);
    expect(result.unwrapErr()).toBeInstanceOf(PeriodTemplateNotFoundError);
  });

  // ── GPE-7: periodItemId not in template ───────────────

  it('GPE-7: returns PeriodItemNotInTemplateError when periodItemId is not in template', async () => {
    const parent = makeParent();
    const template = makeTemplate(['item-7']); // only item-7 is valid

    const uc = new GradePeriodValuationUC(
      makeValRepo(parent),
      makeCCRepo({ level: 1, modality: 0 }),
      makeGradingPeriodRepo(template),
      makeGradeScaleRepo(),
      makePeriodRepo(),
    );

    const result = await uc.execute({ valuationUuid: 'v-1', periodItemId: 'item-99', gradeScaleValueId: 'gsv-a' });

    expect(result.isOk()).toBe(false);
    expect(result.unwrapErr()).toBeInstanceOf(PeriodItemNotInTemplateError);
  });

  // ── GPE-8: Scale value belongs to wrong scale ─────────

  it('GPE-8: returns GradeScaleValueMismatchError when scaleValue.scaleId !== scale.id', async () => {
    const parent = makeParent();
    const template = makeTemplate(['item-7']);
    const scale = makeScale('scale-1');
    const wrongValue = makeScaleValue('gsv-z', 'scale-OTHER'); // different scale

    const uc = new GradePeriodValuationUC(
      makeValRepo(parent),
      makeCCRepo({ level: 1, modality: 0 }),
      makeGradingPeriodRepo(template),
      makeGradeScaleRepo(scale, wrongValue),
      makePeriodRepo(),
    );

    const result = await uc.execute({ valuationUuid: 'v-1', periodItemId: 'item-7', gradeScaleValueId: 'gsv-z' });

    expect(result.isOk()).toBe(false);
    expect(result.unwrapErr()).toBeInstanceOf(GradeScaleValueMismatchError);
  });

  // ── GPE-10: imprimible is persisted when provided ─────
  it('GPE-10: sets imprimible=true when provided in input', async () => {
    const parent = makeParent();
    const template = makeTemplate(['item-7']);
    const scale = makeScale();
    const scaleValue = makeScaleValue();
    const periodRepo = makePeriodRepo(); // null → lazy create

    const uc = new GradePeriodValuationUC(
      makeValRepo(parent),
      makeCCRepo({ level: 1, modality: 0 }),
      makeGradingPeriodRepo(template),
      makeGradeScaleRepo(scale, scaleValue),
      periodRepo,
    );

    const result = await uc.execute({ valuationUuid: 'v-1', periodItemId: 'item-7', gradeScaleValueId: 'gsv-a', imprimible: true });

    expect(result.isOk()).toBe(true);
    const child = result.unwrap();
    expect(child.imprimible).toBe(true);
    expect(periodRepo.save).toHaveBeenCalledTimes(1);
  });

  // ── GPE-11: Grade-only PATCH does NOT change imprimible ─
  it('GPE-11: grade-only PATCH (imprimible absent) does NOT change stored imprimible', async () => {
    const parent = makeParent();
    const template = makeTemplate(['item-7']);
    const scale = makeScale();
    const newValue = makeScaleValue('gsv-mb', 'scale-1');
    const existingChild = CompetencyPeriodValuation.reconstruct({
      id: 'child-1',
      valuationId: 'v-1',
      periodItemId: 'item-7',
      gradeScaleValueId: 'gsv-old',
      gradeCode: 'B',
      internalStatus: 'APROBADO',
      modificable: true,
      imprimible: true, // pre-set to true
    });
    const periodRepo = makePeriodRepo(existingChild);

    const uc = new GradePeriodValuationUC(
      makeValRepo(parent),
      makeCCRepo({ level: 1, modality: 0 }),
      makeGradingPeriodRepo(template),
      makeGradeScaleRepo(scale, newValue),
      periodRepo,
    );

    // imprimible is NOT in the input (grade-only PATCH)
    const result = await uc.execute({ valuationUuid: 'v-1', periodItemId: 'item-7', gradeScaleValueId: 'gsv-mb' });

    expect(result.isOk()).toBe(true);
    const child = result.unwrap();
    expect(child.imprimible).toBe(true); // unchanged
    expect(child.gradeCode).toBe('MB');  // grade was updated
  });

  // ── GPE-12: imprimible-only update (no gradeScaleValueId) ─
  it('GPE-12: sets imprimible only when gradeScaleValueId is absent', async () => {
    const parent = makeParent();
    const template = makeTemplate(['item-7']);
    const existingChild = CompetencyPeriodValuation.reconstruct({
      id: 'child-1',
      valuationId: 'v-1',
      periodItemId: 'item-7',
      gradeScaleValueId: 'gsv-a',
      gradeCode: 'MB',
      internalStatus: 'APROBADO',
      modificable: true,
      imprimible: false,
    });
    const periodRepo = makePeriodRepo(existingChild);

    const uc = new GradePeriodValuationUC(
      makeValRepo(parent),
      makeCCRepo({ level: 1, modality: 0 }),
      makeGradingPeriodRepo(template),
      makeGradeScaleRepo(), // no scale needed
      periodRepo,
    );

    // Only imprimible, no gradeScaleValueId
    const result = await uc.execute({ valuationUuid: 'v-1', periodItemId: 'item-7', imprimible: true });

    expect(result.isOk()).toBe(true);
    const child = result.unwrap();
    expect(child.imprimible).toBe(true);
    expect(child.gradeCode).toBe('MB'); // grade untouched
    expect(periodRepo.save).toHaveBeenCalledTimes(1);
  });

  // ── GPE-9: Grade scale value UUID not found ───────────

  it('GPE-9: returns ValueNotFoundError when gradeScaleValueId is not found', async () => {
    const parent = makeParent();
    const template = makeTemplate(['item-7']);
    const scale = makeScale();
    const gradeScaleRepo = makeGradeScaleRepo(scale, null); // value = null → not found

    const uc = new GradePeriodValuationUC(
      makeValRepo(parent),
      makeCCRepo({ level: 1, modality: 0 }),
      makeGradingPeriodRepo(template),
      gradeScaleRepo,
      makePeriodRepo(),
    );

    const result = await uc.execute({ valuationUuid: 'v-1', periodItemId: 'item-7', gradeScaleValueId: 'gsv-unknown' });

    expect(result.isOk()).toBe(false);
    expect(result.unwrapErr()).toBeInstanceOf(ValueNotFoundError);
  });
});

// ── ListBulkCompetencyValuationsUC ────────────────────────
// [1a-T2 RED→GREEN] Bulk-read use case delegating to findByCourseCycleAndStudyPlanSubject.

describe('ListBulkCompetencyValuationsUC', () => {
  function makeBulkValuationRepo(rows: CompetencyValuationWithPeriods[] = []): import('@educandow/domain').CompetencyValuationRepository {
    return {
      findById:                             vi.fn().mockResolvedValue(null),
      findByStudentAndStudyPlanSubject:     vi.fn().mockResolvedValue([]),
      findByCourseCycleAndStudyPlanSubject: vi.fn().mockResolvedValue(rows),
      save:                                 vi.fn().mockResolvedValue(undefined),
      bulkCreate:                           vi.fn().mockResolvedValue(undefined),
      delete:                               vi.fn().mockResolvedValue(undefined),
    } as unknown as import('@educandow/domain').CompetencyValuationRepository;
  }

  it('delegates to findByCourseCycleAndStudyPlanSubject with the given params', async () => {
    const repo = makeBulkValuationRepo();
    const uc = new ListBulkCompetencyValuationsUC(repo);

    await uc.execute({ courseCycleId: 'cc-1', studyPlanSubjectId: 'sps-1' });

    expect(repo.findByCourseCycleAndStudyPlanSubject).toHaveBeenCalledWith('cc-1', 'sps-1');
  });

  it('returns the read-model list from the repo (BVR-1)', async () => {
    const row: CompetencyValuationWithPeriods = {
      valuationId:      'v-1',
      studentId:        's-1',
      competencyId:     'c-1',
      competencyName:   'Competencia 1',
      periodValuations: [
        {
          periodItemId:      'item-3',
          gradeScaleValueId: 'gsv-a',
          gradeCode:         'MB',
          internalStatus:    'APROBADO',
          modificable:       true,
          imprimible:        false,
        },
      ],
    };
    const repo = makeBulkValuationRepo([row]);
    const uc = new ListBulkCompetencyValuationsUC(repo);

    const result = await uc.execute({ courseCycleId: 'cc-1', studyPlanSubjectId: 'sps-1' });

    expect(result).toHaveLength(1);
    expect(result[0].valuationId).toBe('v-1');
    expect(result[0].periodValuations[0].gradeCode).toBe('MB');
  });

  it('returns [] when repo returns empty (BVR-4 — not 404)', async () => {
    const repo = makeBulkValuationRepo([]);
    const uc = new ListBulkCompetencyValuationsUC(repo);

    const result = await uc.execute({ courseCycleId: 'cc-new', studyPlanSubjectId: 'sps-1' });

    expect(result).toHaveLength(0);
  });

  it('returns parent with periodValuations: [] when no children graded (BVR-5)', async () => {
    const childless: CompetencyValuationWithPeriods = {
      valuationId:      'v-2',
      studentId:        's-2',
      competencyId:     'c-1',
      competencyName:   'Competencia 1',
      periodValuations: [],
    };
    const repo = makeBulkValuationRepo([childless]);
    const uc = new ListBulkCompetencyValuationsUC(repo);

    const result = await uc.execute({ courseCycleId: 'cc-1', studyPlanSubjectId: 'sps-1' });

    expect(result[0].periodValuations).toEqual([]);
  });
});
