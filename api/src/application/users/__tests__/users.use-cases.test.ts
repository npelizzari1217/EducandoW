import { describe, it, expect, vi } from 'vitest';
import {
  EducationalLevelCode,
  EducationalModalityCode,
  type InstitutionLevelEntry,
} from '@educandow/domain';

import {
  userToResponse,
  validateLevelsSubset,
  ListUsersUseCase,
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
