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
 * Spec: R-17, R-18, R-19, R-20, R-22.
 */
import { Injectable } from '@nestjs/common';
import {
  resolveAccessScope,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@educandow/domain';
import type {
  AsistenciaMateriaRepository,
  AttendanceTypeRepository,
  GrupoRepository,
  AlumnosXGrupoRepository,
  DocenteXCicloRepository,
  AsistenciaXMateriaXAlumnoXCursoXCiclo,
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

/** Returns the number of days in the given calendar month (year, month 1-12). */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

@Injectable()
export class RecordSubjectAttendanceDayUseCase {
  constructor(
    private readonly materiaAsistRepo: AsistenciaMateriaRepository,
    private readonly attendanceTypeRepo: AttendanceTypeRepository,
    private readonly grupoRepo: GrupoRepository,
    private readonly alumnosXGrupoRepo: AlumnosXGrupoRepository,
    private readonly docenteRepo: DocenteXCicloRepository,
  ) {}

  async execute(
    input: RecordSubjectAttendanceDayInput,
  ): Promise<AsistenciaXMateriaXAlumnoXCursoXCiclo> {
    const { materiaXCursoXCicloId, studentId, year, month, day, statusCode, userId, userRoles } = input;

    // Auth: D3 or Door 2 teacher-with-group
    const scope = resolveAccessScope({ roles: userRoles });
    if (!scope.isAdministrative) {
      await this.checkDoor2(materiaXCursoXCicloId, studentId, userId);
    }

    // Find existing row (ADR-4)
    const row = await this.materiaAsistRepo.findOne(materiaXCursoXCicloId, studentId, year, month);
    if (!row) {
      throw new NotFoundError(
        'AsistenciaXMateriaXAlumnoXCursoXCiclo',
        `${materiaXCursoXCicloId}/${studentId}/${year}/${month}`,
      );
    }

    // Validate day range (R-20)
    const maxDay = daysInMonth(year, month);
    if (!Number.isInteger(day) || day < 1 || day > maxDay) {
      throw new ValidationError(
        `day "${day}" is out of range — month ${month}/${year} has ${maxDay} days (1..${maxDay})`,
      );
    }

    // Validate statusCode against AttendanceType catalog (R-18)
    const types = await this.attendanceTypeRepo.list();
    const isValidCode = types.some((t) => t.code.get() === statusCode);
    if (!isValidCode) {
      throw new ValidationError(
        `statusCode "${statusCode}" is not a valid AttendanceType code`,
      );
    }

    // Merge-update the day
    return this.materiaAsistRepo.setDay(row.id.get(), day, statusCode);
  }

  private async checkDoor2(
    materiaXCursoXCicloId: string,
    studentId: string,
    userId: string,
  ): Promise<void> {
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
  }
}
