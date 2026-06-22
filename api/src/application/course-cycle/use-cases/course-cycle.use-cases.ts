import { Injectable } from '@nestjs/common';
import {
  Result, ok, err,
  CourseCycle,
  CourseCycleRepository,
  CourseCycleFilters,
  CreateManyResult,
  CourseName,
  PassingGrade,
  BimonthPeriod,
  Level,
  CourseCycleAlreadyExistsError,
  CourseCycleNotFoundError,
  AcademicCycleClosedError,
  EducationalLevelCode,
  EducationalModalityCode,
  type UpdateCourseCycleInput as DomainUpdateCourseCycleInput,
} from '@educandow/domain';
import type { EnrolledStudent } from '@educandow/domain';
import type { CourseSectionRepository } from '@educandow/domain';
import type { AcademicCycleRepository } from '@educandow/domain';
import type { StudyPlanRepository } from '@educandow/domain';
import { NotFoundError } from '@educandow/domain';
import type { AutoCreateCompetenciasXMateriaXAlumnoXCursoXCicloUC } from '../../pedagogy/use-cases/competency.use-cases';
import type { MaterializeMateriasUseCase } from '../../materia-grupo-ciclo/materialize-materias.use-case';

// ── Helpers ──────────────────────────────────────────────────

function buildLevel(levelStr: string): Level {
  const result = Level.create(levelStr);
  if (result.isOk()) return result.unwrap();
  // Fallback: try by numeric code
  const numeric = parseInt(levelStr, 10);
  if (!isNaN(numeric)) {
    const r2 = Level.create(numeric);
    if (r2.isOk()) return r2.unwrap();
  }
  throw new Error(`Invalid level: ${levelStr}`);
}

function buildBimonthPeriod(startStr?: string, endStr?: string): BimonthPeriod | null {
  if (!startStr || !endStr) return null;
  const result = BimonthPeriod.create(new Date(startStr), new Date(endStr));
  if (result.isOk()) return result.unwrap();
  throw new Error(`Invalid bimonth period: ${startStr} -> ${endStr}`);
}

// ── Input types ──────────────────────────────────────────────

export interface CreateCourseCycleInput {
  courseId: string;
  studyPlanId: string;
  cycleId: string;
  courseName: string;
  level: string;
  passingGrade: number;
  promotionText?: string | null;
  firstBimonthStart?: string;
  firstBimonthEnd?: string;
  secondBimonthStart?: string;
  secondBimonthEnd?: string;
  thirdBimonthStart?: string;
  thirdBimonthEnd?: string;
  fourthBimonthStart?: string;
  fourthBimonthEnd?: string;
}

export interface UpdateCourseCycleInput {
  courseName?: string;
  passingGrade?: number;
  active?: boolean;
  promotionText?: string | null;
  firstBimonthStart?: string;
  firstBimonthEnd?: string;
  secondBimonthStart?: string;
  secondBimonthEnd?: string;
  thirdBimonthStart?: string;
  thirdBimonthEnd?: string;
  fourthBimonthStart?: string;
  fourthBimonthEnd?: string;
}

export interface ListCourseCyclesInput {
  level?: number;
  /** Restricción de acceso: códigos de nivel compuestos permitidos.
   * Pasado por el controller cuando !scope.allLevels (SECRETARIO/DIRECTOR). */
  levelIn?: number[];
  cycleId?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export interface GenerateCourseCyclesInput {
  level: number;
  cycleId: string;
  studyPlanId?: string;
}

// ── Use Cases ────────────────────────────────────────────────

@Injectable()
export class CreateCourseCycleUseCase {
  constructor(
    private readonly courseCycleRepo: CourseCycleRepository,
    private readonly courseSectionRepo: CourseSectionRepository,
    private readonly academicCycleRepo: AcademicCycleRepository,
    private readonly studyPlanRepo: StudyPlanRepository,
  ) {}

