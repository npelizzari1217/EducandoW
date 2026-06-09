/**
 * PR4-T17 [GREEN] — SubjectGradesController (READ-SIDE ONLY).
 * Security fixes (PR4a-SEC): C1 (authz via JWT userId) + C3 (module GRADES not GRADING).
 * Write-side endpoints (PUT period grades, PUT finals) are DEFERRED to PR4b.
 * Specs: SPG-R8, SFG-R10, TIA-R8, ES-R7, AD-5, AD-7
 */
import {
  Controller,
  Get,
  Query,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
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
} from './dto/subject-grades.dto';
import { GetSubjectGradesBySubjectUseCase } from '../../application/grading/get-subject-grades-by-subject.use-case';
import { GetSubjectGradesByStudentUseCase } from '../../application/grading/get-subject-grades-by-student.use-case';

@Controller('grading/subject-grades')
@UseGuards(AuthGuard, RolesGuard)
export class SubjectGradesController {
  constructor(
    private readonly getBySubjectUC: GetSubjectGradesBySubjectUseCase,
    private readonly getByStudentUC: GetSubjectGradesByStudentUseCase,
  ) {}

  /**
   * GET /grading/subject-grades
   * "Alumnos por materia" — all students for a (courseCycle, subject).
   * C1: teacher must have SubjectAssignment for (courseCycleId, subjectId) — enforced in use case.
   * C3: module 'GRADES' (was 'GRADING' — mismatch with seeded module code).
   */
  @Get()
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
  @Get('by-student')
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
}
