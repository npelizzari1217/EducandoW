/**
 * MateriasGruposController — PATCH /grupos/:id (updateGrupo)
 * TDD — written before implementation.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

const mockGetClient = vi.fn();
vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: mockGetClient,
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let MateriasGruposController: any;

beforeAll(async () => {
  const mod = await import('../materia-grupo-ciclo.controller');
  MateriasGruposController = mod.MateriasGruposController;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  ctrl.prismaService = overrides.prismaService ?? {
    getMasterClient: vi.fn().mockReturnValue({ user: { findMany: vi.fn().mockResolvedValue([]) } }),
  };
  ctrl.listGruposGlobalUC = overrides.listGruposGlobalUC ?? { execute: vi.fn().mockResolvedValue([]) };
  ctrl.updateGrupoUC = overrides.updateGrupoUC ?? { execute: vi.fn() };
  ctrl.deleteGrupoUC = overrides.deleteGrupoUC ?? { execute: vi.fn().mockResolvedValue(undefined) };
  return ctrl;
}

function makeGrupoDomain(id = 'g-1', name?: string, docenteXCicloId = 'dxc-1') {
  return {
    id,
    materiaXCursoXCicloId: 'm-1',
    docenteXCicloId,
    name,
  };
}

describe('MateriasGruposController — PATCH /grupos/:id (updateGrupo)', () => {
  it('T1: rename only — updateGrupoUC.execute called with { id, name }, response contains updated name', async () => {
    const updatedGrupo = makeGrupoDomain('g-1', 'Grupo Nuevo');
    const updateGrupoUC = { execute: vi.fn().mockResolvedValue(updatedGrupo) };

    const mockClient = {
      docenteXCiclo: { findUnique: vi.fn().mockResolvedValue({ userId: 'user-1' }) },
    };
    mockGetClient.mockReturnValue(mockClient);

    const ctrl = makeController({ updateGrupoUC });
    const result = await ctrl.updateGrupo('g-1', { name: 'Grupo Nuevo' });

    expect(updateGrupoUC.execute).toHaveBeenCalledWith({
      id: 'g-1',
      name: 'Grupo Nuevo',
      userId: undefined,
    });
    expect(result.data.name).toBe('Grupo Nuevo');
  });

  it('T2: reassign teacher — updateGrupoUC.execute called with { id, userId }, response contains userId', async () => {
    const updatedGrupo = makeGrupoDomain('g-1', undefined, 'dxc-new');
    const updateGrupoUC = { execute: vi.fn().mockResolvedValue(updatedGrupo) };

    const mockClient = {
      docenteXCiclo: { findUnique: vi.fn().mockResolvedValue({ userId: 'user-new' }) },
    };
    mockGetClient.mockReturnValue(mockClient);

    const ctrl = makeController({ updateGrupoUC });
    const result = await ctrl.updateGrupo('g-1', { userId: 'user-new' });

    expect(updateGrupoUC.execute).toHaveBeenCalledWith({
      id: 'g-1',
      name: undefined,
      userId: 'user-new',
    });
    // userId should be present in response (from body or resolved from tenant)
    expect(result.data).toBeDefined();
    expect(result.data.docenteXCicloId).toBe('dxc-new');
  });

  it('T3: response conforms to GrupoResponse shape', async () => {
    const updatedGrupo = makeGrupoDomain('g-1', 'Comisión A', 'dxc-1');
    const updateGrupoUC = { execute: vi.fn().mockResolvedValue(updatedGrupo) };

    mockGetClient.mockReturnValue({
      docenteXCiclo: { findUnique: vi.fn().mockResolvedValue({ userId: 'user-1' }) },
    });

    const ctrl = makeController({ updateGrupoUC });
    const result = await ctrl.updateGrupo('g-1', { name: 'Comisión A' });

    expect(result.data).toMatchObject({
      id: 'g-1',
      materiaXCursoXCicloId: 'm-1',
      docenteXCicloId: 'dxc-1',
      alumnosCount: 0,
    });
    expect(typeof result.data.id).toBe('string');
    expect(typeof result.data.docenteXCicloId).toBe('string');
  });
});
