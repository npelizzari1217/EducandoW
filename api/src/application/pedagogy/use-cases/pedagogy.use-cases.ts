import { Injectable } from '@nestjs/common';
import { ok, err, Result, ValidationError, Level, LevelType, EducationalLevelCode, EducationalModalityCode } from '@educandow/domain';
import type { SubjectRepository, CourseSectionRepository, SubjectAssignmentRepository, EvaluacionRepository, NotaRepository, PeriodoEvaluacionRepository, NotaTrimestralRepository, AttendanceRepository, AcademicCycleRepository, StudyPlanRepository, StudyPlanCourseDto } from '@educandow/domain';
import { Subject, CourseSection, SubjectAssignment, Evaluacion, Nota, PeriodoEvaluacion, NotaTrimestral, Attendance, AcademicCycle, StudyPlan } from '@educandow/domain';

const VALID_PEDAGOGICAL_LEVELS: EducationalLevelCode[] = [
  EducationalLevelCode.INICIAL,
  EducationalLevelCode.PRIMARIO,
  EducationalLevelCode.SECUNDARIO,
  EducationalLevelCode.TERCIARIO,
  EducationalLevelCode.ADMINISTRACION,
];

function buildLevel(level: string, modality?: string): Level {
  const parsed = Level.create(level);
  if (parsed.isOk()) return parsed.unwrap();
  return Level.fromParts(
    parseInt(level, 10) as EducationalLevelCode || 1,
    (modality && parseInt(modality, 10) >= 0) ? parseInt(modality, 10) as EducationalModalityCode : EducationalModalityCode.COMUN,
  );
}

// ── AcademicCycle ─────────────────────────────────────
@Injectable()
export class ListAcademicCyclesUC { constructor(private r: AcademicCycleRepository) {} async execute(level?: number): Promise<AcademicCycle[]> { return this.r.findActive(level); } }

// ── Subject ──────────────────────────────────────────
@Injectable()
export class CreateSubjectUC { constructor(private r: SubjectRepository) {} async execute(input: { name: string; level: string; modality?: string; institutionId: string }) { const s = Subject.create({ name: input.name, level: buildLevel(input.level, input.modality), institutionId: input.institutionId }); await this.r.save(s); return ok(s); } }
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
    const updated = Subject.reconstruct({ ...(existing as any).props, name: input.name ?? existing.name });
    await this.r.save(updated);
    return ok(updated);
  }
}

// ── CourseSection ────────────────────────────────────
@Injectable()
export class CreateCourseSectionUC { constructor(private r: CourseSectionRepository, private planRepo: StudyPlanRepository) {} async execute(input: { name?: string; grade?: string; division?: string; level: string; modality?: string; academicYear: string; institutionId?: string; studyPlanId?: string }) {
    let levelVal = buildLevel(input.level, input.modality);
    let academicYear = input.academicYear;

    if (input.studyPlanId) {
      const plan = await this.planRepo.findById(input.studyPlanId);
      if (!plan) return err(new ValidationError(`Plan de estudio ${input.studyPlanId} no encontrado`));
      levelVal = Level.fromParts(plan.level as EducationalLevelCode, plan.modality ?? EducationalModalityCode.COMUN);
      academicYear = plan.academicYear || academicYear;
    }

    const name = input.name || [input.grade, input.division].filter(Boolean).join(' ') || input.level;
    const s = CourseSection.create({ name, grade: input.grade, division: input.division, level: levelVal, academicYear, institutionId: input.institutionId || '' });
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
      ...(existing as any).props,
      name,
      grade: input.grade !== undefined ? input.grade : existing.grade,
      division: input.division !== undefined ? input.division : existing.division,
    });
    await this.r.save(updated);
    return ok(updated);
  }
}

// ── SubjectAssignment ────────────────────────────────
@Injectable()
export class CreateSubjectAssignmentUC { constructor(private r: SubjectAssignmentRepository) {} async execute(input: { subjectId: string; teacherId: string; courseSectionId: string }) { const a = SubjectAssignment.create(input); await this.r.save(a); return ok(a); } }
@Injectable()
export class ListSubjectAssignmentsUC { constructor(private r: SubjectAssignmentRepository) {} async executeByCourse(courseSectionId: string) { return this.r.findByCourseSection(courseSectionId); } async executeByTeacher(teacherId: string) { return this.r.findByTeacher(teacherId); } }
@Injectable()
export class DeleteSubjectAssignmentUC { constructor(private r: SubjectAssignmentRepository) {} async execute(id: string) { await this.r.delete(id); } }

// ── Evaluacion ────────────────────────────────────────
@Injectable()
export class CreateEvaluacionUC { constructor(private r: EvaluacionRepository) {} async execute(input: { assignmentId: string; title: string; description?: string; evaluationDate: string; weight?: number }) { const e = Evaluacion.create({ ...input, evaluationDate: new Date(input.evaluationDate), weight: input.weight ?? 1 }); await this.r.save(e); return ok(e); } }
@Injectable()
export class ListEvaluacionesUC { constructor(private r: EvaluacionRepository) {} async execute(assignmentId: string) { return this.r.findByAssignment(assignmentId); } }
@Injectable()
export class DeleteEvaluacionUC { constructor(private r: EvaluacionRepository) {} async execute(id: string) { await this.r.delete(id); } }

