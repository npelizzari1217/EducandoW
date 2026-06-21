import { describe, it, expect, vi } from 'vitest';
import { CreatePlanificacionCursoUseCase } from '../create-planificacion-curso.use-case';
import { PlanificacionCurso } from '@educandow/domain';
import type { PlanificacionCursoRepository } from '@educandow/domain';

function makeRepo(overrides: Partial<PlanificacionCursoRepository> = {}): PlanificacionCursoRepository {
  return {
    create: vi.fn().mockImplementation(async (data) =>
      PlanificacionCurso.reconstruct({
        id: 'plan-1',
        asignacionCursoId: data.asignacionCursoId,
        nombre: data.nombre,
        periodOrdinal: data.periodOrdinal,
        descripcion: data.descripcion,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ),
    listByAsignacion: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    softDelete: vi.fn(),
    ...overrides,
  };
}

describe('CreatePlanificacionCursoUseCase', () => {
  it('crea una planificación con datos válidos', async () => {
    const repo = makeRepo();
    const uc = new CreatePlanificacionCursoUseCase(repo);
    const result = await uc.execute({
      asignacionCursoId: 'asg-1',
      nombre: 'Planificación Anual',
      periodOrdinal: 1,
      descripcion: 'Descripción',
    });
    expect(result.nombre).toBe('Planificación Anual');
    expect(repo.create).toHaveBeenCalledWith({
      asignacionCursoId: 'asg-1',
      nombre: 'Planificación Anual',
      periodOrdinal: 1,
      descripcion: 'Descripción',
    });
  });

  it('crea planificación sin período ni descripción', async () => {
    const repo = makeRepo();
    const uc = new CreatePlanificacionCursoUseCase(repo);
    const result = await uc.execute({ asignacionCursoId: 'asg-1', nombre: 'Plan B' });
    expect(result.id).toBe('plan-1');
  });
});
