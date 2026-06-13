import { Injectable } from '@nestjs/common';
import type { AlumnosXMateriaRepository, AlumnoMateriaEnriched } from '@educandow/domain';

/**
 * ListAlumnosMateriaUseCase — GET /course-cycles/:ccId/materias/:materiaId/alumnos
 *
 * Delegates the 2-step resolution
 *   AlumnosXMateria → Student name
 * to the repository, keeping the controller free of Prisma knowledge.
 *
 * Throws (via TenantContext) when no tenant client is available — surfaces
 * the error instead of silently returning an empty array.
 */
@Injectable()
export class ListAlumnosMateriaUseCase {
  constructor(private readonly repo: AlumnosXMateriaRepository) {}

  async execute(materiaXCursoXCicloId: string): Promise<AlumnoMateriaEnriched[]> {
    return this.repo.findByMateriaEnriched(materiaXCursoXCicloId);
  }
}
