import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutoCreateCompetencyValuationsUC } from '../use-cases/competency.use-cases';
import { SubjectCompetency, CompetencyValuation } from '@educandow/domain';
import type { SubjectCompetencyRepository, CompetencyValuationRepository } from '@educandow/domain';

// ── Mock TenantContext ────────────────────────────────────
vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

import { TenantContext } from '../../../infrastructure/auth/tenant.context';

// ── Helpers ───────────────────────────────────────────────

function makeCompetency(id: string, subjectId: string): SubjectCompetency {
  return SubjectCompetency.reconstruct({
    id: { get: () => id } as ReturnType<typeof import('@educandow/domain').Id.create>,
    subjectId,
    name: `Competency ${id}`,
    periodActive: 4,
    active: true,
  });
}

function makeCompetencyRepo(competencies: SubjectCompetency[] = []): SubjectCompetencyRepository {
  return {
    findActiveBySubject: vi.fn().mockResolvedValue(competencies),
    findBySubject: vi.fn().mockResolvedValue(competencies),
    findBySubjectAndName: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as SubjectCompetencyRepository;
}

function makeValuationRepo(existing: CompetencyValuation | null = null): CompetencyValuationRepository {
  return {
    findByStudentAndCompetency: vi.fn().mockResolvedValue(existing),
    findByStudentAndSubject: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    bulkCreate: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as CompetencyValuationRepository;
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

// ── executeForEnrollment ──────────────────────────────────

describe('AutoCreateCompetencyValuationsUC.executeForEnrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates valuations for all competencies when enrolling', async () => {
    const comp1 = makeCompetency('comp-uuid-1', 'subj-1');
    const comp2 = makeCompetency('comp-uuid-2', 'subj-1');
    const competencyRepo = makeCompetencyRepo([comp1, comp2]);
    const valuationRepo = makeValuationRepo(null);

    const prismaClient = makePrismaClient({
      subjectAssignment: {
        findMany: vi.fn().mockResolvedValue([{ subjectId: 'subj-1' }]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo);
    await uc.executeForEnrollment('student-1', 'section-1');

    expect(competencyRepo.findActiveBySubject).toHaveBeenCalledWith('subj-1');
    expect(valuationRepo.bulkCreate).toHaveBeenCalledTimes(1);
    const created = vi.mocked(valuationRepo.bulkCreate).mock.calls[0][0];
    expect(created).toHaveLength(2);
  });

  it('skips creation when no subject assignments exist', async () => {
    const competencyRepo = makeCompetencyRepo([]);
    const valuationRepo = makeValuationRepo(null);

    const prismaClient = makePrismaClient({
      subjectAssignment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo);
    await uc.executeForEnrollment('student-1', 'section-1');

    expect(valuationRepo.bulkCreate).not.toHaveBeenCalled();
  });

  it('skips creation when subject has no active competencies', async () => {
    const competencyRepo = makeCompetencyRepo([]);
    const valuationRepo = makeValuationRepo(null);

    const prismaClient = makePrismaClient({
      subjectAssignment: {
        findMany: vi.fn().mockResolvedValue([{ subjectId: 'subj-1' }]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo);
    await uc.executeForEnrollment('student-1', 'section-1');

    expect(valuationRepo.bulkCreate).not.toHaveBeenCalled();
  });

  it('does not duplicate if valuation already exists', async () => {
    const comp = makeCompetency('comp-uuid-1', 'subj-1');
    const existingValuation = CompetencyValuation.create({
      competencyId: 'comp-uuid-1',
      studentId: 'student-1',
      valuation1: null, valuation2: null, valuation3: null, valuation4: null,
      modificable1: true, modificable2: true, modificable3: true, modificable4: true,
      imprimible1: false, imprimible2: false, imprimible3: false, imprimible4: false,
      periodActive: 1,
    });
    const competencyRepo = makeCompetencyRepo([comp]);
    const valuationRepo = makeValuationRepo(existingValuation);

    const prismaClient = makePrismaClient({
      subjectAssignment: {
        findMany: vi.fn().mockResolvedValue([{ subjectId: 'subj-1' }]),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo);
    await uc.executeForEnrollment('student-1', 'section-1');

    // bulkCreate not called since all pairs already exist
    expect(valuationRepo.bulkCreate).not.toHaveBeenCalled();
  });
});

// ── executeForNewEnrollment (from enrollment data) ────────

describe('AutoCreateCompetencyValuationsUC.executeForNewEnrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds course sections by enrollment data and creates valuations', async () => {
    const comp = makeCompetency('comp-uuid-1', 'subj-1');
    const competencyRepo = makeCompetencyRepo([comp]);
    const valuationRepo = makeValuationRepo(null);

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

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo);
    await uc.executeForNewEnrollment('student-1', { level: 2, grade: '3°', division: 'A', academicYear: '2026' });

    expect(prismaClient.courseSection.findMany).toHaveBeenCalled();
    expect(competencyRepo.findActiveBySubject).toHaveBeenCalledWith('subj-1');
    expect(valuationRepo.bulkCreate).toHaveBeenCalledTimes(1);
  });

  it('skips if no course sections match enrollment data', async () => {
    const competencyRepo = makeCompetencyRepo([]);
    const valuationRepo = makeValuationRepo(null);

    const prismaClient = makePrismaClient({
      courseSection: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(prismaClient as never);

    const uc = new AutoCreateCompetencyValuationsUC(competencyRepo, valuationRepo);
    await uc.executeForNewEnrollment('student-1', { level: 2, grade: '3°', division: 'A', academicYear: '2026' });

    expect(valuationRepo.bulkCreate).not.toHaveBeenCalled();
  });
});
