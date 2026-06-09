/**
 * PR1-T10 [RED] — PrismaSubjectGradingPeriodRepository tests.
 * Mocks TenantContext; no real DB.
 * Specs: SPG-R7, AD-4, AD-5
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaSubjectGradingPeriodRepository } from './prisma-subject-grading-period.repository';
import { TenantContext } from '../../../auth/tenant.context';
import { SubjectGradingPeriod } from '@educandow/domain';

vi.mock('../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Row factory ───────────────────────────────────────────────────────────────

function makeSgpRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sgp-uuid-1',
    courseCycleId: 'cc-uuid-1',
    subjectId: 'subj-uuid-1',
    periodOrdinal: 1,
    periodName: '1° Trimestre',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeTemplateItem(sortOrder: number, name: string) {
  return { id: `item-${sortOrder}`, sortOrder, name };
}

// ── Mock client factory ───────────────────────────────────────────────────────

function makeMockClient() {
  return {
    subjectGradingPeriod: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      upsert: vi.fn(),
    },
    courseCycle: {
      findUnique: vi.fn(),
    },
    gradingPeriodTemplate: {
      findFirst: vi.fn(),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// findByCourseCycleAndSubject
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaSubjectGradingPeriodRepository — findByCourseCycleAndSubject', () => {
  let repo: PrismaSubjectGradingPeriodRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaSubjectGradingPeriodRepository();
  });

  it('returns empty array when no snapshot rows exist', async () => {
    mockClient.subjectGradingPeriod.findMany.mockResolvedValue([]);

    const result = await repo.findByCourseCycleAndSubject('cc-uuid-1', 'subj-uuid-1');

    expect(result).toHaveLength(0);
  });

  it('returns mapped SubjectGradingPeriod entities when rows exist', async () => {
    mockClient.subjectGradingPeriod.findMany.mockResolvedValue([
      makeSgpRow({ periodOrdinal: 1, periodName: '1° Trimestre' }),
      makeSgpRow({ id: 'sgp-uuid-2', periodOrdinal: 2, periodName: '2° Trimestre' }),
    ]);

    const result = await repo.findByCourseCycleAndSubject('cc-uuid-1', 'subj-uuid-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(SubjectGradingPeriod);
    expect(result[0].periodOrdinal).toBe(1);
    expect(result[1].periodOrdinal).toBe(2);
  });

  it('queries by courseCycleId and subjectId', async () => {
    mockClient.subjectGradingPeriod.findMany.mockResolvedValue([]);

    await repo.findByCourseCycleAndSubject('cc-uuid-1', 'subj-uuid-1');

    expect(mockClient.subjectGradingPeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          courseCycleId: 'cc-uuid-1',
          subjectId: 'subj-uuid-1',
        }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ensureSnapshot
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaSubjectGradingPeriodRepository — ensureSnapshot', () => {
  let repo: PrismaSubjectGradingPeriodRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaSubjectGradingPeriodRepository();
  });

  it('returns existing rows without touching the DB on second call (no-op)', async () => {
    const existingRows = [
      makeSgpRow({ periodOrdinal: 1 }),
      makeSgpRow({ id: 'sgp-uuid-2', periodOrdinal: 2 }),
    ];
    mockClient.subjectGradingPeriod.findMany.mockResolvedValue(existingRows);

    const result = await repo.ensureSnapshot('cc-uuid-1', 'subj-uuid-1');

    expect(result).toHaveLength(2);
    // createMany should NOT have been called — rows already exist
    expect(mockClient.subjectGradingPeriod.createMany).not.toHaveBeenCalled();
  });

  it('copies template items when no snapshot rows exist (first call)', async () => {
    // findMany returns empty — no existing snapshot rows
    mockClient.subjectGradingPeriod.findMany.mockResolvedValueOnce([]);

    // The CC lookup: needs level and modality for the template query
    mockClient.courseCycle.findUnique.mockResolvedValue({
      uuid: 'cc-uuid-1',
      level: 21,      // PRIMARIO level code
      studyPlan: { modality: 0 },
    });

    // The template lookup returns items
    mockClient.gradingPeriodTemplate.findFirst.mockResolvedValue({
      id: 'template-uuid-1',
      items: [
        makeTemplateItem(1, '1° Trimestre'),
        makeTemplateItem(2, '2° Trimestre'),
      ],
    });

    mockClient.subjectGradingPeriod.createMany.mockResolvedValue({ count: 2 });

    const result = await repo.ensureSnapshot('cc-uuid-1', 'subj-uuid-1');

    // createMany called once with skipDuplicates — idempotent under concurrency
    expect(mockClient.subjectGradingPeriod.createMany).toHaveBeenCalledOnce();
    expect(mockClient.subjectGradingPeriod.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(result).toHaveLength(2);
    expect(result[0].periodOrdinal).toBe(1);
  });

  it('cross-institutionId: a different institutionId can only access its own rows', async () => {
    // institutionId is opaque at DB level (multi-tenant DB is per-institution),
    // but the repo must scope queries — verify it passes the courseCycleId correctly
    mockClient.subjectGradingPeriod.findMany.mockResolvedValue([]);
    mockClient.courseCycle.findUnique.mockResolvedValue(null); // no CC found for this tenant

    const result = await repo.ensureSnapshot('cc-uuid-from-other-inst', 'subj-uuid-1');

    // When CC not found (cross-tenant), returns empty array
    expect(result).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// save
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaSubjectGradingPeriodRepository — save', () => {
  let repo: PrismaSubjectGradingPeriodRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaSubjectGradingPeriodRepository();
  });

  it('upserts keyed on (courseCycleId, subjectId, periodOrdinal)', async () => {
    mockClient.subjectGradingPeriod.upsert.mockResolvedValue({});
    const sgp = SubjectGradingPeriod.snapshotFromTemplateItem({
      courseCycleId: 'cc-uuid-1',
      subjectId: 'subj-uuid-1',
      sortOrder: 1,
      name: '1° Trimestre',
    });

    await repo.save(sgp);

    expect(mockClient.subjectGradingPeriod.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          courseCycleId_subjectId_periodOrdinal: {
            courseCycleId: 'cc-uuid-1',
            subjectId: 'subj-uuid-1',
            periodOrdinal: 1,
          },
        }),
      }),
    );
  });
});
