import { Injectable } from '@nestjs/common';
import { ok, err, ValidationError, Id, Level, EducationalLevel, EducationalLevelCode, EducationalModality, EducationalModalityCode, Result } from '@educandow/domain';
import type { SubjectRepository, CourseSectionRepository, AcademicCycleRepository, StudyPlanRepository, StudyPlanCourseDto } from '@educandow/domain';
import { Subject, CourseSection, AcademicCycle, StudyPlan } from '@educandow/domain';
import { CycleCode, BimonthPeriod, CycleCodeAlreadyExistsError, AcademicCycleNotFoundError, StudyPlanHasDependenciesError } from '@educandow/domain';
import { DomainError } from '@educandow/domain';
import type { SubjectProps, CourseSectionProps, StudyPlanProps, AcademicCycleFilters, PaginatedResult } from '@educandow/domain';
import type { UpdateAcademicCycleInput } from '@educandow/domain';
function buildLevel(level: string, modality?: string): Level {
  const parsed = Level.create(level);
  if (parsed.isOk()) return parsed.unwrap();
  return Level.fromParts(
    parseInt(level, 10) as EducationalLevelCode || 1,
    (modality && parseInt(modality, 10) >= 0) ? parseInt(modality, 10) as EducationalModalityCode : EducationalModalityCode.COMUN,
  );
}

// ── AcademicCycle ─────────────────────────────────────

export interface CreateAcademicCycleDTO {
  name: string;
  level: number;
  modality?: number;
  startDate: string;
  endDate: string;
  code: string;
  firstBimonthStart?: string;
  firstBimonthEnd?: string;
  secondBimonthStart?: string;
  secondBimonthEnd?: string;
  thirdBimonthStart?: string;
  thirdBimonthEnd?: string;
  fourthBimonthStart?: string;
  fourthBimonthEnd?: string;
}

export interface UpdateAcademicCycleDTO {
  name?: string;
  code?: string;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  firstBimonthStart?: string;
  firstBimonthEnd?: string;
  secondBimonthStart?: string;
  secondBimonthEnd?: string;
  thirdBimonthStart?: string;
  thirdBimonthEnd?: string;
  fourthBimonthStart?: string;
  fourthBimonthEnd?: string;
}

function buildBimonthOrNull(startStr?: string, endStr?: string): BimonthPeriod | null | Error {
  if (!startStr && !endStr) return null;
  if (startStr && endStr) {
    const result = BimonthPeriod.create(new Date(startStr), new Date(endStr));
    if (result.isErr()) return result.unwrapErr();
    return result.unwrap();
  }
  return new ValidationError('Bimestere requires both start and end dates');
}

@Injectable()
export class CreateAcademicCycleUC {
  constructor(private r: AcademicCycleRepository) {}

  async execute(input: CreateAcademicCycleDTO): Promise<Result<AcademicCycle, Error>> {
    // Validate code
    const codeResult = CycleCode.create(input.code);
    if (codeResult.isErr()) return err(codeResult.unwrapErr());

    // Check uniqueness
    const existing = await this.r.findByCode(input.code);
    if (existing) return err(new CycleCodeAlreadyExistsError(input.code));

    // Build bimonths
    const firstBimonth = buildBimonthOrNull(input.firstBimonthStart, input.firstBimonthEnd);
    if (firstBimonth instanceof Error) return err(firstBimonth);
    const secondBimonth = buildBimonthOrNull(input.secondBimonthStart, input.secondBimonthEnd);
    if (secondBimonth instanceof Error) return err(secondBimonth);
    const thirdBimonth = buildBimonthOrNull(input.thirdBimonthStart, input.thirdBimonthEnd);
    if (thirdBimonth instanceof Error) return err(thirdBimonth);
    const fourthBimonth = buildBimonthOrNull(input.fourthBimonthStart, input.fourthBimonthEnd);
    if (fourthBimonth instanceof Error) return err(fourthBimonth);

    const cycle = AcademicCycle.create({
      name: input.name,
      level: EducationalLevel.fromCode(input.level as EducationalLevelCode),
      modality: input.modality != null ? EducationalModality.fromCode(input.modality as EducationalModalityCode) : undefined,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      code: codeResult.unwrap(),
      firstBimonth: firstBimonth as BimonthPeriod | null,
      secondBimonth: secondBimonth as BimonthPeriod | null,
      thirdBimonth: thirdBimonth as BimonthPeriod | null,
      fourthBimonth: fourthBimonth as BimonthPeriod | null,
    });

    await this.r.save(cycle);
    return ok(cycle);
  }
}

