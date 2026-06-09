/**
 * PR3-T9 [RED] — PrismaTeacherRepository.findByUserId tests.
 * Mocks TenantContext; no real DB.
 * Specs: TIA-R1, TIA-R2, AD-6
 *
 * Review-fix tests (C1, S1):
 *  C1 — save() must persist userId in both create and update blocks.
 *  S1 — findByUserId must filter deletedAt: null (soft-delete guard).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaTeacherRepository } from './prisma-teacher.repository';
import { Teacher, Id, Dni, Email } from '@educandow/domain';
import { TenantContext } from '../../../auth/tenant.context';

vi.mock('../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
    getInstitutionId: vi.fn().mockReturnValue('inst-1'),
  },
}));

// ── Row factory ────────────────────────────────────────────────────────────────

function makeTeacherRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'teacher-uuid-1',
    firstName: 'Ana',
    lastName: 'García',
    dni: '12345678',
    email: 'ana@test.com',
    phone: null,
    title: null,
    userId: null,
    active: true,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ── Mock client factory ────────────────────────────────────────────────────────

function makeMockClient() {
  return {
    teacher: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// findByUserId
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaTeacherRepository — findByUserId', () => {
  let repo: PrismaTeacherRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaTeacherRepository();
  });

  it('returns null when no teacher has the given userId', async () => {
    mockClient.teacher.findFirst.mockResolvedValue(null);

    const result = await repo.findByUserId('user-does-not-exist');

    expect(result).toBeNull();
  });

  it('returns a Teacher entity when a matching userId is found', async () => {
    mockClient.teacher.findFirst.mockResolvedValue(
      makeTeacherRow({ id: 'teacher-uuid-1', userId: 'user-abc' }),
    );

    const result = await repo.findByUserId('user-abc');

    expect(result).not.toBeNull();
    expect(result!.id.get()).toBe('teacher-uuid-1');
    expect(result!.userId).toBe('user-abc');
  });

  it('queries by userId field', async () => {
    mockClient.teacher.findFirst.mockResolvedValue(null);

    await repo.findByUserId('user-abc');

    expect(mockClient.teacher.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-abc' }),
      }),
    );
  });

  it('returns null for a different tenant (different client returns null)', async () => {
    // Simulate a different tenant DB where this userId does not exist
    const otherMockClient = makeMockClient();
    otherMockClient.teacher.findFirst.mockResolvedValue(null);
    vi.mocked(TenantContext.getClient).mockReturnValue(otherMockClient as any);

    const result = await repo.findByUserId('user-abc');

    expect(result).toBeNull();
  });

  // S1 — soft-delete guard
  it('excludes soft-deleted teachers from auth lookup', async () => {
    mockClient.teacher.findFirst.mockResolvedValue(null);

    await repo.findByUserId('user-abc');

    expect(mockClient.teacher.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// save
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaTeacherRepository — save', () => {
  let repo: PrismaTeacherRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    vi.mocked(TenantContext.getInstitutionId).mockReturnValue('inst-1');
    repo = new PrismaTeacherRepository();
  });

  // C1 — userId must survive the upsert in both create and update branches
  it('save() persists userId in both create and update', async () => {
    mockClient.teacher.upsert.mockResolvedValue({} as any);

    const teacher = Teacher.reconstruct({
      id: Id.reconstruct('teacher-uuid-1'),
      firstName: 'Ana',
      lastName: 'García',
      dni: Dni.reconstruct('12345678'),
      email: Email.reconstruct('ana@test.com'),
      userId: 'user-abc',
      active: true,
    });

    await repo.save(teacher);

    expect(mockClient.teacher.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: 'user-abc' }),
        update: expect.objectContaining({ userId: 'user-abc' }),
      }),
    );
  });
});
