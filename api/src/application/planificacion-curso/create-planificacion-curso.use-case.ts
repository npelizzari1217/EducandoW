import { Injectable } from '@nestjs/common';
import type { PlanificacionCurso, PlanificacionCursoRepository } from '@educandow/domain';

@Injectable()
export class CreatePlanificacionCursoUseCase {
  constructor(private readonly repo: PlanificacionCursoRepository) {}

  async execute(input: {
    asignacionCursoId: string;
    nombre: string;
    periodOrdinal?: number;
    descripcion?: string;
  }): Promise<PlanificacionCurso> {
    return this.repo.create({
      asignacionCursoId: input.asignacionCursoId,
      nombre: input.nombre,
      periodOrdinal: input.periodOrdinal,
      descripcion: input.descripcion,
    });
  }
}