@Injectable()
export class UpdateAcademicCycleUC {
  constructor(private r: AcademicCycleRepository) {}

  async execute(uuid: string, input: UpdateAcademicCycleDTO): Promise<Result<AcademicCycle, Error>> {
    const cycle = await this.r.findByUuid(uuid);
    if (!cycle) return err(new AcademicCycleNotFoundError(uuid));

    const updateData: UpdateAcademicCycleInput = {};

    if (input.name !== undefined) updateData.name = input.name;

    if (input.code !== undefined) {
      const codeResult = CycleCode.create(input.code);
      if (codeResult.isErr()) return err(codeResult.unwrapErr());
      updateData.code = codeResult.unwrap();
    }

    if (input.startDate !== undefined) updateData.startDate = new Date(input.startDate);
    if (input.endDate !== undefined) updateData.endDate = new Date(input.endDate);
    if (input.active !== undefined) updateData.active = input.active;

    if (input.firstBimonthStart !== undefined || input.firstBimonthEnd !== undefined) {
      const bim = buildBimonthOrNull(input.firstBimonthStart, input.firstBimonthEnd);
      if (bim instanceof Error) return err(bim);
      updateData.firstBimonth = bim as BimonthPeriod | null;
    }
    if (input.secondBimonthStart !== undefined || input.secondBimonthEnd !== undefined) {
      const bim = buildBimonthOrNull(input.secondBimonthStart, input.secondBimonthEnd);
      if (bim instanceof Error) return err(bim);
      updateData.secondBimonth = bim as BimonthPeriod | null;
    }
    if (input.thirdBimonthStart !== undefined || input.thirdBimonthEnd !== undefined) {
      const bim = buildBimonthOrNull(input.thirdBimonthStart, input.thirdBimonthEnd);
      if (bim instanceof Error) return err(bim);
      updateData.thirdBimonth = bim as BimonthPeriod | null;
    }
    if (input.fourthBimonthStart !== undefined || input.fourthBimonthEnd !== undefined) {
      const bim = buildBimonthOrNull(input.fourthBimonthStart, input.fourthBimonthEnd);
      if (bim instanceof Error) return err(bim);
      updateData.fourthBimonth = bim as BimonthPeriod | null;
    }

    cycle.update(updateData);
    await this.r.save(cycle);
    return ok(cycle);
  }
}

// ── Other use cases (unchanged) ────────────────────────

@Injectable()
export class DeleteAcademicCycleUC {
  constructor(private r: AcademicCycleRepository) {}

  async execute(uuid: string): Promise<void> {
    const cycle = await this.r.findByUuid(uuid);
    if (!cycle) throw new AcademicCycleNotFoundError(uuid);
    await this.r.softDelete(uuid);
  }
}

@Injectable()
export class ToggleAcademicCycleActiveUC {
  constructor(private r: AcademicCycleRepository) {}

  async execute(uuid: string): Promise<Result<AcademicCycle, Error>> {
    const cycle = await this.r.findByUuid(uuid);
    if (!cycle) return err(new AcademicCycleNotFoundError(uuid));
    cycle.toggleActive();
    await this.r.save(cycle);
    return ok(cycle);
  }
}

@Injectable()
export class GetAcademicCycleUC {
  constructor(private r: AcademicCycleRepository) {}

  async execute(uuid: string): Promise<Result<AcademicCycle, Error>> {
    const cycle = await this.r.findByUuid(uuid);
    if (!cycle) return err(new AcademicCycleNotFoundError(uuid));
    return ok(cycle);
  }
}

@Injectable()
export class ListAcademicCyclesUC {
  constructor(private r: AcademicCycleRepository) {}

  async execute(level?: number): Promise<AcademicCycle[]>;
  async execute(filters: AcademicCycleFilters): Promise<PaginatedResult<AcademicCycle>>;
  async execute(arg: number | AcademicCycleFilters | undefined): Promise<AcademicCycle[] | PaginatedResult<AcademicCycle>> {
    if (typeof arg === 'number' || arg === undefined) {
      return this.r.findActive(arg);
    }
    return this.r.findAll(arg);
  }
}

