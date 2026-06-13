/**
 * MateriasGruposController — GET /course-cycles/:ccId/materias/:materiaId/alumnos
 *
 * Tests for the new listAlumnosMateria endpoint.
 * Written BEFORE implementation (TDD — F7 backend enrichment).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock TenantContext so calls to getClient() are controlled per test
const mockGetClient = vi.fn();
vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: mockGetClient,
  },
}));

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
  return ctrl;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MateriasGruposController — GET /course-cycles/:ccId/materias/:materiaId/alumnos', () => {
  it('T1: returns empty array when no tenant client is available', async () => {
    mockGetClient.mockReturnValue(null);
    const ctrl = makeController();

    const result = await ctrl.listAlumnosMateria('m-1');

    expect(result).toEqual({ data: [] });
  });

  it('T2: returns empty array when no alumnos found for materia', async () => {
    const mockClient = {
      alumnosXMateriaXCursoXCiclo: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      student: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    mockGetClient.mockReturnValue(mockClient);

    const ctrl = makeController();
    const result = await ctrl.listAlumnosMateria('m-1');

    expect(result).toEqual({ data: [] });
    expect(mockClient.alumnosXMateriaXCursoXCiclo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { materiaXCursoXCicloId: 'm-1' } }),
    );
    expect(mockClient.student.findMany).not.toHaveBeenCalled();
  });

  it('T3: returns enriched list with studentName when alumnos exist', async () => {
    const mockAlumnos = [
      { id: 'axm-1', studentId: 'stu-1', createdAt: new Date() },
      { id: 'axm-2', studentId: 'stu-2', createdAt: new Date() },
    ];
    const mockStudents = [
      { id: 'stu-1', firstName: 'Ana', lastName: 'García' },
      { id: 'stu-2', firstName: 'Carlos', lastName: 'López' },
    ];
    const mockClient = {
      alumnosXMateriaXCursoXCiclo: {
        findMany: vi.fn().mockResolvedValue(mockAlumnos),
      },
      student: {
        findMany: vi.fn().mockResolvedValue(mockStudents),
      },
    };
    mockGetClient.mockReturnValue(mockClient);

    const ctrl = makeController();
    const result = await ctrl.listAlumnosMateria('m-1');

    expect(result).toEqual({
      data: [
        { id: 'axm-1', studentId: 'stu-1', studentName: 'Ana García' },
        { id: 'axm-2', studentId: 'stu-2', studentName: 'Carlos López' },
      ],
    });
  });

  it('T4: falls back to studentId as studentName when student not found in DB', async () => {
    const mockAlumnos = [{ id: 'axm-1', studentId: 'stu-unknown', createdAt: new Date() }];
    const mockClient = {
      alumnosXMateriaXCursoXCiclo: {
        findMany: vi.fn().mockResolvedValue(mockAlumnos),
      },
      student: {
        findMany: vi.fn().mockResolvedValue([]), // student not found
      },
    };
    mockGetClient.mockReturnValue(mockClient);

    const ctrl = makeController();
    const result = await ctrl.listAlumnosMateria('m-1');

    expect(result.data[0].studentName).toBe('stu-unknown');
  });
});
