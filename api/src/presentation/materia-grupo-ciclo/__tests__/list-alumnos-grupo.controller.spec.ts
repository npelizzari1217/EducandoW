/**
 * MateriasGruposController — GET /grupos/:grupoId/alumnos
 *
 * After FIX MENOR (Clean Arch): the controller delegates entirely to
 * ListAlumnosGrupoUseCase. No raw Prisma / TenantContext in the controller.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

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
  ctrl.listGruposGlobalUC = overrides.listGruposGlobalUC ?? { execute: vi.fn().mockResolvedValue([]) };
  ctrl.updateGrupoUC = overrides.updateGrupoUC ?? { execute: vi.fn() };
  ctrl.deleteGrupoUC = overrides.deleteGrupoUC ?? { execute: vi.fn() };
  ctrl.removeStudentFromGrupoUC = overrides.removeStudentFromGrupoUC ?? { execute: vi.fn() };
  ctrl.listAlumnosGrupoUC = overrides.listAlumnosGrupoUC ?? { execute: vi.fn().mockResolvedValue([]) };
  return ctrl;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MateriasGruposController — GET /grupos/:grupoId/alumnos', () => {
  it('T1: returns empty array when grupo has no alumnos', async () => {
    const ctrl = makeController({
      listAlumnosGrupoUC: { execute: vi.fn().mockResolvedValue([]) },
    });
    const result = await ctrl.listAlumnosGrupo('g-1');
    expect(result).toEqual({ data: [] });
  });

  it('T2: returns enriched data from use case (studentId + studentName)', async () => {
    const enriched = [
      { id: 'axg-1', studentId: 'stu-1', studentName: 'Ana García' },
      { id: 'axg-2', studentId: 'stu-2', studentName: 'Carlos López' },
    ];
    const ctrl = makeController({
      listAlumnosGrupoUC: { execute: vi.fn().mockResolvedValue(enriched) },
    });
    const result = await ctrl.listAlumnosGrupo('g-1');
    expect(result).toEqual({ data: enriched });
  });

  it('T3: falls back to studentId as studentName when student not found (handled by repo)', async () => {
    // The repo returns studentId as studentName when Student record is missing.
    // The controller just passes through whatever the UC returns.
    const partial = [{ id: 'axg-1', studentId: 'stu-unknown', studentName: 'stu-unknown' }];
    const ctrl = makeController({
      listAlumnosGrupoUC: { execute: vi.fn().mockResolvedValue(partial) },
    });
    const result = await ctrl.listAlumnosGrupo('g-1');
    expect(result.data[0]).toMatchObject({ id: 'axg-1', studentId: 'stu-unknown', studentName: 'stu-unknown' });
  });

  it('T4: propagates error when use case throws (no tenant client surfaces as error)', async () => {
    // After Clean Arch fix: no silent {data:[]} — the repo throws, the UC propagates,
    // NestJS returns 500 (or the global exception filter handles it).
    const ctrl = makeController({
      listAlumnosGrupoUC: {
        execute: vi.fn().mockRejectedValue(new Error('TenantContext: no tenant client available')),
      },
    });
    await expect(ctrl.listAlumnosGrupo('g-1')).rejects.toThrow('TenantContext: no tenant client available');
  });
});
