/**
 * RemoveAsignacionCursoUseCase tests (Fase 4)
 */
import { describe, it, expect, vi } from 'vitest';
import { RemoveAsignacionCursoUseCase } from '../remove-asignacion-curso.use-case';
import {
  AsignacionCursoXCiclo,
  AsignacionCursoXCicloRepository,
  RolCurso,
  NotFoundError,
} from '@educandow/domain';

function makeRepo(
  existing: AsignacionCursoXCiclo | null,
): AsignacionCursoXCicloRepository {
  return {
    assign: vi.fn(),
    findByCourseId: vi.fn().mockResolvedValue(existing ? [existing] : []),
    findByCourseAndDocente: vi.fn().mockResolvedValue(existing ? [existing] : []),
    isPreceptor: vi.fn().mockResolvedValue(false),
    remove: vi.fn().mockResolvedValue(undefined),
    removeTitularesForCourse: vi.fn().mockResolvedValue(undefined),
    findTitularCourseIdsByUser: vi.fn().mockResolvedValue([]),
  };
}

describe('RemoveAsignacionCursoUseCase', () => {
  it('removes an existing assignment', async () => {
    const existing = AsignacionCursoXCiclo.reconstruct({
      id: 'asg-1',
      courseCycleId: 'cc-1',
      docenteXCicloId: 'dxc-1',
      rol: RolCurso.PRECEPTOR,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const repo = makeRepo(existing);
    const uc = new RemoveAsignacionCursoUseCase(repo);

    await uc.execute({ courseCycleId: 'cc-1', asignacionId: 'asg-1' });

    expect(repo.remove).toHaveBeenCalledWith('asg-1');
  });

  it('throws NotFoundError when assignment does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new RemoveAsignacionCursoUseCase(repo);

    await expect(
      uc.execute({ courseCycleId: 'cc-1', asignacionId: 'nonexistent' }),
    ).rejects.toThrow(NotFoundError);

    expect(repo.remove).not.toHaveBeenCalled();
  });
});
