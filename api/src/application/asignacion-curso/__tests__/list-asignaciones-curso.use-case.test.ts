/**
 * ListAsignacionesCursoUseCase tests (Fase 4)
 */
import { describe, it, expect, vi } from 'vitest';
import { ListAsignacionesCursoUseCase } from '../list-asignaciones-curso.use-case';
import {
  AsignacionCursoXCiclo,
  AsignacionCursoXCicloRepository,
  RolCurso,
  TurnoCurso,
} from '@educandow/domain';

function makeAsignacion(
  id: string,
  courseCycleId: string,
  docenteXCicloId: string,
  rol: RolCurso,
  turno?: TurnoCurso,
): AsignacionCursoXCiclo {
  return AsignacionCursoXCiclo.reconstruct({
    id,
    courseCycleId,
    docenteXCicloId,
    rol,
    turno,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeRepo(items: AsignacionCursoXCiclo[]): AsignacionCursoXCicloRepository {
  return {
    assign: vi.fn(),
    findByCourseId: vi.fn().mockResolvedValue(items),
    findByCourseAndDocente: vi.fn().mockResolvedValue([]),
    isPreceptor: vi.fn().mockResolvedValue(false),
    remove: vi.fn().mockResolvedValue(undefined),
    removeTitularesForCourse: vi.fn().mockResolvedValue(undefined),
    findTitularCourseIdsByUser: vi.fn().mockResolvedValue([]),
  };
}

describe('ListAsignacionesCursoUseCase', () => {
  it('returns all assignments for a CursoXCiclo', async () => {
    const items = [
      makeAsignacion('a1', 'cc-1', 'dxc-1', RolCurso.PRECEPTOR, TurnoCurso.MANANA),
      makeAsignacion('a2', 'cc-1', 'dxc-2', RolCurso.TITULAR),
    ];
    const repo = makeRepo(items);
    const uc = new ListAsignacionesCursoUseCase(repo);

    const result = await uc.execute({ courseCycleId: 'cc-1' });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a1');
    expect(result[1].id).toBe('a2');
    expect(repo.findByCourseId).toHaveBeenCalledWith('cc-1');
  });

  it('returns empty list when no assignments exist', async () => {
    const repo = makeRepo([]);
    const uc = new ListAsignacionesCursoUseCase(repo);

    const result = await uc.execute({ courseCycleId: 'cc-none' });
    expect(result).toHaveLength(0);
  });
});
