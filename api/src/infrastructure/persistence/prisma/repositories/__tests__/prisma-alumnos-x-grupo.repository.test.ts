/**
 * PrismaAlumnosXGrupoRepository — findStudentIdsByGrupoIds unit tests.
 *
 * Two-hop resolution: AlumnosXGrupo → MateriasXAlumnoXCursoXCiclo.studentId.
 * Mocks the tenant Prisma client via TenantContext.
 *
 * Satisfies: ADR-2, spec "Student ID Deduplication for Multi-Grupo Teachers"
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaAlumnosXGrupoRepository } from '../prisma-alumnos-x-grupo.repository';
import { TenantContext } from '../../../../auth/tenant.context';

vi.mock('../../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

type MockClient = {
  alumnosXGrupoXCursoXMateriaXCiclo: {
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    orderBy?: unknown;
  };
  materiasXAlumnoXCursoXCiclo: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

function makeMockClient(overrides: Partial<{
  axgRows: { alumnosXMateriaXCursoXCicloId: string }[];
  axmRows: { id: string; studentId: string }[];
}> = {}): MockClient {
  const axgRows = overrides.axgRows ?? [];
  const axmRows = overrides.axmRows ?? [];

  return {
    alumnosXGrupoXCursoXMateriaXCiclo: {
      findMany: vi.fn().mockResolvedValue(axgRows),
      upsert: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    materiasXAlumnoXCursoXCiclo: {
      findMany: vi.fn().mockResolvedValue(axmRows),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// findStudentIdsByGrupoIds
// ═══════════════════════════════════════════════════════════════════════════════

describe('PrismaAlumnosXGrupoRepository.findStudentIdsByGrupoIds', () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
  });

  it('grupoIds = [] → returns [] without calling Prisma', async () => {
    const repo = new PrismaAlumnosXGrupoRepository();
    const result = await repo.findStudentIdsByGrupoIds([]);
    expect(result).toEqual([]);
    expect(mockClient.alumnosXGrupoXCursoXMateriaXCiclo.findMany).not.toHaveBeenCalled();
    expect(mockClient.materiasXAlumnoXCursoXCiclo.findMany).not.toHaveBeenCalled();
  });

  it('hop-1 returns no rows → returns [] without calling hop-2', async () => {
    mockClient = makeMockClient({ axgRows: [] });
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    const repo = new PrismaAlumnosXGrupoRepository();
    const result = await repo.findStudentIdsByGrupoIds(['grupo-1']);
    expect(result).toEqual([]);
    expect(mockClient.materiasXAlumnoXCursoXCiclo.findMany).not.toHaveBeenCalled();
  });

  it('hop-1 returns rows, hop-2 returns student IDs → correct string[]', async () => {
    mockClient = makeMockClient({
      axgRows: [
        { alumnosXMateriaXCursoXCicloId: 'axm-1' },
        { alumnosXMateriaXCursoXCicloId: 'axm-2' },
      ],
      axmRows: [
        { id: 'axm-1', studentId: 'student-1' },
        { id: 'axm-2', studentId: 'student-2' },
      ],
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    const repo = new PrismaAlumnosXGrupoRepository();
    const result = await repo.findStudentIdsByGrupoIds(['grupo-1']);
    expect(result).toHaveLength(2);
    expect(result).toContain('student-1');
    expect(result).toContain('student-2');
  });

  it('co-docencia: same studentId via 2 different alumnosXMateriaXCursoXCicloIds → deduplicated', async () => {
    // S1 appears in both G1 and G2 via different axm rows that share the same studentId
    mockClient = makeMockClient({
      axgRows: [
        { alumnosXMateriaXCursoXCicloId: 'axm-1' },
        { alumnosXMateriaXCursoXCicloId: 'axm-2' },
      ],
      axmRows: [
        { id: 'axm-1', studentId: 's1' },
        { id: 'axm-2', studentId: 's1' }, // same student via different axm
      ],
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    const repo = new PrismaAlumnosXGrupoRepository();
    const result = await repo.findStudentIdsByGrupoIds(['grupo-1', 'grupo-2']);
    expect(result).toEqual(['s1']); // deduplicated
  });

  it('hop-1 deduplicates alumnosXMateriaIds before hop-2 query', async () => {
    // Two AlumnosXGrupo rows pointing to the same axm (shouldn't happen per unique constraint but guard it)
    mockClient = makeMockClient({
      axgRows: [
        { alumnosXMateriaXCursoXCicloId: 'axm-1' },
        { alumnosXMateriaXCursoXCicloId: 'axm-1' }, // duplicate
      ],
      axmRows: [
        { id: 'axm-1', studentId: 's1' },
      ],
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    const repo = new PrismaAlumnosXGrupoRepository();
    const result = await repo.findStudentIdsByGrupoIds(['grupo-1']);
    // hop-2 must receive deduped axmIds
    expect(mockClient.materiasXAlumnoXCursoXCiclo.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['axm-1'] } },
      select: { studentId: true },
    });
    expect(result).toEqual(['s1']);
  });
});
