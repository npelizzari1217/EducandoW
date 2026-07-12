import { describe, it, expect, vi } from 'vitest';
import {
  EducationalLevelCode,
  EducationalModalityCode,
  EmailAlreadyExistsError,
  ValidationError,
  type InstitutionLevelEntry,
} from '@educandow/domain';
import { InsufficientRoleHierarchyError, CrossInstitutionForbiddenError } from '../../shared/errors/authorization-errors';

import {
  userToResponse,
  validateLevelsSubset,
  ListUsersUseCase,
  CreateUserUseCase,
  UpdateUserUseCase,
  DeleteUserUseCase,
} from '../use-cases/users.use-cases';

// ── userToResponse tests ──────────────────────────────────

describe('userToResponse', () => {
  const baseRow = {
    id: 'user-1',
    email: 'test@test.com',
    name: 'Test User',
    passwordHash: '$2b$12$hashedpassword',
    institutionId: 'inst-1',
    institution: { id: 'inst-1', name: 'Escuela X' } as const,
    level: null as number | null,
    modality: null as number | null,
    active: true,
    failedAttempts: 0,
    lockedUntil: null as Date | null,
    deletedAt: null as Date | null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
    userRoles: [{ role: { id: 'r1', name: 'TEACHER', description: 'Docente' } }] as any[],
    userModules: [
      {
        module: { code: 'STUDENTS', name: 'Alumnos' },
        actions: ['READ', 'CREATE'],
      },
    ] as any[],
    userLevels: [] as { level: number; modality: number }[],
  };

  // F1-T1 / UP-S1: persona fields present → exposed in response
  it('returns persona fields when set on the row', () => {
    const row = {
      ...baseRow,
      firstName: 'Ana',
      lastName: 'García',
      dni: '27123456',
      title: 'Lic.',
      phone: '351-555-1234',
    };
    const response = userToResponse(row);
    expect(response.firstName).toBe('Ana');
    expect(response.lastName).toBe('García');
    expect(response.dni).toBe('27123456');
    expect(response.title).toBe('Lic.');
    expect(response.phone).toBe('351-555-1234');
  });

  // F1-T2 / UP-S2: persona fields absent → all null in response
  it('returns null for persona fields when absent from row', () => {
    const response = userToResponse(baseRow);
    expect(response.firstName).toBeNull();
    expect(response.lastName).toBeNull();
    expect(response.dni).toBeNull();
    expect(response.title).toBeNull();
    expect(response.phone).toBeNull();
  });

  it('returns levels as composite codes from userLevels', () => {
    const row = {
      ...baseRow,
      userLevels: [
        { level: 2, modality: 0 },
        { level: 3, modality: 1 },
      ],
    };

    const response = userToResponse(row);

    expect(response.levels).toEqual([20, 31]);
    expect(response.userLevels).toEqual([
      { level: 2, modality: 0 },
      { level: 3, modality: 1 },
    ]);
    // Old scalar fields should NOT appear in response
    expect((response as any).level).toBeUndefined();
    expect((response as any).modality).toBeUndefined();
  });

  it('returns empty arrays when userLevels is empty', () => {
    const row = { ...baseRow, userLevels: [] };

    const response = userToResponse(row);

    expect(response.levels).toEqual([]);
    expect(response.userLevels).toEqual([]);
  });

  it('handles undefined userLevels gracefully', () => {
    const row = { ...baseRow };
    delete (row as any).userLevels;

    const response = userToResponse(row);

    expect(response.levels).toEqual([]);
    expect(response.userLevels).toEqual([]);
  });

  it('still returns other fields correctly alongside levels', () => {
    const row = {
      ...baseRow,
      userLevels: [{ level: 1, modality: 0 }],
    };

    const response = userToResponse(row);

    expect(response.id).toBe('user-1');
    expect(response.email).toBe('test@test.com');
    expect(response.name).toBe('Test User');
    expect(response.institutionId).toBe('inst-1');
    expect(response.institutionName).toBe('Escuela X');
    expect(response.roles).toEqual(['TEACHER']);
    expect(response.levels).toEqual([10]);
    expect(response.userLevels).toEqual([{ level: 1, modality: 0 }]);
  });
});

