/**
 * 1a-T3 [RED→GREEN] — PrismaCompetencyValuationRepo.findByCourseCycleAndStudyPlanSubject.
 * Mocks TenantContext; no real DB.
 * Verifies: competencyId resolution via SubjectCompetency, include periodValuations, BVR-5 ([]≠null).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaCompetencyValuationRepo } from '../prisma-competency-valuation.repository';
import { TenantContext } from '../../../../auth/tenant.context';

vi.mock('../../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Row factories ─────────────────────────────────────────────

function makeValuationRow(overrides: Record<string, unknown> = {}) {
  return {
    id:           'v-uuid-1',
    competencyId: 'comp-uuid-1',
    studentId:    'student-uuid-1',
    courseCycleId: 'cc-uuid-1',
    active:       true,
    deletedAt:    null,
    createdAt:    new Date('2026-01-01'),
    updatedAt:    new Date('2026-01-01'),
    ...overrides,
  };
}

function makePeriodRow(overrides: Record<string, unknown> = {}) {
  return {
    id:               'pv-uuid-1',
    valuationId:      'v-uuid-1',
    periodItemId:     'item-uuid-3',
    gradeScaleValueId: null,
    gradeCode:        null,
    internalStatus:   null,
    modificable:      true,
    imprimible:       false,
    createdAt:        new Date('2026-01-01'),
    updatedAt:        new Date('2026-01-01'),
    ...overrides,
  };
}

// ── Mock client factory ───────────────────────────────────────

function makeMockClient(overrides: Record<string, unknown> = {}) {
  return {
    subjectCompetency: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    competencyValuation: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany:   vi.fn().mockResolvedValue([]),
      upsert:     vi.fn().mockResolvedValue(undefined),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      update:     vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════
// findByCourseCycleAndStudyPlanSubject
// ═══════════════════════════════════════════════════════════

describe('PrismaCompetencyValuationRepo — findByCourseCycleAndStudyPlanSubject', () => {
  let repo: PrismaCompetencyValuationRepo;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaCompetencyValuationRepo();
  });

  it('resolves competencyIds from SubjectCompetency first (studyPlanSubjectId filter)', async () => {
    mockClient.subjectCompetency.findMany.mockResolvedValue([
      { id: 'comp-uuid-1' },
      { id: 'comp-uuid-2' },
    ]);
    mockClient.competencyValuation.findMany.mockResolvedValue([]);

    await repo.findByCourseCycleAndStudyPlanSubject('cc-1', 'sps-1');

    expect(mockClient.subjectCompetency.findMany).toHaveBeenCalledWith({
      where: { studyPlanSubjectId: 'sps-1', deletedAt: null },
      select: { id: true },
    });
  });

  it('returns [] immediately when no competencies found for the studyPlanSubjectId', async () => {
    mockClient.subjectCompetency.findMany.mockResolvedValue([]);

    const result = await repo.findByCourseCycleAndStudyPlanSubject('cc-1', 'sps-1');

    expect(result).toEqual([]);
    expect(mockClient.competencyValuation.findMany).not.toHaveBeenCalled();
  });

  it('queries competencyValuation with courseCycleId + competencyId-in filter + include periodValuations', async () => {
    mockClient.subjectCompetency.findMany.mockResolvedValue([{ id: 'comp-uuid-1' }]);
    mockClient.competencyValuation.findMany.mockResolvedValue([]);

    await repo.findByCourseCycleAndStudyPlanSubject('cc-uuid-1', 'sps-1');

    expect(mockClient.competencyValuation.findMany).toHaveBeenCalledWith({
      where: {
        courseCycleId: 'cc-uuid-1',
        competencyId:  { in: ['comp-uuid-1'] },
        deletedAt:     null,
      },
      include: { periodValuations: true },
    });
  });

  it('maps rows to CompetencyValuationWithPeriods shape — BVR-1 happy path', async () => {
    const periodRow = makePeriodRow({
      gradeScaleValueId: 'gsv-a',
      gradeCode:         'MB',
      internalStatus:    'APROBADO',
    });
    const valRow = { ...makeValuationRow(), periodValuations: [periodRow] };

    mockClient.subjectCompetency.findMany.mockResolvedValue([{ id: 'comp-uuid-1' }]);
    mockClient.competencyValuation.findMany.mockResolvedValue([valRow]);

    const result = await repo.findByCourseCycleAndStudyPlanSubject('cc-uuid-1', 'sps-1');

    expect(result).toHaveLength(1);
    expect(result[0].valuationId).toBe('v-uuid-1');
    expect(result[0].studentId).toBe('student-uuid-1');
    expect(result[0].competencyId).toBe('comp-uuid-1');
    expect(result[0].periodValuations).toHaveLength(1);
    expect(result[0].periodValuations[0].periodItemId).toBe('item-uuid-3');
    expect(result[0].periodValuations[0].gradeCode).toBe('MB');
    expect(result[0].periodValuations[0].internalStatus).toBe('APROBADO');
    expect(result[0].periodValuations[0].modificable).toBe(true);
    expect(result[0].periodValuations[0].imprimible).toBe(false);
  });

  it('returns periodValuations: [] for a parent with no graded children (BVR-5)', async () => {
    const valRow = { ...makeValuationRow({ id: 'v-uuid-2' }), periodValuations: [] };

    mockClient.subjectCompetency.findMany.mockResolvedValue([{ id: 'comp-uuid-1' }]);
    mockClient.competencyValuation.findMany.mockResolvedValue([valRow]);

    const result = await repo.findByCourseCycleAndStudyPlanSubject('cc-uuid-1', 'sps-1');

    expect(result[0].periodValuations).toEqual([]);
  });

  it('children are attached only to their parent — BVR-6 correct join isolation', async () => {
    const pvS1 = makePeriodRow({ id: 'pv-s1', valuationId: 'v-s1', gradeCode: 'MB' });
    const pvS2 = makePeriodRow({ id: 'pv-s2', valuationId: 'v-s2', gradeCode: 'B' });

    const rowS1 = { ...makeValuationRow({ id: 'v-s1', studentId: 's-1' }), periodValuations: [pvS1] };
    const rowS2 = { ...makeValuationRow({ id: 'v-s2', studentId: 's-2' }), periodValuations: [pvS2] };

    mockClient.subjectCompetency.findMany.mockResolvedValue([{ id: 'comp-uuid-1' }]);
    mockClient.competencyValuation.findMany.mockResolvedValue([rowS1, rowS2]);

    const result = await repo.findByCourseCycleAndStudyPlanSubject('cc-uuid-1', 'sps-1');

    expect(result).toHaveLength(2);
    const r1 = result.find((r) => r.studentId === 's-1')!;
    const r2 = result.find((r) => r.studentId === 's-2')!;
    expect(r1.periodValuations[0].gradeCode).toBe('MB');
    expect(r2.periodValuations[0].gradeCode).toBe('B');
  });
});
