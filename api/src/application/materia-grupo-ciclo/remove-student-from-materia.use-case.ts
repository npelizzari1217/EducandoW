import { Injectable } from '@nestjs/common';
import type { MateriaXCursoXCicloRepository, AlumnosXMateriaRepository } from '@educandow/domain';
import { NotFoundError } from '@educandow/domain';

/**
 * RemoveStudentFromMateriaUseCase — MGC-R9, D4.
 *
 * Espejo exacto de RemoveStudentFromGrupoUseCase pero para la capa materia.
 * Validates that the materia exists, then delegates removal to alumnosRepo.removeStudent.
 * Idempotent: the underlying deleteMany in the repo handles missing rows without throwing.
 */
@Injectable()
export class RemoveStudentFromMateriaUseCase {
  constructor(
    private readonly materiaRepo: MateriaXCursoXCicloRepository,
    private readonly alumnosRepo: AlumnosXMateriaRepository,
  ) {}

  async execute(input: {
    materiaXCursoXCicloId: string;
    alumnoXMateriaId: string;
  }): Promise<void> {
    const materia = await this.materiaRepo.findById(input.materiaXCursoXCicloId);
    if (!materia) {
      throw new NotFoundError('MateriaXCursoXCiclo', input.materiaXCursoXCicloId);
    }
    await this.alumnosRepo.removeStudent(input.alumnoXMateriaId);
  }
}
