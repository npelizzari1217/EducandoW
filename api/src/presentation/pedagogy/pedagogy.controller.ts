import { Controller, Get, Post, Delete, Body, Param, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import * as DTO from './dto/pedagogy.dto';
import * as UC from '../../application/pedagogy/use-cases/pedagogy.use-cases';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class PedagogyController {

  constructor(
    private createSubjUC: UC.CreateSubjectUC, private listSubjUC: UC.ListSubjectsUC, private deleteSubjUC: UC.DeleteSubjectUC,
    private createSecUC: UC.CreateCourseSectionUC, private listSecUC: UC.ListCourseSectionsUC, private deleteSecUC: UC.DeleteCourseSectionUC,
    private createAssignUC: UC.CreateSubjectAssignmentUC, private listAssignUC: UC.ListSubjectAssignmentsUC, private deleteAssignUC: UC.DeleteSubjectAssignmentUC,
    private createEvaluacionUC: UC.CreateEvaluacionUC, private listEvaluacionesUC: UC.ListEvaluacionesUC, private deleteEvaluacionUC: UC.DeleteEvaluacionUC,
    private createNotaUC: UC.CreateNotaUC, private listNotasUC: UC.ListNotasUC, private deleteNotaUC: UC.DeleteNotaUC,
    private createPeriodoUC: UC.CreatePeriodoUC, private listPeriodosUC: UC.ListPeriodosUC, private deletePeriodoUC: UC.DeletePeriodoUC,
    private createNotaTrimestralUC: UC.CreateNotaTrimestralUC, private listNotasTrimestralesUC: UC.ListNotasTrimestralesUC, private deleteNotaTrimestralUC: UC.DeleteNotaTrimestralUC,
    private createAttUC: UC.CreateAttendanceUC, private listAttUC: UC.ListAttendanceUC, private deleteAttUC: UC.DeleteAttendanceUC,
  ) {}

  // ── Subjects ───────────────────────────────────────
  @Post('subjects') @Roles('ADMIN','MANAGER')
  async postSubject(@Body(new ZodValidationPipe(DTO.CreateSubjectSchema)) b: DTO.CreateSubjectDTO) { const r = await this.createSubjUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const s = r.unwrap(); return { data: { id: s.id.get(), name: s.name, level: s.level.toCode() } }; }

  @Get('subjects') @Roles('ADMIN','MANAGER','TEACHER')
  async getSubjects(@Query('institutionId') iid: string, @Query('level') l?: string) { const subjects = await this.listSubjUC.execute(iid, l); return { data: subjects.map((s) => ({ id: s.id.get(), name: s.name, level: s.level.toCode() })) }; }

  @Delete('subjects/:id') @Roles('ADMIN') @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSubject(@Param('id') id: string) { await this.deleteSubjUC.execute(id); }

  // ── Course Sections ────────────────────────────────
  @Post('course-sections') @Roles('ADMIN','MANAGER')
  async postSection(@Body(new ZodValidationPipe(DTO.CreateCourseSectionSchema)) b: DTO.CreateCourseSectionDTO) { const r = await this.createSecUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const s = r.unwrap(); return { data: { id: s.id.get(), name: s.name, level: s.level.toCode(), academicYear: s.academicYear } }; }

  @Get('course-sections') @Roles('ADMIN','MANAGER','TEACHER')
  async getSections(@Query('institutionId') iid: string, @Query('level') l: string, @Query('academicYear') ay: string) { const sections = await this.listSecUC.execute(iid, l, ay); return { data: sections.map((s) => ({ id: s.id.get(), name: s.name, grade: s.grade, division: s.division, level: s.level.toCode(), academicYear: s.academicYear })) }; }

  @Delete('course-sections/:id') @Roles('ADMIN') @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSection(@Param('id') id: string) { await this.deleteSecUC.execute(id); }

  // ── Subject Assignments ────────────────────────────
  @Post('subject-assignments') @Roles('ADMIN','MANAGER')
  async postAssign(@Body(new ZodValidationPipe(DTO.CreateSubjectAssignmentSchema)) b: DTO.CreateSubjectAssignmentDTO) { const r = await this.createAssignUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const a = r.unwrap(); return { data: { id: a.id.get(), subjectId: a.subjectId, teacherId: a.teacherId, courseSectionId: a.courseSectionId } }; }

  @Get('subject-assignments') @Roles('ADMIN','MANAGER','TEACHER')
  async getAssigns(@Query('courseSectionId') csid: string, @Query('teacherId') tid: string) { if (csid) { const a = await this.listAssignUC.executeByCourse(csid); return { data: a.map(x => ({ id: x.id.get(), subjectId: x.subjectId, teacherId: x.teacherId, courseSectionId: x.courseSectionId })) }; } if (tid) { const a = await this.listAssignUC.executeByTeacher(tid); return { data: a.map(x => ({ id: x.id.get(), subjectId: x.subjectId, teacherId: x.teacherId, courseSectionId: x.courseSectionId })) }; } return { data: [] }; }

  @Delete('subject-assignments/:id') @Roles('ADMIN') @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAssign(@Param('id') id: string) { await this.deleteAssignUC.execute(id); }

  // ── Evaluaciones ────────────────────────────────────
  @Post('evaluaciones') @Roles('ADMIN','MANAGER','TEACHER')
  async postEvaluacion(@Body(new ZodValidationPipe(DTO.CreateEvaluacionSchema)) b: DTO.CreateEvaluacionDTO) { const r = await this.createEvaluacionUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const e = r.unwrap(); return { data: { id: e.id.get(), title: e.title, evaluationDate: e.evaluationDate.toISOString(), weight: e.weight } }; }

  @Get('evaluaciones') @Roles('ADMIN','MANAGER','TEACHER')
  async getEvaluaciones(@Query('assignmentId') aid: string) { if (aid) { const e = await this.listEvaluacionesUC.execute(aid); return { data: e.map(x => ({ id: x.id.get(), title: x.title, evaluationDate: x.evaluationDate.toISOString(), weight: x.weight })) }; } return { data: [] }; }

  @Delete('evaluaciones/:id') @Roles('ADMIN','MANAGER') @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEvaluacion(@Param('id') id: string) { await this.deleteEvaluacionUC.execute(id); }

  // ── Notas ───────────────────────────────────────────
  @Post('notas') @Roles('ADMIN','MANAGER','TEACHER')
  async postNota(@Body(new ZodValidationPipe(DTO.CreateNotaSchema)) b: DTO.CreateNotaDTO) { const r = await this.createNotaUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const n = r.unwrap(); return { data: { id: n.id.get(), evaluationId: n.evaluationId, studentId: n.studentId, numericValue: n.numericValue, qualitativeValue: n.qualitativeValue, gradeCode: n.gradeCode, gradeLabel: n.gradeLabel, isApproved: n.isApproved } }; }

  @Get('notas') @Roles('ADMIN','MANAGER','TEACHER','TUTOR','STUDENT')
  async getNotas(@Query('evaluationId') eid: string, @Query('studentId') sid: string) { if (eid) { const n = await this.listNotasUC.executeByEvaluation(eid); return { data: n.map(x => ({ id: x.id.get(), studentId: x.studentId, numericValue: x.numericValue, qualitativeValue: x.qualitativeValue, comments: x.comments, gradeCode: x.gradeCode, gradeLabel: x.gradeLabel, isApproved: x.isApproved })) }; } if (sid) { const n = await this.listNotasUC.executeByStudent(sid); return { data: n.map(x => ({ id: x.id.get(), evaluationId: x.evaluationId, numericValue: x.numericValue, qualitativeValue: x.qualitativeValue, gradeCode: x.gradeCode, gradeLabel: x.gradeLabel })) }; } return { data: [] }; }

  @Delete('notas/:id') @Roles('ADMIN','MANAGER') @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNota(@Param('id') id: string) { await this.deleteNotaUC.execute(id); }

  // ── Periodos ────────────────────────────────────────
  @Post('periodos') @Roles('ADMIN','MANAGER')
  async postPeriodo(@Body(new ZodValidationPipe(DTO.CreatePeriodoSchema)) b: DTO.CreatePeriodoDTO) { const r = await this.createPeriodoUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const p = r.unwrap(); return { data: { id: p.id.get(), name: p.name, academicYear: p.academicYear, startDate: p.startDate.toISOString(), endDate: p.endDate.toISOString() } }; }

  @Get('periodos') @Roles('ADMIN','MANAGER','TEACHER')
  async getPeriodos(@Query('academicYear') ay: string) { if (ay) { const p = await this.listPeriodosUC.execute(ay); return { data: p.map(x => ({ id: x.id.get(), name: x.name, academicYear: x.academicYear, startDate: x.startDate.toISOString(), endDate: x.endDate.toISOString() })) }; } return { data: [] }; }

  @Delete('periodos/:id') @Roles('ADMIN') @HttpCode(HttpStatus.NO_CONTENT)
  async deletePeriodo(@Param('id') id: string) { await this.deletePeriodoUC.execute(id); }

  // ── Notas Trimestrales ──────────────────────────────
  @Post('notas-trimestrales') @Roles('ADMIN','MANAGER','TEACHER')
  async postNotaTrimestral(@Body(new ZodValidationPipe(DTO.CreateNotaTrimestralSchema)) b: DTO.CreateNotaTrimestralDTO) { const r = await this.createNotaTrimestralUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const n = r.unwrap(); return { data: { id: n.id.get(), studentId: n.studentId, assignmentId: n.assignmentId, periodId: n.periodId, finalGrade: n.finalGrade, attendancePct: n.attendancePct } }; }

  @Get('notas-trimestrales') @Roles('ADMIN','MANAGER','TEACHER','TUTOR','STUDENT')
  async getNotasTrimestrales(@Query('studentId') sid: string, @Query('periodId') pid: string) { if (sid && pid) { const n = await this.listNotasTrimestralesUC.execute(sid, pid); return { data: n.map(x => ({ id: x.id.get(), assignmentId: x.assignmentId, finalGrade: x.finalGrade, attendancePct: x.attendancePct })) }; } return { data: [] }; }

  @Delete('notas-trimestrales/:id') @Roles('ADMIN','MANAGER') @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotaTrimestral(@Param('id') id: string) { await this.deleteNotaTrimestralUC.execute(id); }

  // ── Attendance ─────────────────────────────────────
  @Post('attendance') @Roles('ADMIN','MANAGER','TEACHER')
  async postAttendance(@Body(new ZodValidationPipe(DTO.CreateAttendanceSchema)) b: DTO.CreateAttendanceDTO) { const r = await this.createAttUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const a = r.unwrap(); return { data: { id: a.id.get(), studentId: a.studentId, status: a.status, statusDescription: a.statusDescription, isPresent: a.isPresent } }; }

  @Get('attendance') @Roles('ADMIN','MANAGER','TEACHER')
  async getAttendance(@Query('courseSectionId') csid: string, @Query('date') d: string, @Query('studentId') sid: string) { if (csid && d) { const a = await this.listAttUC.executeByCourseDate(csid, d); return { data: a.map(x => ({ id: x.id.get(), studentId: x.studentId, status: x.status, statusDescription: x.statusDescription, isPresent: x.isPresent, note: x.note })) }; } if (sid) { const a = await this.listAttUC.executeByStudent(sid); return { data: a.map(x => ({ id: x.id.get(), date: x.date.toISOString(), status: x.status, statusDescription: x.statusDescription })) }; } return { data: [] }; }

  @Delete('attendance/:id') @Roles('ADMIN','MANAGER') @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAttendance(@Param('id') id: string) { await this.deleteAttUC.execute(id); }
}
