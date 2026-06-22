import { Injectable } from '@nestjs/common';
import type { MateriaXCursoXCicloRepository, MateriaXCursoXCiclo } from '@educandow/domain';
import { NotFoundError } from '@educandow/domain';

/**
 * SetMateriaEsOptativaUseCase — MGC-R10, MGC-R11, D3, D6.
 *
 * Toggles the esOptativa flag on a MateriaXCursoXCiclo.
 * Pure toggle — does NOT touch already-enrolled students (no retroactive cleanup, D6).
 * Returns the updated entity so the controller can build the response.
 */
@Injectable()
export class SetMateriaEsOptativaUseCase {
  constructor(private readonly materiaRepo: MateriaXCursoXCicloRepository) {}

  async execute(input: { id: string; esOptativa: boolean }): Promise<MateriaXCursoXCiclo> {
    const materia = await this.materiaRepo.findById(input.id);
    if (!materia) {
      throw new NotFoundError('MateriaXCursoXCiclo', input.id);
    }
    return this.materiaRepo.setEsOptativa(input.id, input.esOptativa);
  }
}
