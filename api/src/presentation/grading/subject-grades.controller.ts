/**
 * PR4-T17 [GREEN] — SubjectGradesController (read-side + write-side PR4b).
 * Security fixes (PR4a-SEC): C1 (authz via JWT userId) + C3 (module GRADES not GRADING).
 * Write-side endpoints added in PR4b: PUT period grades, PUT finals.
 * Specs: SPG-R8, SFG-R10, TIA-R8, ES-R7, AD-5, AD-7, SPG-R3, SFG-R5
 */
import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { NotFoundError } from '@educandow/domain';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../infrastructure/auth/guards/auth.guard';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  SubjectGradesBySubjectQuerySchema,
  SubjectGradesBySubjectQueryDto,
  SubjectGradesByStudentQuerySchema,
  SubjectGradesByStudentQueryDto,
  UpsertSubjectPeriodGradesSchema,
  UpsertSubjectPeriodGradesDto,
  UpsertSubjectFinalGradesSchema,
  UpsertSubjectFinalGradesDto,
} from './dto/subject-grades.dto';
import { GetSubjectGradesBySubjectUseCase } from '../../application/grading/get-subject-grades-by-subject.use-case';
import { GetSubjectGradesByStudentUseCase } from '../../application/grading/get-subject-grades-by-student.use-case';
import { UpsertSubjectPeriodGradesUseCase } from '../../application/grading/upsert-subject-period-grades.use-case';
import { UpsertSubjectFinalGradesUseCase } from '../../application/grading/upsert-subject-final-grades.use-case';

@Controller('grading')
@UseGuards(AuthGuard, RolesGuard)
export class SubjectGradesController {
  constructor(
    private readonly getBySubjectUC: GetSubjectGradesBySubjectUseCase,
    private readonly getByStudentUC: GetSubjectGradesByStudentUseCase,
    private readonly upsertPeriodGradesUC: UpsertSubjectPeriodGradesUseCase,
    private readonly upsertFinalGradesUC: UpsertSubjectFinalGradesUseCase,
  ) {}

  /**
   * GET /grading/subject-grades
   * "Alumnos por materia" — all students for a (courseCycle, subject).
   * C1: teacher must have SubjectAssignment for (courseCycleId, subjectId) — enforced in use case.
   * C3: module 'GRADES' (was 'GRADING' — mismatch with seeded module code).
   */
  @Get('subject-grades')
  @Roles({ module: 'GRADES', action: 'READ' })
  async getBySubject(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(SubjectGradesBySubjectQuerySchema))
    query: SubjectGradesBySubjectQueryDto,
  ) {
    const result = await this.getBySubjectUC.execute({
      courseCycleId: query.courseCycleId,
      subjectId: query.subjectId,
      userId: user.userId,
      userRoles: user.roles,
    });
    if ('forbidden' in result && result.forbidden) {
      throw new ForbiddenException('Not authorized to access grades for this subject/course');
    }
    return { data: result };
  }

  /**
   * GET /grading/subject-grades/by-student
   * "Alumnos por curso" — all subjects for a (courseCycle, student).
   * C1: teacher must be homeroom or have subject assignment in courseCycleId — enforced in use case.
   * C3: module 'GRADES' (was 'GRADING').
   */
  @Get('subject-grades/by-student')
  @Roles({ module: 'GRADES', action: 'READ' })
  async getByStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(SubjectGradesByStudentQuerySchema))
    query: SubjectGradesByStudentQueryDto,
  ) {
    const result = await this.getByStudentUC.execute({
      courseCycleId: query.courseCycleId,
      studentId: query.studentId,
      userId: user.userId,
      userRoles: user.roles,
    });
    if ('forbidden' in result && result.forbidden) {
      throw new ForbiddenException('Not authorized to access grades for this course/student');
    }
    return { data: result };
  }

  /**
   * PUT /grading/subject-grades
   * Batch upsert period grades AND pa/ppi/pp flags (one write path — AD-3).
   * Fase 5: userId + userRoles passed to use case for group-assignment authz (F5-A3).
   * Returns 200 { data: null } on success.
   * 403 if teacher is not assigned to the group for this subject (bug closed).
   * 400 on invalid gradeScaleValueId or periodOrdinal out of range.
   * 404 on missing courseCycleId / subjectId / studentId.
   */
  @Put('subject-grades')
  @Roles({ module: 'GRADES', action: 'WRITE' })
  async upsertPeriodGrades(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpsertSubjectPeriodGradesSchema))
    body: UpsertSubjectPeriodGradesDto,
  ) {
    const result = await this.upsertPeriodGradesUC.execute({
      ...body,
      userId: user.userId,
      userRoles: user.roles,
    });
    if (result.isErr()) {
      const error = result.unwrapErr();
      if (error instanceof NotFoundError) {
        throw new NotFoundException(error.message);
      }
      // ForbiddenError (F5-A3 — teacher not assigned to group)
      if (error.constructor.name === 'ForbiddenError') {
        throw new ForbiddenException(error.message);
      }
      throw new BadRequestException(error.message);
    }
    return { data: null };
  }

  /**
   * PUT /grading/subject-final-grades
   * Batch upsert final grades. Lifecycle enforced in use case (AD-2):
   *   DICIEMBRE blocked when FINAL.passed=true → 400.
   *   MARZO blocked when DICIEMBRE.passed=true → 400.
   *   DEFINITIVA always allowed.
   * Fase 5: userId + userRoles passed for group-assignment authz (F5-A4).
   * Returns 200 { data: null } on success.
   * 403 if teacher is not assigned to the group for this subject.
   */
  @Put('subject-final-grades')
  @Roles({ module: 'GRADES', action: 'WRITE' })
  async upsertFinalGrades(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpsertSubjectFinalGradesSchema))
    body: UpsertSubjectFinalGradesDto,
  ) {
    const result = await this.upsertFinalGradesUC.execute({
      ...body,
      userId: user.userId,
      userRoles: user.roles,
    });
    if (result.isErr()) {
      const error = result.unwrapErr();
      if (error instanceof NotFoundError) {
        throw new NotFoundException(error.message);
      }
      // ForbiddenError (F5-A4 — teacher not assigned to group)
      if (error.constructor.name === 'ForbiddenError') {
        throw new ForbiddenException(error.message);
      }
      throw new BadRequestException(error.message);
    }
    return { data: null };
  }
}
