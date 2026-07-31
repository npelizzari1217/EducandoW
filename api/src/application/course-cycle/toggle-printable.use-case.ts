import { Injectable } from '@nestjs/common';
import type { AlumnosXCursoXCicloRepository, AlumnosXCursoXCiclo } from '@educandow/domain';
import { NotFoundError, ok, err, Result } from '@educandow/domain';

/**
 * TogglePrintableUseCase — T05 (SDD-2 PR-1).
 *
 * Toggles the `printable` flag on a single AlumnosXCursoXCiclo row ("Algunos" path).
 * Mirrors the Remove use-case IDOR pattern: the bridge-row must belong to the
 * provided courseCycleId or NotFoundError is thrown (REQ-TOG-6).
 */
@Injectable()
export class TogglePrintableUseCase {
  constructor(private readonly alumnosRepo: AlumnosXCursoXCicloRepository) {}

  async execute(input: {
    courseCycleId: string;
    id: string;
    value: boolean;
  }): Promise<Result<AlumnosXCursoXCiclo, Error>> {
    const row = await this.alumnosRepo.findById(input.id);

    // IDOR guard: row must exist AND belong to the claimed courseCycle (REQ-TOG-6)
    if (!row || row.courseCycleId !== input.courseCycleId) {
      return err(new NotFoundError('AlumnosXCursoXCiclo', input.id));
    }

    const updated = await this.alumnosRepo.setPrintable(input.id, input.value);
    return ok(updated);
  }
}
