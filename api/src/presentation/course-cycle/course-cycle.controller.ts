import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { RankGuard } from '../../infrastructure/auth/guards/rank.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { Rank } from '../../infrastructure/auth/decorators/rank.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../infrastructure/auth/guards/auth.guard';
import { resolveAccessScope } from '@educandow/domain';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  CreateCourseCycleSchema,
  CreateCourseCycleDto,
  UpdateCourseCycleSchema,
  UpdateCourseCycleDto,
  GenerateCourseCyclesSchema,
  GenerateCourseCyclesDto,
  CourseCycleListQuerySchema,
  CourseCycleListQueryDto,
} from './dto/course-cycle.dto';
import {
  SetGradingPeriodSchema,
  SetGradingPeriodDto,
} from './dto/grading-period.dto';
import {
  SetGradingPhaseSchema,
  SetGradingPhaseDto,
} from './dto/grading-phase.dto';
import {
  TeacherCCListQuerySchema,
  TeacherCCListQueryDto,
  TeacherSubjectsQuerySchema,
  TeacherSubjectsQueryDto,
} from '../grading/dto/subject-grades.dto';
import {
  CreateCourseCycleUseCase,
  UpdateCourseCycleUseCase,
  DeleteCourseCycleUseCase,
  ToggleCourseCycleActiveUseCase,
  GetCourseCycleUseCase,
  ListCourseCyclesUseCase,
  GenerateCourseCyclesUseCase,
  ListStudentsByCourseCycleUC,
} from '../../application/course-cycle/use-cases/course-cycle.use-cases';
import {
  GetActivePeriodUseCase,
  SetActivePeriodUseCase,
} from '../../application/course-cycle/use-cases/grading-period.use-cases';
import {
  GetGradingPhaseUseCase,
  SetGradingPhaseUseCase,
} from '../../application/course-cycle/use-cases/grading-phase.use-cases';
import { ListTeacherCourseCyclesUseCase } from '../../application/grading/list-teacher-course-cycles.use-case';
import { ListTeacherSubjectsInCourseCycleUseCase } from '../../application/grading/list-teacher-subjects-in-course-cycle.use-case';
import { ListAdminSubjectsInCourseCycleUseCase } from '../../application/grading/list-admin-subjects-in-course-cycle.use-case';

@Controller('course-cycles')
@UseGuards(AuthGuard, RolesGuard, RankGuard)
export class CourseCycleController {
  constructor(
    private readonly createUC: CreateCourseCycleUseCase,
    private readonly updateUC: UpdateCourseCycleUseCase,
    private readonly deleteUC: DeleteCourseCycleUseCase,
    private readonly toggleUC: ToggleCourseCycleActiveUseCase,
    private readonly getUC: GetCourseCycleUseCase,
    private readonly listUC: ListCourseCyclesUseCase,
    private readonly generateUC: GenerateCourseCyclesUseCase,
    private readonly getGradingPeriodUC: GetActivePeriodUseCase,
    private readonly setGradingPeriodUC: SetActivePeriodUseCase,
    private readonly listStudentsUC: ListStudentsByCourseCycleUC,
    // PR4-T19 + PR4a-SEC W1: teacher-filter use cases (required — module always wires them)
    private readonly listTeacherCCsUC: ListTeacherCourseCyclesUseCase,
    private readonly listTeacherSubjectsUC: ListTeacherSubjectsInCourseCycleUseCase,
    private readonly listAdminSubjectsUC: ListAdminSubjectsInCourseCycleUseCase,
    // fase-bimestre-cierre-asistencia PR-1b
    private readonly getGradingPhaseUC: GetGradingPhaseUseCase,
    private readonly setGradingPhaseUC: SetGradingPhaseUseCase,
  ) {}

