import { Injectable } from '@nestjs/common';
import type { AsignacionCursoXCicloRepository } from '@educandow/domain';
import { NotFoundError } from '@educandow/domain';

/**
 * RemoveAsignacionCursoUseCase — Fase 4 (F4-A3).
 *
 * Removes a specific AsignacionCursoXCiclo by id.
 * Validates that the assignment exists in the given CursoXCiclo.
 */
@Injectable()
export class RemoveAsignacionCursoUseCase {
  constructor(private readonly repo: AsignacionCursoXCicloRepository) {}

  async execute(input: { courseCycleId: string; asignacionId: string }): Promise<void> {
    const existing = await this.repo.findByCourseId(input.courseCycleId);
    const found = existing.find((a) => a.id === input.asignacionId);

    if (!found) {
      throw new NotFoundError('AsignacionCursoXCiclo', input.asignacionId);
    }

    await this.repo.remove(input.asignacionId);
  }
}
