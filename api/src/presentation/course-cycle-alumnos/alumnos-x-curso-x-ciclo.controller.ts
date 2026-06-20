import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  AddStudentToCourseCycleSchema,
  type AddStudentToCourseCycleDto,
  type AlumnoXCursoCicloResponse,
  type AlumnoCursoCicloItem,
} from './dto/alumnos-x-curso-x-ciclo.dto';
import { AddStudentToCourseCycleUseCase } from '../../application/course-cycle/add-student-to-course-cycle.use-case';
import { ListStudentsByCourseCycleUseCase } from '../../application/course-cycle/list-students-by-course-cycle.use-case';
import { RemoveStudentFromCourseCycleUseCase } from '../../application/course-cycle/remove-student-from-course-cycle.use-case';

/**
 * AlumnosXCursoXCicloController — SDD-1 PR-3 (T-17).
 *
 * Manages the authoritative student roster for a CourseCycle.
 * Endpoints are nested under /course-cycles/:ccId/alumnos.
 * Mirrors the AlumnosXMateriaXCursoXCiclo slice pattern exactly.
 *
 * DELETE uses bridge-row :id (ADR #1243), not :studentId.
 */
@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class AlumnosXCursoXCicloController {
  constructor(
    private readonly addUC: AddStudentToCourseCycleUseCase,
    private readonly listUC: ListStudentsByCourseCycleUseCase,
    private readonly removeUC: RemoveStudentFromCourseCycleUseCase,
  ) {}

  /**
   * POST /course-cycles/:ccId/alumnos — Enroll a student in a CourseCycle.
   * Idempotent: re-enrolling returns the existing record (no duplicate, no error).
   * Spec S-01, S-02, S-06, S-07.
   */
  @Post('course-cycles/:ccId/alumnos')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'CREATE' })
  async addStudent(
    @Param('ccId') ccId: string,
    @Body(new ZodValidationPipe(AddStudentToCourseCycleSchema)) body: AddStudentToCourseCycleDto,
  ): Promise<{ data: AlumnoXCursoCicloResponse }> {
    const result = await this.addUC.execute({
      courseCycleId: ccId,
      studentId: body.studentId,
    });
    return {
      data: {
        id: result.id,
        courseCycleId: result.courseCycleId,
        studentId: result.studentId,
      },
    };
  }

  /**
   * GET /course-cycles/:ccId/alumnos — List enrolled students enriched with name.
   * Returns [] when no students are assigned (not 404). Spec S-03, S-04.
   */
  @Get('course-cycles/:ccId/alumnos')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
  async listStudents(
    @Param('ccId') ccId: string,
  ): Promise<{ data: AlumnoCursoCicloItem[] }> {
    const data = await this.listUC.execute(ccId);
    return { data };
  }

  /**
   * DELETE /course-cycles/:ccId/alumnos/:id — Remove a student enrollment.
   * :id is the AlumnosXCursoXCiclo bridge-row id (ADR #1243).
   * Returns 204 No Content on success. Spec S-05, S-08.
   */
  @Delete('course-cycles/:ccId/alumnos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'DELETE' })
  async removeStudent(
    @Param('ccId') ccId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.removeUC.execute({ courseCycleId: ccId, id });
  }
}
