/**
 * MateriasGruposController — POST /course-cycles/:ccId/materias/:materiaId/alumnos
 * TDD — RED-first, written before the Result-migration retrofit (MGCM-R5, MGCM-R7).
 * Spec: MGCM-R1, MGCM-R2, MGCM-R5, MGCM-R7 · Design: §3 "addStudentToMateria"
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { MateriasXAlumnoXCursoXCiclo, NotFoundError, ok, err } from '@educandow/domain';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let MateriasGruposController: any;

beforeAll(async () => {
  const mod = await import('../materia-grupo-ciclo.controller');
  MateriasGruposController = mod.MateriasGruposController;
});

function makeCreated(
  id = 'axm-1',
  materiaXCursoXCicloId = 'mxcc-1',
  studentId = 's-1',
): MateriasXAlumnoXCursoXCiclo {
  return MateriasXAlumnoXCursoXCiclo.reconstruct({
    id,
    materiaXCursoXCicloId,
    studentId,
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

describe('MateriasGruposController — POST /course-cycles/:ccId/materias/:materiaId/alumnos', () => {
  it('T1: happy path — ok(created) → response.data matches AlumnoXMateriaResponse shape', async () => {
    const created = makeCreated('axm-1', 'mxcc-1', 's-1');
    const addStudentToMateriaUC = { execute: vi.fn().mockResolvedValue(ok(created)) };
    const ctrl = makeController({ addStudentToMateriaUC });

    const result = await ctrl.addStudentToMateria('mxcc-1', { studentId: 's-1' });

    expect(addStudentToMateriaUC.execute).toHaveBeenCalledWith({
      materiaXCursoXCicloId: 'mxcc-1',
      studentId: 's-1',
    });
    expect(result.data).toEqual({
      id: 'axm-1',
      materiaXCursoXCicloId: 'mxcc-1',
      studentId: 's-1',
    });
  });

  it('T2: materia not found → err(NotFoundError) re-thrown, not swallowed', async () => {
    const error = new NotFoundError('MateriaXCursoXCiclo', 'bad-id');
    const addStudentToMateriaUC = { execute: vi.fn().mockResolvedValue(err(error)) };
    const ctrl = makeController({ addStudentToMateriaUC });

    await expect(
      ctrl.addStudentToMateria('bad-id', { studentId: 's-1' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