  async execute(input: CreateCourseCycleInput): Promise<Result<CourseCycle, Error>> {
    // Validate FKs exist
    const course = await this.courseSectionRepo.findById(input.courseId);
    if (!course) {
      return err(new NotFoundError('CourseSection', input.courseId));
    }

    const cycle = await this.academicCycleRepo.findByUuid(input.cycleId);
    if (!cycle) {
      return err(new NotFoundError('AcademicCycle', input.cycleId));
    }

    const plan = await this.studyPlanRepo.findById(input.studyPlanId);
    if (!plan) {
      return err(new NotFoundError('StudyPlan', input.studyPlanId));
    }

    // Check duplicate
    const existing = await this.courseCycleRepo.findByPair(input.courseId, input.cycleId);
    if (existing) {
      return err(new CourseCycleAlreadyExistsError(input.courseId, input.cycleId));
    }

    // Build VOs
    const courseName = CourseName.create(input.courseName);
    if (courseName.isErr()) return err(courseName.unwrapErr());

    const level = buildLevel(input.level);

    const passingGrade = PassingGrade.create(input.passingGrade);
    if (passingGrade.isErr()) return err(passingGrade.unwrapErr());

    const firstBim = buildBimonthPeriod(input.firstBimonthStart, input.firstBimonthEnd);
    const secondBim = buildBimonthPeriod(input.secondBimonthStart, input.secondBimonthEnd);
    const thirdBim = buildBimonthPeriod(input.thirdBimonthStart, input.thirdBimonthEnd);
    const fourthBim = buildBimonthPeriod(input.fourthBimonthStart, input.fourthBimonthEnd);

    const cc = CourseCycle.create({
      courseId: input.courseId,
      studyPlanId: input.studyPlanId,
      cycleId: input.cycleId,
      courseName: courseName.unwrap(),
      level,
      passingGrade: passingGrade.unwrap(),
      promotionText: input.promotionText ?? null,
      firstBimonth: firstBim,
      secondBimonth: secondBim,
      thirdBimonth: thirdBim,
      fourthBimonth: fourthBim,
    });

    await this.courseCycleRepo.save(cc);
    return ok(cc);
  }
}

@Injectable()
export class UpdateCourseCycleUseCase {
  constructor(private readonly courseCycleRepo: CourseCycleRepository) {}

  async execute(uuid: string, input: UpdateCourseCycleInput): Promise<Result<CourseCycle, Error>> {
    const cc = await this.courseCycleRepo.findByUuid(uuid);
    if (!cc) {
      return err(new CourseCycleNotFoundError(uuid));
    }

    // Build update VOs from input
    const updateData: DomainUpdateCourseCycleInput = {};

    if (input.courseName !== undefined) {
      const cn = CourseName.create(input.courseName);
      if (cn.isErr()) return err(cn.unwrapErr());
      updateData.courseName = cn.unwrap();
    }

    if (input.passingGrade !== undefined) {
      const pg = PassingGrade.create(input.passingGrade);
      if (pg.isErr()) return err(pg.unwrapErr());
      updateData.passingGrade = pg.unwrap();
    }

    if (input.active !== undefined) {
      updateData.active = input.active;
    }

    if (input.promotionText !== undefined) {
      updateData.promotionText = input.promotionText;
    }

    if (input.firstBimonthStart && input.firstBimonthEnd) {
      updateData.firstBimonth = buildBimonthPeriod(input.firstBimonthStart, input.firstBimonthEnd);
    }

    if (input.secondBimonthStart && input.secondBimonthEnd) {
      updateData.secondBimonth = buildBimonthPeriod(input.secondBimonthStart, input.secondBimonthEnd);
    }

    if (input.thirdBimonthStart && input.thirdBimonthEnd) {
      updateData.thirdBimonth = buildBimonthPeriod(input.thirdBimonthStart, input.thirdBimonthEnd);
    }

    if (input.fourthBimonthStart && input.fourthBimonthEnd) {
      updateData.fourthBimonth = buildBimonthPeriod(input.fourthBimonthStart, input.fourthBimonthEnd);
    }

    cc.update(updateData);
    await this.courseCycleRepo.save(cc);
    return ok(cc);
  }
}

@Injectable()
export class DeleteCourseCycleUseCase {
  constructor(private readonly courseCycleRepo: CourseCycleRepository) {}

