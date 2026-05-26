import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus, UseGuards, HttpException } from '@nestjs/common';
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
    private createSubjUC: UC.CreateSubjectUC, private listSubjUC: UC.ListSubjectsUC, private deleteSubjUC: UC.DeleteSubjectUC, private updateSubjUC: UC.UpdateSubjectUC,
    private createSecUC: UC.CreateCourseSectionUC, private listSecUC: UC.ListCourseSectionsUC, private deleteSecUC: UC.DeleteCourseSectionUC, private updateSecUC: UC.UpdateCourseSectionUC,
    private createAssignUC: UC.CreateSubjectAssignmentUC, private listAssignUC: UC.ListSubjectAssignmentsUC, private deleteAssignUC: UC.DeleteSubjectAssignmentUC,
    private createEvaluacionUC: UC.CreateEvaluacionUC, private listEvaluacionesUC: UC.ListEvaluacionesUC, private deleteEvaluacionUC: UC.DeleteEvaluacionUC,
    private createNotaUC: UC.CreateNotaUC, private listNotasUC: UC.ListNotasUC, private deleteNotaUC: UC.DeleteNotaUC,
    private createPeriodoUC: UC.CreatePeriodoUC, private listPeriodosUC: UC.ListPeriodosUC, private deletePeriodoUC: UC.DeletePeriodoUC,
    private createNotaTrimestralUC: UC.CreateNotaTrimestralUC, private listNotasTrimestralesUC: UC.ListNotasTrimestralesUC, private deleteNotaTrimestralUC: UC.DeleteNotaTrimestralUC,
    private createAttUC: UC.CreateAttendanceUC, private listAttUC: UC.ListAttendanceUC, private deleteAttUC: UC.DeleteAttendanceUC,
    private listCyclesUC: UC.ListAcademicCyclesUC,
    private createPlanUC: UC.CreateStudyPlanUC, private listPlansUC: UC.ListStudyPlansUC,
    private getPlanUC: UC.GetStudyPlanUC, private updatePlanUC: UC.UpdateStudyPlanUC, private deletePlanUC: UC.DeleteStudyPlanUC,
    private addCourseUC: UC.AddCourseToPlanUC, private removeCourseUC: UC.RemoveCourseFromPlanUC,
    private addSubjectUC: UC.AddSubjectToPlanCourseUC, private removeSubjectUC: UC.RemoveSubjectFromPlanCourseUC,
    private getPlanCourseUC: UC.GetPlanCourseDetailUC, private listPlanCoursesUC: UC.ListPlanCoursesUC,
  ) {}

  // ── Academic Cycles ────────────────────────────────────
  @Get('academic-cycles') @Roles('ADMIN','MANAGER','TEACHER')
  async getCycles(@Query('level') l?: string) {
    const level = l ? parseInt(l, 10) : undefined;
    const cycles = await this.listCyclesUC.execute(level);
    return { data: cycles.map((c) => ({ id: c.id.get(), name: c.name, level: c.level, modality: c.modality, startDate: c.startDate.toISOString(), endDate: c.endDate.toISOString(), active: c.active })) };
  }

  // ── Subjects ───────────────────────────────────────
  @Post('subjects') @Roles('ADMIN','MANAGER')
  async postSubject(@Body(new ZodValidationPipe(DTO.CreateSubjectSchema)) b: DTO.CreateSubjectDTO) { const r = await this.createSubjUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const s = r.unwrap(); return { data: { id: s.id.get(), name: s.name, level: s.level.toCode() } }; }

  @Get('subjects') @Roles('ADMIN','MANAGER','TEACHER')
  async getSubjects(@Query('institutionId') iid: string, @Query('level') l?: string) { const subjects = await this.listSubjUC.execute(iid, l); return { data: subjects.map((s) => ({ id: s.id.get(), name: s.name, level: s.level.toCode() })) }; }

  @Delete('subjects/:id') @Roles('ADMIN') @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSubject(@Param('id') id: string) { await this.deleteSubjUC.execute(id); }

  @Patch('subjects/:id') @Roles('ADMIN','MANAGER')
  async patchSubject(@Param('id') id: string, @Body(new ZodValidationPipe(DTO.UpdateSubjectSchema)) b: DTO.UpdateSubjectDTO) { const r = await this.updateSubjUC.execute(id, b); if (r.isErr()) throw r.unwrapErr(); const s: any = r.unwrap(); if (!s) return { data: null }; return { data: { id: s.id.get(), name: s.name, level: s.level.toCode() } }; }

  // ── Course Sections ────────────────────────────────
  @Post('course-sections') @Roles('ADMIN','MANAGER')
  async postSection(@Body(new ZodValidationPipe(DTO.CreateCourseSectionSchema)) b: DTO.CreateCourseSectionDTO) { const r = await this.createSecUC.execute(b); if (r.isErr()) throw new HttpException({ error: { message: r.unwrapErr().message } }, HttpStatus.BAD_REQUEST); const s = r.unwrap() as any; return { data: { id: s.id.get(), name: s.name, level: s.level.toCode(), academicYear: s.academicYear } }; }

  @Get('course-sections') @Roles('ADMIN','MANAGER','TEACHER')
  async getSections(@Query('institutionId') iid: string, @Query('level') l: string, @Query('academicYear') ay: string) { const sections = await this.listSecUC.execute(iid, l, ay); return { data: sections.map((s) => ({ id: s.id.get(), name: s.name, grade: s.grade, division: s.division, level: s.level.toCode(), academicYear: s.academicYear })) }; }

  @Delete('course-sections/:id') @Roles('ADMIN') @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSection(@Param('id') id: string) { await this.deleteSecUC.execute(id); }

  @Patch('course-sections/:id') @Roles('ADMIN','MANAGER')
  async patchSection(@Param('id') id: string, @Body(new ZodValidationPipe(DTO.UpdateCourseSectionSchema)) b: DTO.UpdateCourseSectionDTO) { const r = await this.updateSecUC.execute(id, b); if (r.isErr()) throw r.unwrapErr(); const s: any = r.unwrap(); if (!s) return { data: null }; return { data: { id: s.id.get(), name: s.name, grade: s.grade, division: s.division, level: s.level.toCode(), academicYear: s.academicYear } }; }

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

  // ── Study Plans ─────────────────────────────────────
  @Post('study-plans') @Roles('ADMIN','MANAGER')
  async createPlan(@Body(new ZodValidationPipe(DTO.CreateStudyPlanSchema)) b: DTO.CreateStudyPlanDTO) { const r = await this.createPlanUC.execute(b); if (r.isErr()) throw new HttpException({ error: { message: r.unwrapErr().message } }, HttpStatus.BAD_REQUEST); const p = r.unwrap() as any; return { data: { id: p.id.get(), name: p.name, level: p.level, academicYear: p.academicYear } }; }

  @Get('study-plans') @Roles('ADMIN','MANAGER','TEACHER')
  async listPlans(@Query('level') l?: string) {
    const plans = await this.listPlansUC.execute(l ? parseInt(l, 10) : undefined) as any[];
    return {
      data: plans.map((p: any) => ({
        id: p.id.get(),
        name: p.name,
        level: p.level,
        modality: p.modality,
        academicYear: p.academicYear,
        active: p.active,
      })),
    };
  }

  @Get('study-plans/:id') @Roles('ADMIN','MANAGER','TEACHER')
  async getPlan(@Param('id') id: string) {
    const p: any = await this.getPlanUC.execute(id);
    if (!p) return { data: null };
    const planCourses = await this.listPlanCoursesUC.execute(id);
    return {
      data: {
        id: p.id.get(),
        name: p.name,
        level: p.level,
        modality: p.modality,
        academicYear: p.academicYear,
        active: p.active,
        courses: planCourses.map((c) => ({
          id: c.id,
          courseSectionId: c.courseSectionId,
          courseSectionName: c.courseSectionName,
          studyPlanId: c.studyPlanId,
          subjectCount: c.subjects?.length ?? 0,
          subjects: c.subjects?.map((s: any) => ({
            id: s.id,
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            hoursPerWeek: s.hoursPerWeek,
          })) ?? [],
        })),
      },
    };
  }

  @Patch('study-plans/:id') @Roles('ADMIN','MANAGER')
  async updatePlan(@Param('id') id: string, @Body(new ZodValidationPipe(DTO.UpdateStudyPlanSchema)) b: DTO.UpdateStudyPlanDTO) { const r = await this.updatePlanUC.execute(id, b); if (r.isErr()) throw r.unwrapErr(); const p: any = r.unwrap(); if (!p) return { data: null }; return { data: { id: p.id.get(), name: p.name, academicYear: p.academicYear, active: p.active } }; }

  @Delete('study-plans/:id') @Roles('ADMIN','MANAGER') @HttpCode(HttpStatus.NO_CONTENT)
  async deletePlan(@Param('id') id: string) { await this.deletePlanUC.execute(id); }

  // ── Plan Courses ───────────────────────────────────
  @Get('study-plans/:id/courses') @Roles('ADMIN','MANAGER','TEACHER')
  async listPlanCourses(@Param('id') id: string) {
    const courses = await this.listPlanCoursesUC.execute(id);
    return { data: courses.map((c) => ({ id: c.id, courseSectionId: c.courseSectionId, courseSectionName: c.courseSectionName, courseGrade: c.courseGrade, courseDivision: c.courseDivision, studyPlanId: c.studyPlanId, subjectCount: c.subjects?.length ?? 0 })) };
  }

  @Post('study-plans/:id/courses') @Roles('ADMIN','MANAGER')
  async addCourseToPlan(@Param('id') id: string, @Body(new ZodValidationPipe(DTO.AddCourseToPlanSchema)) b: DTO.AddCourseToPlanDTO) {
    const r = await this.addCourseUC.execute(id, b.courseSectionId);
    if (r.isErr()) throw new HttpException({ error: { message: r.unwrapErr().message } }, HttpStatus.BAD_REQUEST);
    return { data: { ok: true } };
  }

  @Delete('study-plans/:id/courses/:courseId') @Roles('ADMIN','MANAGER') @HttpCode(HttpStatus.NO_CONTENT)
  async removeCourseFromPlan(@Param('id') id: string, @Param('courseId') courseId: string) { await this.removeCourseUC.execute(id, courseId); }

  // ── Plan Course Subjects ───────────────────────────
  @Get('study-plan-courses/:id') @Roles('ADMIN','MANAGER','TEACHER')
  async getPlanCourseDetail(@Param('id') id: string) {
    const detail = await this.getPlanCourseUC.execute(id);
    if (!detail) return { data: null };
    return { data: { id: detail.id, studyPlanId: detail.studyPlanId, courseSectionId: detail.courseSectionId } };
  }

  @Get('study-plan-courses/:id/subjects') @Roles('ADMIN','MANAGER','TEACHER')
  async listPlanCourseSubjects(@Param('id') id: string) {
    const detail = await this.getPlanCourseUC.execute(id);
    if (!detail) return { data: [] };
    return { data: (detail.subjects || []).map((s: any) => ({
      id: s.id,
      subjectId: s.subjectId,
      subjectName: s.subjectName || null,
      hoursPerWeek: s.hoursPerWeek ?? null,
    })) };
  }

  @Post('study-plan-courses/:id/subjects') @Roles('ADMIN','MANAGER')
  async addSubjectToPlanCourse(@Param('id') id: string, @Body(new ZodValidationPipe(DTO.AddSubjectToPlanCourseSchema)) b: DTO.AddSubjectToPlanCourseDTO) {
    const r = await this.addSubjectUC.execute(id, b.subjectId, b.hoursPerWeek);
    if (r.isErr()) throw new HttpException({ error: { message: r.unwrapErr().message } }, HttpStatus.BAD_REQUEST);
    return { data: { ok: true } };
  }

  @Delete('study-plan-courses/:id/subjects/:subjectId') @Roles('ADMIN','MANAGER') @HttpCode(HttpStatus.NO_CONTENT)
  async removeSubjectFromPlanCourse(@Param('id') id: string, @Param('subjectId') subjectId: string) { await this.removeSubjectUC.execute(id, subjectId); }
}
