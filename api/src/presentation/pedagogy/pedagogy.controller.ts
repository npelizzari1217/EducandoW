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
    private createGradeUC: UC.CreateGradeUC, private listGradeUC: UC.ListGradesUC, private deleteGradeUC: UC.DeleteGradeUC,
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

  // ── Grades ─────────────────────────────────────────
  @Post('grades') @Roles('ADMIN','MANAGER','TEACHER')
  async postGrade(@Body(new ZodValidationPipe(DTO.CreateGradeSchema)) b: DTO.CreateGradeDTO) { const r = await this.createGradeUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const g = r.unwrap(); return { data: { id: g.id.get(), period: g.period, numericValue: g.numericValue, qualitativeValue: g.qualitativeValue, status: g.status } }; }

  @Get('grades') @Roles('ADMIN','MANAGER','TEACHER')
  async getGrades(@Query('studentId') sid: string, @Query('courseSectionId') csid: string) { if (sid) { const g = await this.listGradeUC.executeByStudent(sid); return { data: g.map(x => ({ id: x.id.get(), subjectId: x.subjectId, period: x.period, numericValue: x.numericValue, qualitativeValue: x.qualitativeValue, status: x.status })) }; } if (csid) { const g = await this.listGradeUC.executeByCourse(csid); return { data: g.map(x => ({ id: x.id.get(), studentId: x.studentId, subjectId: x.subjectId, period: x.period, numericValue: x.numericValue, status: x.status })) }; } return { data: [] }; }

  @Delete('grades/:id') @Roles('ADMIN','MANAGER') @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGrade(@Param('id') id: string) { await this.deleteGradeUC.execute(id); }

  // ── Attendance ─────────────────────────────────────
  @Post('attendance') @Roles('ADMIN','MANAGER','TEACHER')
  async postAttendance(@Body(new ZodValidationPipe(DTO.CreateAttendanceSchema)) b: DTO.CreateAttendanceDTO) { const r = await this.createAttUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const a = r.unwrap(); return { data: { id: a.id.get(), studentId: a.studentId, status: a.status } }; }

  @Get('attendance') @Roles('ADMIN','MANAGER','TEACHER')
  async getAttendance(@Query('courseSectionId') csid: string, @Query('date') d: string, @Query('studentId') sid: string) { if (csid && d) { const a = await this.listAttUC.executeByCourseDate(csid, d); return { data: a.map(x => ({ id: x.id.get(), studentId: x.studentId, status: x.status, note: x.note })) }; } if (sid) { const a = await this.listAttUC.executeByStudent(sid); return { data: a.map(x => ({ id: x.id.get(), date: x.date.toISOString(), status: x.status })) }; } return { data: [] }; }

  @Delete('attendance/:id') @Roles('ADMIN','MANAGER') @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAttendance(@Param('id') id: string) { await this.deleteAttUC.execute(id); }
}
