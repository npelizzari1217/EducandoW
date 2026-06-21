import { describe, it, expect, vi } from 'vitest';
import { ListPlanificacionesCursoUseCase } from '../list-planificaciones-curso.use-case';
import { PlanificacionCurso } from '@educandow/domain';
import type { PlanificacionCursoRepository } from '@educandow/domain';

function makeRepo(): PlanificacionCursoRepository {
  const plan = PlanificacionCurso.reconstruct({
    id: 'plan-1', asignacionCursoId: 'asg-1', nombre: 'P1',
    active: true, createdAt: new Date(), updatedAt: new Date(),
  });
  return {
    create: vi.fn(),
    listByAsignacion: vi.fn().mockResolvedValue([plan]),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
}

describe('ListPlanificacionesCursoUseCase', () => {
  it('retorna las planificaciones de una asignación', async () => {
    const repo = makeRepo();
    const uc = new ListPlanificacionesCursoUseCase(repo);
    const result = await uc.execute({ asignacionCursoId: 'asg-1' });
    expect(result).toHaveLength(1);
    expect(result[0].nombre).toBe('P1');
    expect(repo.listByAsignacion).toHaveBeenCalledWith('asg-1');
  });
});
