/**
 * T2.3.1 — PrismaAttendanceTypeRepository tests (RED → GREEN).
 * Uses vi.mock for TenantContext; no real DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaAttendanceTypeRepository } from '../prisma-attendance-type.repository';
import { TenantContext } from '../../../../auth/tenant.context';
import { AttendanceType } from '@educandow/domain';
import { Decimal } from '@prisma/tenant-client/runtime/library';

// ── Mock TenantContext ────────────────────────────────────────

vi.mock('../../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Prisma Row Factory ────────────────────────────────────────

function makePrismaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'at-uuid-1',
    level: 2,
    code: 'P',
    description: 'Presente',
    absenceValue: new Decimal('0.00'),
    isPresent: true,
    assignable: true,
    isSystem: false,
    active: true,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ── list ──────────────────────────────────────────────────────

describe('PrismaAttendanceTypeRepository — list', () => {
  let repo: PrismaAttendanceTypeRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  function makeMockClient() {
    return {
      attendanceType: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        upsert: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
    };
  }

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaAttendanceTypeRepository();
  });

  it('returns all types when no filters provided', async () => {
    mockClient.attendanceType.findMany.mockResolvedValue([makePrismaRow()]);
    const result = await repo.list();

    expect(mockClient.attendanceType.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(AttendanceType);
  });

  it('filters by level when provided', async () => {
    mockClient.attendanceType.findMany.mockResolvedValue([]);
    await repo.list({ level: 2 });

    expect(mockClient.attendanceType.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, level: 2 },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    });
  });

  it('filters by active when provided', async () => {
    mockClient.attendanceType.findMany.mockResolvedValue([]);
    await repo.list({ active: true });

    expect(mockClient.attendanceType.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, active: true },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    });
  });
});

// ── findById ──────────────────────────────────────────────────

describe('PrismaAttendanceTypeRepository — findById', () => {
  let repo: PrismaAttendanceTypeRepository;
  let mockClient: { attendanceType: { findUnique: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    mockClient = { attendanceType: { findUnique: vi.fn() } };
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaAttendanceTypeRepository();
  });

  it('returns mapped entity when record exists', async () => {
    mockClient.attendanceType.findUnique.mockResolvedValue(makePrismaRow());
    const result = await repo.findById('at-uuid-1');

    expect(result).toBeInstanceOf(AttendanceType);
    expect(result!.id).toBe('at-uuid-1');
    expect(result!.level).toBe(2);
    expect(result!.code.get()).toBe('P');
    expect(result!.absenceValue).toBe(0); // Decimal → number
  });

  it('returns null when record does not exist', async () => {
    mockClient.attendanceType.findUnique.mockResolvedValue(null);
    const result = await repo.findById('nonexistent');
    expect(result).toBeNull();
  });
});

// ── existsByLevelCode ─────────────────────────────────────────

describe('PrismaAttendanceTypeRepository — existsByLevelCode', () => {
  let repo: PrismaAttendanceTypeRepository;
  let mockClient: { attendanceType: { count: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    mockClient = { attendanceType: { count: vi.fn() } };
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaAttendanceTypeRepository();
  });

  it('returns true when record exists (no excludeId)', async () => {
    mockClient.attendanceType.count.mockResolvedValue(1);
    const result = await repo.existsByLevelCode(2, 'P');
    expect(result).toBe(true);
    expect(mockClient.attendanceType.count).toHaveBeenCalledWith({
      where: { level: 2, code: 'P', deletedAt: null },
    });
  });

  it('excludes id when excludeId is provided', async () => {
    mockClient.attendanceType.count.mockResolvedValue(0);
    const result = await repo.existsByLevelCode(2, 'P', 'exclude-this');
    expect(result).toBe(false);
    expect(mockClient.attendanceType.count).toHaveBeenCalledWith({
      where: { level: 2, code: 'P', deletedAt: null, NOT: { id: 'exclude-this' } },
    });
  });
});

// ── save ─────────────────────────────────────────────────────

describe('PrismaAttendanceTypeRepository — save', () => {
  let repo: PrismaAttendanceTypeRepository;
  let mockClient: { attendanceType: { upsert: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    mockClient = { attendanceType: { upsert: vi.fn() } };
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaAttendanceTypeRepository();
  });

  it('calls upsert with correct data', async () => {
    mockClient.attendanceType.upsert.mockResolvedValue({});
    const entity = AttendanceType.create({
      code: 'T',
      description: 'Tardanza',
      absenceValue: 0.5,
      level: 2,
      assignable: true,
    });

    await repo.save(entity);

    expect(mockClient.attendanceType.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: entity.id },
        create: expect.objectContaining({
          id: entity.id,
          level: 2,
          code: 'T',
          description: 'Tardanza',
          absenceValue: 0.5,
          assignable: true,
          isSystem: false,
          active: true,
        }),
      }),
    );
  });
});

// ── delete ────────────────────────────────────────────────────

describe('PrismaAttendanceTypeRepository — delete', () => {
  let repo: PrismaAttendanceTypeRepository;
  let mockClient: { attendanceType: { delete: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    mockClient = { attendanceType: { delete: vi.fn() } };
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaAttendanceTypeRepository();
  });

  it('calls delete with the correct id', async () => {
    mockClient.attendanceType.delete.mockResolvedValue({});
    await repo.delete('at-uuid-1');
    expect(mockClient.attendanceType.delete).toHaveBeenCalledWith({
      where: { id: 'at-uuid-1' },
    });
  });
});