// ── Subject ──────────────────────────────────────────
@Injectable()
export class CreateSubjectUC { constructor(private r: SubjectRepository) {} async execute(input: { name: string; level: string; modality?: string; institutionId: string }) { const s = Subject.create({ name: input.name, level: buildLevel(input.level, input.modality), institutionId: Id.create(input.institutionId) }); await this.r.save(s); return ok(s); } }
@Injectable()
export class ListSubjectsUC { constructor(private r: SubjectRepository) {} async execute(institutionId: string, level?: string) { return level ? this.r.findByLevel(institutionId, buildLevel(level).get()) : this.r.findByInstitution(institutionId); } }
@Injectable()
export class DeleteSubjectUC { constructor(private r: SubjectRepository) {} async execute(id: string) { await this.r.delete(id); } }
@Injectable()
export class UpdateSubjectUC {
  constructor(private r: SubjectRepository) {}
  async execute(id: string, input: { name?: string }) {
    const existing = await this.r.findById(id);
    if (!existing) return ok(null);
    const updated = Subject.reconstruct({ ...(existing as unknown as { props: SubjectProps }).props, name: input.name ?? existing.name });
    await this.r.save(updated);
    return ok(updated);
  }
}

// ── CourseSection ────────────────────────────────────
@Injectable()
export class CreateCourseSectionUC { constructor(private r: CourseSectionRepository, private planRepo: StudyPlanRepository) {} async execute(input: { name?: string; grade?: string; division?: string; level: string; modality?: string; academicYear: string; institutionId?: string; studyPlanId?: string }): Promise<Result<CourseSection, ValidationError>> {
    let levelVal = buildLevel(input.level, input.modality);
    let academicYear = input.academicYear;

    if (input.studyPlanId) {
      const plan = await this.planRepo.findById(input.studyPlanId);
      if (!plan) return err(new ValidationError(`Plan de estudio ${input.studyPlanId} no encontrado`));
      levelVal = Level.fromParts(plan.level as EducationalLevelCode, plan.modality ?? EducationalModalityCode.COMUN);
    }

    const name = input.name || [input.grade, input.division].filter(Boolean).join(' ') || input.level;
    const s = CourseSection.create({ name, grade: input.grade, division: input.division, level: levelVal, academicYear, institutionId: Id.reconstruct(input.institutionId || '') });
    await this.r.save(s);
    return ok(s);
  }
}
@Injectable()
export class ListCourseSectionsUC { constructor(private r: CourseSectionRepository) {} async execute(institutionId: string, level: string, academicYear: string) { return this.r.findByLevel(institutionId, buildLevel(level).get(), academicYear); } }
@Injectable()
export class DeleteCourseSectionUC { constructor(private r: CourseSectionRepository) {} async execute(id: string) { await this.r.delete(id); } }
@Injectable()
export class UpdateCourseSectionUC {
  constructor(private r: CourseSectionRepository) {}
  async execute(id: string, input: { name?: string; grade?: string; division?: string }) {
    const existing = await this.r.findById(id);
    if (!existing) return ok(null);
    const name = input.name || [input.grade, input.division].filter(Boolean).join(' ') || existing.name;
    const updated = CourseSection.reconstruct({
      ...(existing as unknown as { props: CourseSectionProps }).props,
      name,
      grade: input.grade !== undefined ? input.grade : existing.grade,
      division: input.division !== undefined ? input.division : existing.division,
    });
    await this.r.save(updated);
    return ok(updated);
  }
}

// ── Study Plans ──────────────────────────────────────
@Injectable()
export class CreateStudyPlanUC { constructor(private r: StudyPlanRepository) {} async execute(input: { name: string; level: number; modality?: number; cycleUuid?: string }): Promise<Result<StudyPlan, ValidationError>> {
    const modality = input.modality ?? 0;
    const compositeValidation = Level.create(input.level * 10 + modality);
    if (compositeValidation.isErr()) {
      return err(new ValidationError(`Combinación de nivel/modalidad inválida: nivel=${input.level}, modalidad=${modality}. Verifique que la modalidad sea válida para el nivel indicado.`));
    }
    const p = StudyPlan.create({ name: input.name, level: input.level as EducationalLevelCode, modality: modality as EducationalModalityCode, cycleUuid: input.cycleUuid });
    await this.r.save(p);
    return ok(p);
  }
}
@Injectable()
export class UpdateStudyPlanUC {
  constructor(private r: StudyPlanRepository) {}

