/**
 * MateriasGruposController — PATCH /course-cycles/:ccId/materias/:materiaId
 * TDD T2.12 — written before T2.14 implementation.
 * Spec: MGC-R10, MGC-S23, MGC-S24 · Design: D3, D8, section 6.2
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { MateriaXCursoXCiclo, NotFoundError } from '@educandow/domain';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let MateriasGruposController: any;

beforeAll(async () => {
  const mod = await import('../materia-grupo-ciclo.controller');
  MateriasGruposController = mod.MateriasGruposController;
});

function makeMateriaDomain(id: string, esOptativa: boolean): MateriaXCursoXCiclo {
  return MateriaXCursoXCiclo.reconstruct({
    id,
    courseCycleId: 'cc-1',
    subjectId: 'sub-1',
    esOptativa,
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
  ctrl.listEnrollableStudentsForMateriaUC = overrides.listEnrollableStudentsForMateriaUC ?? { execute: vi.fn().mockResolvedValue([]) };
  return ctrl;
}

describe('MateriasGruposController — PATCH /course-cycles/:ccId/materias/:materiaId', () => {
  it('T1: { esOptativa: true } → delegates to setMateriaEsOptativaUC, response has esOptativa=true', async () => {
    const updated = makeMateriaDomain('mxcc-1', true);
    const setMateriaEsOptativaUC = { execute: vi.fn().mockResolvedValue(updated) };
    const ctrl = makeController({ setMateriaEsOptativaUC });

    const result = await ctrl.setMateriaEsOptativa('cc-1', 'mxcc-1', { esOptativa: true });

    expect(setMateriaEsOptativaUC.execute).toHaveBeenCalledWith({
      id: 'mxcc-1',
      esOptativa: true,
    });
    expect(result.data.esOptativa).toBe(true);
    expect(result.data.id).toBe('mxcc-1');
  });

  it('T2: { esOptativa: false } → response has esOptativa=false (toggle back)', async () => {
    const updated = makeMateriaDomain('mxcc-1', false);
    const setMateriaEsOptativaUC = { execute: vi.fn().mockResolvedValue(updated) };
    const ctrl = makeController({ setMateriaEsOptativaUC });

    const result = await ctrl.setMateriaEsOptativa('cc-1', 'mxcc-1', { esOptativa: false });

    expect(setMateriaEsOptativaUC.execute).toHaveBeenCalledWith({
      id: 'mxcc-1',
      esOptativa: false,
    });
    expect(result.data.esOptativa).toBe(false);
  });

  it('T3: materia not found → NotFoundError propagates', async () => {
    const error = new NotFoundError('MateriaXCursoXCiclo', 'bad-id');
    const setMateriaEsOptativaUC = { execute: vi.fn().mockRejectedValue(error) };
    const ctrl = makeController({ setMateriaEsOptativaUC });

    await expect(
      ctrl.setMateriaEsOptativa('cc-1', 'bad-id', { esOptativa: true }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('T4: response conforms to MateriaResponse shape (includes required fields)', async () => {
    const updated = makeMateriaDomain('mxcc-1', true);
    const setMateriaEsOptativaUC = { execute: vi.fn().mockResolvedValue(updated) };
    const ctrl = makeController({ setMateriaEsOptativaUC });

    const result = await ctrl.setMateriaEsOptativa('cc-1', 'mxcc-1', { esOptativa: true });

    expect(result.data).toMatchObject({
      id: 'mxcc-1',
      courseCycleId: 'cc-1',
      subjectId: 'sub-1',
      esOptativa: true,
    });
  });
});
