import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaStudyPlanRepository } from '../prisma-study-plan.repository';
import { TenantContext } from '../../../../auth/tenant.context';
import { StudyPlan, Id, EducationalLevelCode, EducationalModalityCode } from '@educandow/domain';

vi.mock('../../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

function makePlan(id: string, level: EducationalLevelCode, modality: EducationalModalityCode): StudyPlan {
  return StudyPlan.reconstruct({
    id: Id.reconstruct(id),
    name: 'Plan Test',
    level,
    modality,
    active: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  });
}

// ── saveWithLevelCascade ──────────────────────────────────────

describe('PrismaStudyPlanRepository — saveWithLevelCascade', () => {
  beforeEach(() => {
    vi.mocked(TenantContext.getClient).mockReset();
  });

  it('runs studyPlan.upsert + courseSection.updateMany + courseCycle.updateMany inside a single interactive transaction (level=3, modality=1 → composite 31)', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({});
    const mockCourseSectionUpdateMany = vi.fn().mockResolvedValue({ count: 2 });
    const mockCourseCycleUpdateMany = vi.fn().mockResolvedValue({ count: 2 });
    const txMock = {
      studyPlan: { upsert: mockUpsert },
      courseSection: { updateMany: mockCourseSectionUpdateMany },
      courseCycle: { updateMany: mockCourseCycleUpdateMany },
    };
    const mockTransaction = vi.fn().mockImplementation(async (fn: (tx: typeof txMock) => Promise<void>) => fn(txMock));

    vi.mocked(TenantContext.getClient).mockReturnValue({
      $transaction: mockTransaction,
    } as any);

    const plan = makePlan('plan-1', EducationalLevelCode.SECUNDARIO, EducationalModalityCode.TALLERES);
    const repo = new PrismaStudyPlanRepository();
    await repo.saveWithLevelCascade(plan, 3, 1);

    // All three writes must run inside a single $transaction call
    expect(mockTransaction).toHaveBeenCalledOnce();

    // studyPlan.upsert called inside tx with level=3, modality=1
    expect(mockUpsert).toHaveBeenCalledOnce();
    const upsertArg = mockUpsert.mock.calls[0][0];
    expect(upsertArg.update.level).toBe(3);
    expect(upsertArg.update.modality).toBe(1);
    expect(upsertArg.create.level).toBe(3);
    expect(upsertArg.create.modality).toBe(1);

    // courseSection.updateMany: separate level and modality columns
    expect(mockCourseSectionUpdateMany).toHaveBeenCalledWith({
      where: { studyPlanCourses: { some: { studyPlanId: 'plan-1' } } },
      data: { level: 3, modality: 1 },
    });

    // courseCycle.updateMany: composite code (3 * 10 + 1 = 31)
    expect(mockCourseCycleUpdateMany).toHaveBeenCalledWith({
      where: { studyPlanId: 'plan-1' },
      data: { level: 31 },
    });
  });

  it('all writes occur inside the transaction callback — top-level client studyPlan.upsert is NOT called', async () => {
    const topLevelUpsert = vi.fn();
    const mockUpsert = vi.fn().mockResolvedValue({});
    const mockCourseSectionUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockCourseCycleUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
    const txMock = {
      studyPlan: { upsert: mockUpsert },
      courseSection: { updateMany: mockCourseSectionUpdateMany },
      courseCycle: { updateMany: mockCourseCycleUpdateMany },
    };
    const mockTransaction = vi.fn().mockImplementation(async (fn: (tx: typeof txMock) => Promise<void>) => fn(txMock));

    vi.mocked(TenantContext.getClient).mockReturnValue({
      studyPlan: { upsert: topLevelUpsert },
      $transaction: mockTransaction,
    } as any);

    const plan = makePlan('plan-2', EducationalLevelCode.PRIMARIO, EducationalModalityCode.COMUN);
    const repo = new PrismaStudyPlanRepository();
    await repo.saveWithLevelCascade(plan, 2, 0);

    // Top-level client must NOT be called; only tx's methods
    expect(topLevelUpsert).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledOnce();
  });
});

// ── addSubject / esOptativa (T04 RED → T05 GREEN) ────────────

