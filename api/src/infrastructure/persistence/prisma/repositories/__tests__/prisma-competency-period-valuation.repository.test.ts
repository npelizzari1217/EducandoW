/**
 * T1.8 [RED] → GREEN — PrismaCompetencyPeriodValuationRepository tests.
 * Mocks TenantContext; no real DB.
 * Note: The `competency_period_valuations` table does not exist until PR2 migration.
 * These tests work because TenantContext is mocked and vitest uses esbuild (no type checking).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaCompetencyPeriodValuationRepository } from '../prisma-competency-period-valuation.repository';
import { TenantContext } from '../../../../auth/tenant.context';
import { CompetencyPeriodValuation } from '@educandow/domain';

// ── Mock TenantContext ────────────────────────────────────────

vi.mock('../../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Row factories ─────────────────────────────────────────────

function makePeriodValuationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'child-uuid-1',
    valuationId: 'valuation-uuid-1',
    periodItemId: 'period-item-uuid-1',
    gradeScaleValueId: null,
    gradeCode: null,
    internalStatus: null,
    modificable: true,
    imprimible: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ── Mock client factory ───────────────────────────────────────

function makeMockClient() {
  return {
    competencyPeriodValuation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

// ═══════════════════════════════════════════════════════════
// findByValuationAndPeriod
// ═══════════════════════════════════════════════════════════

describe('PrismaCompetencyPeriodValuationRepository — findByValuationAndPeriod', () => {
  let repo: PrismaCompetencyPeriodValuationRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaCompetencyPeriodValuationRepository();
  });

  it('returns null when the child row does not exist', async () => {
    mockClient.competencyPeriodValuation.findFirst.mockResolvedValue(null);

    const result = await repo.findByValuationAndPeriod('valuation-uuid-1', 'period-item-uuid-1');

    expect(result).toBeNull();
    expect(mockClient.competencyPeriodValuation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          valuationId: 'valuation-uuid-1',
          periodItemId: 'period-item-uuid-1',
        }),
      }),
    );
  });

  it('returns mapped CompetencyPeriodValuation when row exists', async () => {
    mockClient.competencyPeriodValuation.findFirst.mockResolvedValue(makePeriodValuationRow());

    const result = await repo.findByValuationAndPeriod('valuation-uuid-1', 'period-item-uuid-1');

    expect(result).toBeInstanceOf(CompetencyPeriodValuation);
    expect(result!.id).toBe('child-uuid-1');
    expect(result!.valuationId).toBe('valuation-uuid-1');
    expect(result!.gradeScaleValueId).toBeNull();
    expect(result!.modificable).toBe(true);
  });

  it('maps graded row correctly', async () => {
    mockClient.competencyPeriodValuation.findFirst.mockResolvedValue(
      makePeriodValuationRow({
        gradeScaleValueId: 'sv-uuid-1',
        gradeCode: 'A',
        internalStatus: 'APROBADO',
        modificable: false,
        imprimible: true,
      }),
    );

    const result = await repo.findByValuationAndPeriod('valuation-uuid-1', 'period-item-uuid-1');

    expect(result!.gradeScaleValueId).toBe('sv-uuid-1');
    expect(result!.gradeCode).toBe('A');
    expect(result!.internalStatus).toBe('APROBADO');
    expect(result!.modificable).toBe(false);
    expect(result!.imprimible).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// save (upsert on valuationId + periodItemId)
// ═══════════════════════════════════════════════════════════

describe('PrismaCompetencyPeriodValuationRepository — save', () => {
  let repo: PrismaCompetencyPeriodValuationRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaCompetencyPeriodValuationRepository();
  });

  it('calls upsert keyed on the (valuationId, periodItemId) unique pair', async () => {
    mockClient.competencyPeriodValuation.upsert.mockResolvedValue({});
    const child = CompetencyPeriodValuation.create({ valuationId: 'val-uuid', periodItemId: 'pi-uuid' });

    await repo.save(child);

    expect(mockClient.competencyPeriodValuation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          valuationId_periodItemId: {
            valuationId: child.valuationId,
            periodItemId: child.periodItemId,
          },
        }),
      }),
    );
  });

  it('includes all grade fields in create and update payloads', async () => {
    mockClient.competencyPeriodValuation.upsert.mockResolvedValue({});
    const child = CompetencyPeriodValuation.reconstruct({
      id: 'child-uuid-1',
      valuationId: 'val-uuid',
      periodItemId: 'pi-uuid',
      gradeScaleValueId: 'sv-uuid',
      gradeCode: 'B',
      internalStatus: 'EN_PROCESO',
      modificable: false,
      imprimible: true,
    });

    await repo.save(child);

    expect(mockClient.competencyPeriodValuation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          id: 'child-uuid-1',
          gradeScaleValueId: 'sv-uuid',
          gradeCode: 'B',
          internalStatus: 'EN_PROCESO',
          modificable: false,
          imprimible: true,
        }),
        update: expect.objectContaining({
          gradeScaleValueId: 'sv-uuid',
          gradeCode: 'B',
          modificable: false,
          imprimible: true,
        }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════
// listByValuation
// ═══════════════════════════════════════════════════════════

describe('PrismaCompetencyPeriodValuationRepository — listByValuation', () => {
  let repo: PrismaCompetencyPeriodValuationRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaCompetencyPeriodValuationRepository();
  });

  it('returns empty array when no children exist', async () => {
    mockClient.competencyPeriodValuation.findMany.mockResolvedValue([]);

    const result = await repo.listByValuation('valuation-uuid-1');

    expect(result).toHaveLength(0);
  });

  it('returns mapped array of CompetencyPeriodValuation', async () => {
    mockClient.competencyPeriodValuation.findMany.mockResolvedValue([
      makePeriodValuationRow({ id: 'child-uuid-1', periodItemId: 'pi-uuid-1' }),
      makePeriodValuationRow({ id: 'child-uuid-2', periodItemId: 'pi-uuid-2' }),
    ]);

    const result = await repo.listByValuation('valuation-uuid-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(CompetencyPeriodValuation);
    expect(result[1]).toBeInstanceOf(CompetencyPeriodValuation);
  });

  it('filters by valuationId', async () => {
    mockClient.competencyPeriodValuation.findMany.mockResolvedValue([]);

    await repo.listByValuation('valuation-uuid-1');

    expect(mockClient.competencyPeriodValuation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { valuationId: 'valuation-uuid-1' },
      }),
    );
  });
});
