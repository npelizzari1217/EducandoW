/**
 * ListGeneralAttendanceUseCase — application use-case (SDD-4 PR-2).
 *
 * Returns all general monthly attendance rows for a CourseCycle + month.
 * Empty array when the month has not been generated (R-31: not HTTP 404).
 *
 * Authorization:
 *   D3 — SECRETARIO/DIRECTOR/ADMIN/ROOT: full scope
 *   Door 2 — preceptor of the CourseCycle (same pattern as GetDailyAttendanceUseCase)
 *
 * Spec: R-31.
 */
import { Injectable } from '@nestjs/common';
import {
  resolveAccessScope,
  ok,
  err,
} from '@educandow/domain';
import type {
  AsistenciaGeneralRepository,
  DocenteXCicloRepository,
  AsignacionCursoXCicloRepository,
  EnrichedGeneralAttendance,
  Result,
} from '@educandow/domain';
import { ForbiddenError } from '../shared/errors/forbidden-error';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

export interface ListGeneralAttendanceInput {
  courseCycleId: string;
  year: number;
  month: number;
  userId: string;
  userRoles: string[];
}

@Injectable()
export class ListGeneralAttendanceUseCase {
  constructor(
    private readonly generalRepo: AsistenciaGeneralRepository,
    private readonly docenteRepo: DocenteXCicloRepository,
    private readonly asignacionRepo: AsignacionCursoXCicloRepository,
  ) {}

  async execute(
    input: ListGeneralAttendanceInput,
  ): Promise<Result<EnrichedGeneralAttendance[], ForbiddenError>> {
    const { courseCycleId, year, month, userId, userRoles } = input;

    const scope = resolveAccessScope({ roles: userRoles });
    if (!scope.isAdministrative) {
      const check = await this.checkDoor2(courseCycleId, userId);
      if (check.isErr()) return err(check.unwrapErr());
    }

    const rows = await this.generalRepo.findByScopeAndMonthEnriched(courseCycleId, year, month, undefined);
    return ok(rows);
  }

  private async checkDoor2(courseCycleId: string, userId: string): Promise<Result<void, ForbiddenError>> {
    const client = TenantContext.getClient();
    if (!client) {
      return err(new ForbiddenError('Tenant context unavailable'));
    }

    const cc = await client.courseCycle.findUnique({
      where: { uuid: courseCycleId },
      select: { cycleId: true },
    });
    if (!cc) {
      return err(new ForbiddenError('CourseCycle not found — authorization failed'));
    }

    const docente = await this.docenteRepo.findByUserAndCycle(userId, cc.cycleId);
    if (!docente) {
      return err(new ForbiddenError('User is not a DocenteXCiclo in this cycle'));
    }

    const isPreceptor = await this.asignacionRepo.isPreceptor(docente.id, courseCycleId);
    if (!isPreceptor) {
      return err(new ForbiddenError('User is not a preceptor for this CursoXCiclo'));
    }

    return ok(undefined);
  }
}
