import { Injectable } from '@nestjs/common';
import type {
  GrupoRepository,
  AlumnosXGrupoRepository,
  AlumnosXMateriaRepository,
  AlumnosXGrupoXCursoXMateriaXCiclo,
} from '@educandow/domain';
import { NotFoundError } from '@educandow/domain';

/**
 * AddStudentToGrupoUseCase — Fase 3c (F3-A4).
 *
 * Adds a student (via their AlumnosXMateriaXCursoXCiclo membership) to a group.
 *
 * Hard containment (MGC-R4): verifies that the alumnosXMateriaXCursoXCicloId
 * belongs to the same materiaXCursoXCicloId as the group. If not → rejected.
 *
 * This check also covers MGC-S10 (cross-CC rejection) because a student from a
 * different CC has an alumnosXMateriaId referencing a different courseCycleId chain.
 *
 * Co-docencia (MGC-R5 / MGC-S12): same student can be in multiple groups of the
 * same materia — the @@unique is (grupoId, alumnosXMateriaId) so overlap is valid.
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
  }): Promise<AlumnosXGrupoXCursoXMateriaXCiclo> {
    // Validate group exists
    const grupo = await this.grupoRepo.findById(input.grupoId);
    if (!grupo) {
      throw new NotFoundError('GrupoXCursoXMateriaXCiclo', input.grupoId);
    }

    // Validate AlumnosXMateria exists
    const axm = await this.alumnosMateriaRepo.findById(input.alumnosXMateriaXCursoXCicloId);
    if (!axm) {
      throw new NotFoundError('AlumnosXMateriaXCursoXCiclo', input.alumnosXMateriaXCursoXCicloId);
    }

    // Hard containment check: grupo ⊆ materia (MGC-R4, MGC-S11, MGC-S10)
    if (axm.materiaXCursoXCicloId !== grupo.materiaXCursoXCicloId) {
      throw new Error(
        `Student is not in the universe of this grupo's materia (MGC-R4). ` +
        `grupo.materiaId=${grupo.materiaXCursoXCicloId}, axm.materiaId=${axm.materiaXCursoXCicloId}`,
      );
    }

    // Add to group — co-docencia allowed (MGC-R5 / MGC-S12)
    return this.alumnosGrupoRepo.addStudent(input.grupoId, input.alumnosXMateriaXCursoXCicloId);
  }
}