describe('PrismaStudyPlanRepository — addSubject esOptativa (D5)', () => {
  beforeEach(() => {
    vi.mocked(TenantContext.getClient).mockReset();
  });

  it('Test A (MGC-S29): addSubject with esOptativa:true passes true on create AND update', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({});
    vi.mocked(TenantContext.getClient).mockReturnValue({
      studyPlanSubject: { upsert: mockUpsert },
    } as any);

    const repo = new PrismaStudyPlanRepository();
    await repo.addSubject('pc-1', 'subj-1', 3, true);

    expect(mockUpsert).toHaveBeenCalledOnce();
    const arg = mockUpsert.mock.calls[0][0];
    expect(arg.create.esOptativa).toBe(true);
    expect(arg.update.esOptativa).toBe(true);
  });

  it('Test B (MGC-S28): addSubject with no flag passes esOptativa:undefined on create (D5)', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({});
    vi.mocked(TenantContext.getClient).mockReturnValue({
      studyPlanSubject: { upsert: mockUpsert },
    } as any);

    const repo = new PrismaStudyPlanRepository();
    await repo.addSubject('pc-1', 'subj-1');

    expect(mockUpsert).toHaveBeenCalledOnce();
    const arg = mockUpsert.mock.calls[0][0];
    expect(arg.create.esOptativa).toBeUndefined();
  });

  it('Test D (D5 LOCK): hoursPerWeek-only call passes esOptativa:undefined in update (not false)', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({});
    vi.mocked(TenantContext.getClient).mockReturnValue({
      studyPlanSubject: { upsert: mockUpsert },
    } as any);

    const repo = new PrismaStudyPlanRepository();
    await repo.addSubject('pc-1', 'subj-1', 5);

    expect(mockUpsert).toHaveBeenCalledOnce();
    const arg = mockUpsert.mock.calls[0][0];
    expect(arg.update.esOptativa).toBeUndefined();
    expect(arg.update.esOptativa).not.toBe(false);
  });
});

// ── findPlanCourseById / findPlanCoursesByPlan esOptativa (T04 Test C) ───────

describe('PrismaStudyPlanRepository — find* esOptativa mapping (MGC-S35)', () => {
  beforeEach(() => {
    vi.mocked(TenantContext.getClient).mockReset();
  });

  it('Test C: findPlanCourseById maps esOptativa:true from Prisma to DTO', async () => {
    const mockFindUnique = vi.fn().mockResolvedValue({
      id: 'pc-1',
      studyPlanId: 'plan-1',
      courseSectionId: 'cs-1',
      courseSection: { name: 'Test', grade: null, division: null },
      studyPlan: {},
      subjects: [
        { id: 'sps-1', subjectId: 'subj-1', subject: { id: 'subj-1', name: 'Math' }, hoursPerWeek: 3, esOptativa: true },
      ],
    });
    vi.mocked(TenantContext.getClient).mockReturnValue({
      studyPlanCourse: { findUnique: mockFindUnique },
    } as any);

    const repo = new PrismaStudyPlanRepository();
    const result = await repo.findPlanCourseById('pc-1');

    expect(result).not.toBeNull();
    expect(result!.subjects![0].esOptativa).toBe(true);
  });

  it('Test C2: findPlanCoursesByPlan maps esOptativa:true from Prisma to DTO', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([
      {
        id: 'pc-1',
        studyPlanId: 'plan-1',
        courseSectionId: 'cs-1',
        courseSection: { name: 'Test', grade: null, division: null },
        subjects: [
          { id: 'sps-1', subjectId: 'subj-1', subject: { id: 'subj-1', name: 'Math' }, hoursPerWeek: 3, esOptativa: true },
        ],
      },
    ]);
    vi.mocked(TenantContext.getClient).mockReturnValue({
      studyPlanCourse: { findMany: mockFindMany },
    } as any);

    const repo = new PrismaStudyPlanRepository();
    const results = await repo.findPlanCoursesByPlan('plan-1');

    expect(results).toHaveLength(1);
    expect(results[0].subjects![0].esOptativa).toBe(true);
  });
});

// ── Integration: round-trip + D5 LOCK (T12) ────────────────────

