import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock('@prisma/tenant-client', () => ({
  PrismaClient: vi.fn(),
}));

import { ListarAlumnosQuery } from '../../src/application/shared/queries/listar-alumnos.query';

function makeQuery() {
  const mockPrisma = {
    student: {
      findMany: mockFindMany,
    },
  };
  return new ListarAlumnosQuery({ prisma: mockPrisma as any });
}

describe('ListarAlumnosQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT include institutionId in the where clause', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const query = makeQuery();
    const result = await query.execute({
      institutionId: 'inst-123',
      search: 'juan',
      page: 1,
      pageSize: 10,
    });

    expect(result.isOk()).toBe(true);

    // Verify no institutionId in where clause
    const whereArg = mockFindMany.mock.calls[0][0]?.where;
    expect(whereArg).not.toHaveProperty('institutionId');

    // Verify other filters still work
    expect(whereArg).toHaveProperty('OR');
    expect(whereArg.OR).toEqual([
      { firstName: { contains: 'juan', mode: 'insensitive' } },
      { lastName: { contains: 'juan', mode: 'insensitive' } },
      { dni: { contains: 'juan' } },
    ]);
  });

  it('returns empty list when no students match', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const query = makeQuery();
    const result = await query.execute({
      institutionId: 'inst-456',
      page: 1,
      pageSize: 20,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([]);
    }

    // Verify institutionId NOT in where clause
    const whereArg = mockFindMany.mock.calls[0][0]?.where;
    expect(whereArg).not.toHaveProperty('institutionId');
  });

  it('filters by search term across firstName, lastName, and dni', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 's1',
        firstName: 'Juan',
        lastName: 'Perez',
        dni: '12345678',
        enrollments: [{ level: 2, grade: '3A', division: 'A', status: 'ACTIVE' }],
      },
    ]);

    const query = makeQuery();
    const result = await query.execute({
      institutionId: 'inst-any',
      search: 'juan',
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].nombre).toBe('Juan');
    }

    // Verify search was applied but institutionId was NOT
    const whereArg = mockFindMany.mock.calls[0][0]?.where;
    expect(whereArg).not.toHaveProperty('institutionId');
    expect(whereArg.OR).toBeDefined();
  });

  it('uses default pagination when page/pageSize not provided', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const query = makeQuery();
    await query.execute({ institutionId: 'inst-x' });

    const args = mockFindMany.mock.calls[0][0];
    expect(args.skip).toBe(0);
    expect(args.take).toBe(20);
  });
});
