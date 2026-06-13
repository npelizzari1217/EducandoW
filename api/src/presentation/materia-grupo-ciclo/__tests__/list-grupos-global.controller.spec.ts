/**
 * MateriasGruposController — GET /grupos (listGruposGlobal)
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

const mockUser = { userId: 'root-user', roles: ['ROOT'], levels: [] };

describe('MateriasGruposController — GET /grupos (listGruposGlobal)', () => {
  it('T1: ROOT with grupos — resolves docenteName from master DB', async () => {
    const grupoRows = [
      {
        id: 'g-1',
        name: 'Comisión A',
        docenteXCicloId: 'dxc-1',
        docenteUserId: 'user-1',
        materiaId: 'mat-1',
        subjectId: 'subj-1',
        subjectName: 'Matemática',
        courseCycleId: 'cc-uuid-1',
        courseName: 'Primero',
        level: 20,
        alumnosCount: 5,
      },
    ];
    const listGruposGlobalUC = { execute: vi.fn().mockResolvedValue(grupoRows) };
    const masterUser = { id: 'user-1', firstName: 'Ana', lastName: 'García', name: 'Ana García' };
    const prismaService = {
      getMasterClient: vi.fn().mockReturnValue({
        user: { findMany: vi.fn().mockResolvedValue([masterUser]) },
      }),
    };

    const ctrl = makeController({ listGruposGlobalUC, prismaService });
    const result = await ctrl.listGruposGlobal(mockUser, {});

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'g-1',
      docenteName: 'Ana García',
      docenteUserId: 'user-1',
      subjectName: 'Matemática',
      alumnosCount: 5,
    });
  });

  it('T2: returns { data: [] } when use case returns empty array', async () => {
    const listGruposGlobalUC = { execute: vi.fn().mockResolvedValue([]) };

    const ctrl = makeController({ listGruposGlobalUC });
    const result = await ctrl.listGruposGlobal(mockUser, {});

    expect(result).toEqual({ data: [] });
    // master DB should NOT be queried when no grupos
    const prismaService = ctrl.prismaService as { getMasterClient: ReturnType<typeof vi.fn> };
    expect(prismaService.getMasterClient).not.toHaveBeenCalled();
  });

  it('T3: TEACHER — use case receives userId from @CurrentUser', async () => {
    const teacherUser = { userId: 'teacher-user', roles: ['TEACHER'], levels: [20] };
    const listGruposGlobalUC = { execute: vi.fn().mockResolvedValue([]) };

    const ctrl = makeController({ listGruposGlobalUC });
    await ctrl.listGruposGlobal(teacherUser, {});

    expect(listGruposGlobalUC.execute).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'teacher-user', roles: ['TEACHER'] }),
      expect.any(Object),
    );
  });

  it('T4: query params (level, courseCycleId, materiaId) are forwarded to use case', async () => {
    const listGruposGlobalUC = { execute: vi.fn().mockResolvedValue([]) };
    const query = { level: 20, courseCycleId: 'cc-uuid-1', materiaId: 'mat-uuid-1' };

    const ctrl = makeController({ listGruposGlobalUC });
    await ctrl.listGruposGlobal(mockUser, query);

    expect(listGruposGlobalUC.execute).toHaveBeenCalledWith(
      expect.any(Object),
      { level: 20, courseCycleId: 'cc-uuid-1', materiaId: 'mat-uuid-1' },
    );
  });

  it('T5: docenteName is null when user not found in master DB', async () => {
    const grupoRows = [
      {
        id: 'g-1',
        docenteXCicloId: 'dxc-1',
        docenteUserId: 'ghost-user',
        materiaId: 'mat-1',
        subjectId: 'subj-1',
        subjectName: 'Historia',
        courseCycleId: 'cc-uuid-1',
        courseName: 'Segundo',
        level: 30,
        alumnosCount: 0,
      },
    ];
    const listGruposGlobalUC = { execute: vi.fn().mockResolvedValue(grupoRows) };
    const prismaService = {
      getMasterClient: vi.fn().mockReturnValue({
        user: { findMany: vi.fn().mockResolvedValue([]) }, // not found
      }),
    };

    const ctrl = makeController({ listGruposGlobalUC, prismaService });
    const result = await ctrl.listGruposGlobal(mockUser, {});

    expect(result.data[0].docenteName).toBeNull();
  });
});
