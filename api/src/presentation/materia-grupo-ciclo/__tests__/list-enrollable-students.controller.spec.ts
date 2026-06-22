/**
 * MateriasGruposController — GET /course-cycles/:ccId/materias/:materiaId/alumnos?eligible=true
 * TDD T2.13 — written before T2.14 implementation.
 * Spec: D5, section 6.4
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

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
  ctrl.removeStudentFromMateriaUC = overrides.removeStudentFromMateriaUC ?? { execute: vi.fn() };
  ctrl.setMateriaEsOptativaUC = overrides.setMateriaEsOptativaUC ?? { execute: vi.fn() };
  ctrl.listEnrollableStudentsForMateriaUC = overrides.listEnrollableStudentsForMateriaUC ?? { execute: vi.fn().mockResolvedValue([]) };
  return ctrl;
}

describe('MateriasGruposController — GET /materias/:materiaId/alumnos?eligible=true', () => {
  it('T1: eligible=true → delegates to listEnrollableStudentsForMateriaUC', async () => {
    const candidates = [
      { id: 'axcc-1', studentId: 's-1', studentName: 'Ana García' },
      { id: 'axcc-2', studentId: 's-2', studentName: 'Carlos López' },
    ];
    const listEnrollableStudentsForMateriaUC = {
      execute: vi.fn().mockResolvedValue(candidates),
    };
    const ctrl = makeController({ listEnrollableStudentsForMateriaUC });

    const result = await ctrl.listAlumnosMateria('mxcc-1', undefined, 'true');

    expect(listEnrollableStudentsForMateriaUC.execute).toHaveBeenCalledWith({
      materiaXCursoXCicloId: 'mxcc-1',
    });
    expect(result).toEqual({ data: candidates });
  });

  it('T2: without eligible → current behavior (delegates to listAlumnosMateriaUC)', async () => {
    const universe = [{ id: 'axm-1', studentId: 's-1', studentName: 'Ana García' }];
    const listAlumnosMateriaUC = { execute: vi.fn().mockResolvedValue(universe) };
    const listEnrollableStudentsForMateriaUC = { execute: vi.fn().mockResolvedValue([]) };
    const ctrl = makeController({ listAlumnosMateriaUC, listEnrollableStudentsForMateriaUC });

    const result = await ctrl.listAlumnosMateria('mxcc-1', undefined, undefined);

    expect(listAlumnosMateriaUC.execute).toHaveBeenCalledWith({
      materiaXCursoXCicloId: 'mxcc-1',
      unassigned: false,
    });
    expect(listEnrollableStudentsForMateriaUC.execute).not.toHaveBeenCalled();
    expect(result).toEqual({ data: universe });
  });

  it('T3: eligible=true wins over unassigned=true (mutual exclusion — eligible takes priority)', async () => {
    const candidates = [{ id: 'axcc-1', studentId: 's-1', studentName: 'Ana García' }];
    const listEnrollableStudentsForMateriaUC = { execute: vi.fn().mockResolvedValue(candidates) };
    const listAlumnosMateriaUC = { execute: vi.fn().mockResolvedValue([]) };
    const ctrl = makeController({ listEnrollableStudentsForMateriaUC, listAlumnosMateriaUC });

    const result = await ctrl.listAlumnosMateria('mxcc-1', 'true', 'true');

    expect(listEnrollableStudentsForMateriaUC.execute).toHaveBeenCalled();
    expect(listAlumnosMateriaUC.execute).not.toHaveBeenCalled();
    expect(result.data).toEqual(candidates);
  });

  it('T4: eligible=true and no candidates → returns empty array', async () => {
    const listEnrollableStudentsForMateriaUC = { execute: vi.fn().mockResolvedValue([]) };
    const ctrl = makeController({ listEnrollableStudentsForMateriaUC });

    const result = await ctrl.listAlumnosMateria('mxcc-1', undefined, 'true');

    expect(result).toEqual({ data: [] });
  });
});
