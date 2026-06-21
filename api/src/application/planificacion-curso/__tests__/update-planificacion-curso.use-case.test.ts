import { describe, it, expect, vi } from 'vitest';
import { UpdatePlanificacionCursoUseCase } from '../update-planificacion-curso.use-case';
import { PlanificacionCurso } from '@educandow/domain';
import type { PlanificacionCursoRepository } from '@educandow/domain';

function makeRepo(): PlanificacionCursoRepository {
  return {
    create: vi.fn(),
    listByAsignacion: vi.fn(),
    update: vi.fn().mockImplementation(async (id, data) =>
      PlanificacionCurso.reconstruct({
        id, asignacionCursoId: 'asg-1',
        nombre: data.nombre ?? 'P1',
        periodOrdinal: data.periodOrdinal ?? undefined,
        descripcion: data.descripcion ?? undefined,
        active: true, createdAt: new Date(), updatedAt: new Date(),
      })
    ),
    softDelete: vi.fn(),
  };
}

describe('UpdatePlanificacionCursoUseCase', () => {
  it('actualiza una planificación', async () => {
    const repo = makeRepo();
    const uc = new UpdatePlanificacionCursoUseCase(repo);
    const result = await uc.execute({ id: 'plan-1', nombre: 'Nuevo nombre' });
    expect(result.nombre).toBe('Nuevo nombre');
    expect(repo.update).toHaveBeenCalledWith('plan-1', { nombre: 'Nuevo nombre' });
  });
});
