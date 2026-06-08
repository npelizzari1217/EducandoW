/**
 * T42 [RED] — PrismaGradingPeriodRepository tests.
 * Mocks TenantContext; no real DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaGradingPeriodRepository } from '../prisma-grading-period.repository';
import { TenantContext } from '../../../../auth/tenant.context';
import { GradingPeriodTemplate } from '@educandow/domain';

// ── Mock TenantContext ────────────────────────────────────────

vi.mock('../../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Row factories ─────────────────────────────────────────────

function makeTemplateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'template-uuid-1',
    name: 'Trimestral Primaria',
    level: 2,
    modality: 0,
    active: true,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    items: [],
    ...overrides,
  };
}

function makeItemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-uuid-1',
    templateId: 'template-uuid-1',
    name: '1° Trimestre',
    sortOrder: 1,
    ...overrides,
  };
}

function makeDateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'date-uuid-1',
    itemId: 'item-uuid-1',     // Prisma field name (maps to template_item_id in DB)
    cycleId: 'cycle-uuid-1',
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-05-31'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ── Mock client factory ───────────────────────────────────────

function makeMockClient() {
  return {
    gradingPeriodTemplate: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    gradingPeriodTemplateItem: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    gradingPeriodDate: {
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn((fn: (client: any) => Promise<any>) => fn(makeMockClient())),
  };
}

// ═══════════════════════════════════════════════════════════
// saveTemplate — upsert + items in transaction
// ═══════════════════════════════════════════════════════════

describe('PrismaGradingPeriodRepository — saveTemplate', () => {
  let repo: PrismaGradingPeriodRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaGradingPeriodRepository();
  });

  it('calls $transaction when saving a template with items', async () => {
    const template = GradingPeriodTemplate.reconstruct({
      id: 'template-uuid-1',
      name: 'Trimestral Primaria',
      level: 2,
      modality: 0,
      active: true,
      deletedAt: null,
      items: [
        { id: 'item-uuid-1', templateId: 'template-uuid-1', name: '1° Trimestre', sortOrder: 1 },
      ],
    });

    await repo.saveTemplate(template);

    expect(mockClient.$transaction).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════
// findDatesByCycle
// ═══════════════════════════════════════════════════════════

describe('PrismaGradingPeriodRepository — findDatesByCycle', () => {
  let repo: PrismaGradingPeriodRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaGradingPeriodRepository();
  });

  it('queries dates filtered by templateId and cycleId', async () => {
    mockClient.gradingPeriodDate.findMany.mockResolvedValue([makeDateRow()]);

    const result = await repo.findDatesByCycle('template-uuid-1', 'cycle-uuid-1');

    expect(result).toBeInstanceOf(Array);
    expect(mockClient.gradingPeriodDate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cycleId: 'cycle-uuid-1' }),
      }),
    );
  });

  it('returns empty array when no dates found', async () => {
    mockClient.gradingPeriodDate.findMany.mockResolvedValue([]);

    const result = await repo.findDatesByCycle('nonexistent', 'cycle-uuid-1');

    expect(result).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════
// countDatesForTemplate
// ═══════════════════════════════════════════════════════════

describe('PrismaGradingPeriodRepository — countDatesForTemplate', () => {
  let repo: PrismaGradingPeriodRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaGradingPeriodRepository();
  });

  it('counts dates associated with the template via items', async () => {
    mockClient.gradingPeriodDate.count.mockResolvedValue(6);

    const result = await repo.countDatesForTemplate('template-uuid-1');

    expect(result).toBe(6);
    expect(mockClient.gradingPeriodDate.count).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════
// listTemplates
// ═══════════════════════════════════════════════════════════

describe('PrismaGradingPeriodRepository — listTemplates', () => {
  let repo: PrismaGradingPeriodRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaGradingPeriodRepository();
  });

  it('returns mapped GradingPeriodTemplate instances', async () => {
    const templateRow = makeTemplateRow({
      items: [makeItemRow()],
    });
    mockClient.gradingPeriodTemplate.findMany.mockResolvedValue([templateRow]);

    const result = await repo.listTemplates();

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(GradingPeriodTemplate);
    expect(result[0].items).toHaveLength(1);
  });

  it('filters by level when provided', async () => {
    mockClient.gradingPeriodTemplate.findMany.mockResolvedValue([]);

    await repo.listTemplates({ level: 2 });

    expect(mockClient.gradingPeriodTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ level: 2 }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════
// findActiveTemplateByLevelModality (T1.10)
// ═══════════════════════════════════════════════════════════

describe('PrismaGradingPeriodRepository — findActiveTemplateByLevelModality', () => {
  let repo: PrismaGradingPeriodRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaGradingPeriodRepository();
  });

  it('returns null when no active template exists for the (level, modality)', async () => {
    mockClient.gradingPeriodTemplate.findFirst.mockResolvedValue(null);
    const result = await repo.findActiveTemplateByLevelModality(2, 0);
    expect(result).toBeNull();
  });

  it('returns mapped GradingPeriodTemplate when an active template exists', async () => {
    mockClient.gradingPeriodTemplate.findFirst.mockResolvedValue(
      makeTemplateRow({ items: [makeItemRow()] }),
    );
    const result = await repo.findActiveTemplateByLevelModality(2, 0);
    expect(result).toBeInstanceOf(GradingPeriodTemplate);
    expect(result!.level).toBe(2);
    expect(result!.modality).toBe(0);
    expect(result!.active).toBe(true);
    expect(result!.items).toHaveLength(1);
  });

  it('queries with active=true, deletedAt=null, ordered by updatedAt desc, includes items', async () => {
    mockClient.gradingPeriodTemplate.findFirst.mockResolvedValue(null);
    await repo.findActiveTemplateByLevelModality(3, 1);
    expect(mockClient.gradingPeriodTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ level: 3, modality: 1, active: true, deletedAt: null }),
        orderBy: { updatedAt: 'desc' },
        include: expect.objectContaining({ items: expect.anything() }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════
// saveDates (upsert)
// ═══════════════════════════════════════════════════════════

describe('PrismaGradingPeriodRepository — saveDates', () => {
  let repo: PrismaGradingPeriodRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaGradingPeriodRepository();
  });

  it('calls gradingPeriodDate.upsert with the correct uniqueness key', async () => {
    mockClient.gradingPeriodDate.upsert.mockResolvedValue({});

    await repo.saveDates('item-uuid-1', 'cycle-uuid-1', {
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-05-31'),
    });

    expect(mockClient.gradingPeriodDate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          itemId_cycleId: { itemId: 'item-uuid-1', cycleId: 'cycle-uuid-1' },
        }),
      }),
    );
  });
});
