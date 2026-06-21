import { Injectable } from '@nestjs/common';
import type {
  AlumnosXMateriaRepository,
  AlumnosXGrupoRepository,
  AlumnoMateriaEnriched,
} from '@educandow/domain';

export interface ListAlumnosMateriaInput {
  materiaXCursoXCicloId: string;
  /** When true, excludes students already assigned to any group of this materia. */
  unassigned?: boolean;
}

/**
 * ListAlumnosMateriaUseCase — GET /course-cycles/:ccId/materias/:materiaId/alumnos
 *
 * Returns students enrolled in a materia (universe), optionally filtered to
 * only those not yet assigned to any group of the same materia.
 *
 * Fase 3: unassigned=true → calls AlumnosXGrupoRepository.findAssignedAlumnosMateriaIds
 * to exclude already-grouped students server-side (clean, no client-side filtering needed).
 *
 * Throws (via TenantContext) when no tenant client is available — surfaces
 * the error instead of silently returning an empty array.
 */
@Injectable()
export class ListAlumnosMateriaUseCase {
  constructor(
    private readonly repo: AlumnosXMateriaRepository,
    private readonly alumnosGrupoRepo: AlumnosXGrupoRepository,
  ) {}

  async execute(input: ListAlumnosMateriaInput): Promise<AlumnoMateriaEnriched[]> {
    const universe = await this.repo.findByMateriaEnriched(input.materiaXCursoXCicloId);

    if (!input.unassigned) {
      return universe;
    }

    // Fetch the set of alumnosXMateriaXCursoXCicloId values already in any grupo of this materia
    const assignedIds = await this.alumnosGrupoRepo.findAssignedAlumnosMateriaIds(
      input.materiaXCursoXCicloId,
    );

    if (assignedIds.length === 0) {
      return universe;
    }

    const assignedSet = new Set(assignedIds);
    return universe.filter((alumno) => !assignedSet.has(alumno.id));
  }
}
