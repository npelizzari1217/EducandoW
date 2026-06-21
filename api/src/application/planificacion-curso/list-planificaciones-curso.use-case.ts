import { Injectable } from '@nestjs/common';
import type { PlanificacionCurso, PlanificacionCursoRepository } from '@educandow/domain';

@Injectable()
export class ListPlanificacionesCursoUseCase {
  constructor(private readonly repo: PlanificacionCursoRepository) {}

  async execute(input: { asignacionCursoId: string }): Promise<PlanificacionCurso[]> {
    return this.repo.listByAsignacion(input.asignacionCursoId);
  }
}