  @Post()
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'CREATE' })
  async create(@Body(new ZodValidationPipe(CreateCourseCycleSchema)) body: CreateCourseCycleDto) {
    const result = await this.createUC.execute({
      courseId: body.courseId,
      studyPlanId: body.studyPlanId,
      cycleId: body.cycleId,
      courseName: body.courseName,
      level: body.level,
      passingGrade: body.passingGrade,
      promotionText: body.promotionText ?? null,
      firstBimonthStart: body.firstBimonthStart,
      firstBimonthEnd: body.firstBimonthEnd,
      secondBimonthStart: body.secondBimonthStart,
      secondBimonthEnd: body.secondBimonthEnd,
      thirdBimonthStart: body.thirdBimonthStart,
      thirdBimonthEnd: body.thirdBimonthEnd,
      fourthBimonthStart: body.fourthBimonthStart,
      fourthBimonthEnd: body.fourthBimonthEnd,
    });
    if (result.isErr()) throw result.unwrapErr();
    const cc = result.unwrap();
    return { data: this.toResponse(cc) };
  }

  /**
   * GET /course-cycles
   * C2: non-ROOT callers use their JWT userId (cannot enumerate others).
   *     ROOT can optionally pass teacherUserId for admin lookups.
   * C3: added 'TEACHER' role so teachers can access this endpoint.
   */
  @Get()
  @Roles('ROOT', 'TEACHER', { module: 'COURSE_CYCLES', action: 'READ' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(CourseCycleListQuerySchema.merge(TeacherCCListQuerySchema.partial()))) query: CourseCycleListQueryDto & TeacherCCListQueryDto,
  ) {
    const scope = resolveAccessScope(user);
    const isRoot = user.roles.includes('ROOT');

    if (!scope.isAdministrative) {
      // TEACHER and below: only their own records (Puerta 2)
      const ccs = await this.listTeacherCCsUC.execute({
        userId: user.userId,
        mode: query.role ?? 'subject',
      });
      // W3: use case returns { cycle, modality }[] — pass modality to toResponse for
      // scale/template lookup in TeacherFilteredSelectionContext.
      return { data: ccs.map(({ cycle, modality }) => this.toResponse(cycle, null, modality)) };
    }

    // Administrative (SECRETARIO / DIRECTOR / ADMIN / ROOT)
    // ROOT: optional teacherUserId filter for admin cross-teacher lookups
    if (isRoot && query.teacherUserId) {
      const ccs = await this.listTeacherCCsUC.execute({
        userId: query.teacherUserId,
        mode: query.role ?? 'subject',
      });
      return { data: ccs.map(({ cycle, modality }) => this.toResponse(cycle, null, modality)) };
    }

    // Full tenant list, scoped by level unless ROOT/ADMIN (allLevels=true)
    const result = await this.listUC.execute({
      level: query.level,
      levelIn: scope.allLevels ? undefined : scope.compositeLevels,
      cycleId: query.cycleId,
      active: query.active,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      data: result.data.map((cc) => this.toResponse(cc, null, null, result.studentCounts.get(cc.uuid) ?? 0)),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  }

  /**
   * GET /course-cycles/:uuid/subjects
   * PR4-T19 + PR4a-SEC: returns teacher's subjects in a CourseCycle.
   * C2: effective userId derived from JWT; ROOT can override via optional teacherUserId.
   * C3: added 'TEACHER' role.
   * W1: no optional guard — module always wires listTeacherSubjectsUC.
   * Must be declared BEFORE :uuid to avoid route collision.
   */
  @Get(':uuid/subjects')
  @Roles('ROOT', 'TEACHER', { module: 'COURSE_CYCLES', action: 'READ' })
  async listSubjects(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(TeacherSubjectsQuerySchema)) query: TeacherSubjectsQueryDto,
  ) {
    const scope = resolveAccessScope(user);

    if (scope.isAdministrative) {
      // ROOT admin override: lookup subjects for a specific teacher
      if (user.roles.includes('ROOT') && query.teacherUserId) {
        const subjects = await this.listTeacherSubjectsUC.execute({
          userId: query.teacherUserId,
          courseCycleId: uuid,
        });
        return { data: subjects };
      }
      // All admin roles (ROOT/ADMIN/DIRECTOR/SECRETARIO): all subjects of the CC
      const subjects = await this.listAdminSubjectsUC.execute(uuid);
      return { data: subjects };
    }

    // Non-administrative (TEACHER, etc.): only their subjects
    const subjects = await this.listTeacherSubjectsUC.execute({
      userId: user.userId,
      courseCycleId: uuid,
    });
    return { data: subjects };
  }

  @Get(':uuid')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
  async get(@Param('uuid') uuid: string) {
    const result = await this.getUC.execute(uuid);
    if (result.isErr()) throw result.unwrapErr();
    const { cycle, modality } = result.unwrap();
    return { data: this.toResponse(cycle, null, modality) };
  }

  @Get(':uuid/students')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
  async listStudents(@Param('uuid') uuid: string) {
    return { data: await this.listStudentsUC.execute(uuid) };
  }

  @Patch(':uuid')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })
  async update(
    @Param('uuid') uuid: string,
    @Body(new ZodValidationPipe(UpdateCourseCycleSchema)) body: UpdateCourseCycleDto,
  ) {
    const result = await this.updateUC.execute(uuid, {
      courseName: body.courseName,
      passingGrade: body.passingGrade,
      promotionText: body.promotionText,
      firstBimonthStart: body.firstBimonthStart,
      firstBimonthEnd: body.firstBimonthEnd,
      secondBimonthStart: body.secondBimonthStart,
      secondBimonthEnd: body.secondBimonthEnd,
      thirdBimonthStart: body.thirdBimonthStart,
      thirdBimonthEnd: body.thirdBimonthEnd,
      fourthBimonthStart: body.fourthBimonthStart,
      fourthBimonthEnd: body.fourthBimonthEnd,
    });
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.toResponse(result.unwrap()) };
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'DELETE' })
  async delete(@Param('uuid') uuid: string) {
    await this.deleteUC.execute(uuid);
  }

  @Patch(':uuid/deactivate')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })
  async deactivate(@Param('uuid') uuid: string) {
    const result = await this.toggleUC.execute(uuid, false);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.toResponse(result.unwrap()) };
  }

  @Patch(':uuid/activate')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })
  async activate(@Param('uuid') uuid: string) {
    const result = await this.toggleUC.execute(uuid, true);
    if (result.isErr()) throw result.unwrapErr();
    return { data: this.toResponse(result.unwrap()) };
  }

  @Post('generate')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'CREATE' })
  async generate(@Body(new ZodValidationPipe(GenerateCourseCyclesSchema)) body: GenerateCourseCyclesDto) {
    const result = await this.generateUC.execute({
      level: body.level,
      cycleId: body.cycleId,
      studyPlanId: body.studyPlanId,
    });
    return { data: result };
  }

  @Get(':uuid/grading-period')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
  async getGradingPeriod(@Param('uuid') uuid: string) {
    const result = await this.getGradingPeriodUC.execute(uuid);
    if (result.isErr()) throw result.unwrapErr();
    return { data: result.unwrap() };
  }

  @Patch(':uuid/grading-period')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })
  async setGradingPeriod(
    @Param('uuid') uuid: string,
    @Body(new ZodValidationPipe(SetGradingPeriodSchema)) body: SetGradingPeriodDto,
  ) {
    const result = await this.setGradingPeriodUC.execute(uuid, {
      activeGradingPeriod: body.activeGradingPeriod,
    });
    if (result.isErr()) throw result.unwrapErr();
    return { data: result.unwrap() };
  }

  /**
   * GET /course-cycles/:uuid/grading-phase
   * Read is broad (grillas de calificación necesitan el valor para deshabilitar columnas).
   */
  @Get(':uuid/grading-phase')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
  async getGradingPhase(@Param('uuid') uuid: string) {
    const result = await this.getGradingPhaseUC.execute(uuid);
    if (result.isErr()) throw result.unwrapErr();
    return { data: result.unwrap() };
  }

  /**
   * PATCH /course-cycles/:uuid/grading-phase
   * Secretario+ only (AC-A-1/2: explicit rejection for PRECEPTOR/TEACHER via rank gate).
   * 422 if the CourseCycle's level does not support grading phases (Inicial/Terciario).
   */
  @Patch(':uuid/grading-phase')
  @Rank(40)
  async setGradingPhase(
    @Param('uuid') uuid: string,
    @Body(new ZodValidationPipe(SetGradingPhaseSchema)) body: SetGradingPhaseDto,
  ) {
    const result = await this.setGradingPhaseUC.execute(uuid, { gradingPhase: body.gradingPhase });
    if (result.isErr()) throw result.unwrapErr();
    return { data: result.unwrap() };
  }

  private toResponse(
    cc: {
      uuid: string;
      courseId: string;
      studyPlanId: string;
      cycleId: string;
      courseName: { get(): string };
      level: { get(): number };
      active: boolean;
      passingGrade: { get(): number };
      promotionText: string | null;
      firstBimonth: { start: Date; end: Date } | null;
      secondBimonth: { start: Date; end: Date } | null;
      thirdBimonth: { start: Date; end: Date } | null;
      fourthBimonth: { start: Date; end: Date } | null;
      activeGradingPeriod: number | null;
      gradingPhase?: { code: string } | null;
      lastModifiedAt: Date;
      deletedAt?: Date | null;
    },
    academicCycleDates?: {
      firstBimonth: { start: Date; end: Date } | null;
      secondBimonth: { start: Date; end: Date } | null;
      thirdBimonth: { start: Date; end: Date } | null;
      fourthBimonth: { start: Date; end: Date } | null;
    } | null,
    modality?: number | null,
    studentCount?: number,
  ) {
    // effectiveBimonthDates: use CourseCycle own dates first; fall back to AcademicCycle dates
    const eff1 = cc.firstBimonth ?? academicCycleDates?.firstBimonth ?? null;
    const eff2 = cc.secondBimonth ?? academicCycleDates?.secondBimonth ?? null;
    const eff3 = cc.thirdBimonth ?? academicCycleDates?.thirdBimonth ?? null;
    const eff4 = cc.fourthBimonth ?? academicCycleDates?.fourthBimonth ?? null;

    return {
      uuid: cc.uuid,
      courseId: cc.courseId,
      studyPlanId: cc.studyPlanId,
      cycleId: cc.cycleId,
      courseName: cc.courseName.get(),
      level: cc.level.get(),
      modality: modality ?? null,
      active: cc.active,
      passingGrade: cc.passingGrade.get(),
      promotionText: cc.promotionText,
      activeGradingPeriod: cc.activeGradingPeriod,
      gradingPhase: cc.gradingPhase?.code ?? null,
      ownBimonthDates: {
        firstBimonthStart: cc.firstBimonth?.start?.toISOString() ?? null,
        firstBimonthEnd: cc.firstBimonth?.end?.toISOString() ?? null,
        secondBimonthStart: cc.secondBimonth?.start?.toISOString() ?? null,
        secondBimonthEnd: cc.secondBimonth?.end?.toISOString() ?? null,
        thirdBimonthStart: cc.thirdBimonth?.start?.toISOString() ?? null,
        thirdBimonthEnd: cc.thirdBimonth?.end?.toISOString() ?? null,
        fourthBimonthStart: cc.fourthBimonth?.start?.toISOString() ?? null,
        fourthBimonthEnd: cc.fourthBimonth?.end?.toISOString() ?? null,
      },
      effectiveBimonthDates: {
        firstBimonthStart: eff1?.start?.toISOString() ?? null,
        firstBimonthEnd: eff1?.end?.toISOString() ?? null,
        secondBimonthStart: eff2?.start?.toISOString() ?? null,
        secondBimonthEnd: eff2?.end?.toISOString() ?? null,
        thirdBimonthStart: eff3?.start?.toISOString() ?? null,
        thirdBimonthEnd: eff3?.end?.toISOString() ?? null,
        fourthBimonthStart: eff4?.start?.toISOString() ?? null,
        fourthBimonthEnd: eff4?.end?.toISOString() ?? null,
      },
      lastModifiedAt: cc.lastModifiedAt.toISOString(),
      studentCount: studentCount ?? 0,
    };
  }
}
