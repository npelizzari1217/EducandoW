/**
 * GetDailyAttendanceUseCase — application use-case (Fase 6, F6-A4).
 *
 * Reads daily attendance for a CursoXCiclo on a given date.
 *
 * Scope:
 *   - PRECEPTOR: scoped to their CursoXCiclo (Door 2 check via isPreceptor).
 *   - SECRETARIO/DIRECTOR/ADMIN/ROOT (D3): full scope.
 */
import { Injectable } from '@nestjs/common';
import { resolveAccessScope, ForbiddenError } from '@educandow/domain';
import type {
  DailyAttendanceRepository,
  DocenteXCicloRepository,
  AsignacionCursoXCicloRepository,
  AsistenciaDiaria,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

export interface GetDailyAttendanceInput {
  courseCycleId: string;
  date: Date;
  userId: string;
  userRoles: string[];
}

@Injectable()
export class GetDailyAttendanceUseCase {
  constructor(
    private readonly attendanceRepo: DailyAttendanceRepository,
    private readonly docenteRepo: DocenteXCicloRepository,
    private readonly asignacionRepo: AsignacionCursoXCicloRepository,
  ) {}

  async execute(input: GetDailyAttendanceInput): Promise<AsistenciaDiaria[]> {
    const scope = resolveAccessScope({ roles: input.userRoles });

    // D3: management roles get full scope — no Door 2 check
    if (!scope.isAdministrative) {
      await this.checkDoor2(input.courseCycleId, input.userId);
    }

    return this.attendanceRepo.findByCourseAndDate(input.courseCycleId, input.date);
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
