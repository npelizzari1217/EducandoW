import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaUserRepository } from '../prisma-user.repository';
import { PrismaService } from '../../prisma.service';
import {
  Id,
  Email,
  EducationalLevelCode,
  EducationalModalityCode,
  User,
  type UserLevelEntry,
} from '@educandow/domain';

// ── Helpers ──────────────────────────────────────────────────

function makePrismaUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed-abc',
    institutionId: 'inst-1',
    failedAttempts: 0,
    lockedUntil: null,
    active: true,
    deletedAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
    userRoles: [],
    userModules: [],
    userLevels: [],
    ...overrides,
  };
}

function makeMockPrismaService(masterClient: Record<string, unknown> = {}) {
  return {
    getMasterClient: () => masterClient,
    getTenantClient: () => ({}),
  } as unknown as PrismaService;
}

// ── toDomain mapping tests ──────────────────────────────────

describe('PrismaUserRepository — toDomain with userLevels', () => {
  let repo: PrismaUserRepository;

  beforeEach(() => {
    const mockPrisma = makeMockPrismaService();
    repo = new PrismaUserRepository(mockPrisma);
  });

  it('maps userLevels rows to User.levels as UserLevelEntry[]', () => {
    const row = makePrismaUserRow({
      level: null,
      modality: null,
      userLevels: [
        { level: 2, modality: 0 },
        { level: 3, modality: 1 },
      ],
    });

    // Access private toDomain via reflect or by calling a public method
    // We'll test indirectly by checking that the repository reads userLevels
    // via a findByEmail call (mocked)
    // For direct toDomain test, use TypeScript trick
    const toDomain = (repo as any).toDomain.bind(repo);
    const user: User = toDomain(row);

    const levels = user.levels;
    expect(levels).toHaveLength(2);
    expect(levels[0]).toEqual({ level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN });
    expect(levels[1]).toEqual({ level: EducationalLevelCode.SECUNDARIO, modality: EducationalModalityCode.TALLERES });
  });

  it('maps empty userLevels to empty levels array', () => {
    const row = makePrismaUserRow({
      level: null,
      modality: null,
      userLevels: [],
    });

    const toDomain = (repo as any).toDomain.bind(repo);
    const user: User = toDomain(row);

    expect(user.levels).toHaveLength(0);
  });

  it('userLevels is the sole source for levels — deprecated scalar fields are ignored', () => {
    const row = makePrismaUserRow({
      userLevels: [],
    });

    const toDomain = (repo as any).toDomain.bind(repo);
    const user: User = toDomain(row);

    // Levels come only from userLevels — deprecated scalar fields no longer exist
    expect(user.levels).toHaveLength(0);
  });

  it('handles undefined userLevels gracefully (levels defaults to empty)', () => {
    const row = makePrismaUserRow({});
    delete (row as any).userLevels;

    const toDomain = (repo as any).toDomain.bind(repo);
    const user: User = toDomain(row);

    expect(user.levels).toHaveLength(0);
  });

  it('userLevels are correctly mapped to User entity', () => {
    const row = makePrismaUserRow({
      userLevels: [
        { level: 4, modality: 2 },
      ],
    });

    const toDomain = (repo as any).toDomain.bind(repo);
    const user: User = toDomain(row);

    expect(user.levels).toHaveLength(1);
    expect(user.levels[0]).toEqual({
      level: EducationalLevelCode.TERCIARIO,
      modality: EducationalModalityCode.BILINGÜISMO,
    });
  });
});

// ── save() userLevels tests ──────────────────────────────────

describe('PrismaUserRepository — save() with userLevels', () => {
  it('includes userLevels.create when user has levels on upsert', async () => {
    const mockUpsert = vi.fn().mockResolvedValue(makePrismaUserRow({ userLevels: [{ level: 2, modality: 0 }] }));
    const mockClient = { user: { upsert: mockUpsert } };
    const repo = new PrismaUserRepository(makeMockPrismaService(mockClient));

    const user = User.create({
      email: Email.reconstruct('test@test.com'),
      name: 'Test',
      passwordHash: 'hash',
      levels: [
        { level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN },
      ],
    });

    const result = await repo.save(user);
    expect(result.isOk()).toBe(true);

    // Verify upsert was called with userLevels in both create and update
    const upsertArg = mockUpsert.mock.calls[0][0];
    expect(upsertArg.create.userLevels).toBeDefined();
    expect(upsertArg.create.userLevels.create).toEqual([{ level: 2, modality: 0 }]);
    expect(upsertArg.update.userLevels).toBeDefined();
    expect(upsertArg.update.userLevels.deleteMany).toEqual({});
    expect(upsertArg.update.userLevels.create).toEqual([{ level: 2, modality: 0 }]);

    // Old level/modality scalars should NOT be written
    expect(upsertArg.create.level).toBeUndefined();
    expect(upsertArg.create.modality).toBeUndefined();
    expect(upsertArg.update.level).toBeUndefined();
    expect(upsertArg.update.modality).toBeUndefined();
  });

  it('does NOT touch userLevels when user.levels is empty', async () => {
    const mockUpsert = vi.fn().mockResolvedValue(makePrismaUserRow());
    const mockClient = { user: { upsert: mockUpsert } };
    const repo = new PrismaUserRepository(makeMockPrismaService(mockClient));

    const user = User.create({
      email: Email.reconstruct('test@test.com'),
      name: 'Test',
      passwordHash: 'hash',
    });
    // User.create without levels → levels is []

    const result = await repo.save(user);
    expect(result.isOk()).toBe(true);

    const upsertArg = mockUpsert.mock.calls[0][0];
    expect(upsertArg.create.userLevels).toBeUndefined();
    expect(upsertArg.update.userLevels).toBeUndefined();
  });

  it('userInclude includes userLevels', () => {
    const repo = new PrismaUserRepository(makeMockPrismaService());
    const include = (repo as any).userInclude;

    expect(include.userLevels).toBeDefined();
    // userLevels should just be a simple include (no nested relations needed)
    expect(include.userLevels).toBe(true);
  });
});
