import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus, UseGuards, HttpException } from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import * as DTO from './dto/pedagogy.dto';
import * as CDTO from './dto/competency.dto';
import * as UC from '../../application/pedagogy/use-cases/pedagogy.use-cases';
import * as CUC from '../../application/pedagogy/use-cases/competency.use-cases';
import { BoletinInvalidationService } from '../../application/reportes/boletin-invalidation.service';
import type { AcademicCycle } from '@educandow/domain';

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
    private getCycleUC: UC.GetAcademicCycleUC,
    private createCycleUC: UC.CreateAcademicCycleUC,
    private updateCycleUC: UC.UpdateAcademicCycleUC,
    private deleteCycleUC: UC.DeleteAcademicCycleUC,
    private toggleCycleUC: UC.ToggleAcademicCycleActiveUC,
    private createPlanUC: UC.CreateStudyPlanUC, private listPlansUC: UC.ListStudyPlansUC,
    private getPlanUC: UC.GetStudyPlanUC, private updatePlanUC: UC.UpdateStudyPlanUC, private deletePlanUC: UC.DeleteStudyPlanUC,
    private addCourseUC: UC.AddCourseToPlanUC, private removeCourseUC: UC.RemoveCourseFromPlanUC,
    private addSubjectUC: UC.AddSubjectToPlanCourseUC, private removeSubjectUC: UC.RemoveSubjectFromPlanCourseUC,
    private getPlanCourseUC: UC.GetPlanCourseDetailUC, private listPlanCoursesUC: UC.ListPlanCoursesUC,
    private createCompUC: CUC.CreateSubjectCompetencyUC, private listCompUC: CUC.ListSubjectCompetenciesUC,
    private getCompUC: CUC.GetSubjectCompetencyUC, private updateCompUC: CUC.UpdateSubjectCompetencyUC,
    private deleteCompUC: CUC.DeleteSubjectCompetencyUC,
    private listValUC: CUC.ListCompetencyValuationsUC, private getValUC: CUC.GetCompetencyValuationUC,
    private updateValUC: CUC.UpdateCompetencyValuationUC,
    private boletinInvalidation: BoletinInvalidationService,
  ) {}

  // ── Academic Cycles ────────────────────────────────────
  @Get('academic-cycles') @Roles('ROOT', { module: 'COURSES', action: 'READ' })
  async getCycles(@Query('level') l?: string, @Query('active') active?: string,
                   @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const level = l ? parseInt(l, 10) : undefined;
    const hasFilters = active !== undefined || page !== undefined || pageSize !== undefined;

    if (hasFilters) {
      const result = await this.listCyclesUC.execute({
        level,
        active: active === 'true' ? true : active === 'false' ? false : undefined,
        page: page ? parseInt(page, 10) : undefined,
        pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      });
      return {
        data: result.data.map((c: AcademicCycle) => this.toCycleResponse(c)),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    }

    const cycles = await this.listCyclesUC.execute(level);
    return { data: cycles.map((c: AcademicCycle) => this.toCycleResponse(c)) };
  }

  @Get('academic-cycles/:uuid') @Roles('ROOT', { module: 'COURSES', action: 'READ' })
  async getCycle(@Param('uuid') uuid: string) {
    const result = await this.getCycleUC.execute(uuid);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.toCycleResponse(result.unwrap()) };
  }

  @Post('academic-cycles') @Roles('ROOT', { module: 'COURSES', action: '*' })
  async postCycle(@Body(new ZodValidationPipe(DTO.CreateAcademicCycleSchema)) b: DTO.CreateAcademicCycleDTO) {
    const result = await this.createCycleUC.execute(b);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.toCycleResponse(result.unwrap()) };
  }

  @Patch('academic-cycles/:uuid') @Roles('ROOT', { module: 'COURSES', action: '*' })
  async patchCycle(@Param('uuid') uuid: string, @Body(new ZodValidationPipe(DTO.UpdateAcademicCycleSchema)) b: DTO.UpdateAcademicCycleDTO) {
    const result = await this.updateCycleUC.execute(uuid, b);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.toCycleResponse(result.unwrap()) };
  }

  @Delete('academic-cycles/:uuid') @Roles('ROOT', { module: 'COURSES', action: '*' }) @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCycle(@Param('uuid') uuid: string) {
    await this.deleteCycleUC.execute(uuid);
  }

  @Patch('academic-cycles/:uuid/toggle-active') @Roles('ROOT', { module: 'COURSES', action: '*' })
  async toggleActive(@Param('uuid') uuid: string) {
    const result = await this.toggleCycleUC.execute(uuid);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.toCycleResponse(result.unwrap()) };
  }

  private toCycleResponse(c: AcademicCycle) {
    return {
      uuid: c.uuid,
      code: c.code.get ? c.code.get() : c.code,
      name: c.name,

      level: c.level,
      modality: c.modality,
      startDate: c.startDate instanceof Date ? c.startDate.toISOString() : c.startDate,
      endDate: c.endDate instanceof Date ? c.endDate.toISOString() : c.endDate,
      active: c.active,
      firstBimonthStart: c.firstBimonth?.start ? (c.firstBimonth.start instanceof Date ? c.firstBimonth.start.toISOString() : c.firstBimonth.start) : null,
      firstBimonthEnd: c.firstBimonth?.end ? (c.firstBimonth.end instanceof Date ? c.firstBimonth.end.toISOString() : c.firstBimonth.end) : null,
      secondBimonthStart: c.secondBimonth?.start ? (c.secondBimonth.start instanceof Date ? c.secondBimonth.start.toISOString() : c.secondBimonth.start) : null,
      secondBimonthEnd: c.secondBimonth?.end ? (c.secondBimonth.end instanceof Date ? c.secondBimonth.end.toISOString() : c.secondBimonth.end) : null,
      thirdBimonthStart: c.thirdBimonth?.start ? (c.thirdBimonth.start instanceof Date ? c.thirdBimonth.start.toISOString() : c.thirdBimonth.start) : null,
      thirdBimonthEnd: c.thirdBimonth?.end ? (c.thirdBimonth.end instanceof Date ? c.thirdBimonth.end.toISOString() : c.thirdBimonth.end) : null,
      fourthBimonthStart: c.fourthBimonth?.start ? (c.fourthBimonth.start instanceof Date ? c.fourthBimonth.start.toISOString() : c.fourthBimonth.start) : null,
      fourthBimonthEnd: c.fourthBimonth?.end ? (c.fourthBimonth.end instanceof Date ? c.fourthBimonth.end.toISOString() : c.fourthBimonth.end) : null,
    };
  }

  // ── Subjects ───────────────────────────────────────
  @Post('subjects') @Roles('ROOT', { module: 'SUBJECTS', action: 'CREATE' })
  async postSubject(@Body(new ZodValidationPipe(DTO.CreateSubjectSchema)) b: DTO.CreateSubjectDTO) { const r = await this.createSubjUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const s = r.unwrap(); return { data: { id: s.id.get(), name: s.name, level: s.level.toCode() } }; }

  @Get('subjects') @Roles('ROOT', { module: 'SUBJECTS', action: 'READ' })
  async getSubjects(@Query('institutionId') iid: string, @Query('level') l?: string) { const subjects = await this.listSubjUC.execute(iid, l); return { data: subjects.map((s) => ({ id: s.id.get(), name: s.name, level: s.level.toCode() })) }; }

  @Delete('subjects/:id') @Roles('ROOT', { module: 'SUBJECTS', action: 'DELETE' }) @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSubject(@Param('id') id: string) { await this.deleteSubjUC.execute(id); }

  @Patch('subjects/:id') @Roles('ROOT', { module: 'SUBJECTS', action: 'UPDATE' })
  async patchSubject(@Param('id') id: string, @Body(new ZodValidationPipe(DTO.UpdateSubjectSchema)) b: DTO.UpdateSubjectDTO) { const r = await this.updateSubjUC.execute(id, b); if (r.isErr()) throw r.unwrapErr(); const s = r.unwrap(); if (!s) return { data: null }; return { data: { id: s.id.get(), name: s.name, level: s.level.toCode() } }; }

  // ── Course Sections ────────────────────────────────
  @Post('course-sections') @Roles('ROOT', { module: 'COURSES', action: 'CREATE' })
  async postSection(@Body(new ZodValidationPipe(DTO.CreateCourseSectionSchema)) b: DTO.CreateCourseSectionDTO) { const r = await this.createSecUC.execute(b); if (r.isErr()) throw new HttpException({ error: { message: r.unwrapErr().message } }, HttpStatus.BAD_REQUEST); const s = r.unwrap(); return { data: { id: s.id.get(), name: s.name, level: s.level.toCode(), academicYear: s.academicYear } }; }

  @Get('course-sections') @Roles('ROOT', { module: 'COURSES', action: 'READ' })
  async getSections(@Query('institutionId') iid: string, @Query('level') l: string, @Query('academicYear') ay: string) { const sections = await this.listSecUC.execute(iid, l, ay); return { data: sections.map((s) => ({ id: s.id.get(), name: s.name, grade: s.grade, division: s.division, level: s.level.toCode(), academicYear: s.academicYear })) }; }

  @Delete('course-sections/:id') @Roles('ROOT', { module: 'COURSES', action: 'DELETE' }) @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSection(@Param('id') id: string) { await this.deleteSecUC.execute(id); }

  @Patch('course-sections/:id') @Roles('ROOT', { module: 'COURSES', action: 'UPDATE' })
  async patchSection(@Param('id') id: string, @Body(new ZodValidationPipe(DTO.UpdateCourseSectionSchema)) b: DTO.UpdateCourseSectionDTO) { const r = await this.updateSecUC.execute(id, b); if (r.isErr()) throw r.unwrapErr(); const s = r.unwrap(); if (!s) return { data: null }; return { data: { id: s.id.get(), name: s.name, grade: s.grade, division: s.division, level: s.level.toCode(), academicYear: s.academicYear } }; }

  // ── Subject Assignments ────────────────────────────
  @Post('subject-assignments') @Roles('ROOT', { module: 'COURSES', action: 'CREATE' })
  async postAssign(@Body(new ZodValidationPipe(DTO.CreateSubjectAssignmentSchema)) b: DTO.CreateSubjectAssignmentDTO) { const r = await this.createAssignUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const a = r.unwrap(); return { data: { id: a.id.get(), subjectId: a.subjectId, teacherId: a.teacherId, courseSectionId: a.courseSectionId } }; }

  @Get('subject-assignments') @Roles('ROOT', { module: 'COURSES', action: 'READ' })
  async getAssigns(@Query('courseSectionId') csid: string, @Query('teacherId') tid: string) { if (csid) { const a = await this.listAssignUC.executeByCourse(csid); return { data: a.map(x => ({ id: x.id.get(), subjectId: x.subjectId, teacherId: x.teacherId, courseSectionId: x.courseSectionId })) }; } if (tid) { const a = await this.listAssignUC.executeByTeacher(tid); return { data: a.map(x => ({ id: x.id.get(), subjectId: x.subjectId, teacherId: x.teacherId, courseSectionId: x.courseSectionId })) }; } return { data: [] }; }

  @Delete('subject-assignments/:id') @Roles('ROOT', { module: 'COURSES', action: 'DELETE' }) @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAssign(@Param('id') id: string) { await this.deleteAssignUC.execute(id); }

  // ── Evaluaciones ────────────────────────────────────
  @Post('evaluaciones') @Roles('ROOT', { module: 'GRADES', action: 'CREATE' })
  async postEvaluacion(@Body(new ZodValidationPipe(DTO.CreateEvaluacionSchema)) b: DTO.CreateEvaluacionDTO) { const r = await this.createEvaluacionUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const e = r.unwrap(); return { data: { id: e.id.get(), title: e.title, evaluationDate: e.evaluationDate.toISOString(), weight: e.weight } }; }

  @Get('evaluaciones') @Roles('ROOT', { module: 'GRADES', action: 'READ' })
  async getEvaluaciones(@Query('assignmentId') aid: string) { if (aid) { const e = await this.listEvaluacionesUC.execute(aid); return { data: e.map(x => ({ id: x.id.get(), title: x.title, evaluationDate: x.evaluationDate.toISOString(), weight: x.weight })) }; } return { data: [] }; }

  @Delete('evaluaciones/:id') @Roles('ROOT', { module: 'GRADES', action: 'DELETE' }) @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEvaluacion(@Param('id') id: string) { await this.deleteEvaluacionUC.execute(id); }

  // ── Notas ───────────────────────────────────────────
  @Post('notas') @Roles('ROOT', { module: 'GRADES', action: 'CREATE' })
  async postNota(@Body(new ZodValidationPipe(DTO.CreateNotaSchema)) b: DTO.CreateNotaDTO) { const r = await this.createNotaUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const n = r.unwrap(); return { data: { id: n.id.get(), evaluationId: n.evaluationId, studentId: n.studentId, numericValue: n.numericValue, qualitativeValue: n.qualitativeValue, gradeCode: n.gradeCode, gradeLabel: n.gradeLabel, isApproved: n.isApproved } }; }

  @Get('notas') @Roles('ROOT', { module: 'GRADES', action: 'READ' })
  async getNotas(@Query('evaluationId') eid: string, @Query('studentId') sid: string) { if (eid) { const n = await this.listNotasUC.executeByEvaluation(eid); return { data: n.map(x => ({ id: x.id.get(), studentId: x.studentId, numericValue: x.numericValue, qualitativeValue: x.qualitativeValue, comments: x.comments, gradeCode: x.gradeCode, gradeLabel: x.gradeLabel, isApproved: x.isApproved })) }; } if (sid) { const n = await this.listNotasUC.executeByStudent(sid); return { data: n.map(x => ({ id: x.id.get(), evaluationId: x.evaluationId, numericValue: x.numericValue, qualitativeValue: x.qualitativeValue, gradeCode: x.gradeCode, gradeLabel: x.gradeLabel })) }; } return { data: [] }; }

  @Delete('notas/:id') @Roles('ROOT', { module: 'GRADES', action: 'DELETE' }) @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNota(@Param('id') id: string) { await this.deleteNotaUC.execute(id); }

  // ── Periodos ────────────────────────────────────────
  @Post('periodos') @Roles('ROOT', { module: 'GRADES', action: 'CREATE' })
  async postPeriodo(@Body(new ZodValidationPipe(DTO.CreatePeriodoSchema)) b: DTO.CreatePeriodoDTO) { const r = await this.createPeriodoUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const p = r.unwrap(); return { data: { id: p.id.get(), name: p.name, academicYear: p.academicYear, startDate: p.startDate.toISOString(), endDate: p.endDate.toISOString() } }; }

  @Get('periodos') @Roles('ROOT', { module: 'GRADES', action: 'READ' })
  async getPeriodos(@Query('academicYear') ay: string) { if (ay) { const p = await this.listPeriodosUC.execute(ay); return { data: p.map(x => ({ id: x.id.get(), name: x.name, academicYear: x.academicYear, startDate: x.startDate.toISOString(), endDate: x.endDate.toISOString() })) }; } return { data: [] }; }

  @Delete('periodos/:id') @Roles('ROOT', { module: 'GRADES', action: 'DELETE' }) @HttpCode(HttpStatus.NO_CONTENT)
  async deletePeriodo(@Param('id') id: string) { await this.deletePeriodoUC.execute(id); }

  // ── Notas Trimestrales ──────────────────────────────
  @Post('notas-trimestrales') @Roles('ROOT', { module: 'GRADES', action: 'CREATE' })
  async postNotaTrimestral(@Body(new ZodValidationPipe(DTO.CreateNotaTrimestralSchema)) b: DTO.CreateNotaTrimestralDTO) {
    const r = await this.createNotaTrimestralUC.execute(b);
    if (r.isErr()) throw r.unwrapErr();
    const n = r.unwrap();
    // Invalidate cached PDF boletín for this student — grade data changed
    await this.boletinInvalidation.invalidateForStudent(n.studentId);
    return { data: { id: n.id.get(), studentId: n.studentId, assignmentId: n.assignmentId, periodId: n.periodId, finalGrade: n.finalGrade, attendancePct: n.attendancePct } };
  }

  @Get('notas-trimestrales') @Roles('ROOT', { module: 'GRADES', action: 'READ' })
  async getNotasTrimestrales(@Query('studentId') sid: string, @Query('periodId') pid: string) { if (sid && pid) { const n = await this.listNotasTrimestralesUC.execute(sid, pid); return { data: n.map(x => ({ id: x.id.get(), assignmentId: x.assignmentId, finalGrade: x.finalGrade, attendancePct: x.attendancePct })) }; } return { data: [] }; }

  @Delete('notas-trimestrales/:id') @Roles('ROOT', { module: 'GRADES', action: 'DELETE' }) @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotaTrimestral(@Param('id') id: string) {
    // Resolve studentId before deletion so we can invalidate the PDF
    const client = TenantContext.getClient();
    if (client) {
      const nota = await client.notaTrimestral.findUnique({ where: { id }, select: { studentId: true } });
      if (nota) await this.boletinInvalidation.invalidateForStudent(nota.studentId);
    }
    await this.deleteNotaTrimestralUC.execute(id);
  }

  // ── Attendance ─────────────────────────────────────
  @Post('attendance') @Roles('ROOT', { module: 'ATTENDANCE', action: 'CREATE' })
  async postAttendance(@Body(new ZodValidationPipe(DTO.CreateAttendanceSchema)) b: DTO.CreateAttendanceDTO) { const r = await this.createAttUC.execute(b); if (r.isErr()) throw r.unwrapErr(); const a = r.unwrap(); return { data: { id: a.id.get(), studentId: a.studentId, status: a.status, statusDescription: a.statusDescription, isPresent: a.isPresent } }; }

  @Get('attendance') @Roles('ROOT', { module: 'ATTENDANCE', action: 'READ' })
  async getAttendance(@Query('courseSectionId') csid: string, @Query('date') d: string, @Query('studentId') sid: string) { if (csid && d) { const a = await this.listAttUC.executeByCourseDate(csid, d); return { data: a.map(x => ({ id: x.id.get(), studentId: x.studentId, status: x.status, statusDescription: x.statusDescription, isPresent: x.isPresent, note: x.note })) }; } if (sid) { const a = await this.listAttUC.executeByStudent(sid); return { data: a.map(x => ({ id: x.id.get(), date: x.date.toISOString(), status: x.status, statusDescription: x.statusDescription })) }; } return { data: [] }; }

  @Delete('attendance/:id') @Roles('ROOT', { module: 'ATTENDANCE', action: 'DELETE' }) @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAttendance(@Param('id') id: string) { await this.deleteAttUC.execute(id); }

  // ── Study Plans ─────────────────────────────────────
  @Post('study-plans') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'CREATE' })
  async createPlan(@Body(new ZodValidationPipe(DTO.CreateStudyPlanSchema)) b: DTO.CreateStudyPlanDTO) { const r = await this.createPlanUC.execute(b); if (r.isErr()) throw new HttpException({ error: { message: r.unwrapErr().message } }, HttpStatus.BAD_REQUEST); const p = r.unwrap(); return { data: { id: p.id.get(), name: p.name, level: p.level, academicYear: p.academicYear } }; }

  @Get('study-plans') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'READ' })
  async listPlans(@Query('level') l?: string) {
    const institutionId = TenantContext.getInstitutionId();
    const plans = await this.listPlansUC.execute(l ? parseInt(l, 10) : undefined);
    return {
      data: plans.map((p) => ({
        id: p.id.get(),
        name: p.name,
        level: p.level,
        modality: p.modality,
        academicYear: p.academicYear,
        active: p.active,
        institutionId: institutionId ?? undefined,
      })),
    };
  }

  @Get('study-plans/:id') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'READ' })
  async getPlan(@Param('id') id: string) {
    const p = await this.getPlanUC.execute(id);
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
        institutionId: TenantContext.getInstitutionId() ?? undefined,
        courses: planCourses.map((c) => ({
          id: c.id,
          courseSectionId: c.courseSectionId,
          courseSectionName: c.courseSectionName,
          studyPlanId: c.studyPlanId,
          subjectCount: c.subjects?.length ?? 0,
          subjects: c.subjects?.map((s) => ({
            id: s.id,
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            hoursPerWeek: s.hoursPerWeek,
          })) ?? [],
        })),
      },
    };
  }

  @Patch('study-plans/:id') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'UPDATE' })
  async updatePlan(@Param('id') id: string, @Body(new ZodValidationPipe(DTO.UpdateStudyPlanSchema)) b: DTO.UpdateStudyPlanDTO) { const r = await this.updatePlanUC.execute(id, b); if (r.isErr()) throw r.unwrapErr(); const p = r.unwrap(); if (!p) return { data: null }; return { data: { id: p.id.get(), name: p.name, academicYear: p.academicYear, active: p.active } }; }

  @Delete('study-plans/:id') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'DELETE' }) @HttpCode(HttpStatus.NO_CONTENT)
  async deletePlan(@Param('id') id: string) { await this.deletePlanUC.execute(id); }

  // ── Plan Courses ───────────────────────────────────
  @Get('study-plans/:id/courses') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'READ' })
  async listPlanCourses(@Param('id') id: string) {
    const courses = await this.listPlanCoursesUC.execute(id);
    return { data: courses.map((c) => ({ id: c.id, courseSectionId: c.courseSectionId, courseSectionName: c.courseSectionName, courseGrade: c.courseGrade, courseDivision: c.courseDivision, studyPlanId: c.studyPlanId, subjectCount: c.subjects?.length ?? 0 })) };
  }

  @Post('study-plans/:id/courses') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'UPDATE' })
  async addCourseToPlan(@Param('id') id: string, @Body(new ZodValidationPipe(DTO.AddCourseToPlanSchema)) b: DTO.AddCourseToPlanDTO) {
    const r = await this.addCourseUC.execute(id, b.courseSectionId);
    if (r.isErr()) throw new HttpException({ error: { message: r.unwrapErr().message } }, HttpStatus.BAD_REQUEST);
    return { data: { ok: true } };
  }

  @Delete('study-plans/:id/courses/:courseId') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'UPDATE' }) @HttpCode(HttpStatus.NO_CONTENT)
  async removeCourseFromPlan(@Param('id') id: string, @Param('courseId') courseId: string) { await this.removeCourseUC.execute(id, courseId); }

  // ── Plan Course Subjects ───────────────────────────
  @Get('study-plan-courses/:id') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'READ' })
  async getPlanCourseDetail(@Param('id') id: string) {
    const detail = await this.getPlanCourseUC.execute(id);
    if (!detail) return { data: null };
    return { data: { id: detail.id, studyPlanId: detail.studyPlanId, courseSectionId: detail.courseSectionId } };
  }

  @Get('study-plan-courses/:id/subjects') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'READ' })
  async listPlanCourseSubjects(@Param('id') id: string) {
    const detail = await this.getPlanCourseUC.execute(id);
    if (!detail) return { data: [] };
    return { data: (detail.subjects || []).map((s) => ({
      id: s.id,
      subjectId: s.subjectId,
      subjectName: s.subjectName || null,
      hoursPerWeek: s.hoursPerWeek ?? null,
    })) };
  }

  @Post('study-plan-courses/:id/subjects') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'UPDATE' })
  async addSubjectToPlanCourse(@Param('id') id: string, @Body(new ZodValidationPipe(DTO.AddSubjectToPlanCourseSchema)) b: DTO.AddSubjectToPlanCourseDTO) {
    const r = await this.addSubjectUC.execute(id, b.subjectId, b.hoursPerWeek);
    if (r.isErr()) throw new HttpException({ error: { message: r.unwrapErr().message } }, HttpStatus.BAD_REQUEST);
    return { data: { ok: true } };
  }

  @Delete('study-plan-courses/:id/subjects/:subjectId') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'UPDATE' }) @HttpCode(HttpStatus.NO_CONTENT)
  async removeSubjectFromPlanCourse(@Param('id') id: string, @Param('subjectId') subjectId: string) { await this.removeSubjectUC.execute(id, subjectId); }

  // ── Subject Competencies ────────────────────────────

  @Post('subject-competencies') @Roles('ROOT', { module: 'COURSES', action: '*' })
  async createCompetency(@Body(new ZodValidationPipe(CDTO.CreateSubjectCompetencySchema)) b: CDTO.CreateSubjectCompetencyDTO) {
    const r = await this.createCompUC.execute(b);
    if (r.isErr()) throw new HttpException(r.unwrapErr().message, HttpStatus.CONFLICT);
    const c = r.unwrap();
    return { data: { uuid: c.id.get(), subjectId: c.subjectId, name: c.name, periodActive: c.periodActive, active: c.active } };
  }

  @Get('subject-competencies') @Roles('ROOT', { module: 'COURSES', action: 'READ' })
  async listCompetencies(@Query('subjectId') subjectId: string, @Query('active') active?: string) {
    if (!subjectId) throw new HttpException('subjectId es requerido', HttpStatus.UNPROCESSABLE_ENTITY);
    const activeFilter = active === 'true' ? true : active === 'false' ? false : undefined;
    const competencies = await this.listCompUC.execute(subjectId, activeFilter);
    return { data: competencies.map((c) => ({ uuid: c.id.get(), subjectId: c.subjectId, name: c.name, periodActive: c.periodActive, active: c.active })) };
  }

  @Get('subject-competencies/:uuid') @Roles('ROOT', { module: 'COURSES', action: 'READ' })
  async getCompetency(@Param('uuid') uuid: string) {
    const c = await this.getCompUC.execute(uuid);
    if (!c) throw new HttpException('Competencia no encontrada', HttpStatus.NOT_FOUND);
    return { data: { uuid: c.id.get(), subjectId: c.subjectId, name: c.name, periodActive: c.periodActive, active: c.active } };
  }

  @Patch('subject-competencies/:uuid') @Roles('ROOT', { module: 'COURSES', action: '*' })
  async updateCompetency(@Param('uuid') uuid: string, @Body(new ZodValidationPipe(CDTO.UpdateSubjectCompetencySchema)) b: CDTO.UpdateSubjectCompetencyDTO) {
    const r = await this.updateCompUC.execute(uuid, b);
    if (r.isErr()) throw new HttpException(r.unwrapErr().message, HttpStatus.UNPROCESSABLE_ENTITY);
    const c = r.unwrap();
    return { data: { uuid: c.id.get(), subjectId: c.subjectId, name: c.name, periodActive: c.periodActive, active: c.active } };
  }

  @Delete('subject-competencies/:uuid') @Roles('ROOT', { module: 'COURSES', action: '*' }) @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCompetency(@Param('uuid') uuid: string) {
    await this.deleteCompUC.execute(uuid);
  }

  // ── Competency Valuations ───────────────────────────

  @Get('competency-valuations') @Roles('ROOT', { module: 'COURSES', action: 'READ' })
  async listValuations(@Query('studentId') studentId: string, @Query('subjectId') subjectId: string) {
    if (!studentId || !subjectId) throw new HttpException('studentId y subjectId son requeridos', HttpStatus.UNPROCESSABLE_ENTITY);
    const vals = await this.listValUC.execute(studentId, subjectId);
    return { data: vals.map((v) => this.toValuationResponse(v)) };
  }

  @Get('competency-valuations/:uuid') @Roles('ROOT', { module: 'COURSES', action: 'READ' })
  async getValuation(@Param('uuid') uuid: string) {
    const r = await this.getValUC.execute(uuid);
    if (r.isErr()) throw new HttpException(r.unwrapErr().message, HttpStatus.NOT_FOUND);
    return { data: this.toValuationResponse(r.unwrap()) };
  }

  @Patch('competency-valuations/:uuid') @Roles('ROOT', { module: 'COURSES', action: '*' })
  async updateValuation(@Param('uuid') uuid: string, @Body(new ZodValidationPipe(CDTO.UpdateCompetencyValuationSchema)) b: CDTO.UpdateCompetencyValuationDTO) {
    const r = await this.updateValUC.execute(uuid, b as Record<string, unknown>);
    if (r.isErr()) throw new HttpException(r.unwrapErr().message, HttpStatus.UNPROCESSABLE_ENTITY);
    return { data: this.toValuationResponse(r.unwrap()) };
  }

  private toValuationResponse(v: import('@educandow/domain').CompetencyValuation) {
    return {
      uuid: v.id.get(),
      competencyId: v.competencyId,
      studentId: v.studentId,
      valuation1: v.valuation1,
      valuation2: v.valuation2,
      valuation3: v.valuation3,
      valuation4: v.valuation4,
      modificable1: v.modificable1,
      modificable2: v.modificable2,
      modificable3: v.modificable3,
      modificable4: v.modificable4,
      imprimible1: v.imprimible1,
      imprimible2: v.imprimible2,
      imprimible3: v.imprimible3,
      imprimible4: v.imprimible4,
      periodActive: v.periodActive,
    };
  }
}