// ── validateLevelsSubset tests ─────────────────────────────

describe('validateLevelsSubset', () => {
  const institutionLevels: InstitutionLevelEntry[] = [
    { level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN },
    { level: EducationalLevelCode.SECUNDARIO, modality: EducationalModalityCode.COMUN },
    { level: EducationalLevelCode.SECUNDARIO, modality: EducationalModalityCode.TALLERES },
  ];

  it('accepts a valid subset of institution levels', () => {
    const result = validateLevelsSubset(
      [
        { level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN },
      ],
      institutionLevels,
    );
    expect(result.isOk()).toBe(true);
  });

  it('accepts empty userLevels', () => {
    const result = validateLevelsSubset([], institutionLevels);
    expect(result.isOk()).toBe(true);
  });

  it('accepts all institution levels', () => {
    const result = validateLevelsSubset(
      [
        { level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN },
        { level: EducationalLevelCode.SECUNDARIO, modality: EducationalModalityCode.COMUN },
        { level: EducationalLevelCode.SECUNDARIO, modality: EducationalModalityCode.TALLERES },
      ],
      institutionLevels,
    );
    expect(result.isOk()).toBe(true);
  });

  it('rejects a level not in institution (TERCIARIO)', () => {
    const result = validateLevelsSubset(
      [
        { level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN },
        { level: EducationalLevelCode.TERCIARIO, modality: EducationalModalityCode.COMUN },
      ],
      institutionLevels,
    );
    expect(result.isErr()).toBe(true);
    const err = result.unwrapErr();
    expect(err.message).toContain('Levels not in institution');
    expect(err.message).toContain('4:0');
  });

  it('rejects with correct modality not in institution', () => {
    const result = validateLevelsSubset(
      [
        { level: EducationalLevelCode.SECUNDARIO, modality: EducationalModalityCode.BILINGÜISMO },
      ],
      institutionLevels,
    );
    expect(result.isErr()).toBe(true);
    const err = result.unwrapErr();
    expect(err.message).toContain('3:2');
  });

  it('lists all invalid entries in error message', () => {
    const result = validateLevelsSubset(
      [
        { level: EducationalLevelCode.TERCIARIO, modality: EducationalModalityCode.COMUN },
        { level: EducationalLevelCode.INICIAL, modality: EducationalModalityCode.COMUN },
      ],
      institutionLevels,
    );
    expect(result.isErr()).toBe(true);
    const err = result.unwrapErr();
    expect(err.message).toContain('4:0');
    expect(err.message).toContain('1:0');
  });

  it('validates against empty institution levels (rejects any input)', () => {
    const result = validateLevelsSubset(
      [{ level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN }],
      [],
    );
    expect(result.isErr()).toBe(true);
  });
});

// ── ListUsersUseCase — new filter params ─────────────────────

/**
 * Helper to build a fake UserRow as returned by Prisma's user.findMany().
 */
function makeUserRow(overrides: {
  id: string;
  roles?: string[];
  levels?: { level: number; modality: number }[];
  active?: boolean;
}) {
  return {
    id: overrides.id,
    email: `${overrides.id}@test.com`,
    name: overrides.id,
    passwordHash: 'hash',
    institutionId: 'inst-1',
    active: overrides.active ?? true,
    failedAttempts: 0,
    lockedUntil: null,
    deletedAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
    userRoles: (overrides.roles ?? []).map((name) => ({
      role: { id: `role-${name}`, name, description: name },
    })),
    institution: { id: 'inst-1', name: 'Escuela Test' },
    userModules: [],
    userLevels: (overrides.levels ?? []).map((l) => ({ level: l.level, modality: l.modality })),
    firstName: null,
    lastName: null,
    dni: null,
    title: null,
    phone: null,
  };
}

