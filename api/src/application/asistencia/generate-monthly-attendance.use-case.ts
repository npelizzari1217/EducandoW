/**
 * GenerateMonthlyAttendanceUseCase — application use-case (SDD-4 PR-2;
 * autollenado de Presente added in asistencia-autollenado-p PR-3).
 *
 * Materializes monthly attendance register rows for a CourseCycle+month.
 * Additive / skipDuplicates semantics (ADR-3 of SDD-4): existing rows with
 * recorded days are NEVER overwritten. Mirrors SDD-3
 * CascadeStudentMateriasCompetenciasUseCase.
 *
 * Authorization: ADMIN-only (D3 — SECRETARIO/DIRECTOR/ADMIN/ROOT).
 *   Rationale: generation is an administrative materialization, not a per-teacher action.
 *
 * Steps:
 *   1. Require administrative role (D3 only)
 *   2. Verify CourseCycle exists in tenant DB (now also reads `level`, needed
 *      to resolve the Presente AttendanceType — ADR-2 of asistencia-autollenado-p).
 *   2b. Guard: the previously GENERATED month (findLatestBefore, not the calendar
 *       predecessor) must be closed, else PreviousMonthOpenError. First-ever
 *       generated month is exempt (design §B1, AC-B-8/9/10, fase-bimestre-cierre-asistencia PR-3b).
 *   2c. Ensure this month's own AttendanceMonthStatus row exists (OPEN) — marks
 *       the month as "generated" for future canGenerate/findLatestBefore checks.
 *       Idempotent: never reopens/recloses an already-existing row.
 *   3. Get enrolled students (AlumnosXCursoXCiclo)
 *   4. Get all materias for the CC (MateriaXCursoXCiclo)
 *   4b. Autollenado de Presente (ATR-R11, asistencia-autollenado-p ADR-2/3/4):
 *       - Mes CERRADO (existingStatus ya leído en 2c) → no-op: se preserva el
 *         comportamiento preexistente de Generar (days = lockedMap plano), sin
 *         resolver Presente y sin ningún error/bypass nuevo (ATR-R11.6).
 *       - Mes abierto (o recién creado) → resuelve el AttendanceType Presente
 *         del nivel UNA sola vez; si no existe, corta ANTES de cualquier
 *         escritura de asistencia (sin escritura parcial) devolviendo
 *         `err(PresenteTypeNotFoundError)`. Si existe, arma `targetDays` con
 *         `fillHabilVacios`, reusado en AMBOS ejes (general y materia, ATR-R11.4).
 *   5. For each materia, get student-materia assignments (MateriasXAlumnoXCursoXCiclo)
 *   6. generateMany (skipDuplicates) for general table
 *   7. generateMany (skipDuplicates) for subject table
 *   8. Return counts, wrapped in `ok(...)` (ADR-3 of asistencia-autollenado-p:
 *      Result only for the new PresenteTypeNotFoundError path — legacy throws
 *      (ForbiddenError/NotFoundError/PreviousMonthOpenError) are unchanged).
 *
 * Spec: R-9 through R-15, R-38 (SDD-4); ATR-R11.1..R11.7 (asistencia-autollenado-p).
 * ADR: ADR-3 (SDD-4); ADR-2/ADR-3/ADR-4 (asistencia-autollenado-p).
 */
