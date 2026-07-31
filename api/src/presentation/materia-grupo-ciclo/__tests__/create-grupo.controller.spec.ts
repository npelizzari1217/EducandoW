/**
 * MateriasGruposController — POST /course-cycles/:ccId/materias/:materiaId/grupos (createGrupo)
 * TDD — RED-first, written before the Result-migration retrofit (MGCM-R5, MGCM-R7).
 * Spec: MGCM-R1, MGCM-R2, MGCM-R4, MGCM-R5, MGCM-R7 · Design: §3 "createGrupo"
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { GrupoXCursoXMateriaXCiclo, NotFoundError, ok, err } from '@educandow/domain';

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

function makeGrupo(
  id = 'g-1',
  materiaXCursoXCicloId = 'm-1',
  docenteXCicloId = 'dxc-1',
): GrupoXCursoXMateriaXCiclo {
  return GrupoXCursoXMateriaXCiclo.reconstruct({
    id,
    materiaXCursoXCicloId,
    docenteXCicloId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeController(overrides: Record<string, unknown> = {}) {
  const ctrl = Object.create(MateriasGruposController.prototype);
  ctrl.listMateriasUC = overrides.listMateriasUC ?? { execute: vi.fn().mockResolvedValue([]) };
  ctrl.addStudentToMateriaUC = overrides.addStudentToMateriaUC ?? { execute: vi.fn() };
  ctrl.createGrupoUC = overrides.createGrupoUC ?? { execute: vi.fn() };
  ctrl.listGruposUC = overrides.listGruposUC ?? { execute: vi.fn().mockResolvedValue([]) };
  ctrl.addStudentToGrupoUC = overrides.addStudentToGrupoUC ?? { execute: vi.fn() };
  ctrl.prismaService = overrides.prismaService ?? {
    getMasterClient: vi.fn().mockReturnValue({ user: { findMany: vi.fn().mockResolvedValue([]) } }),
  };
  ctrl.listGruposGlobalUC = overrides.listGruposGlobalUC ?? { execute: vi.fn().mockResolvedValue([]) };
  ctrl.updateGrupoUC = overrides.updateGrupoUC ?? { execute: vi.fn() };
  ctrl.deleteGrupoUC = overrides.deleteGrupoUC ?? { execute: vi.fn().mockResolvedValue(undefined) };
  ctrl.removeStudentFromGrupoUC = overrides.removeStudentFromGrupoUC ?? { execute: vi.fn() };
  ctrl.listAlumnosGrupoUC = overrides.listAlumnosGrupoUC ?? { execute: vi.fn().mockResolvedValue([]) };
  ctrl.listAlumnosMateriaUC = overrides.listAlumnosMateriaUC ?? { execute: vi.fn().mockResolvedValue([]) };
  ctrl.removeStudentFromMateriaUC = overrides.removeStudentFromMateriaUC ?? { execute: vi.fn() };
  ctrl.setMateriaEsOptativaUC = overrides.setMateriaEsOptativaUC ?? { execute: vi.fn() };
  ctrl.listEnrollableStudentsForMateriaUC =
    overrides.listEnrollableStudentsForMateriaUC ?? { execute: vi.fn().mockResolvedValue([]) };
  return ctrl;
}

describe('MateriasGruposController — POST /course-cycles/:ccId/materias/:materiaId/grupos', () => {
  it('T1: happy path (cycleId in body) — ok(grupo) → response.data matches GrupoResponse shape', async () => {
    const grupo = makeGrupo('g-1', 'm-1', 'dxc-1');
    const createGrupoUC = { execute: vi.fn().mockResolvedValue(ok(grupo)) };
    const ctrl = makeController({ createGrupoUC });

    const result = await ctrl.createGrupo('cc-1', 'm-1', { userId: 'user-1', cycleId: 'cycle-1' });

    expect(createGrupoUC.execute).toHaveBeenCalledWith({
      materiaXCursoXCicloId: 'm-1',
      userId: 'user-1',
      cycleId: 'cycle-1',
      name: undefined,
    });
    expect(result.data).toMatchObject({
      id: 'g-1',
      materiaXCursoXCicloId: 'm-1',
      docenteXCicloId: 'dxc-1',
      alumnosCount: 0,
      userId: 'user-1',
    });
  });

  it('T2: happy path (cycleId resolved via TenantContext) — resolves cycleId from CourseCycle before calling the UC', async () => {
    const grupo = makeGrupo('g-2', 'm-1', 'dxc-2');
    const createGrupoUC = { execute: vi.fn().mockResolvedValue(ok(grupo)) };
    mockGetClient.mockReturnValue({
      courseCycle: { findUnique: vi.fn().mockResolvedValue({ cycleId: 'resolved-cycle' }) },
    });
    const ctrl = makeController({ createGrupoUC });

    await ctrl.createGrupo('cc-1', 'm-1', { userId: 'user-1' });

    expect(createGrupoUC.execute).toHaveBeenCalledWith({
      materiaXCursoXCicloId: 'm-1',
      userId: 'user-1',
      cycleId: 'resolved-cycle',
      name: undefined,
    });
  });

  it('T3: materia not found → err(NotFoundError) re-thrown, not swallowed', async () => {
    const error = new NotFoundError('MateriaXCursoXCiclo', 'bad-id');
    const createGrupoUC = { execute: vi.fn().mockResolvedValue(err(error)) };
    const ctrl = makeController({ createGrupoUC });

    await expect(
      ctrl.createGrupo('cc-1', 'bad-id', { userId: 'user-1', cycleId: 'cycle-1' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
