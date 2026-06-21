import { Injectable } from '@nestjs/common';
import type { PlanificacionCursoRepository } from '@educandow/domain';

@Injectable()
export class DeletePlanificacionCursoUseCase {
  constructor(private readonly repo: PlanificacionCursoRepository) {}

  async execute(input: { id: string }): Promise<void> {
    return this.repo.softDelete(input.id);
  }
}
