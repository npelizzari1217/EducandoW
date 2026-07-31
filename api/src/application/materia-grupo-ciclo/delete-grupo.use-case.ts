import { Injectable } from '@nestjs/common';
import type { GrupoRepository } from '@educandow/domain';
import { NotFoundError, ok, err, Result } from '@educandow/domain';

/**
 * DeleteGrupoUseCase — hard-deletes a grupo.
 * Cascade in Prisma removes AlumnosXGrupo and AusenciasXGrupo automatically.
 */
@Injectable()
export class DeleteGrupoUseCase {
  constructor(private readonly grupoRepo: GrupoRepository) {}

  async execute(id: string): Promise<Result<void, NotFoundError>> {
    const grupo = await this.grupoRepo.findById(id);
    if (!grupo) return err(new NotFoundError('GrupoXCursoXMateriaXCiclo', id));
    await this.grupoRepo.delete(id);
    return ok(undefined);
  }
}