/**
 * Build a mock PrismaService that returns the given rows from getMasterClient().user.findMany().
 */
function makeMockPrisma(rows: ReturnType<typeof makeUserRow>[]) {
  return {
    getMasterClient: () => ({
      user: {
        findMany: vi.fn().mockResolvedValue(rows),
      },
    }),
  } as unknown as import('../../../infrastructure/persistence/prisma/prisma.service').PrismaService;
}

describe('ListUsersUseCase — level and roles filters', () => {
  const userPrimario = makeUserRow({
    id: 'u-primario',
    roles: ['TEACHER'],
    levels: [{ level: 2, modality: 0 }], // Primario Común
  });
  const userSecundario = makeUserRow({
    id: 'u-secundario',
    roles: ['PRECEPTOR'],
    levels: [{ level: 3, modality: 0 }], // Secundario Común
  });
  const userBothLevels = makeUserRow({
    id: 'u-both',
    roles: ['DIRECTOR'],
    levels: [
      { level: 2, modality: 0 },
      { level: 3, modality: 0 },
    ],
  });
  const userNoLevel = makeUserRow({
    id: 'u-no-level',
    roles: ['SECRETARIO'],
    levels: [],
  });

  const allUsers = [userPrimario, userSecundario, userBothLevels, userNoLevel];

  // T-L1: level=2 returns only users with userLevel.level === 2
  it('T-L1: level=2 filters users with Primario level only', async () => {
    const uc = new ListUsersUseCase(makeMockPrisma(allUsers));
    const result = await uc.execute({ creatorRoles: ['ROOT'], level: 2 });
    const ids = result.data.map((u) => u.id);
    expect(ids).toContain('u-primario');
    expect(ids).toContain('u-both');
    expect(ids).not.toContain('u-secundario');
    expect(ids).not.toContain('u-no-level');
  });

  // T-L2: roles=['TEACHER','PRECEPTOR'] returns users with any of those roles (OR)
  it('T-L2: roles=["TEACHER","PRECEPTOR"] applies OR filter', async () => {
    const uc = new ListUsersUseCase(makeMockPrisma(allUsers));
    const result = await uc.execute({ creatorRoles: ['ROOT'], roles: ['TEACHER', 'PRECEPTOR'] });
    const ids = result.data.map((u) => u.id);
    expect(ids).toContain('u-primario'); // TEACHER
    expect(ids).toContain('u-secundario'); // PRECEPTOR
    expect(ids).not.toContain('u-both'); // DIRECTOR — no match
    expect(ids).not.toContain('u-no-level'); // SECRETARIO — no match
  });

  // T-L3: level + roles combined (AND)
  it('T-L3: level=2 + roles=["TEACHER"] returns only intersection', async () => {
    const uc = new ListUsersUseCase(makeMockPrisma(allUsers));
    const result = await uc.execute({
      creatorRoles: ['ROOT'],
      level: 2,
      roles: ['TEACHER'],
    });
    const ids = result.data.map((u) => u.id);
    expect(ids).toContain('u-primario'); // Primario + TEACHER
    expect(ids).not.toContain('u-both'); // Primario but DIRECTOR, not TEACHER
    expect(ids).not.toContain('u-secundario'); // PRECEPTOR, not Primario
  });

  // T-L4: back-compat — role (singular string) still works
  it('T-L4: role (singular, back-compat) still filters correctly', async () => {
    const uc = new ListUsersUseCase(makeMockPrisma(allUsers));
    const result = await uc.execute({ creatorRoles: ['ROOT'], role: 'DIRECTOR' });
    const ids = result.data.map((u) => u.id);
    expect(ids).toContain('u-both'); // DIRECTOR
    expect(ids).not.toContain('u-primario'); // TEACHER, not DIRECTOR
    expect(ids).not.toContain('u-secundario'); // PRECEPTOR, not DIRECTOR
    expect(ids).not.toContain('u-no-level'); // SECRETARIO, not DIRECTOR
  });
});

