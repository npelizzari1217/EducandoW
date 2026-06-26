/**
 * GenerateMonthlyAttendanceUseCase — application use-case (SDD-4 PR-2).
 *
 * Materializes monthly attendance register rows for a CourseCycle+month.
 * Additive / skipDuplicates semantics (ADR-3): existing rows with recorded
 * days are NEVER overwritten. Mirrors SDD-3 CascadeStudentMateriasCompetenciasUseCase.
 *
 * Authorization: ADMIN-only (D3 — SECRETARIO/DIRECTOR/ADMIN/ROOT).
 *   Rationale: generation is an administrative materialization, not a per-teacher action.
 *
 * Steps:
 *   1. Require administrative role (D3 only)
 *   2. Verify CourseCycle exists in tenant DB
 *   3. Get enrolled students (AlumnosXCursoXCiclo)
 *   4. Get all materias for the CC (MateriaXCursoXCiclo)
 *   5. For each materia, get student-materia assignments (MateriasXAlumnoXCursoXCiclo)
 *   6. generateMany (skipDuplicates) for general table
 *   7. generateMany (skipDuplicates) for subject table
 *   8. Return counts
 *
 * Spec: R-9 through R-15, R-38.
 * ADR: ADR-3.
 */
import { Injectable } from '@nestjs/common';
import {
  resolveAccessScope,
  ForbiddenError,
  NotFoundError,
  buildLockedDayMap,
} from '@educandow/domain';
import type {
  AlumnosXCursoXCicloRepository,
  MateriaXCursoXCicloRepository,
  AlumnosXMateriaRepository,
  AsistenciaGeneralRepository,
  AsistenciaMateriaRepository,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

export interface GenerateMonthlyAttendanceInput {
  courseCycleId: string;
  year: number;
  month: number;
  userId: string;
  userRoles: string[];
}

export interface GenerationResult {
  generalCreated: number;
  generalSkipped: number;
  materiaCreated: number;
  materiaSkipped: number;
}

@Injectable()
export class GenerateMonthlyAttendanceUseCase {
  constructor(
    private readonly alumnosCCRepo: AlumnosXCursoXCicloRepository,
    private readonly mxccRepo: MateriaXCursoXCicloRepository,
    private readonly alumnosXMateriaRepo: AlumnosXMateriaRepository,
    private readonly generalRepo: AsistenciaGeneralRepository,
    private readonly materiaAsistRepo: AsistenciaMateriaRepository,
  ) {}

  async execute(input: GenerateMonthlyAttendanceInput): Promise<GenerationResult> {
    const { courseCycleId, year, month, userRoles } = input;

    // 1. D3 admin-only gate
    const scope = resolveAccessScope({ roles: userRoles });
    if (!scope.isAdministrative) {
      throw new ForbiddenError('Monthly attendance generation requires an administrative role (D3)');
    }

    // 2. Verify CourseCycle exists
    const client = TenantContext.getClient();
    if (!client) {
      throw new ForbiddenError('Tenant context unavailable');
    }
    const cc = await client.courseCycle.findUnique({
      where: { uuid: courseCycleId },
      select: { uuid: true },
    });
    if (!cc) {
      throw new NotFoundError('CourseCycle', courseCycleId);
    }

    // 3. Get enrolled students (general roster)
    const enrolled = await this.alumnosCCRepo.findByCourseCycle(courseCycleId);

    // 4. Get all materias for the CC
    const materias = await this.mxccRepo.findByCourseCycleId(courseCycleId);

    // Edge: zero enrollment → all counts zero (R-13)
    if (enrolled.length === 0 && materias.length === 0) {
      return { generalCreated: 0, generalSkipped: 0, materiaCreated: 0, materiaSkipped: 0 };
    }

    // Build locked-day map once for this month (REQ-GEN-3 / T5.2)
    const lockedMap = buildLockedDayMap(year, month);

    // 5. Generate general rows (one per student)
    let generalCreated = 0;
    let generalSkipped = 0;

    if (enrolled.length > 0) {
      const generalRows = enrolled.map((e) => ({
        courseCycleId,
        studentId: e.studentId,
        year,
        month,
        days: lockedMap,
      }));
      const generalResult = await this.generalRepo.generateMany(generalRows);
      generalCreated = generalResult.created;
      generalSkipped = generalResult.skipped;
    }

    // 6. For each materia, get student assignments → build subject rows
    let materiaCreated = 0;
    let materiaSkipped = 0;

    if (materias.length > 0) {
      const alumnosXMateriaLists = await Promise.all(
        materias.map((m) => this.alumnosXMateriaRepo.findByMateria(m.id)),
      );
      const subjectRows = alumnosXMateriaLists
        .flat()
        .map((axm) => ({
          materiaXCursoXCicloId: axm.materiaXCursoXCicloId,
          studentId: axm.studentId,
          year,
          month,
          days: lockedMap,
        }));

      if (subjectRows.length > 0) {
        const materiaResult = await this.materiaAsistRepo.generateMany(subjectRows);
        materiaCreated = materiaResult.created;
        materiaSkipped = materiaResult.skipped;
      }
    }

    return { generalCreated, generalSkipped, materiaCreated, materiaSkipped };
  }
}
