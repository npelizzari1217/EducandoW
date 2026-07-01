/**
 * T2.3.1 — PrismaAttendanceTypeRepository tests (RED → GREEN).
 * Uses vi.mock for TenantContext; no real DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaAttendanceTypeRepository } from '../prisma-attendance-type.repository';
import { TenantContext } from '../../../../auth/tenant.context';
import { AttendanceType, AttendanceBehaviorValue } from '@educandow/domain';
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
    behavior: AttendanceBehaviorValue.NO_COMPUTA,
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

  // PR2 — T4/Q4: allowedLevels (scope de nivel base, WHERE level IN (...))
  it('filters by allowedLevels (WHERE level IN (...)) when provided', async () => {
    mockClient.attendanceType.findMany.mockResolvedValue([]);
    await repo.list({ allowedLevels: [2, 3] });

    expect(mockClient.attendanceType.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, level: { in: [2, 3] } },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    });
  });

  it('an explicit level filter takes precedence over allowedLevels', async () => {
    mockClient.attendanceType.findMany.mockResolvedValue([]);
    await repo.list({ level: 2, allowedLevels: [2, 3] });

    expect(mockClient.attendanceType.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, level: 2 },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    });
  });

  it('produces an empty IN clause when allowedLevels is [] (0 base levels — no data leak)', async () => {
    mockClient.attendanceType.findMany.mockResolvedValue([]);
    await repo.list({ allowedLevels: [] });

    expect(mockClient.attendanceType.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, level: { in: [] } },
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
    expect(result!.behavior.get()).toBe(AttendanceBehaviorValue.NO_COMPUTA);
  });

  it('returns null when record does not exist', async () => {
    mockClient.attendanceType.findUnique.mockResolvedValue(null);
    const result = await repo.findById('nonexistent');
    expect(result).toBeNull();
  });

  it.each(Object.values(AttendanceBehaviorValue))(
    'reconstructs the VO correctly for behavior=%s',
    async (behavior) => {
      mockClient.attendanceType.findUnique.mockResolvedValue(makePrismaRow({ behavior }));
      const result = await repo.findById('at-uuid-1');
      expect(result!.behavior.get()).toBe(behavior);
    },
  );
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

  it('calls upsert with correct data, deriving assignable from behavior.isEligible()', async () => {
    mockClient.attendanceType.upsert.mockResolvedValue({});
    const entity = AttendanceType.create({
      code: 'T',
      description: 'Tardanza',
      absenceValue: 0.5,
      level: 2,
      behavior: AttendanceBehaviorValue.TARDE_JUSTIFICADA,
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
          assignable: true, // derived: TARDE_JUSTIFICADA.isEligible() === true
          behavior: AttendanceBehaviorValue.TARDE_JUSTIFICADA,
          isSystem: false,
          active: true,
        }),
      }),
    );
  });

  it('derives assignable=false for behavior=NO_ELEGIBLE (does not read an input assignable)', async () => {
    mockClient.attendanceType.upsert.mockResolvedValue({});
    const entity = AttendanceType.create({
      code: 'SAB2',
      description: 'Sábado custom',
      absenceValue: 0,
      level: 2,
      behavior: AttendanceBehaviorValue.NO_ELEGIBLE,
    });

    await repo.save(entity);

    expect(mockClient.attendanceType.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          assignable: false,
          behavior: AttendanceBehaviorValue.NO_ELEGIBLE,
        }),
      }),
    );
  });

  it('preserves the isPresent derivation formula unchanged (absenceValue===0 && assignable)', async () => {
    mockClient.attendanceType.upsert.mockResolvedValue({});
    const entity = AttendanceType.create({
      code: 'P2',
      description: 'Presente custom',
      absenceValue: 0,
      level: 2,
      behavior: AttendanceBehaviorValue.NO_COMPUTA, // isEligible()===true, absenceValue===0 → isPresent=true
    });

    await repo.save(entity);

    expect(mockClient.attendanceType.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ isPresent: true }),
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