describe('PrismaStudyPlanRepository — integration round-trip esOptativa (T12)', () => {
  beforeEach(() => {
    vi.mocked(TenantContext.getClient).mockReset();
  });

  it('Test E (MGC-S29+S38): addSubject true then findPlanCourseById returns esOptativa:true', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({});
    const mockFindUnique = vi.fn().mockResolvedValue({
      id: 'pc-1',
      studyPlanId: 'plan-1',
      courseSectionId: 'cs-1',
      courseSection: { name: 'Test', grade: null, division: null },
      studyPlan: {},
      subjects: [
        { id: 'sps-1', subjectId: 'subj-1', subject: { id: 'subj-1', name: 'Math' }, hoursPerWeek: 3, esOptativa: true },
      ],
    });
    vi.mocked(TenantContext.getClient).mockReturnValue({
      studyPlanSubject: { upsert: mockUpsert },
      studyPlanCourse: { findUnique: mockFindUnique },
    } as any);

    const repo = new PrismaStudyPlanRepository();
    await repo.addSubject('pc-1', 'subj-1', 3, true);
    const result = await repo.findPlanCourseById('pc-1');

    expect(result!.subjects![0].esOptativa).toBe(true);
  });

  it('Test F (D5/MGC-S35): second call without flag has esOptativa:undefined in update (preserves existing)', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({});
    vi.mocked(TenantContext.getClient).mockReturnValue({
      studyPlanSubject: { upsert: mockUpsert },
    } as any);

    const repo = new PrismaStudyPlanRepository();
    // First call: set esOptativa true
    await repo.addSubject('pc-1', 'subj-1', 4, true);
    // Second call: hours-only, no esOptativa
    await repo.addSubject('pc-1', 'subj-1', 5);

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    const secondArg = mockUpsert.mock.calls[1][0];
    expect(secondArg.update.esOptativa).toBeUndefined();
  });

  it('Test G (MGC-S36): addSubject on NEW subject creates with esOptativa:true', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({});
    vi.mocked(TenantContext.getClient).mockReturnValue({
      studyPlanSubject: { upsert: mockUpsert },
    } as any);

    const repo = new PrismaStudyPlanRepository();
    await repo.addSubject('pc-new', 'subj-new', 3, true);

    expect(mockUpsert).toHaveBeenCalledOnce();
    const arg = mockUpsert.mock.calls[0][0];
    expect(arg.create.esOptativa).toBe(true);
  });
});

// ── getDependencies ───────────────────────────────────────────

describe('PrismaStudyPlanRepository — getDependencies', () => {
  beforeEach(() => {
    vi.mocked(TenantContext.getClient).mockReset();
  });

  it('counts all studyPlanCourse rows for the given planId', async () => {
    const mockStudyPlanCourseCount = vi.fn().mockResolvedValue(3);
    const mockCourseCycleCount = vi.fn().mockResolvedValue(0);

    vi.mocked(TenantContext.getClient).mockReturnValue({
      studyPlanCourse: { count: mockStudyPlanCourseCount },
      courseCycle: { count: mockCourseCycleCount },
    } as any);

    const repo = new PrismaStudyPlanRepository();
    const result = await repo.getDependencies('plan-x');

    expect(result.courseCount).toBe(3);
    expect(mockStudyPlanCourseCount).toHaveBeenCalledWith({ where: { studyPlanId: 'plan-x' } });
  });

  it('counts only courseCycle rows where deletedAt is null (soft-deleted excluded)', async () => {
    const mockStudyPlanCourseCount = vi.fn().mockResolvedValue(0);
    const mockCourseCycleCount = vi.fn().mockResolvedValue(1);

    vi.mocked(TenantContext.getClient).mockReturnValue({
      studyPlanCourse: { count: mockStudyPlanCourseCount },
      courseCycle: { count: mockCourseCycleCount },
    } as any);

    const repo = new PrismaStudyPlanRepository();
    const result = await repo.getDependencies('plan-y');

    expect(result.courseCycleCount).toBe(1);
    expect(mockCourseCycleCount).toHaveBeenCalledWith({ where: { studyPlanId: 'plan-y', deletedAt: null } });
  });

  it('returns zero counts when no rows exist', async () => {
    const mockStudyPlanCourseCount = vi.fn().mockResolvedValue(0);
    const mockCourseCycleCount = vi.fn().mockResolvedValue(0);

    vi.mocked(TenantContext.getClient).mockReturnValue({
      studyPlanCourse: { count: mockStudyPlanCourseCount },
      courseCycle: { count: mockCourseCycleCount },
    } as any);

    const repo = new PrismaStudyPlanRepository();
    const result = await repo.getDependencies('plan-z');

    expect(result.courseCount).toBe(0);
    expect(result.courseCycleCount).toBe(0);
  });
});
