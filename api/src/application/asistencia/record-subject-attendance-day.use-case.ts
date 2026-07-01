/**
 * RecordSubjectAttendanceDayUseCase — application use-case (SDD-4 PR-2).
 *
 * Sets or updates a single day's attendance status in a student's per-materia
 * monthly register row. Requires the row to exist (ADR-4).
 *
 * Authorization model (3 doors):
 *   Door 1 — ATTENDANCE:CREATE (enforced at controller via @Roles)
 *   Door 2 — teacher owns a group for this materia AND target student is in that group
 *   D3     — SECRETARIO/DIRECTOR/ADMIN/ROOT bypass Door 2
 *
 * Resolution steps for Door 2:
 *   1. Get MateriaXCursoXCiclo → courseCycleId
 *   2. Get CourseCycle → cycleId
 *   3. findByUserAndCycle(userId, cycleId) → DocenteXCiclo
 *   4. findGroupsForDocente(docenteId, materiaXCursoXCicloId) → teacher's groups
 *   5. findStudentIdsByGrupoIds(groupIds) → students in teacher's groups
 *   6. Verify target studentId is in that set
 *
 * Month-closed guard (fase-bimestre-cierre-asistencia, PR-3b — Capacidad B):
 *   UNCONDITIONAL — rejects ALL roles, including ROOT/ADMIN, when the materia's
 *   CourseCycle+year+month is closed. Never nested inside the isAdministrative
 *   bypass (AC-B-4/5/6). Read-only total: no role can bypass a closed month.
 *
 * Spec: R-17, R-18, R-19, R-20, R-22.
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
  MonthClosedError,
} from '@educandow/domain';
import type {
  AsistenciaMateriaRepository,
  AttendanceTypeRepository,
  GrupoRepository,
  AlumnosXGrupoRepository,
  DocenteXCicloRepository,
  AsistenciaXMateriaXAlumnoXCursoXCiclo,
  AttendanceMonthStatusRepository,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

export interface RecordSubjectAttendanceDayInput {
  materiaXCursoXCicloId: string;
  studentId: string;
  year: number;
  month: number;
  day: number;
  statusCode: string;
  userId: string;
  userRoles: string[];
}

@Injectable()
export class RecordSubjectAttendanceDayUseCase {
  constructor(
    private readonly materiaAsistRepo: AsistenciaMateriaRepository,
    private readonly attendanceTypeRepo: AttendanceTypeRepository,
    private readonly grupoRepo: GrupoRepository,
    private readonly alumnosXGrupoRepo: AlumnosXGrupoRepository,
    private readonly docenteRepo: DocenteXCicloRepository,
    private readonly monthStatusRepo: AttendanceMonthStatusRepository,
  ) {}

  async execute(
    input: RecordSubjectAttendanceDayInput,
  ): Promise<AsistenciaXMateriaXAlumnoXCursoXCiclo> {
    const { materiaXCursoXCicloId, studentId, year, month, day, statusCode, userId, userRoles } = input;

    // Auth: D3 or Door 2 teacher-with-group. Both paths resolve the materia's
    // CourseCycle uuid — needed unconditionally for the month-closed guard below.
    const scope = resolveAccessScope({ roles: userRoles });
    const courseCycleId = scope.isAdministrative
      ? await this.resolveCourseCycleId(materiaXCursoXCicloId)
      : await this.checkDoor2(materiaXCursoXCicloId, studentId, userId);

    // Month-closed guard — UNCONDITIONAL, applies to every role including ROOT/ADMIN
    // (AC-B-4/5/6). Never placed behind scope.isAdministrative — no bypass exists.
    const monthStatus = await this.monthStatusRepo.findOne(courseCycleId, year, month);
    if (monthStatus && monthStatus.isClosed()) {
      throw new MonthClosedError(courseCycleId, year, month);
    }

    // Find existing row (ADR-4)
    const row = await this.materiaAsistRepo.findOne(materiaXCursoXCicloId, studentId, year, month);
    if (!row) {
      throw new NotFoundError(
        'AsistenciaXMateriaXAlumnoXCursoXCiclo',
        `${materiaXCursoXCicloId}/${studentId}/${year}/${month}`,
      );
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

    // Merge-update the day
    return this.materiaAsistRepo.setDay(row.id.get(), day, statusCode);
  }

  /** Returns the materia's CourseCycle uuid, reused by the caller for the month-closed guard. */
  private async checkDoor2(
    materiaXCursoXCicloId: string,
    studentId: string,
    userId: string,
  ): Promise<string> {
    const client = TenantContext.getClient();
    if (!client) {
      throw new ForbiddenError('Tenant context unavailable');
    }

    // Step 1: materia → courseCycleId
    const materia = await client.materiaXCursoXCiclo.findUnique({
      where: { id: materiaXCursoXCicloId },
      select: { courseCycleId: true },
    });
    if (!materia) {
      throw new ForbiddenError('MateriaXCursoXCiclo not found — authorization failed');
    }

    // Step 2: courseCycle → cycleId
    const cc = await client.courseCycle.findUnique({
      where: { uuid: materia.courseCycleId },
      select: { cycleId: true },
    });
    if (!cc) {
      throw new ForbiddenError('CourseCycle not found — authorization failed');
    }

    // Step 3: resolve DocenteXCiclo
    const docente = await this.docenteRepo.findByUserAndCycle(userId, cc.cycleId);
    if (!docente) {
      throw new ForbiddenError('User is not a DocenteXCiclo in this cycle');
    }

    // Step 4: find teacher's groups for this materia
    const teacherGroups = await this.grupoRepo.findGroupsForDocente(docente.id, materiaXCursoXCicloId);
    if (teacherGroups.length === 0) {
      throw new ForbiddenError('User has no group assignment for this materia');
    }

    // Step 5: verify target student is in teacher's groups
    const groupIds = teacherGroups.map((g) => g.id);
    const studentIds = await this.alumnosXGrupoRepo.findStudentIdsByGrupoIds(groupIds);
    if (!studentIds.includes(studentId)) {
      throw new ForbiddenError('Target student is not in any of the teacher\'s groups for this materia');
    }

    return materia.courseCycleId;
  }

  /**
   * Resolves the materia's CourseCycle uuid without any Door 2 authorization check —
   * used only on the D3 admin bypass path, where the caller is already authorized.
   */
  private async resolveCourseCycleId(materiaXCursoXCicloId: string): Promise<string> {
    const client = TenantContext.getClient();
    if (!client) {
      throw new ForbiddenError('Tenant context unavailable');
    }
    const materia = await client.materiaXCursoXCiclo.findUnique({
      where: { id: materiaXCursoXCicloId },
      select: { courseCycleId: true },
    });
    if (!materia) {
      throw new NotFoundError('MateriaXCursoXCiclo', materiaXCursoXCicloId);
    }
    return materia.courseCycleId;
  }
}
