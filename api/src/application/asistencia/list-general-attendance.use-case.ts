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
  ForbiddenError,
} from '@educandow/domain';
import type {
  AsistenciaGeneralRepository,
  DocenteXCicloRepository,
  AsignacionCursoXCicloRepository,
  AsistenciaXAlumnoXCursoXCiclo,
} from '@educandow/domain';
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

  async execute(input: ListGeneralAttendanceInput): Promise<AsistenciaXAlumnoXCursoXCiclo[]> {
    const { courseCycleId, year, month, userId, userRoles } = input;

    const scope = resolveAccessScope({ roles: userRoles });
    if (!scope.isAdministrative) {
      await this.checkDoor2(courseCycleId, userId);
    }

    return this.generalRepo.findByScopeAndMonth(courseCycleId, year, month, undefined);
  }

  private async checkDoor2(courseCycleId: string, userId: string): Promise<void> {
    const client = TenantContext.getClient();
    if (!client) {
      throw new ForbiddenError('Tenant context unavailable');
    }

    const cc = await client.courseCycle.findUnique({
      where: { uuid: courseCycleId },
      select: { cycleId: true },
    });
    if (!cc) {
      throw new ForbiddenError('CourseCycle not found — authorization failed');
    }

    const docente = await this.docenteRepo.findByUserAndCycle(userId, cc.cycleId);
    if (!docente) {
      throw new ForbiddenError('User is not a DocenteXCiclo in this cycle');
    }

    const isPreceptor = await this.asignacionRepo.isPreceptor(docente.id, courseCycleId);
    if (!isPreceptor) {
      throw new ForbiddenError('User is not a preceptor for this CursoXCiclo');
    }
  }
}
