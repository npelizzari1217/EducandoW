import { Injectable } from '@nestjs/common';
import type { GrupoRepository } from '@educandow/domain';
import { NotFoundError } from '@educandow/domain';

/**
 * DeleteGrupoUseCase — hard-deletes a grupo.
 * Cascade in Prisma removes AlumnosXGrupo and AusenciasXGrupo automatically.
 */
@Injectable()
export class DeleteGrupoUseCase {
  constructor(private readonly grupoRepo: GrupoRepository) {}

  async execute(id: string): Promise<void> {
    const grupo = await this.grupoRepo.findById(id);
    if (!grupo) throw new NotFoundError('GrupoXCursoXMateriaXCiclo', id);
    await this.grupoRepo.delete(id);
  }
}
