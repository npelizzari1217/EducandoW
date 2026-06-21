import { describe, it, expect, vi } from 'vitest';
import { DeletePlanificacionCursoUseCase } from '../delete-planificacion-curso.use-case';
import type { PlanificacionCursoRepository } from '@educandow/domain';

function makeRepo(): PlanificacionCursoRepository {
  return {
    create: vi.fn(),
    listByAsignacion: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn().mockResolvedValue(undefined),
  };
}

describe('DeletePlanificacionCursoUseCase', () => {
  it('hace soft delete de una planificación', async () => {
    const repo = makeRepo();
    const uc = new DeletePlanificacionCursoUseCase(repo);
    await uc.execute({ id: 'plan-1' });
    expect(repo.softDelete).toHaveBeenCalledWith('plan-1');
  });
});
