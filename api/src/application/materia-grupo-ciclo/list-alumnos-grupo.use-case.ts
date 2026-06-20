import { Injectable } from '@nestjs/common';
import type { AlumnosXGrupoRepository, AlumnoGrupoEnriched } from '@educandow/domain';

/**
 * ListAlumnosGrupoUseCase — GET /grupos/:grupoId/alumnos (F3-P6 enrichment).
 *
 * Delegates the 2-step resolution
 *   AlumnosXGrupo → MateriasXAlumnoXCursoXCiclo.studentId → Student name
 * to the repository, keeping the controller free of Prisma knowledge.
 *
 * Throws (via TenantContext) when no tenant client is available — surfaces
 * the error instead of silently returning an empty array.
 */
@Injectable()
export class ListAlumnosGrupoUseCase {
  constructor(private readonly repo: AlumnosXGrupoRepository) {}

  async execute(grupoId: string): Promise<AlumnoGrupoEnriched[]> {
    return this.repo.findByGrupoEnriched(grupoId);
  }
}
