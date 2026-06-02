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
} from '@educandow/domain';
import type { CourseSectionRepository } from '@educandow/domain';
import type { AcademicCycleRepository } from '@educandow/domain';
import type { StudyPlanRepository, StudyPlanCourseDto } from '@educandow/domain';
import { NotFoundError } from '@educandow/domain';

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
  cycleId?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export interface GenerateCourseCyclesInput {
  studyPlanId: string;
  cycleId: string;
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

    try {
      cc.ensureActive();
    } catch (e) {
      return err(e as Error);
    }

    // Build update VOs from input
    const updateData: Record<string, unknown> = {};

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

    cc.update(updateData as any);
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

  async execute(uuid: string): Promise<Result<CourseCycle, Error>> {
    const cc = await this.courseCycleRepo.findByUuid(uuid);
    if (!cc) {
      return err(new CourseCycleNotFoundError(uuid));
    }
    return ok(cc);
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
  ) {}

  async execute(input: GenerateCourseCyclesInput): Promise<CreateManyResult> {
    // Validate study plan exists
    const plan = await this.studyPlanRepo.findById(input.studyPlanId);
    if (!plan) {
      throw new NotFoundError('StudyPlan', input.studyPlanId);
    }

    // Validate academic cycle exists and is active
    const cycle = await this.academicCycleRepo.findByUuid(input.cycleId);
    if (!cycle) {
      throw new NotFoundError('AcademicCycle', input.cycleId);
    }
    if (!cycle.active) {
      throw new AcademicCycleClosedError(input.cycleId);
    }

    // Get courses from plan
    const planCourses: StudyPlanCourseDto[] = await this.studyPlanRepo.findPlanCoursesByPlan(input.studyPlanId);

    if (planCourses.length === 0) {
      return { created: 0, skipped: 0, total: 0 };
    }

    // For each plan course, create a CourseCycle
    // We use StudyPlan from the input (the plan identifier)
    const courseCycles: CourseCycle[] = planCourses.map((pc) => {
      return CourseCycle.create({
        courseId: pc.courseSectionId,
        studyPlanId: input.studyPlanId,
        cycleId: input.cycleId,
        courseName: CourseName.create(pc.courseSectionName ?? 'Sin nombre').unwrap(),
        level: buildLevel('PRIMARIO'), // will be overridden
        passingGrade: PassingGrade.create(6).unwrap(),
      });
    });

    const result = await this.courseCycleRepo.createMany(courseCycles);
    return result;
  }
}