import { Injectable } from '@nestjs/common';
import {
  resolveAccessScope,
  ForbiddenError,
  NotFoundError,
  buildLockedDayMap,
  fillHabilVacios,
  AttendanceMonthStatus,
  PreviousMonthOpenError,
  PresenteTypeNotFoundError,
  ok,
  err,
} from '@educandow/domain';
import type {
  AlumnosXCursoXCicloRepository,
  MateriaXCursoXCicloRepository,
  AlumnosXMateriaRepository,
  AsistenciaGeneralRepository,
  AsistenciaMateriaRepository,
  AttendanceMonthStatusRepository,
  AttendanceTypeRepository,
  Result,
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
    private readonly monthStatusRepo: AttendanceMonthStatusRepository,
    private readonly attendanceTypeRepo: AttendanceTypeRepository,
  ) {}

  async execute(
    input: GenerateMonthlyAttendanceInput,
  ): Promise<Result<GenerationResult, PresenteTypeNotFoundError>> {
    const { courseCycleId, year, month, userRoles } = input;

    // 1. D3 admin-only gate
    const scope = resolveAccessScope({ roles: userRoles });
    if (!scope.isAdministrative) {
      throw new ForbiddenError('Monthly attendance generation requires an administrative role (D3)');
    }

    // 2. Verify CourseCycle exists (level needed to resolve Presente — ADR-2)
    const client = TenantContext.getClient();
    if (!client) {
      throw new ForbiddenError('Tenant context unavailable');
    }
    const cc = await client.courseCycle.findUnique({
      where: { uuid: courseCycleId },
      select: { uuid: true, level: true },
    });
    if (!cc) {
      throw new NotFoundError('CourseCycle', courseCycleId);
    }

    // 2b. Guard: previous GENERATED month (not the calendar predecessor — schools
    // may skip months) must be closed. First-ever generated month is exempt.
    const previousStatus = await this.monthStatusRepo.findLatestBefore(courseCycleId, year, month);
    if (!AttendanceMonthStatus.canGenerate(previousStatus)) {
      throw new PreviousMonthOpenError(courseCycleId, year, month);
    }

    // 2c. Ensure this month's own status row exists (OPEN) — marks the month as
    // "generated" for future canGenerate/findLatestBefore checks. Idempotent:
    // never reopens/recloses an already-existing row (ADR-3).
    const existingStatus = await this.monthStatusRepo.findOne(courseCycleId, year, month);
    if (!existingStatus) {
      await this.monthStatusRepo.upsert(AttendanceMonthStatus.create({ courseCycleId, year, month }));
    }

    // 3. Get enrolled students (general roster)
    const enrolled = await this.alumnosCCRepo.findByCourseCycle(courseCycleId);

    // 4. Get all materias for the CC
    const materias = await this.mxccRepo.findByCourseCycleId(courseCycleId);

    // Edge: zero enrollment → all counts zero (R-13)
    if (enrolled.length === 0 && materias.length === 0) {
      return ok({ generalCreated: 0, generalSkipped: 0, materiaCreated: 0, materiaSkipped: 0 });
    }

    // Build locked-day map once for this month (REQ-GEN-3 / T5.2)
    const lockedMap = buildLockedDayMap(year, month);

    // 4b. Autollenado de Presente (ATR-R11, ADR-2/ADR-3/ADR-4 asistencia-autollenado-p).
    // Mes CERRADO → no-op: preserva el comportamiento preexistente de Generar
    // (days = lockedMap plano), sin resolver Presente y sin ningún error/bypass
    // nuevo (ATR-R11.6). Reusa `existingStatus` ya leído en 2c (no query extra).
    const isClosed = existingStatus ? existingStatus.isClosed() : false;
    let targetDays: Record<string, string> = lockedMap;
    if (!isClosed) {
      const presente = await this.attendanceTypeRepo.findPresenteByLevel(cc.level);
      if (!presente) {
        // Corte ANTES de cualquier escritura de asistencia (sin escritura parcial).
        return err(new PresenteTypeNotFoundError(cc.level, courseCycleId));
      }
      targetDays = fillHabilVacios(lockedMap, presente.code.get(), year, month);
    }

    // 5. Generate general rows (one per student)
    let generalCreated = 0;
    let generalSkipped = 0;

    if (enrolled.length > 0) {
      const generalRows = enrolled.map((e) => ({
        courseCycleId,
        studentId: e.studentId,
        year,
        month,
        days: targetDays,
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
          days: targetDays,
        }));

      if (subjectRows.length > 0) {
        const materiaResult = await this.materiaAsistRepo.generateMany(subjectRows);
        materiaCreated = materiaResult.created;
        materiaSkipped = materiaResult.skipped;
      }
    }

    return ok({ generalCreated, generalSkipped, materiaCreated, materiaSkipped });
  }
}
