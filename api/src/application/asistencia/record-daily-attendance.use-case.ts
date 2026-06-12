/**
 * RecordDailyAttendanceUseCase — application use-case (Fase 6, F6-A2).
 *
 * Records daily attendance for a student in a CourseCycle.
 * Recorded by a preceptor assigned to the CC (AsignacionCursoXCiclo rol=PRECEPTOR).
 *
 * Authorization model (3 doors):
 *   Door 1 — module ATTENDANCE:CREATE (enforced at controller via @Roles).
 *   Door 2 — preceptor assignment: userId must have AsignacionCursoXCiclo(PRECEPTOR) for this CC.
 *   D3     — SECRETARIO/DIRECTOR/ADMIN/ROOT bypass Door 2.
 *
 * Resolution steps for Door 2 (teacher path):
 *   1. Get CourseCycle → cycleId (raw Prisma via TenantContext)
 *   2. findByUserAndCycle(userId, cycleId) → DocenteXCiclo
 *   3. asignacionRepo.isPreceptor(docenteXCicloId, courseCycleId)
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

export interface RecordDailyAttendanceInput {
  courseCycleId: string;
  studentId: string;
  date: Date;
  statusCode: string;
  observaciones?: string;
  userId: string;
  userRoles: string[];
}

@Injectable()
export class RecordDailyAttendanceUseCase {
  constructor(
    private readonly attendanceRepo: DailyAttendanceRepository,
    private readonly docenteRepo: DocenteXCicloRepository,
    private readonly asignacionRepo: AsignacionCursoXCicloRepository,
  ) {}

  async execute(input: RecordDailyAttendanceInput): Promise<AsistenciaDiaria> {
    const scope = resolveAccessScope({ roles: input.userRoles });

    // D3: management roles bypass Door 2
    if (!scope.isAdministrative) {
      await this.checkDoor2(input.courseCycleId, input.userId);
    }

    return this.attendanceRepo.record({
      courseCycleId: input.courseCycleId,
      studentId: input.studentId,
      date: input.date,
      statusCode: input.statusCode,
      observaciones: input.observaciones,
    });
  }

  private async checkDoor2(courseCycleId: string, userId: string): Promise<void> {
    const client = TenantContext.getClient();
    if (!client) {
      throw new ForbiddenError('Tenant context unavailable');
    }

    // Step 1: get cycleId from CourseCycle
    const cc = await client.courseCycle.findUnique({
      where: { uuid: courseCycleId },
      select: { cycleId: true },
    });
    if (!cc) {
      throw new ForbiddenError('CourseCycle not found — authorization failed');
    }

    // Step 2: resolve DocenteXCiclo for this user in this cycle
    const docente = await this.docenteRepo.findByUserAndCycle(userId, cc.cycleId);
    if (!docente) {
      throw new ForbiddenError('User is not a DocenteXCiclo in this cycle');
    }

    // Step 3: check preceptor assignment
    const isPreceptor = await this.asignacionRepo.isPreceptor(docente.id, courseCycleId);
    if (!isPreceptor) {
      throw new ForbiddenError('User is not a preceptor for this CursoXCiclo');
    }
  }
}
