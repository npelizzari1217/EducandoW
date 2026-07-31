import { Injectable } from '@nestjs/common';
import type {
  GrupoRepository,
  AlumnosXGrupoRepository,
  AlumnosXMateriaRepository,
  AlumnosXGrupoXCursoXMateriaXCiclo,
  Result,
} from '@educandow/domain';
import {
  NotFoundError,
  AlumnoAlreadyInGrupoError,
  GrupoMateriaMismatchError,
  ok,
  err,
} from '@educandow/domain';

/**
 * AddStudentToGrupoUseCase — Fase 3c (F3-A4).
 *
 * Adds a student (via their MateriasXAlumnoXCursoXCiclo membership) to a group.
 *
 * Hard containment (MGC-R4): verifies that the alumnosXMateriaXCursoXCicloId
 * belongs to the same materiaXCursoXCicloId as the group. If not → returns
 * `err(GrupoMateriaMismatchError)` (422, MGCM-R3).
 *
 * Cross-CC rejection (MGC-S10) is also covered by the containment check because
 * a student from a different CC has an alumnosXMateriaId referencing a different
 * courseCycleId chain, so the materiaIds won't match.
 *
 * Exclusión estricta (MGC-S13 / Fase 3): one student = one group per materia.
 * Co-docencia (multiple groups, same materia) is no longer allowed.
 * Returns `err(AlumnoAlreadyInGrupoError)` (409) if the student is already in
 * any group of the same materia.
 */
@Injectable()
export class AddStudentToGrupoUseCase {
  constructor(
    private readonly grupoRepo: GrupoRepository,
    private readonly alumnosGrupoRepo: AlumnosXGrupoRepository,
    private readonly alumnosMateriaRepo: AlumnosXMateriaRepository,
  ) {}

  async execute(input: {
    grupoId: string;
    alumnosXMateriaXCursoXCicloId: string;
  }): Promise<Result<AlumnosXGrupoXCursoXMateriaXCiclo, NotFoundError | GrupoMateriaMismatchError | AlumnoAlreadyInGrupoError>> {
    // Validate group exists
    const grupo = await this.grupoRepo.findById(input.grupoId);
    if (!grupo) {
      return err(new NotFoundError('GrupoXCursoXMateriaXCiclo', input.grupoId));
    }

    // Validate AlumnosXMateria exists
    const axm = await this.alumnosMateriaRepo.findById(input.alumnosXMateriaXCursoXCicloId);
    if (!axm) {
      return err(new NotFoundError('MateriasXAlumnoXCursoXCiclo', input.alumnosXMateriaXCursoXCicloId));
    }

    // Hard containment check: grupo ⊆ materia (MGC-R4, MGC-S11, MGC-S10)
    if (axm.materiaXCursoXCicloId !== grupo.materiaXCursoXCicloId) {
      return err(new GrupoMateriaMismatchError());
    }

    // Exclusión estricta (MGC-S13): one student per materia per group.
    // Check if this alumnosXMateriaId is already assigned to any group of the materia.
    const assignedIds = await this.alumnosGrupoRepo.findAssignedAlumnosMateriaIds(
      grupo.materiaXCursoXCicloId,
    );
    if (assignedIds.includes(input.alumnosXMateriaXCursoXCicloId)) {
      return err(new AlumnoAlreadyInGrupoError());
    }

    // Add to group
    return ok(await this.alumnosGrupoRepo.addStudent(input.grupoId, input.alumnosXMateriaXCursoXCicloId));
  }
}
