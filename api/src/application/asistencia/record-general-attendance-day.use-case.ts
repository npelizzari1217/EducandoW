/**
 * RecordGeneralAttendanceDayUseCase — application use-case (SDD-4 PR-2).
 *
 * Sets or updates a single day's attendance status in a student's general
 * monthly register row. Requires the row to exist (must generate first — ADR-4).
 *
 * Authorization model (3 doors):
 *   Door 1 — ATTENDANCE:CREATE (enforced at controller via @Roles)
 *   Door 2 — preceptor of the CourseCycle (mirrors RecordDailyAttendanceUseCase)
 *   D3     — SECRETARIO/DIRECTOR/ADMIN/ROOT bypass Door 2
 *
 * Validations:
 *   - Register row must exist (NotFoundError if not generated yet)
 *   - day must be in 1..daysInMonth(year, month) (ValidationError if out of range)
 *   - statusCode must exist in AttendanceType catalog (ValidationError if unknown)
 *
 * Spec: R-16, R-18, R-19, R-20.
 */
import { Injectable } from '@nestjs/common';
import {
  resolveAccessScope,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  daysInMonth,
  dayOfWeek,
  DayNotAssignableError,
  StatusNotAssignableError,
} from '@educandow/domain';
import type {
  AsistenciaGeneralRepository,
  AttendanceTypeRepository,
  DocenteXCicloRepository,
  AsignacionCursoXCicloRepository,
  AsistenciaXAlumnoXCursoXCiclo,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

export interface RecordGeneralAttendanceDayInput {
  courseCycleId: string;
  studentId: string;
  year: number;
  month: number;
  day: number;
  statusCode: string;
  userId: string;
  userRoles: string[];
}

@Injectable()
export class RecordGeneralAttendanceDayUseCase {
  constructor(
    private readonly generalRepo: AsistenciaGeneralRepository,
    private readonly attendanceTypeRepo: AttendanceTypeRepository,
    private readonly docenteRepo: DocenteXCicloRepository,
    private readonly asignacionRepo: AsignacionCursoXCicloRepository,
  ) {}

  async execute(input: RecordGeneralAttendanceDayInput): Promise<AsistenciaXAlumnoXCursoXCiclo> {
    const { courseCycleId, studentId, year, month, day, statusCode, userId, userRoles } = input;

    // Auth: D3 or Door 2 preceptor
    const scope = resolveAccessScope({ roles: userRoles });
    if (!scope.isAdministrative) {
      await this.checkDoor2(courseCycleId, userId);
    }

    // Find existing row (ADR-4: row must be pre-generated)
    const row = await this.generalRepo.findOne(courseCycleId, studentId, year, month);
    if (!row) {
      throw new NotFoundError('AsistenciaXAlumnoXCursoXCiclo', `${courseCycleId}/${studentId}/${year}/${month}`);
    }

    // Step 2: syntactic range check — grid only shows 1..31 (400 ValidationError)
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      throw new ValidationError(`day must be an integer between 1 and 31`);
    }

    // Step 3: calendar authority — non-existent day (422 DAY_NOT_ASSIGNABLE)
    const maxDay = daysInMonth(year, month);
    if (day > maxDay) {
      throw new DayNotAssignableError(
        `day ${day} does not exist in ${month}/${year} (month has ${maxDay} days)`,
      );
    }

    // Step 4: calendar authority — weekend (422 DAY_NOT_ASSIGNABLE)
    const dow = dayOfWeek(year, month, day);
    if (dow === 0 || dow === 6) {
      throw new DayNotAssignableError(
        `day ${day} (${month}/${year}) is a ${dow === 6 ? 'Saturday' : 'Sunday'} and cannot be recorded`,
      );
    }

    // Step 5: validate statusCode against AttendanceType catalog (400 ValidationError)
    const types = await this.attendanceTypeRepo.list();
    const type = types.find((t) => t.code.get() === statusCode);
    if (!type) {
      throw new ValidationError(
        `statusCode "${statusCode}" is not a valid AttendanceType code`,
      );
    }

    // Step 6: assignable guard — non-assignable code (400 STATUS_NOT_ASSIGNABLE)
    if (!type.assignable) {
      throw new StatusNotAssignableError(`statusCode "${statusCode}" is not assignable`);
    }

    // Merge-update the day in the row's JSON day-map (ADR-1)
    return this.generalRepo.setDay(row.id.get(), day, statusCode);
  }

  private async checkDoor2(courseCycleId: string, userId: string): Promise<void> {
    const client = TenantContext.getClient();
    if (!client) {
      throw new ForbiddenError('Tenant context unavailable');
    }

    // Resolve cycleId for DocenteXCiclo lookup
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
