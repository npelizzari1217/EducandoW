import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AutoCreateCompetencyValuationsUC,
  CreateSubjectCompetencyUC,
  ListSubjectCompetenciesUC,
  ListCompetencyValuationsUC,
  CopySubjectCompetenciesUC,
  UpdateSubjectCompetencyUC,
} from '../use-cases/competency.use-cases';
import { SubjectCompetency, CompetencyValuation, Id } from '@educandow/domain';
import type {
  SubjectCompetencyRepository,
  CompetencyValuationRepository,
  StudyPlanRepository,
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

function makeValuationRepo(existing: CompetencyValuation | null = null): CompetencyValuationRepository {
  return {
    findByStudentAndCompetency: vi.fn().mockResolvedValue(existing),
    findByStudentAndStudyPlanSubject: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    bulkCreate: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as CompetencyValuationRepository;
}

function makeStudyPlanRepo(spsIds: string[] = []): StudyPlanRepository {
  return {
    findStudyPlanSubjectIds: vi.fn().mockResolvedValue(spsIds),
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
    courseSection: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    subjectAssignment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    enrollment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

function makeExistingValuation(competencyId: string, studentId: string): CompetencyValuation {
  return CompetencyValuation.create({
    competencyId,
    studentId,
    valuation1: null, valuation2: null, valuation3: null, valuation4: null,
    modificable1: true, modificable2: true, modificable3: true, modificable4: true,
    imprimible1: false, imprimible2: false, imprimible3: false, imprimible4: false,
    periodActive: 1,
  });
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

// ── AutoCreateCompetencyValuationsUC.executeForSubjectAssignment ──

describe('AutoCreateCompetencyValuationsUC.executeForSubjectAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates through StudyPlan hierarchy to create valuations', async () => {
    const comp1 = makeCompetency('comp-uuid-1', 'sps-1');
    const comp2 = makeCompetency('comp-uuid-2', 'sps-1');
    const competencyRepo = makeCompetencyRepo([comp1, comp2]);
    const valuationRepo = makeValuationRepo(null);
    const studyPlanRepo = makeStudyPlanRepo(['sps-1']);

    const prismaClient = makePrismaClient({
      courseSection: {
        findUnique: vi.fn().mockResolvedValue({ level: 1, grade: '1°', division: 'A', academicYear: '2026' }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      enrollment: {
        findMany: vi.fn().mockResolvedValue([{ studentId: 'student-1' }]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.executeForSubjectAssignment('subj-1', 'section-1');

    expect(studyPlanRepo.findStudyPlanSubjectIds).toHaveBeenCalledWith('section-1', 'subj-1');
    expect(competencyRepo.findActiveByStudyPlanSubject).toHaveBeenCalledWith('sps-1');
    expect(valuationRepo.bulkCreate).toHaveBeenCalledTimes(1);
    const created = vi.mocked(valuationRepo.bulkCreate).mock.calls[0][0];
    expect(created).toHaveLength(2);
  });

  it('no-op when findStudyPlanSubjectIds returns empty array', async () => {
    const competencyRepo = makeCompetencyRepo([]);
    const valuationRepo = makeValuationRepo(null);
    const studyPlanRepo = makeStudyPlanRepo([]);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.executeForSubjectAssignment('subj-1', 'section-1');

    expect(competencyRepo.findActiveByStudyPlanSubject).not.toHaveBeenCalled();
    expect(valuationRepo.bulkCreate).not.toHaveBeenCalled();
  });

  it('no-op when zero competencies found', async () => {
    const competencyRepo = makeCompetencyRepo([]);
    const valuationRepo = makeValuationRepo(null);
    const studyPlanRepo = makeStudyPlanRepo(['sps-1']);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.executeForSubjectAssignment('subj-1', 'section-1');

    expect(valuationRepo.bulkCreate).not.toHaveBeenCalled();
  });

  it('does not duplicate if valuation already exists (idempotency)', async () => {
    const comp = makeCompetency('comp-uuid-1', 'sps-1');
    const existingValuation = makeExistingValuation('comp-uuid-1', 'student-1');
    const competencyRepo = makeCompetencyRepo([comp]);
    const valuationRepo = makeValuationRepo(existingValuation);
    const studyPlanRepo = makeStudyPlanRepo(['sps-1']);

    const prismaClient = makePrismaClient({
      courseSection: {
        findUnique: vi.fn().mockResolvedValue({ level: 1, grade: '1°', division: 'A', academicYear: '2026' }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      enrollment: {
        findMany: vi.fn().mockResolvedValue([{ studentId: 'student-1' }]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.executeForSubjectAssignment('subj-1', 'section-1');

    expect(valuationRepo.bulkCreate).not.toHaveBeenCalled();
  });
});

// ── AutoCreateCompetencyValuationsUC.executeForEnrollment ──

describe('AutoCreateCompetencyValuationsUC.executeForEnrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates valuations for all competencies via hierarchy when enrolling', async () => {
    const comp1 = makeCompetency('comp-uuid-1', 'sps-1');
    const comp2 = makeCompetency('comp-uuid-2', 'sps-1');
    const competencyRepo = makeCompetencyRepo([comp1, comp2]);
    const valuationRepo = makeValuationRepo(null);
    const studyPlanRepo = makeStudyPlanRepo(['sps-1']);

    const prismaClient = makePrismaClient({
      subjectAssignment: {
        findMany: vi.fn().mockResolvedValue([{ subjectId: 'subj-1' }]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.executeForEnrollment('student-1', 'section-1');

    expect(studyPlanRepo.findStudyPlanSubjectIds).toHaveBeenCalledWith('section-1', 'subj-1');
    expect(competencyRepo.findActiveByStudyPlanSubject).toHaveBeenCalledWith('sps-1');
    expect(valuationRepo.bulkCreate).toHaveBeenCalledTimes(1);
    const created = vi.mocked(valuationRepo.bulkCreate).mock.calls[0][0];
    expect(created).toHaveLength(2);
  });

  it('skips creation when no subject assignments exist', async () => {
    const competencyRepo = makeCompetencyRepo([]);
    const valuationRepo = makeValuationRepo(null);
    const studyPlanRepo = makeStudyPlanRepo([]);

    const prismaClient = makePrismaClient({
      subjectAssignment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.executeForEnrollment('student-1', 'section-1');

    expect(valuationRepo.bulkCreate).not.toHaveBeenCalled();
  });

  it('skips creation when subject has no active competencies via hierarchy', async () => {
    const competencyRepo = makeCompetencyRepo([]);
    const valuationRepo = makeValuationRepo(null);
    const studyPlanRepo = makeStudyPlanRepo(['sps-1']);

    const prismaClient = makePrismaClient({
      subjectAssignment: {
        findMany: vi.fn().mockResolvedValue([{ subjectId: 'subj-1' }]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.executeForEnrollment('student-1', 'section-1');

    expect(valuationRepo.bulkCreate).not.toHaveBeenCalled();
  });

  it('does not duplicate if valuation already exists', async () => {
    const comp = makeCompetency('comp-uuid-1', 'sps-1');
    const existingValuation = makeExistingValuation('comp-uuid-1', 'student-1');
    const competencyRepo = makeCompetencyRepo([comp]);
    const valuationRepo = makeValuationRepo(existingValuation);
    const studyPlanRepo = makeStudyPlanRepo(['sps-1']);

    const prismaClient = makePrismaClient({
      subjectAssignment: {
        findMany: vi.fn().mockResolvedValue([{ subjectId: 'subj-1' }]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.executeForEnrollment('student-1', 'section-1');

    expect(valuationRepo.bulkCreate).not.toHaveBeenCalled();
  });
});

// ── AutoCreateCompetencyValuationsUC.executeForNewEnrollment ──

describe('AutoCreateCompetencyValuationsUC.executeForNewEnrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds course sections by enrollment data and creates valuations via hierarchy', async () => {
    const comp = makeCompetency('comp-uuid-1', 'sps-1');
    const competencyRepo = makeCompetencyRepo([comp]);
    const valuationRepo = makeValuationRepo(null);
    const studyPlanRepo = makeStudyPlanRepo(['sps-1']);

    const prismaClient = makePrismaClient({
      courseSection: {
        findMany: vi.fn().mockResolvedValue([{ id: 'section-1' }]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      subjectAssignment: {
        findMany: vi.fn().mockResolvedValue([{ subjectId: 'subj-1' }]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.executeForNewEnrollment('student-1', { level: 2, grade: '3°', division: 'A', academicYear: '2026' });

    expect(prismaClient.courseSection.findMany).toHaveBeenCalled();
    expect(studyPlanRepo.findStudyPlanSubjectIds).toHaveBeenCalled();
    expect(competencyRepo.findActiveByStudyPlanSubject).toHaveBeenCalled();
    expect(valuationRepo.bulkCreate).toHaveBeenCalledTimes(1);
  });

  it('skips if no course sections match enrollment data', async () => {
    const competencyRepo = makeCompetencyRepo([]);
    const valuationRepo = makeValuationRepo(null);
    const studyPlanRepo = makeStudyPlanRepo([]);

    const prismaClient = makePrismaClient({
      courseSection: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo, studyPlanRepo);
    await uc.executeForNewEnrollment('student-1', { level: 2, grade: '3°', division: 'A', academicYear: '2026' });

    expect(valuationRepo.bulkCreate).not.toHaveBeenCalled();
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
    const valuationRepo = makeValuationRepo(null);
    const uc = new ListCompetencyValuationsUC(valuationRepo);
    await uc.execute('student-1', 'sps-1');
    expect(valuationRepo.findByStudentAndStudyPlanSubject).toHaveBeenCalledWith('student-1', 'sps-1');
  });
});