// ── CreateUserUseCase — Result migration (AEM-R4/R5/R6) ────────────

/**
 * Builds a fake full user record as returned by user.create / the post-create refresh findUnique.
 */
function makeCreatedUserRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-new',
    email: 'new@test.com',
    name: 'New User',
    passwordHash: 'hashed',
    institutionId: 'inst-1',
    active: true,
    failedAttempts: 0,
    lockedUntil: null,
    deletedAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
    userRoles: [],
    institution: null,
    userModules: [],
    userLevels: [],
    firstName: null,
    lastName: null,
    dni: null,
    title: null,
    phone: null,
    ...overrides,
  };
}

/**
 * Mock PrismaService for CreateUserUseCase. First `user.findUnique` call is the email-uniqueness
 * check; the second (only reached on the success path) is the post-create refresh.
 */
function makeCreatePrisma(opts: {
  existingEmail?: unknown;
  institution?: { levels: { level: number; modality: number }[] } | null;
} = {}) {
  const findUnique = vi
    .fn()
    .mockResolvedValueOnce(opts.existingEmail ?? null)
    .mockResolvedValueOnce(makeCreatedUserRecord());

  return {
    getMasterClient: () => ({
      user: {
        findUnique,
        create: vi.fn().mockResolvedValue(makeCreatedUserRecord()),
      },
      institution: {
        findUnique: vi.fn().mockResolvedValue(opts.institution ?? null),
      },
      role: { findMany: vi.fn().mockResolvedValue([]) },
      userRole: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
      profileModulePermission: { findMany: vi.fn().mockResolvedValue([]) },
      module: { findMany: vi.fn().mockResolvedValue([]) },
      userModule: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    }),
  } as unknown as import('../../../infrastructure/persistence/prisma/prisma.service').PrismaService;
}

