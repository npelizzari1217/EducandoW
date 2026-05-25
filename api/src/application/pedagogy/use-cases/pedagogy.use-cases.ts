import { Injectable } from '@nestjs/common';
import { ok, err, Result, ValidationError, Level, LevelType, EducationalLevelCode, EducationalModalityCode } from '@educandow/domain';
import type { SubjectRepository, CourseSectionRepository, SubjectAssignmentRepository, EvaluacionRepository, NotaRepository, PeriodoEvaluacionRepository, NotaTrimestralRepository, AttendanceRepository } from '@educandow/domain';
import { Subject, CourseSection, SubjectAssignment, Evaluacion, Nota, PeriodoEvaluacion, NotaTrimestral, Attendance } from '@educandow/domain';

function buildLevel(level: string, modality?: string): Level {
  const parsed = Level.create(level);
  if (parsed.isOk()) return parsed.unwrap();
  // Fallback: try from parts
  return Level.fromParts(
    parseInt(level, 10) as EducationalLevelCode || 1,
    (modality && parseInt(modality, 10) >= 0) ? parseInt(modality, 10) as EducationalModalityCode : EducationalModalityCode.COMUN,
  );
}

// ── Subject ──────────────────────────────────────────
@Injectable()
export class CreateSubjectUC { constructor(private r: SubjectRepository) {} async execute(input: { name: string; level: string; modality?: string; institutionId: string }) { const s = Subject.create({ name: input.name, level: buildLevel(input.level, input.modality), institutionId: input.institutionId }); await this.r.save(s); return ok(s); } }
@Injectable()
export class ListSubjectsUC { constructor(private r: SubjectRepository) {} async execute(institutionId: string, level?: string) { return level ? this.r.findByLevel(institutionId, buildLevel(level).get()) : this.r.findByInstitution(institutionId); } }
@Injectable()
export class DeleteSubjectUC { constructor(private r: SubjectRepository) {} async execute(id: string) { await this.r.delete(id); } }

// ── CourseSection ────────────────────────────────────
@Injectable()
export class CreateCourseSectionUC { constructor(private r: CourseSectionRepository) {} async execute(input: { name: string; grade?: string; division?: string; level: string; modality?: string; academicYear: string; institutionId: string }) { const s = CourseSection.create({ name: input.name, grade: input.grade, division: input.division, level: buildLevel(input.level, input.modality), academicYear: input.academicYear, institutionId: input.institutionId }); await this.r.save(s); return ok(s); } }
@Injectable()
export class ListCourseSectionsUC { constructor(private r: CourseSectionRepository) {} async execute(institutionId: string, level: string, academicYear: string) { return this.r.findByLevel(institutionId, buildLevel(level).get(), academicYear); } }
@Injectable()
export class DeleteCourseSectionUC { constructor(private r: CourseSectionRepository) {} async execute(id: string) { await this.r.delete(id); } }

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
