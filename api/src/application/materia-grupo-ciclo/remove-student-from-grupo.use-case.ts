import { Injectable } from '@nestjs/common';
import type { GrupoRepository, AlumnosXGrupoRepository } from '@educandow/domain';
import { NotFoundError, ok, err, Result } from '@educandow/domain';

/**
 * RemoveStudentFromGrupoUseCase — espejo exacto de AddStudentToGrupoUseCase.
 *
 * Quita un alumno de un grupo usando el id del registro AlumnosXGrupo.
 * Valida que el grupo exista antes de intentar la eliminación.
 */
@Injectable()
export class RemoveStudentFromGrupoUseCase {
  constructor(
    private readonly grupoRepo: GrupoRepository,
    private readonly alumnosGrupoRepo: AlumnosXGrupoRepository,
  ) {}

  async execute(input: { grupoId: string; alumnoXGrupoId: string }): Promise<Result<void, NotFoundError>> {
    const grupo = await this.grupoRepo.findById(input.grupoId);
    if (!grupo) {
      return err(new NotFoundError('GrupoXCursoXMateriaXCiclo', input.grupoId));
    }

    await this.alumnosGrupoRepo.removeStudent(input.grupoId, input.alumnoXGrupoId);
    return ok(undefined);
  }
}
