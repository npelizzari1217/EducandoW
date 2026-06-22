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
import { StudyPlanHasDependenciesError, NotFoundError, CompetenciaXMateriaXAlumnoXCursoXCicloNotFoundError, ValueNotFoundError } from '@educandow/domain';
import type { CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo } from '@educandow/domain';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class PedagogyController {

  constructor(
    private createSubjUC: UC.CreateSubjectUC, private listSubjUC: UC.ListSubjectsUC, private deleteSubjUC: UC.DeleteSubjectUC, private updateSubjUC: UC.UpdateSubjectUC,
    private createSecUC: UC.CreateCourseSectionUC, private listSecUC: UC.ListCourseSectionsUC, private deleteSecUC: UC.DeleteCourseSectionUC, private updateSecUC: UC.UpdateCourseSectionUC,
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
    private copyCompUC: CUC.CopySubjectCompetenciesUC,
    private listValUC: CUC.ListCompetenciasXMateriaXAlumnoXCursoXCicloUC, private getValUC: CUC.GetCompetenciaXMateriaXAlumnoXCursoXCicloUC,
    private listBulkValUC: CUC.ListBulkCompetenciasXMateriaXAlumnoXCursoXCicloUC,
    private gradePeriodUC: CUC.GradePeriodValuationUC,
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

      level: c.level.code,
      modality: c.modality.code,
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

  // ── Study Plans ─────────────────────────────────────
  @Post('study-plans') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'CREATE' })
  async createPlan(@Body(new ZodValidationPipe(DTO.CreateStudyPlanSchema)) b: DTO.CreateStudyPlanDTO) { const r = await this.createPlanUC.execute(b); if (r.isErr()) throw new HttpException({ error: { message: r.unwrapErr().message } }, HttpStatus.BAD_REQUEST); const p = r.unwrap(); return { data: { id: p.id.get(), name: p.name, level: p.level, cycleUuid: p.cycleUuid ?? null } }; }

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
        cycleUuid: p.cycleUuid ?? null,
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
        cycleUuid: p.cycleUuid ?? null,
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
            esOptativa: s.esOptativa,
          })) ?? [],
        })),
      },
    };
  }

  @Patch('study-plans/:id') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'UPDATE' })
  async updatePlan(@Param('id') id: string, @Body(new ZodValidationPipe(DTO.UpdateStudyPlanSchema)) b: DTO.UpdateStudyPlanDTO) { const r = await this.updatePlanUC.execute(id, b); if (r.isErr()) throw r.unwrapErr(); const p = r.unwrap(); if (!p) return { data: null }; return { data: { id: p.id.get(), name: p.name, cycleUuid: p.cycleUuid ?? null, active: p.active, level: p.level, modality: p.modality } }; }

  @Delete('study-plans/:id') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'DELETE' }) @HttpCode(HttpStatus.NO_CONTENT)
  async deletePlan(@Param('id') id: string) {
    const r = await this.deletePlanUC.execute(id);
    if (r.isErr()) {
      const e = r.unwrapErr();
      if (e instanceof StudyPlanHasDependenciesError) {
        throw new HttpException(
          { error: { message: e.message, code: e.code, details: { courseCount: e.courseCount, courseCycleCount: e.courseCycleCount } } },
          HttpStatus.CONFLICT,
        );
      }
      throw new HttpException({ error: { message: e.message, code: e.code } }, HttpStatus.BAD_REQUEST);
    }
  }

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
      esOptativa: s.esOptativa ?? false,
    })) };
  }

  @Post('study-plan-courses/:id/subjects') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'UPDATE' })
  async addSubjectToPlanCourse(@Param('id') id: string, @Body(new ZodValidationPipe(DTO.AddSubjectToPlanCourseSchema)) b: DTO.AddSubjectToPlanCourseDTO) {
    const r = await this.addSubjectUC.execute(id, b.subjectId, b.hoursPerWeek, b.esOptativa);
    if (r.isErr()) throw new HttpException({ error: { message: r.unwrapErr().message } }, HttpStatus.BAD_REQUEST);
    return { data: { ok: true } };
  }

  @Delete('study-plan-courses/:id/subjects/:subjectId') @Roles('ROOT', { module: 'STUDY_PLANS', action: 'UPDATE' }) @HttpCode(HttpStatus.NO_CONTENT)
  async removeSubjectFromPlanCourse(@Param('id') id: string, @Param('subjectId') subjectId: string) { await this.removeSubjectUC.execute(id, subjectId); }

  // ── Subject Competencies ────────────────────────────

  @Post('subject-competencies') @Roles('ROOT', { module: 'COURSES', action: '*' })
  async createCompetency(@Body(new ZodValidationPipe(CDTO.CreateSubjectCompetencySchema)) b: CDTO.CreateSubjectCompetencyDTO) {
    const r = await this.createCompUC.execute(b);
    if (r.isErr()) throw new HttpException(r.unwrapErr().message, HttpStatus.BAD_REQUEST);
    const c = r.unwrap();
    return { data: { uuid: c.id.get(), studyPlanSubjectId: c.studyPlanSubjectId, name: c.name, active: c.active } };
  }

  @Get('subject-competencies') @Roles('ROOT', { module: 'COURSES', action: 'READ' })
  async listCompetencies(@Query('studyPlanSubjectId') studyPlanSubjectId: string) {
    if (!studyPlanSubjectId) throw new HttpException('studyPlanSubjectId es requerido', HttpStatus.BAD_REQUEST);
    const competencies = await this.listCompUC.execute(studyPlanSubjectId);
    return { data: competencies.map((c) => ({ uuid: c.id.get(), studyPlanSubjectId: c.studyPlanSubjectId, name: c.name, active: c.active })) };
  }

  // IMPORTANT: /copy must be declared before /:uuid to avoid NestJS treating "copy" as a param
  @Post('subject-competencies/copy') @Roles('ROOT', { module: 'COURSES', action: '*' })
  async copyCompetencies(@Body(new ZodValidationPipe(CDTO.CopySubjectCompetenciesSchema)) b: CDTO.CopySubjectCompetenciesDTO) {
    const r = await this.copyCompUC.execute(b);
    if (r.isErr()) throw new HttpException({ error: { message: r.unwrapErr().message } }, HttpStatus.BAD_REQUEST);
    return { data: r.unwrap() };
  }

  @Get('subject-competencies/:uuid') @Roles('ROOT', { module: 'COURSES', action: 'READ' })
  async getCompetency(@Param('uuid') uuid: string) {
    const c = await this.getCompUC.execute(uuid);
    if (!c) throw new HttpException('Competencia no encontrada', HttpStatus.NOT_FOUND);
    return { data: { uuid: c.id.get(), studyPlanSubjectId: c.studyPlanSubjectId, name: c.name, active: c.active } };
  }

  @Patch('subject-competencies/:uuid') @Roles('ROOT', { module: 'COURSES', action: '*' })
  async updateCompetency(@Param('uuid') uuid: string, @Body(new ZodValidationPipe(CDTO.UpdateSubjectCompetencySchema)) b: CDTO.UpdateSubjectCompetencyDTO) {
    const r = await this.updateCompUC.execute(uuid, b);
    if (r.isErr()) {
      const error = r.unwrapErr();
      if (error instanceof NotFoundError) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
    const c = r.unwrap();
    return { data: { uuid: c.id.get(), studyPlanSubjectId: c.studyPlanSubjectId, name: c.name, active: c.active } };
  }

  @Delete('subject-competencies/:uuid') @Roles('ROOT', { module: 'COURSES', action: '*' }) @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCompetency(@Param('uuid') uuid: string) {
    await this.deleteCompUC.execute(uuid);
  }

  // ── Competency Valuations ───────────────────────────

  @Get('competency-valuations') @Roles('ROOT', { module: 'COURSES', action: 'READ' })
  async listValuations(
    @Query('studentId') studentId: string,
    @Query('studyPlanSubjectId') studyPlanSubjectId: string,
    @Query('courseCycleId') courseCycleId: string,
  ) {
    // ── Bulk-read branch (PR slice 1a): courseCycleId acts as discriminator ──
    if (courseCycleId) {
      if (!studyPlanSubjectId) {
        throw new HttpException(
          { error: { message: 'courseCycleId y studyPlanSubjectId son requeridos juntos' } },
          HttpStatus.BAD_REQUEST,
        );
      }
      const rows = await this.listBulkValUC.execute({ courseCycleId, studyPlanSubjectId });
      return {
        data: rows.map((row) => ({
          valuationId:      row.valuationId,
          studentId:        row.studentId,
          competencyId:     row.competencyId,
          periodValuations: row.periodValuations,
        })),
      };
    }

    // ── Legacy branch: studentId + studyPlanSubjectId ──
    if (!studentId || !studyPlanSubjectId) throw new HttpException('studentId y studyPlanSubjectId son requeridos', HttpStatus.BAD_REQUEST);
    const vals = await this.listValUC.execute(studentId, studyPlanSubjectId);
    return { data: vals.map((v) => this.toValuationResponse(v)) };
  }

  @Get('competency-valuations/:uuid') @Roles('ROOT', { module: 'COURSES', action: 'READ' })
  async getValuation(@Param('uuid') uuid: string) {
    const r = await this.getValUC.execute(uuid);
    if (r.isErr()) throw new HttpException(r.unwrapErr().message, HttpStatus.NOT_FOUND);
    return { data: this.toValuationResponse(r.unwrap()) };
  }

  // IMPORTANT: PATCH /:uuid/periods/:periodItemId is a nested sub-resource on competency-valuations.
  // It must be declared here (after GET /:uuid) with a distinct HTTP method — no route collision.
  @Patch('competency-valuations/:uuid/periods/:periodItemId')
  @Roles('ROOT', { module: 'COURSES', action: '*' })
  async gradePeriod(
    @Param('uuid') uuid: string,
    @Param('periodItemId') periodItemId: string,
    @Body(new ZodValidationPipe(CDTO.UpdatePeriodGradeSchema)) body: CDTO.UpdatePeriodGradeDto,
  ) {
    // Pre-resolve studentId for boletin invalidation
    const client = TenantContext.getClient();
    let studentId: string | undefined;
    if (client) {
      const v = await client.competenciaXMateriaXAlumnoXCursoXCiclo.findUnique({
        where: { id: uuid },
        select: { studentId: true },
      });
      studentId = v?.studentId ?? undefined;
    }

    const result = await this.gradePeriodUC.execute({
      valuationUuid: uuid,
      periodItemId,
      gradeScaleValueId: body.gradeScaleValueId,
      imprimible: body.imprimible,
    });

    if (result.isErr()) {
      const e = result.unwrapErr();
      if (e instanceof CompetenciaXMateriaXAlumnoXCursoXCicloNotFoundError || e instanceof ValueNotFoundError) {
        throw new HttpException({ error: { message: e.message, code: e.code } }, HttpStatus.NOT_FOUND);
      }
      throw new HttpException({ error: { message: e.message, code: e.code } }, HttpStatus.BAD_REQUEST);
    }

    // Invalidate cached PDF boletín for this student — grade data changed
    if (studentId) {
      await this.boletinInvalidation.invalidateForStudent(studentId);
    }

    return { data: this.toPeriodValuationResponse(result.unwrap()) };
  }

  private toValuationResponse(v: import('@educandow/domain').CompetenciaXMateriaXAlumnoXCursoXCiclo) {
    return {
      uuid: v.id.get(),
      competencyId: v.competencyId,
      studentId: v.studentId,
      courseCycleId: v.courseCycleId,
    };
  }

  private toPeriodValuationResponse(child: CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo) {
    return {
      id: child.id,
      valuationId: child.valuationId,
      periodItemId: child.periodItemId,
      gradeScaleValueId: child.gradeScaleValueId,
      gradeCode: child.gradeCode,
      internalStatus: child.internalStatus,
      modificable: child.modificable,
      imprimible: child.imprimible,
    };
  }
}
