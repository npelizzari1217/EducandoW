/**
 * PR4-T10 [GREEN] — ListMateriasPreviasByStudentUseCase.
 *
 * Returns materias previas for a student:
 *   - Validates studentId exists in tenant → 404 if not (cross-tenant isolation)
 *   - With `academicYear` param → calls findByStudentAndAcademicYear
 *   - Without `academicYear`   → calls findByStudent (all years)
 *   - Empty array is a valid 200 response (never throws/errors)
 *
 * Returns domain projections as plain objects for the presentation layer to map.
 *
 * Specs: MP-R6, MP-R8, MP-R9, D2
 */
import { Injectable, Inject } from '@nestjs/common';
import {
  MateriaPrevia,
  MATERIA_PREVIA_REPOSITORY,
  MateriaPreviaRepository,
  SubjectFinalGradeCondicion,
  MateriaPreviaStatus,
  Result,
  ok,
  err,
  NotFoundError,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

// ── Output type ───────────────────────────────────────────────────────────────

export interface MateriaPreviaProjection {
  id:                  string;
  studentId:           string;
  subjectId:           string;
  originAcademicYear:  string;
  originCourseCycleId?: string;
  condicion:           SubjectFinalGradeCondicion;
  status:              MateriaPreviaStatus;
  resolvedGradeCode?:  string;
  resolvedAt?:         Date;
  createdAt:           Date;
  updatedAt:           Date;
}

// ── Use case ──────────────────────────────────────────────────────────────────

@Injectable()
export class ListMateriasPreviasByStudentUseCase {
  constructor(
    @Inject(MATERIA_PREVIA_REPOSITORY)
    private readonly repo: MateriaPreviaRepository,
  ) {}

  async execute(input: {
    studentId:    string;
    academicYear?: string;
  }): Promise<Result<MateriaPreviaProjection[], NotFoundError>> {
    const { studentId, academicYear } = input;
    const client = TenantContext.getClient();

    // ── 1. Validate studentId exists in tenant (cross-tenant isolation) ───────
    const student = await client?.student.findUnique({
      where: { id: studentId },
      select: { id: true },
    });
    if (!student) {
      return err(new NotFoundError('Student', studentId));
    }

    // ── 2. Fetch previas (empty array is valid — never error) ─────────────────
    let previas: MateriaPrevia[];

    if (academicYear) {
      previas = await this.repo.findByStudentAndAcademicYear(studentId, academicYear);
    } else {
      previas = await this.repo.findByStudent(studentId);
    }

    // ── 3. Project to plain objects ───────────────────────────────────────────
    const projections: MateriaPreviaProjection[] = previas.map((p) => ({
      id:                  p.id,
      studentId:           p.studentId,
      subjectId:           p.subjectId,
      originAcademicYear:  p.originAcademicYear,
      originCourseCycleId: p.originCourseCycleId,
      condicion:           p.condicion,
      status:              p.status,
      resolvedGradeCode:   p.resolvedGradeCode,
      resolvedAt:          p.resolvedAt,
      createdAt:           p.createdAt,
      updatedAt:           p.updatedAt,
    }));

    return ok(projections);
  }
}
