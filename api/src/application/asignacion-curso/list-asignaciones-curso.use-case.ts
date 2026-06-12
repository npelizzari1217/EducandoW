import { Injectable } from '@nestjs/common';
import type { AsignacionCursoXCiclo, AsignacionCursoXCicloRepository } from '@educandow/domain';

/**
 * ListAsignacionesCursoUseCase — Fase 4 (F4-A2).
 *
 * Returns all DocenteXCiclo assignments for a given CursoXCiclo.
 * Persona enrichment (firstName, lastName, etc.) is done at the
 * presentation layer by joining with the master-DB User.
 */
@Injectable()
export class ListAsignacionesCursoUseCase {
  constructor(private readonly repo: AsignacionCursoXCicloRepository) {}

  async execute(input: { courseCycleId: string }): Promise<AsignacionCursoXCiclo[]> {
    return this.repo.findByCourseId(input.courseCycleId);
  }
}
