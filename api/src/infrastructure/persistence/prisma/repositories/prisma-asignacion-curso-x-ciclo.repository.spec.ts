/**
 * PrismaAsignacionCursoXCicloRepository — findTitularCourseIdsByUser tests
 * REQ-08, D1, D6 (TDD RED → GREEN)
 * Mocks TenantContext; no real DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaAsignacionCursoXCicloRepository } from './prisma-asignacion-curso-x-ciclo.repository';
import { TenantContext } from '../../../auth/tenant.context';
import { RolCurso } from '@educandow/domain';

vi.mock('../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

function makeMockClient(rows: { courseCycleId: string }[] = []) {
  return {
    asignacionCursoXCiclo: {
      findMany: vi.fn().mockResolvedValue(rows),
    },
  };
}

describe('PrismaAsignacionCursoXCicloRepository — findTitularCourseIdsByUser', () => {
  let repo: PrismaAsignacionCursoXCicloRepository;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repo = new PrismaAsignacionCursoXCicloRepository();
  });

  it('returns courseCycleId strings for TITULAR rows with active docenteXCiclo', async () => {
    mockClient.asignacionCursoXCiclo.findMany.mockResolvedValue([
      { courseCycleId: 'cc-uuid-1' },
      { courseCycleId: 'cc-uuid-2' },
    ]);

    const result = await repo.findTitularCourseIdsByUser('user-abc');

    expect(result).toEqual(['cc-uuid-1', 'cc-uuid-2']);
  });

  it('deduplicates: two TITULAR rows with the same courseCycleId → array of length 1', async () => {
    mockClient.asignacionCursoXCiclo.findMany.mockResolvedValue([
      { courseCycleId: 'cc-uuid-shared' },
      { courseCycleId: 'cc-uuid-shared' },
    ]);

    const result = await repo.findTitularCourseIdsByUser('user-abc');

    expect(result).toHaveLength(1);
    expect(result[0]).toBe('cc-uuid-shared');
  });

  it('returns [] when no TITULAR rows match — no throw', async () => {
    mockClient.asignacionCursoXCiclo.findMany.mockResolvedValue([]);

    const result = await repo.findTitularCourseIdsByUser('user-no-titular');

    expect(result).toEqual([]);
  });

  it('issues findMany with rol=TITULAR and docenteXCiclo:{userId, active:true}', async () => {
    mockClient.asignacionCursoXCiclo.findMany.mockResolvedValue([]);

    await repo.findTitularCourseIdsByUser('user-xyz');

    expect(mockClient.asignacionCursoXCiclo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          rol: RolCurso.TITULAR,
          docenteXCiclo: { userId: 'user-xyz', active: true },
        },
        select: { courseCycleId: true },
      }),
    );
  });
});
