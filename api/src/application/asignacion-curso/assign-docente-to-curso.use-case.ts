import { Injectable } from '@nestjs/common';
import type { AsignacionCursoXCiclo, AsignacionCursoXCicloRepository } from '@educandow/domain';
import { RolCurso, TurnoCurso, ForbiddenError } from '@educandow/domain';
import { DocenteXCicloService } from '../docente-ciclo/docente-x-ciclo.service';

/**
 * AssignDocenteToCursoUseCase — Fase 4 (F4-A1).
 *
 * Assigns a DocenteXCiclo to a CursoXCiclo as PRECEPTOR or TITULAR.
 *
 * ACC-R3: the DocenteXCiclo cycleId MUST match the CursoXCiclo cycleId.
 * D2: no uniqueness constraint on turno — multiple preceptors per turno are valid.
 * ACC-S5: when assigning a TITULAR, all previous TITULAR assignments for the CC
 *         are removed first (replace semantics).
 * ACC-R4: this use-case NEVER touches GrupoXCursoXMateriaXCiclo.
 */
@Injectable()
export class AssignDocenteToCursoUseCase {
  constructor(
    private readonly repo: AsignacionCursoXCicloRepository,
    private readonly docenteService: DocenteXCicloService,
  ) {}

  async execute(input: {
    courseCycleId: string;
    courseCycleUuid: string;
    /** AcademicCycle UUID of the CursoXCiclo — used to validate and upsert DocenteXCiclo. */
    cycleId: string;
    userId: string;
    rol: RolCurso;
    turno?: TurnoCurso;
  }): Promise<AsignacionCursoXCiclo> {
    // Get or create DocenteXCiclo for (userId, cycleId)
    const docenteXCiclo = await this.docenteService.getOrCreateForCycle(input.userId, input.cycleId);

    // ACC-R3: cycle mismatch check
    // docenteService.getOrCreateForCycle uses cycleId we pass — the upsert always
    // creates/returns a DocenteXCiclo scoped to that cycleId. The validation is that
    // when the caller passes a different cycleId than the one the existing docente belongs to,
    // getOrCreateForCycle will return the one scoped to input.cycleId (creating it if needed).
    // The cross-cycle check is: if the retrieved docenteXCiclo.cycleId != input.cycleId
    // that would be a bug. Here we enforce it explicitly.
    if (docenteXCiclo.cycleId !== input.cycleId) {
      throw new ForbiddenError(
        `DocenteXCiclo cycleId (${docenteXCiclo.cycleId}) does not match ` +
        `CursoXCiclo cycleId (${input.cycleId}) — ACC-R3`,
      );
    }

    // ACC-S5: for TITULAR, remove all previous titular assignments for this CC
    if (input.rol === RolCurso.TITULAR) {
      await this.repo.removeTitularesForCourse(input.courseCycleId);
    }

    return this.repo.assign({
      courseCycleId: input.courseCycleId,
      docenteXCicloId: docenteXCiclo.id,
      rol: input.rol,
      turno: input.turno,
    });
  }
}
