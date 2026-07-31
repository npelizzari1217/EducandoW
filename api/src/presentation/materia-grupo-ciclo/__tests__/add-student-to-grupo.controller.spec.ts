/**
 * MateriasGruposController — POST /grupos/:grupoId/alumnos (addStudentToGrupo)
 * TDD RED-first — written before the controller retrofit (MGCM-R3, MGCM-R5, MGCM-R7).
 * Model: update-grupo.controller.spec.ts (`Object.create(prototype)` + injected mock UC).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  NotFoundError,
  AlumnoAlreadyInGrupoError,
  GrupoMateriaMismatchError,
  ok,
  err,
} from '@educandow/domain';

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

function makeAlumnoXGrupoDomain(
  id = 'axg-1',
  grupoId = 'grupo-1',
  alumnosXMateriaXCursoXCicloId = 'axm-1',
) {
  return { id, grupoId, alumnosXMateriaXCursoXCicloId };
}

describe('MateriasGruposController — POST /grupos/:grupoId/alumnos (addStudentToGrupo)', () => {
  it('T1: happy path — addStudentToGrupoUC.execute called, response conforms to AlumnoXGrupoResponse shape', async () => {
    const created = makeAlumnoXGrupoDomain('axg-1', 'grupo-1', 'axm-1');
    const addStudentToGrupoUC = { execute: vi.fn().mockResolvedValue(ok(created)) };

    const ctrl = makeController({ addStudentToGrupoUC });
    const result = await ctrl.addStudentToGrupo('grupo-1', {
      alumnosXMateriaXCursoXCicloId: 'axm-1',
    });

    expect(addStudentToGrupoUC.execute).toHaveBeenCalledWith({
      grupoId: 'grupo-1',
      alumnosXMateriaXCursoXCicloId: 'axm-1',
    });
    expect(result.data).toEqual({
      id: 'axg-1',
      grupoId: 'grupo-1',
      alumnosXMateriaXCursoXCicloId: 'axm-1',
    });
  });

  it('T2: grupo not found → err(NotFoundError) re-thrown, not swallowed', async () => {
    const error = new NotFoundError('GrupoXCursoXMateriaXCiclo', 'non-existent');
    const addStudentToGrupoUC = { execute: vi.fn().mockResolvedValue(err(error)) };

    const ctrl = makeController({ addStudentToGrupoUC });

    await expect(
      ctrl.addStudentToGrupo('non-existent', { alumnosXMateriaXCursoXCicloId: 'axm-1' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('T3: student already in another grupo of the same materia → err(AlumnoAlreadyInGrupoError) re-thrown', async () => {
    const error = new AlumnoAlreadyInGrupoError();
    const addStudentToGrupoUC = { execute: vi.fn().mockResolvedValue(err(error)) };

    const ctrl = makeController({ addStudentToGrupoUC });

    await expect(
      ctrl.addStudentToGrupo('grupo-1', { alumnosXMateriaXCursoXCicloId: 'axm-1' }),
    ).rejects.toBeInstanceOf(AlumnoAlreadyInGrupoError);
  });

  it('T4: grupo⊆materia mismatch → err(GrupoMateriaMismatchError) re-thrown (maps to 422, not 500 — MGCM-R3)', async () => {
    const error = new GrupoMateriaMismatchError();
    const addStudentToGrupoUC = { execute: vi.fn().mockResolvedValue(err(error)) };

    const ctrl = makeController({ addStudentToGrupoUC });

    await expect(
      ctrl.addStudentToGrupo('grupo-1', { alumnosXMateriaXCursoXCicloId: 'axm-1' }),
    ).rejects.toBeInstanceOf(GrupoMateriaMismatchError);
  });
});
