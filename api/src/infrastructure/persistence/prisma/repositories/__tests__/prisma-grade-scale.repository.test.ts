/**
 * T16 [RED] — PrismaGradeScaleRepository tests.
 * Mocks TenantContext; no real DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaGradeScaleRepository } from '../prisma-grade-scale.repository';
import { TenantContext } from '../../../../auth/tenant.context';
import { GradeScale, GradeScaleValue } from '@educandow/domain';

// ── Mock TenantContext ────────────────────────────────────────

vi.mock('../../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Row factories ─────────────────────────────────────────────

function makeScaleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'scale-uuid-1',
    name: 'Numérica 1-10',
    level: 2,
    modality: 0,
    active: true,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    values: [],
    ...overrides,
  };
}

function makeValueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'value-uuid-1',
    scaleId: 'scale-uuid-1',
    code: '10',
    label: 'Diez',
    internalStatus: 'APROBADO' as const,
    sortOrder: 0,
    active: true,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ── Mock client factory ───────────────────────────────────────

function makeMockClient() {
  return {
    gradeScale: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    gradeScaleValue: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  };
}

// ═══════════════════════════════════════════════════════════
// list
// ═══════════════════════════════════════════════════════════

describe('PrismaGradeScaleRepository — list', () => {
  let repo: PrismaGradeScaleRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaGradeScaleRepository();
  });

  it('returns all scales when no filters provided', async () => {
    mockClient.gradeScale.findMany.mockResolvedValue([makeScaleRow()]);
    const result = await repo.list();

    expect(mockClient.gradeScale.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(GradeScale);
  });

  it('maps internalStatus correctly from Prisma row to domain', async () => {
    const row = makeScaleRow({
      values: [makeValueRow({ internalStatus: 'APROBADO' })],
    });
    mockClient.gradeScale.findMany.mockResolvedValue([row]);

    const result = await repo.list();
    expect(result[0].values[0]).toBeInstanceOf(GradeScaleValue);
    expect(result[0].values[0].internalStatus).toBe('APROBADO');
  });

  it('filters by level when provided', async () => {
    mockClient.gradeScale.findMany.mockResolvedValue([]);
    await repo.list({ level: 2 });

    expect(mockClient.gradeScale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ level: 2 }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════
// findById
// ═══════════════════════════════════════════════════════════

describe('PrismaGradeScaleRepository — findById', () => {
  let repo: PrismaGradeScaleRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaGradeScaleRepository();
  });

  it('returns mapped GradeScale when record exists', async () => {
    mockClient.gradeScale.findUnique.mockResolvedValue(makeScaleRow());
    const result = await repo.findById('scale-uuid-1');

    expect(result).toBeInstanceOf(GradeScale);
    expect(result!.id).toBe('scale-uuid-1');
    expect(result!.level).toBe(2);
  });

  it('returns null when record does not exist', async () => {
    mockClient.gradeScale.findUnique.mockResolvedValue(null);
    const result = await repo.findById('nonexistent');
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// save (upsert)
// ═══════════════════════════════════════════════════════════

describe('PrismaGradeScaleRepository — save', () => {
  let repo: PrismaGradeScaleRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaGradeScaleRepository();
  });

  it('calls upsert with correct data', async () => {
    mockClient.gradeScale.upsert.mockResolvedValue({});
    const scale = GradeScale.create({ name: 'Numérica', level: 2, modality: 0 });

    await repo.save(scale);

    expect(mockClient.gradeScale.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: scale.id },
        create: expect.objectContaining({ name: 'Numérica', level: 2, modality: 0 }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════
// countActiveValues
// ═══════════════════════════════════════════════════════════

describe('PrismaGradeScaleRepository — countActiveValues', () => {
  let repo: PrismaGradeScaleRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaGradeScaleRepository();
  });

  it('filters by scaleId and deletedAt=null', async () => {
    mockClient.gradeScaleValue.count.mockResolvedValue(3);
    const result = await repo.countActiveValues('scale-uuid-1');

    expect(result).toBe(3);
    expect(mockClient.gradeScaleValue.count).toHaveBeenCalledWith({
      where: { scaleId: 'scale-uuid-1', deletedAt: null },
    });
  });
});

// ═══════════════════════════════════════════════════════════
// softDelete scale
// ═══════════════════════════════════════════════════════════

describe('PrismaGradeScaleRepository — softDelete', () => {
  let repo: PrismaGradeScaleRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaGradeScaleRepository();
  });

  it('sets active=false and deletedAt on scale', async () => {
    mockClient.gradeScale.update.mockResolvedValue({});
    await repo.softDelete('scale-uuid-1');

    expect(mockClient.gradeScale.update).toHaveBeenCalledWith({
      where: { id: 'scale-uuid-1' },
      data: { active: false, deletedAt: expect.any(Date) },
    });
  });
});

// ═══════════════════════════════════════════════════════════
// existsByName
// ═══════════════════════════════════════════════════════════

describe('PrismaGradeScaleRepository — existsByName', () => {
  let repo: PrismaGradeScaleRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaGradeScaleRepository();
  });

  it('returns true when a matching scale exists', async () => {
    mockClient.gradeScale.count.mockResolvedValue(1);
    const result = await repo.existsByName(2, 0, 'Numérica 1-10');
    expect(result).toBe(true);
  });

  it('excludes id when excludeId is provided', async () => {
    mockClient.gradeScale.count.mockResolvedValue(0);
    const result = await repo.existsByName(2, 0, 'Numérica 1-10', 'exclude-this');
    expect(result).toBe(false);
    expect(mockClient.gradeScale.count).toHaveBeenCalledWith({
      where: { level: 2, modality: 0, name: 'Numérica 1-10', deletedAt: null, NOT: { id: 'exclude-this' } },
    });
  });
});
