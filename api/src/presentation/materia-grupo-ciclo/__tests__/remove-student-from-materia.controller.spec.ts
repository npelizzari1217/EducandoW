/**
 * MateriasGruposController — DELETE /course-cycles/:ccId/materias/:materiaId/alumnos/:id
 * TDD T2.11 — written before T2.14 implementation.
 * Spec: MGC-R9, MGC-S19, MGC-S20, MGC-S22 · Design: D4, D8, section 6.3
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { NotFoundError } from '@educandow/domain';

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
  ctrl.removeStudentFromMateriaUC = overrides.removeStudentFromMateriaUC ?? { execute: vi.fn().mockResolvedValue(undefined) };
  ctrl.setMateriaEsOptativaUC = overrides.setMateriaEsOptativaUC ?? { execute: vi.fn() };
  ctrl.listEnrollableStudentsForMateriaUC = overrides.listEnrollableStudentsForMateriaUC ?? { execute: vi.fn().mockResolvedValue([]) };
  return ctrl;
}

describe('MateriasGruposController — DELETE /course-cycles/:ccId/materias/:materiaId/alumnos/:id', () => {
  it('T1: HTTP 204 — delegates to removeStudentFromMateriaUC with correct ids', async () => {
    const removeStudentFromMateriaUC = { execute: vi.fn().mockResolvedValue(undefined) };
    const ctrl = makeController({ removeStudentFromMateriaUC });

    const result = await ctrl.removeStudentFromMateria('cc-1', 'mxcc-1', 'axm-42');

    expect(removeStudentFromMateriaUC.execute).toHaveBeenCalledWith({
      materiaXCursoXCicloId: 'mxcc-1',
      alumnoXMateriaId: 'axm-42',
    });
    expect(removeStudentFromMateriaUC.execute).toHaveBeenCalledTimes(1);
    expect(result).toBeUndefined(); // 204 NO_CONTENT
  });

  it('T2: materia not found → NotFoundError propagates (controller does not swallow)', async () => {
    const error = new NotFoundError('MateriaXCursoXCiclo', 'non-existent');
    const removeStudentFromMateriaUC = { execute: vi.fn().mockRejectedValue(error) };
    const ctrl = makeController({ removeStudentFromMateriaUC });

    await expect(
      ctrl.removeStudentFromMateria('cc-1', 'non-existent', 'axm-42'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('T3: idempotent — calling twice with same id is valid (repo handles it as no-op)', async () => {
    // The UC delegates to deleteMany which is idempotent.
    // Controller does not add any extra guard — it just delegates.
    const removeStudentFromMateriaUC = { execute: vi.fn().mockResolvedValue(undefined) };
    const ctrl = makeController({ removeStudentFromMateriaUC });

    await ctrl.removeStudentFromMateria('cc-1', 'mxcc-1', 'axm-42');
    await ctrl.removeStudentFromMateria('cc-1', 'mxcc-1', 'axm-42');

    expect(removeStudentFromMateriaUC.execute).toHaveBeenCalledTimes(2);
  });
});