  async execute(uuid: string): Promise<void> {
    const cc = await this.courseCycleRepo.findByUuid(uuid);
    if (!cc) {
      throw new CourseCycleNotFoundError(uuid);
    }

    cc.ensureActive();
    await this.courseCycleRepo.softDelete(cc.uuid);
  }
}

@Injectable()
export class ToggleCourseCycleActiveUseCase {
  constructor(private readonly courseCycleRepo: CourseCycleRepository) {}

  async execute(uuid: string, active: boolean): Promise<Result<CourseCycle, Error>> {
    const cc = await this.courseCycleRepo.findByUuid(uuid);
    if (!cc) {
      return err(new CourseCycleNotFoundError(uuid));
    }

    if (active) {
      cc.activate();
    } else {
      cc.deactivate();
    }

    await this.courseCycleRepo.save(cc);
    return ok(cc);
  }
}

@Injectable()
export class GetCourseCycleUseCase {
  constructor(private readonly courseCycleRepo: CourseCycleRepository) {}

  async execute(uuid: string): Promise<Result<{ cycle: CourseCycle; modality: number | null }, Error>> {
    const cc = await this.courseCycleRepo.findByUuid(uuid);
    if (!cc) {
      return err(new CourseCycleNotFoundError(uuid));
    }
    const ctx = await this.courseCycleRepo.findGradingContextByUuid(uuid);
    return ok({ cycle: cc, modality: ctx?.modality ?? null });
  }
}

@Injectable()
export class ListStudentsByCourseCycleUC {
  constructor(private readonly repo: CourseCycleRepository) {}

  /**
   * Returns enrolled students for the given CourseCycle.
   * Throws CourseCycleNotFoundError (→ HTTP 404) if cycle does not exist.
   * Returns [] when cycle exists but has no active enrollments (SBC-3).
   */
  async execute(uuid: string): Promise<EnrolledStudent[]> {
    const cc = await this.repo.findByUuid(uuid);
    if (!cc) throw new CourseCycleNotFoundError(uuid);
    return this.repo.findEnrolledStudents(uuid);
  }
}

@Injectable()
export class ListCourseCyclesUseCase {
  constructor(private readonly courseCycleRepo: CourseCycleRepository) {}

  async execute(filters: ListCourseCyclesInput) {
    return this.courseCycleRepo.findAll(filters as CourseCycleFilters);
  }
}

@Injectable()
export class GenerateCourseCyclesUseCase {
  constructor(
    private readonly courseCycleRepo: CourseCycleRepository,
    private readonly studyPlanRepo: StudyPlanRepository,
    private readonly academicCycleRepo: AcademicCycleRepository,
    private readonly autoCreateUC: AutoCreateCompetenciasXMateriaXAlumnoXCursoXCicloUC,
    private readonly materializeMateriasUC?: MaterializeMateriasUseCase,
  ) {}