describe('CreateUserUseCase', () => {
  // AEM-R4.S1 / AEM-R5.S1 — insufficient hierarchy → err, not throw
  it('returns err(InsufficientRoleHierarchyError) when caller lacks hierarchy for the requested roles', async () => {
    const uc = new CreateUserUseCase(makeCreatePrisma());

    const result = await uc.execute({
      email: 'new@test.com',
      password: 'secret123',
      name: 'New User',
      roles: ['ADMIN'],
      creatorRoles: ['TEACHER'],
    });

    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error).toBeInstanceOf(InsufficientRoleHierarchyError);
    expect(error.code).toBe('INSUFFICIENT_ROLE_HIERARCHY');
  });

  // AEM-R4.S6 (site #1) — email already exists → err, not throw
  it('returns err(EmailAlreadyExistsError) when the email is already registered', async () => {
    const uc = new CreateUserUseCase(
      makeCreatePrisma({ existingEmail: makeCreatedUserRecord({ id: 'existing' }) }),
    );

    const result = await uc.execute({
      email: 'new@test.com',
      password: 'secret123',
      name: 'New User',
      creatorRoles: ['ROOT'],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(EmailAlreadyExistsError);
  });

  // AEM-R4.S6 (site #3) — levels not a subset of institution levels → err, not throw
  it('returns err(ValidationError) when levels are not a subset of institution levels', async () => {
    const uc = new CreateUserUseCase(
      makeCreatePrisma({
        institution: { levels: [{ level: 2, modality: 0 }] }, // Primario Común only
      }),
    );

    const result = await uc.execute({
      email: 'new@test.com',
      password: 'secret123',
      name: 'New User',
      creatorRoles: ['DIRECTOR'],
      creatorInstitutionId: 'inst-1',
      levels: [{ level: 4, modality: 0 }], // Terciario — not in institution
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });

  // AEM-R6.S1 — ROOT bypasses hierarchy entirely
  it('ROOT caller succeeds regardless of requested role hierarchy', async () => {
    const uc = new CreateUserUseCase(makeCreatePrisma());

    const result = await uc.execute({
      email: 'new@test.com',
      password: 'secret123',
      name: 'New User',
      roles: ['ADMIN'],
      creatorRoles: ['ROOT'],
    });

    expect(result.isOk()).toBe(true);
  });

  // AEM-R6.S2 — non-ROOT caller with strictly sufficient hierarchy succeeds
  it('non-ROOT caller with sufficient hierarchy succeeds', async () => {
    const uc = new CreateUserUseCase(makeCreatePrisma());

    const result = await uc.execute({
      email: 'new@test.com',
      password: 'secret123',
      name: 'New User',
      roles: ['TEACHER'],
      creatorRoles: ['ADMIN'],
    });

    expect(result.isOk()).toBe(true);
  });
});

// ── UpdateUserUseCase — Result migration (AEM-R4/R5/R6) ────────────

function makeExistingUserRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'existing@test.com',
    name: 'Existing User',
    passwordHash: 'hashed',
    institutionId: 'inst-1',
    active: true,
    failedAttempts: 0,
    lockedUntil: null,
    deletedAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
    userRoles: [] as { role: { id: string; name: string; description: string } }[],
    institution: null,
    userModules: [],
    userLevels: [],
    firstName: null,
    lastName: null,
    dni: null,
    title: null,
    phone: null,
    ...overrides,
  };
}

/**
 * Mock PrismaService for UpdateUserUseCase. `user.findUnique` is called with `where: { id }`
 * (initial lookup, then post-update refresh) and with `where: { email }` (uniqueness check) —
 * differentiated by argument shape. The first `id` lookup returns `existingUser`; the last
 * returns `updatedUser` (post-update refresh).
 */
function makeUpdatePrisma(opts: {
  existingUser?: ReturnType<typeof makeExistingUserRecord> | null;
  emailConflict?: unknown;
  institution?: { levels: { level: number; modality: number }[] } | null;
  updatedUser?: ReturnType<typeof makeExistingUserRecord>;
} = {}) {
  let idCallCount = 0;
  const existingUser =
    opts.existingUser === undefined ? makeExistingUserRecord() : opts.existingUser;

  const findUnique = vi.fn().mockImplementation((args: { where?: { email?: string; id?: string } }) => {
    if (args?.where?.email !== undefined) {
      return Promise.resolve(opts.emailConflict ?? null);
    }
    idCallCount += 1;
    if (idCallCount === 1) {
      return Promise.resolve(existingUser);
    }
    return Promise.resolve(opts.updatedUser ?? existingUser);
  });

  return {
    getMasterClient: () => ({
      user: {
        findUnique,
        update: vi.fn().mockResolvedValue(undefined),
      },
      institution: {
        findUnique: vi.fn().mockResolvedValue(opts.institution ?? null),
      },
      role: { findMany: vi.fn().mockResolvedValue([]) },
      userRole: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      profileModulePermission: { findMany: vi.fn().mockResolvedValue([]) },
      module: { findMany: vi.fn().mockResolvedValue([]) },
      userModule: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    }),
  } as unknown as import('../../../infrastructure/persistence/prisma/prisma.service').PrismaService;
}

describe('UpdateUserUseCase', () => {
  // AEM-R4.S2 / AEM-R5.S5 (site #4) — cross-institution → err, not throw
  it('returns err(CrossInstitutionForbiddenError) when creatorInstitutionId differs from the target institutionId', async () => {
    const uc = new UpdateUserUseCase(
      makeUpdatePrisma({ existingUser: makeExistingUserRecord({ institutionId: 'inst-2' }) }),
    );

    const result = await uc.execute(
      'user-1',
      { name: 'New Name' },
      ['DIRECTOR'],
      'inst-1',
    );

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(CrossInstitutionForbiddenError);
  });

  // AEM-R4.S3 / AEM-R5.S2 (site #5) — insufficient hierarchy to manage target → err, not throw
  it('returns err(InsufficientRoleHierarchyError) when caller cannot manage the target by canManageUser', async () => {
    const uc = new UpdateUserUseCase(
      makeUpdatePrisma({
        existingUser: makeExistingUserRecord({
          institutionId: 'inst-1',
          userRoles: [{ role: { id: 'r1', name: 'ADMIN', description: 'Admin' } }],
        }),
      }),
    );

    const result = await uc.execute(
      'user-1',
      { name: 'New Name' },
      ['TEACHER'],
      'inst-1',
    );

    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error).toBeInstanceOf(InsufficientRoleHierarchyError);
    expect(error.code).toBe('INSUFFICIENT_ROLE_HIERARCHY');
  });

  // AEM-R4.S4 / AEM-R5.S3 (site #6) — assigning roles above own rank → err, not throw
  it('returns err(InsufficientRoleHierarchyError) when assigning roles above the caller own rank', async () => {
    const uc = new UpdateUserUseCase(
      makeUpdatePrisma({
        existingUser: makeExistingUserRecord({
          institutionId: 'inst-1',
          userRoles: [{ role: { id: 'r1', name: 'TEACHER', description: 'Teacher' } }],
        }),
      }),
    );

    const result = await uc.execute(
      'user-1',
      { roles: ['ADMIN'] },
      ['DIRECTOR'],
      'inst-1',
    );

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(InsufficientRoleHierarchyError);
  });

  // AEM-R4.S6 (site #7) — email conflict → err, not throw
  it('returns err(EmailAlreadyExistsError) on email conflict', async () => {
    const uc = new UpdateUserUseCase(
      makeUpdatePrisma({
        existingUser: makeExistingUserRecord({ institutionId: 'inst-1' }),
        emailConflict: makeExistingUserRecord({ id: 'other-user' }),
      }),
    );

    const result = await uc.execute(
      'user-1',
      { email: 'taken@test.com' },
      ['ROOT'],
    );

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(EmailAlreadyExistsError);
  });

  // AEM-R4.S6 (site #8) — invalid levels → err, not throw
  it('returns err(ValidationError) when levels are not a subset of institution levels', async () => {
    const uc = new UpdateUserUseCase(
      makeUpdatePrisma({
        existingUser: makeExistingUserRecord({ institutionId: 'inst-1' }),
        institution: { levels: [{ level: 2, modality: 0 }] },
      }),
    );

    const result = await uc.execute(
      'user-1',
      { levels: [{ level: 4, modality: 0 }] },
      ['DIRECTOR'],
      'inst-1',
    );

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });

  // Not-found semantics unchanged: ok path with data: null, NOT an error (design §3.1)
  it('returns ok({ data: null }) when the target user does not exist (unchanged semantics)', async () => {
    const uc = new UpdateUserUseCase(makeUpdatePrisma({ existingUser: null }));

    const result = await uc.execute('missing-id', { name: 'New Name' }, ['ROOT']);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ data: null });
  });

  // AEM-R6.S1 — ROOT bypasses all hierarchy and institution checks
  it('ROOT caller succeeds regardless of target roles or institution', async () => {
    const uc = new UpdateUserUseCase(
      makeUpdatePrisma({
        existingUser: makeExistingUserRecord({
          institutionId: 'inst-2',
          userRoles: [{ role: { id: 'r1', name: 'ADMIN', description: 'Admin' } }],
        }),
      }),
    );

    const result = await uc.execute(
      'user-1',
      { roles: ['ADMIN'] },
      ['ROOT'],
      'inst-1',
    );

    expect(result.isOk()).toBe(true);
  });

  // AEM-R6.S2 — non-ROOT caller with strictly sufficient hierarchy succeeds
  it('non-ROOT caller with sufficient hierarchy succeeds', async () => {
    const uc = new UpdateUserUseCase(
      makeUpdatePrisma({
        existingUser: makeExistingUserRecord({
          institutionId: 'inst-1',
          userRoles: [{ role: { id: 'r1', name: 'TEACHER', description: 'Teacher' } }],
        }),
      }),
    );

    const result = await uc.execute(
      'user-1',
      { name: 'New Name' },
      ['ADMIN'],
      'inst-1',
    );

    expect(result.isOk()).toBe(true);
  });

  // AEM-R6.S3 — same-institution update never returns CrossInstitutionForbiddenError
  it('same-institution update never returns CrossInstitutionForbiddenError', async () => {
    const uc = new UpdateUserUseCase(
      makeUpdatePrisma({
        existingUser: makeExistingUserRecord({ institutionId: 'inst-1' }),
      }),
    );

    const result = await uc.execute(
      'user-1',
      { name: 'New Name' },
      ['DIRECTOR'],
      'inst-1',
    );

    if (result.isErr()) {
      expect(result.unwrapErr()).not.toBeInstanceOf(CrossInstitutionForbiddenError);
    } else {
      expect(result.isOk()).toBe(true);
    }
  });
});

