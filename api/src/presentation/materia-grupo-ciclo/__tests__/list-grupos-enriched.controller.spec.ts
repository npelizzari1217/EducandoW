/**
 * MateriasGruposController — GET /course-cycles/:ccId/materias/:materiaId/grupos (enriched)
 *
 * Tests that listGrupos returns userId, docenteName and uses alumnosCount (plural).
 * Written BEFORE implementation (TDD — F7 backend enrichment).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock TenantContext so calls to getClient() are controlled per test
const mockGetClient = vi.fn();
vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: mockGetClient,
  },
}));

let MateriasGruposController: any;

beforeAll(async () => {
  const mod = await import('../materia-grupo-ciclo.controller');
  MateriasGruposController = mod.MateriasGruposController;
});

function makeController(overrides: Record<string, unknown> = {}) {
  const ctrl = Object.create(MateriasGruposController.prototype);
  ctrl.listMateriasUC = overrides.listMateriasUC ?? { execute: vi.fn().mockResolvedValue([]) };
  ctrl.addStudentToMateriaUC = overrides.addStudentToMateriaUC ?? { execute: vi.fn() };
  ctrl.createGrupoUC = overrides.createGrupoUC ?? { execute: vi.fn() };
  ctrl.listGruposUC = overrides.listGruposUC ?? {
    execute: vi.fn().mockResolvedValue([]),
    getAlumnosForGrupo: vi.fn().mockResolvedValue([]),
  };
  ctrl.addStudentToGrupoUC = overrides.addStudentToGrupoUC ?? { execute: vi.fn() };
  ctrl.prismaService = overrides.prismaService ?? { getMasterClient: vi.fn() };
  return ctrl;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MateriasGruposController — listGrupos enriched', () => {
  it('T1: returns grupos with userId and docenteName resolved from docenteXCiclo + master user', async () => {
    const mockGrupos = [
      {
        grupo: { id: 'g-1', materiaXCursoXCicloId: 'm-1', docenteXCicloId: 'dxc-1', name: 'Grupo A' },
        alumnos: [{ id: 'a-1' }, { id: 'a-2' }],
      },
    ];
    const listGruposUC = { execute: vi.fn().mockResolvedValue(mockGrupos) };

    const mockClient = {
      docenteXCiclo: {
        findMany: vi.fn().mockResolvedValue([{ id: 'dxc-1', userId: 'user-1' }]),
      },
    };
    mockGetClient.mockReturnValue(mockClient);

    const mockMasterClient = {
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'user-1', firstName: 'Ana', lastName: 'García', name: 'Ana García' },
        ]),
      },
    };
    const prismaService = { getMasterClient: vi.fn().mockReturnValue(mockMasterClient) };

    const ctrl = makeController({ listGruposUC, prismaService });
    const result = await ctrl.listGrupos('m-1');

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'g-1',
      userId: 'user-1',
      docenteName: 'Ana García',
    });
  });

  it('T2: response uses alumnosCount (plural) not alumnoCount (singular)', async () => {
    const mockGrupos = [
      {
        grupo: { id: 'g-1', materiaXCursoXCicloId: 'm-1', docenteXCicloId: 'dxc-1', name: 'Grupo A' },
        alumnos: [{ id: 'a-1' }, { id: 'a-2' }, { id: 'a-3' }],
      },
    ];
    const listGruposUC = { execute: vi.fn().mockResolvedValue(mockGrupos) };

    const mockClient = {
      docenteXCiclo: {
        findMany: vi.fn().mockResolvedValue([{ id: 'dxc-1', userId: 'user-1' }]),
      },
    };
    mockGetClient.mockReturnValue(mockClient);

    const mockMasterClient = {
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'user-1', firstName: 'Carlos', lastName: 'López', name: 'Carlos López' },
        ]),
      },
    };
    const prismaService = { getMasterClient: vi.fn().mockReturnValue(mockMasterClient) };

    const ctrl = makeController({ listGruposUC, prismaService });
    const result = await ctrl.listGrupos('m-1');

    // Must use the plural field name
    expect(result.data[0].alumnosCount).toBe(3);
    expect(result.data[0]).not.toHaveProperty('alumnoCount');
  });

  it('T3: docenteName is null when userId not found in master DB', async () => {
    const mockGrupos = [
      {
        grupo: { id: 'g-1', materiaXCursoXCicloId: 'm-1', docenteXCicloId: 'dxc-1', name: null },
        alumnos: [],
      },
    ];
    const listGruposUC = { execute: vi.fn().mockResolvedValue(mockGrupos) };

    const mockClient = {
      docenteXCiclo: {
        findMany: vi.fn().mockResolvedValue([{ id: 'dxc-1', userId: 'user-ghost' }]),
      },
    };
    mockGetClient.mockReturnValue(mockClient);

    const mockMasterClient = {
      user: {
        findMany: vi.fn().mockResolvedValue([]), // user not found
      },
    };
    const prismaService = { getMasterClient: vi.fn().mockReturnValue(mockMasterClient) };

    const ctrl = makeController({ listGruposUC, prismaService });
    const result = await ctrl.listGrupos('m-1');

    expect(result.data[0].userId).toBe('user-ghost');
    expect(result.data[0].docenteName).toBeNull();
  });

  it('T4: returns empty data when no grupos found', async () => {
    const listGruposUC = { execute: vi.fn().mockResolvedValue([]) };
    mockGetClient.mockReturnValue({
      docenteXCiclo: { findMany: vi.fn().mockResolvedValue([]) },
    });
    const prismaService = { getMasterClient: vi.fn().mockReturnValue({ user: { findMany: vi.fn().mockResolvedValue([]) } }) };

    const ctrl = makeController({ listGruposUC, prismaService });
    const result = await ctrl.listGrupos('m-1');

    expect(result).toEqual({ data: [] });
  });
});