  async execute(input: GenerateCourseCyclesInput): Promise<CreateManyResult> {
    // 1. Validate cycle exists and is active
    const cycle = await this.academicCycleRepo.findByUuid(input.cycleId);
    if (!cycle) {
      throw new NotFoundError('AcademicCycle', input.cycleId);
    }
    if (!cycle.active) {
      throw new AcademicCycleClosedError(input.cycleId);
    }

    // 2. Determine plans to process
    const plans: { id: string; level: number; modality: number }[] = [];

    if (input.studyPlanId) {
      const plan = await this.studyPlanRepo.findById(input.studyPlanId);
      if (!plan) {
        throw new NotFoundError('StudyPlan', input.studyPlanId);
      }
      plans.push({
        id: plan.id.get(),
        level: plan.level as number,
        modality: plan.modality as number,
      });
    } else {
      const baseLevel = Math.floor(input.level / 10);
      const allPlans = await this.studyPlanRepo.findAll(baseLevel);
      for (const plan of allPlans) {
        plans.push({
          id: plan.id.get(),
          level: plan.level as number,
          modality: plan.modality as number,
        });
      }
    }

    // 3. Process each plan's courses with per-course UPSERT
    let created = 0;
    let updated = 0;
    let total = 0;

    for (const planRef of plans) {
      const planCourses = await this.studyPlanRepo.findPlanCoursesByPlan(planRef.id);

      for (const pc of planCourses) {
        const compositeLevel = Level.fromParts(planRef.level as EducationalLevelCode, planRef.modality as EducationalModalityCode);
        const courseName = CourseName.create(pc.courseSectionName ?? 'Sin nombre').unwrap();
        const passingGrade = PassingGrade.create(6).unwrap();

        const existing = await this.courseCycleRepo.findByPair(pc.courseSectionId, input.cycleId);

        let courseCycleUuid: string;
        if (existing) {
          // Regenerar resincroniza las fechas de bimestre desde el ciclo lectivo
          // (pisa overrides por curso, por decisión de producto).
          existing.update({
            courseName,
            firstBimonth: cycle.firstBimonth ?? null,
            secondBimonth: cycle.secondBimonth ?? null,
            thirdBimonth: cycle.thirdBimonth ?? null,
            fourthBimonth: cycle.fourthBimonth ?? null,
          });
          await this.courseCycleRepo.save(existing);
          courseCycleUuid = existing.uuid;
          updated++;
        } else {
          const cc = CourseCycle.create({
            courseId: pc.courseSectionId,
            studyPlanId: planRef.id,
            cycleId: input.cycleId,
            courseName,
            level: compositeLevel,
            passingGrade,
            promotionText: null,
            // Hereda las fechas de bimestre definidas en el ciclo lectivo.
            firstBimonth: cycle.firstBimonth ?? null,
            secondBimonth: cycle.secondBimonth ?? null,
            thirdBimonth: cycle.thirdBimonth ?? null,
            fourthBimonth: cycle.fourthBimonth ?? null,
          });
          await this.courseCycleRepo.save(cc);
          courseCycleUuid = cc.uuid;
          created++;
        }
        // Fire-and-forget: sync CompetencyValuation parents for this CourseCycle on BOTH
        // create AND update, so newly added subjects/competencies (or newly enrolled students)
        // get their valuations. Idempotent (skipDuplicates); failure must NOT block generation.
        this.autoCreateUC.execute({ courseCycleId: courseCycleUuid }).catch((e) => {
          console.error('[GenerateCourseCycles] AutoCreate failed (non-blocking):', e);
        });

        // Fire-and-forget: materialize MateriaXCursoXCiclo from plan subjects (F3-A1, D1).
        // Aditivo: creates missing rows + re-syncs studyPlanSubjectId on existing ones.
        // Never touches grades, groups, or AlumnosXGrupo (D1).
        if (this.materializeMateriasUC && (pc.subjects ?? []).length > 0) {
          this.materializeMateriasUC
            .execute({
              courseCycleId: courseCycleUuid,
              planSubjects: pc.subjects!.map((s) => ({
                subjectId: s.subjectId,
                studyPlanSubjectId: s.id,
                esOptativa: s.esOptativa,
              })),
            })
            .catch((e) => {
              console.error('[GenerateCourseCycles] materializeMaterias failed (non-blocking):', e);
            });
        }

        total++;
      }
    }

    return { created, updated, total };
  }
}