// ── Nota ──────────────────────────────────────────────
@Injectable()
export class CreateNotaUC { constructor(private r: NotaRepository) {} async execute(input: { evaluationId: string; studentId: string; numericValue?: number; qualitativeValue?: string; comments?: string; gradeScaleValueId?: string }) { const n = Nota.create(input); await this.r.save(n); return ok(n); } }
@Injectable()
export class ListNotasUC { constructor(private r: NotaRepository) {} async executeByEvaluation(evaluationId: string) { return this.r.findByEvaluation(evaluationId); } async executeByStudent(studentId: string) { return this.r.findByStudent(studentId); } }
@Injectable()
export class DeleteNotaUC { constructor(private r: NotaRepository) {} async execute(id: string) { await this.r.delete(id); } }

// ── PeriodoEvaluacion ─────────────────────────────────
@Injectable()
export class CreatePeriodoUC { constructor(private r: PeriodoEvaluacionRepository) {} async execute(input: { academicYear: string; name: string; startDate: string; endDate: string }) { const p = PeriodoEvaluacion.create({ ...input, startDate: new Date(input.startDate), endDate: new Date(input.endDate) }); await this.r.save(p); return ok(p); } }
@Injectable()
export class ListPeriodosUC { constructor(private r: PeriodoEvaluacionRepository) {} async execute(academicYear: string) { return this.r.findByAcademicYear(academicYear); } }
@Injectable()
export class DeletePeriodoUC { constructor(private r: PeriodoEvaluacionRepository) {} async execute(id: string) { await this.r.delete(id); } }

// ── NotaTrimestral ────────────────────────────────────
@Injectable()
export class CreateNotaTrimestralUC { constructor(private r: NotaTrimestralRepository) {} async execute(input: { studentId: string; assignmentId: string; periodId: string; finalGrade: number; attendancePct?: number }) { const n = NotaTrimestral.create(input); await this.r.save(n); return ok(n); } }
@Injectable()
export class ListNotasTrimestralesUC { constructor(private r: NotaTrimestralRepository) {} async execute(studentId: string, periodId: string) { return this.r.findByStudentAndPeriod(studentId, periodId); } }
@Injectable()
export class DeleteNotaTrimestralUC { constructor(private r: NotaTrimestralRepository) {} async execute(id: string) { await this.r.delete(id); } }

// ── Attendance ───────────────────────────────────────
@Injectable()
export class CreateAttendanceUC { constructor(private r: AttendanceRepository) {} async execute(input: { studentId: string; courseSectionId: string; date: string; status: string; note?: string }) { const { status, ...rest } = input; const a = Attendance.create({ ...rest, date: new Date(input.date), statusId: status as any }); await this.r.save(a); return ok(a); } }
@Injectable()
export class ListAttendanceUC { constructor(private r: AttendanceRepository) {} async executeByCourseDate(courseSectionId: string, date: string) { return this.r.findByCourseSectionAndDate(courseSectionId, new Date(date)); } async executeByStudent(studentId: string) { return this.r.findByStudent(studentId); } }
@Injectable()
export class DeleteAttendanceUC { constructor(private r: AttendanceRepository) {} async execute(id: string) { await this.r.delete(id); } }

// ── Study Plans ──────────────────────────────────────
@Injectable()
export class CreateStudyPlanUC { constructor(private r: StudyPlanRepository) {} async execute(input: { name: string; level: number; modality?: number; academicYear: string }) {
    const lvl = input.level as EducationalLevelCode;
    if (!VALID_PEDAGOGICAL_LEVELS.includes(lvl)) return err(new ValidationError(`Nivel educativo inválido: ${input.level}. Debe ser 1 (Inicial), 2 (Primario), 3 (Secundario), 4 (Terciario), o 9 (Administración)`));
    const p = StudyPlan.create({ name: input.name, level: lvl, modality: (input.modality ?? 0) as EducationalModalityCode, academicYear: input.academicYear });
    await this.r.save(p);
    return ok(p);
  }
}
@Injectable()
export class UpdateStudyPlanUC { constructor(private r: StudyPlanRepository) {} async execute(id: string, input: { name?: string; academicYear?: string; active?: boolean }) { const existing = await this.r.findById(id); if (!existing) return ok(null); const updated = StudyPlan.reconstruct({ ...(existing as any).props, name: input.name ?? existing.name, academicYear: input.academicYear ?? existing.academicYear, active: input.active ?? existing.active, updatedAt: new Date() }); await this.r.save(updated); return ok(updated); } }
@Injectable()
export class ListStudyPlansUC { constructor(private r: StudyPlanRepository) {} async execute(level?: number) { return this.r.findAll(level); } }
@Injectable()
export class GetStudyPlanUC { constructor(private r: StudyPlanRepository) {} async execute(id: string) { return this.r.findById(id); } }
@Injectable()
export class DeleteStudyPlanUC { constructor(private r: StudyPlanRepository) {} async execute(id: string) { const existing = await this.r.findById(id); if (!existing) return; await this.r.softDelete(id); } }
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
  async execute(planCourseId: string, subjectId: string, hoursPerWeek?: number) {
    const planCourse = await this.planRepo.findPlanCourseById(planCourseId);
    if (!planCourse) return err(new ValidationError(`Asociación plan-curso ${planCourseId} no encontrada`));
    const subject = await this.subjectRepo.findById(subjectId);
    if (!subject) return err(new ValidationError(`Materia ${subjectId} no encontrada`));
    await this.planRepo.addSubject(planCourseId, subjectId, hoursPerWeek);
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
