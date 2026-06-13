/**
 * MateriasGruposController — DELETE /grupos/:id (deleteGrupo)
 * TDD — written before implementation.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { NotFoundError } from '@educandow/domain';

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

describe('MateriasGruposController — DELETE /grupos/:id (deleteGrupo)', () => {
  it('T1: deleteGrupoUC.execute called with correct id, returns undefined (no body)', async () => {
    const deleteGrupoUC = { execute: vi.fn().mockResolvedValue(undefined) };

    const ctrl = makeController({ deleteGrupoUC });
    const result = await ctrl.deleteGrupo('g-1');

    expect(deleteGrupoUC.execute).toHaveBeenCalledWith('g-1');
    expect(result).toBeUndefined();
  });

  it('T2: if deleteGrupoUC throws NotFoundError, the error propagates (controller does not swallow it)', async () => {
    const error = new NotFoundError('GrupoXCursoXMateriaXCiclo', 'non-existent');
    const deleteGrupoUC = { execute: vi.fn().mockRejectedValue(error) };

    const ctrl = makeController({ deleteGrupoUC });

    await expect(ctrl.deleteGrupo('non-existent')).rejects.toBeInstanceOf(NotFoundError);
  });
});