  async execute(id: string, input: { name?: string; cycleUuid?: string | null; active?: boolean; level?: number; modality?: number }): Promise<Result<StudyPlan | null, ValidationError>> {
    const existing = await this.r.findById(id);
    if (!existing) return ok(null);

    const newLevel = (input.level ?? existing.level) as EducationalLevelCode;
    const newModality = (input.modality ?? existing.modality) as EducationalModalityCode;

    if (input.level !== undefined || input.modality !== undefined) {
      const compositeValidation = Level.create(newLevel * 10 + newModality);
      if (compositeValidation.isErr()) {
        return err(new ValidationError(`Combinación de nivel/modalidad inválida: nivel=${newLevel}, modalidad=${newModality}. Verifique que la modalidad sea válida para el nivel indicado.`));
      }
    }

    const levelChanged = newLevel !== existing.level || newModality !== existing.modality;

    const updated = StudyPlan.reconstruct({
      ...(existing as unknown as { props: StudyPlanProps }).props,
      name: input.name ?? existing.name,
      cycleUuid: input.cycleUuid !== undefined ? (input.cycleUuid ?? undefined) : existing.cycleUuid,
      active: input.active ?? existing.active,
      updatedAt: new Date(),
    });

    if (levelChanged) {
      updated.changeLevel(newLevel, newModality);
      await this.r.saveWithLevelCascade(updated, newLevel, newModality);
    } else {
      await this.r.save(updated);
    }

    return ok(updated);
  }
}
@Injectable()
export class ListStudyPlansUC { constructor(private r: StudyPlanRepository) {} async execute(level?: number) { return this.r.findAll(level); } }
@Injectable()
export class GetStudyPlanUC { constructor(private r: StudyPlanRepository) {} async execute(id: string) { return this.r.findById(id); } }
@Injectable()
export class DeleteStudyPlanUC {
  constructor(private r: StudyPlanRepository) {}

  async execute(id: string): Promise<Result<void, DomainError>> {
    const existing = await this.r.findById(id);
    if (!existing) return ok(undefined);
    const { courseCount, courseCycleCount } = await this.r.getDependencies(id);
    if (courseCount > 0 || courseCycleCount > 0) {
      return err(new StudyPlanHasDependenciesError(courseCount, courseCycleCount));
    }
    await this.r.softDelete(id);
    return ok(undefined);
  }
}
@Injectable()
export class AddCourseToPlanUC {
  constructor(private planRepo: StudyPlanRepository, private courseRepo: CourseSectionRepository) {}
  async execute(planId: string, courseSectionId: string) {
    const plan = await this.planRepo.findById(planId);
    if (!plan) return err(new ValidationError(`Plan de estudio ${planId} no encontrado`));
    const course = await this.courseRepo.findById(courseSectionId);
    if (!course) return err(new ValidationError(`Curso ${courseSectionId} no encontrado`));
    await this.planRepo.addCourse(planId, courseSectionId);
    return ok(null);
  }
}
@Injectable()
export class RemoveCourseFromPlanUC { constructor(private r: StudyPlanRepository) {} async execute(planId: string, courseSectionId: string) { await this.r.removeCourse(planId, courseSectionId); } }
@Injectable()
export class AddSubjectToPlanCourseUC {
  constructor(private planRepo: StudyPlanRepository, private subjectRepo: SubjectRepository) {}
  async execute(planCourseId: string, subjectId: string, hoursPerWeek?: number, esOptativa?: boolean) {
    const planCourse = await this.planRepo.findPlanCourseById(planCourseId);
    if (!planCourse) return err(new ValidationError(`Asociación plan-curso ${planCourseId} no encontrada`));
    const subject = await this.subjectRepo.findById(subjectId);
    if (!subject) return err(new ValidationError(`Materia ${subjectId} no encontrada`));
    await this.planRepo.addSubject(planCourseId, subjectId, hoursPerWeek, esOptativa);
    return ok(null);
  }
}
@Injectable()
export class RemoveSubjectFromPlanCourseUC { constructor(private r: StudyPlanRepository) {} async execute(planCourseId: string, subjectId: string) { await this.r.removeSubject(planCourseId, subjectId); } }
@Injectable()
export class GetPlanCourseDetailUC {
  constructor(private planRepo: StudyPlanRepository) {}
  async execute(planCourseId: string): Promise<StudyPlanCourseDto | null> {
    return this.planRepo.findPlanCourseById(planCourseId);
  }
}
@Injectable()
export class ListPlanCoursesUC {
  constructor(private planRepo: StudyPlanRepository) {}
  async execute(planId: string): Promise<StudyPlanCourseDto[]> {
    return this.planRepo.findPlanCoursesByPlan(planId);
  }
}
