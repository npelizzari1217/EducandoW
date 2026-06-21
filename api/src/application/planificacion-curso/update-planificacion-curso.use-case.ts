import { Injectable } from '@nestjs/common';
import type { PlanificacionCurso, PlanificacionCursoRepository } from '@educandow/domain';

@Injectable()
export class UpdatePlanificacionCursoUseCase {
  constructor(private readonly repo: PlanificacionCursoRepository) {}

  async execute(input: {
    id: string;
    nombre?: string;
    periodOrdinal?: number | null;
    descripcion?: string | null;
  }): Promise<PlanificacionCurso> {
    const { id, ...data } = input;
    return this.repo.update(id, data);
  }
}