// ── DeleteUserUseCase — Result migration (AEM-R4/R5/R6) ────────────

function makeDeletePrisma(opts: {
  existingUser?: { id: string; userRoles: { role: { name: string } }[] } | null;
} = {}) {
  const existingUser =
    opts.existingUser === undefined
      ? { id: 'user-1', userRoles: [] as { role: { name: string } }[] }
      : opts.existingUser;

  return {
    getMasterClient: () => ({
      user: {
        findUnique: vi.fn().mockResolvedValue(existingUser),
        update: vi.fn().mockResolvedValue(undefined),
      },
    }),
  } as unknown as import('../../../infrastructure/persistence/prisma/prisma.service').PrismaService;
}

describe('DeleteUserUseCase', () => {
  // AEM-R4.S5 / AEM-R5.S4 (site #9) — insufficient hierarchy → err, not throw
  it('returns err(InsufficientRoleHierarchyError) when caller cannot manage the target by canManageUser', async () => {
    const uc = new DeleteUserUseCase(
      makeDeletePrisma({
        existingUser: { id: 'user-1', userRoles: [{ role: { name: 'ADMIN' } }] },
      }),
    );

    const result = await uc.execute('user-1', ['TEACHER']);

    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error).toBeInstanceOf(InsufficientRoleHierarchyError);
    expect(error.code).toBe('INSUFFICIENT_ROLE_HIERARCHY');
  });

  // Not-found semantics unchanged: idempotent no-op, ok(undefined), NOT an error (design §4)
  it('returns ok(undefined) when the target user does not exist (idempotent no-op)', async () => {
    const uc = new DeleteUserUseCase(makeDeletePrisma({ existingUser: null }));

    const result = await uc.execute('missing-id', ['ROOT']);

    expect(result.isOk()).toBe(true);
  });

  // AEM-R6.S1 — ROOT bypasses hierarchy entirely
  it('ROOT caller succeeds regardless of target roles', async () => {
    const uc = new DeleteUserUseCase(
      makeDeletePrisma({
        existingUser: { id: 'user-1', userRoles: [{ role: { name: 'ADMIN' } }] },
      }),
    );

    const result = await uc.execute('user-1', ['ROOT']);

    expect(result.isOk()).toBe(true);
  });

  // AEM-R6.S2 — non-ROOT caller with strictly sufficient hierarchy succeeds
  it('non-ROOT caller with sufficient hierarchy succeeds', async () => {
    const uc = new DeleteUserUseCase(
      makeDeletePrisma({
        existingUser: { id: 'user-1', userRoles: [{ role: { name: 'TEACHER' } }] },
      }),
    );

    const result = await uc.execute('user-1', ['ADMIN']);

    expect(result.isOk()).toBe(true);
  });
});
