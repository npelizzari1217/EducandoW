import { Injectable } from '@nestjs/common';
import { ok, err, Result, ValidationError, Level, LevelType } from '@educandow/domain';
import type { SubjectRepository, CourseSectionRepository, SubjectAssignmentRepository, GradeRepository, AttendanceRepository } from '@educandow/domain';
import { Subject, CourseSection, SubjectAssignment, Grade, Attendance } from '@educandow/domain';

// ── Subject ──────────────────────────────────────────
@Injectable()
export class CreateSubjectUC { constructor(private r: SubjectRepository) {} async execute(input: { name: string; level: string; institutionId: string }) { const s = Subject.create({ ...input, level: Level.create(input.level).unwrap() }); await this.r.save(s); return ok(s); } }
@Injectable()
export class ListSubjectsUC { constructor(private r: SubjectRepository) {} async execute(institutionId: string, level?: string) { return level ? this.r.findByLevel(institutionId, Level.create(level).unwrap().get()) : this.r.findByInstitution(institutionId); } }
@Injectable()
export class DeleteSubjectUC { constructor(private r: SubjectRepository) {} async execute(id: string) { await this.r.delete(id); } }

// ── CourseSection ────────────────────────────────────
@Injectable()
export class CreateCourseSectionUC { constructor(private r: CourseSectionRepository) {} async execute(input: { name: string; grade?: string; division?: string; level: string; academicYear: string; institutionId: string }) { const s = CourseSection.create({ ...input, level: Level.create(input.level).unwrap() }); await this.r.save(s); return ok(s); } }
@Injectable()
export class ListCourseSectionsUC { constructor(private r: CourseSectionRepository) {} async execute(institutionId: string, level: string, academicYear: string) { return this.r.findByLevel(institutionId, Level.create(level).unwrap().get(), academicYear); } }
@Injectable()
export class DeleteCourseSectionUC { constructor(private r: CourseSectionRepository) {} async execute(id: string) { await this.r.delete(id); } }

// ── SubjectAssignment ────────────────────────────────
@Injectable()
export class CreateSubjectAssignmentUC { constructor(private r: SubjectAssignmentRepository) {} async execute(input: { subjectId: string; teacherId: string; courseSectionId: string }) { const a = SubjectAssignment.create(input); await this.r.save(a); return ok(a); } }
@Injectable()
export class ListSubjectAssignmentsUC { constructor(private r: SubjectAssignmentRepository) {} async executeByCourse(courseSectionId: string) { return this.r.findByCourseSection(courseSectionId); } async executeByTeacher(teacherId: string) { return this.r.findByTeacher(teacherId); } }
@Injectable()
export class DeleteSubjectAssignmentUC { constructor(private r: SubjectAssignmentRepository) {} async execute(id: string) { await this.r.delete(id); } }

// ── Grade ────────────────────────────────────────────
@Injectable()
export class CreateGradeUC { constructor(private r: GradeRepository) {} async execute(input: { studentId: string; subjectId: string; courseSectionId: string; period: string; numericValue?: number; qualitativeValue?: string; status?: string }) { const g = Grade.create({ ...input, status: input.status as any }); await this.r.save(g); return ok(g); } }
@Injectable()
export class ListGradesUC { constructor(private r: GradeRepository) {} async executeByStudent(studentId: string) { return this.r.findByStudent(studentId); } async executeByCourse(courseSectionId: string) { return this.r.findByCourseSection(courseSectionId); } }
@Injectable()
export class DeleteGradeUC { constructor(private r: GradeRepository) {} async execute(id: string) { await this.r.delete(id); } }

// ── Attendance ───────────────────────────────────────
@Injectable()
export class CreateAttendanceUC { constructor(private r: AttendanceRepository) {} async execute(input: { studentId: string; courseSectionId: string; date: string; status: string; note?: string }) { const a = Attendance.create({ ...input, date: new Date(input.date), status: input.status as any }); await this.r.save(a); return ok(a); } }
@Injectable()
export class ListAttendanceUC { constructor(private r: AttendanceRepository) {} async executeByCourseDate(courseSectionId: string, date: string) { return this.r.findByCourseSectionAndDate(courseSectionId, new Date(date)); } async executeByStudent(studentId: string) { return this.r.findByStudent(studentId); } }
@Injectable()
export class DeleteAttendanceUC { constructor(private r: AttendanceRepository) {} async execute(id: string) { await this.r.delete(id); } }
