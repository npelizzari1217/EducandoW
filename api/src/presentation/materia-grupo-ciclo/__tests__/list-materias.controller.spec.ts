/**
 * MateriasGruposController — GET /course-cycles/:ccId/materias (listMaterias)
 * TDD T2.9 — verifies esOptativa is exposed in MateriaResponse (MGC-R12, MGC-S27).
 * Written before T2.10 (DTO update) — must fail first.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { MateriaXCursoXCiclo } from '@educandow/domain';

const mockGetClient = vi.fn();
vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: { getClient: mockGetClient },
}));

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

describe('MateriasGruposController — GET /course-cycles/:ccId/materias (esOptativa in response)', () => {
  it('MGC-S27: response includes esOptativa per materia (false and true)', async () => {
    // Tenant client: no subjects to enrich (test focuses on esOptativa mapping)
    mockGetClient.mockReturnValue({
      subject: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const m1 = makeMateriaDomain('mxcc-1', false);
    const m2 = makeMateriaDomain('mxcc-2', true);

    const listMateriasUC = {
      execute: vi.fn().mockResolvedValue([
        { materia: m1, alumnoCount: 5, grupoCount: 2 },
        { materia: m2, alumnoCount: 0, grupoCount: 0 },
      ]),
    };

    const ctrl = makeController({ listMateriasUC });
    const result = await ctrl.listMaterias('cc-1');

    expect(result.data).toHaveLength(2);
    expect(result.data[0].esOptativa).toBe(false);
    expect(result.data[1].esOptativa).toBe(true);
  });

  it('returns empty data when no materias exist', async () => {
    mockGetClient.mockReturnValue({
      subject: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const ctrl = makeController({
      listMateriasUC: { execute: vi.fn().mockResolvedValue([]) },
    });
    const result = await ctrl.listMaterias('cc-empty');
    expect(result.data).toEqual([]);
  });
});
