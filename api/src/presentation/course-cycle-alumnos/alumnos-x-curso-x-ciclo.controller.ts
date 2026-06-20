import {
  Controller,
  Get,
  Post,
  Patch,
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
  SetPrintableSchema,
  type AddStudentToCourseCycleDto,
  type SetPrintableDto,
  type AlumnoXCursoCicloResponse,
  type AlumnoCursoCicloItem,
} from './dto/alumnos-x-curso-x-ciclo.dto';
import { AddStudentToCourseCycleUseCase } from '../../application/course-cycle/add-student-to-course-cycle.use-case';
import { ListStudentsByCourseCycleUseCase } from '../../application/course-cycle/list-students-by-course-cycle.use-case';
import { RemoveStudentFromCourseCycleUseCase } from '../../application/course-cycle/remove-student-from-course-cycle.use-case';
import { TogglePrintableUseCase } from '../../application/course-cycle/toggle-printable.use-case';
import { SetCoursePrintableUseCase } from '../../application/course-cycle/set-course-printable.use-case';
import { ListStudentMembershipsUseCase } from '../../application/course-cycle/list-student-memberships.use-case';
import { CascadeStudentMateriasCompetenciasUseCase, type CascadeResult } from '../../application/course-cycle/cascade-student-materias-competencias.use-case';
import type { StudentMembershipEnriched } from '@educandow/domain';

/**
 * AlumnosXCursoXCicloController — SDD-1 PR-3 (T-17).
 *
 * Manages the authoritative student roster for a CourseCycle.
 * Endpoints are nested under /course-cycles/:ccId/alumnos.
 * Mirrors the MateriasXAlumnoXCursoXCiclo slice pattern exactly.
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
    private readonly togglePrintableUC: TogglePrintableUseCase,
    private readonly setCoursePrintableUC: SetCoursePrintableUseCase,
    private readonly listMembershipsUC: ListStudentMembershipsUseCase,
    private readonly cascadeUC: CascadeStudentMateriasCompetenciasUseCase,
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
   * GET /course-cycles/:ccId/alumnos — List enrolled students enriched with name + printable.
   * Returns [] when no students are assigned (not 404). Spec S-03, S-04.
   * SDD-2: each item now includes printable boolean (REQ-LIST-1).
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

  /**
   * PATCH /course-cycles/:ccId/alumnos/printable — Bulk-set printable for all rows.
   * Body: { value: boolean }
   * Implements "Todos" (value=true) and "Ninguno" (value=false) (REQ-TOG-2, REQ-TOG-3).
   * NOTE: This route MUST be registered BEFORE the :id variant to avoid NestJS
   * matching "printable" as the :id param in DELETE /alumnos/:id.
   */
  @Patch('course-cycles/:ccId/alumnos/printable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })
  async setBulkPrintable(
    @Param('ccId') ccId: string,
    @Body(new ZodValidationPipe(SetPrintableSchema)) body: SetPrintableDto,
  ): Promise<void> {
    await this.setCoursePrintableUC.execute({ courseCycleId: ccId, value: body.value });
  }

  /**
   * PATCH /course-cycles/:ccId/alumnos/:id/printable — Toggle printable for a single row.
   * Body: { value: boolean }
   * Implements the "Algunos" per-student toggle (REQ-TOG-1, REQ-TOG-6).
   * Returns 204 No Content on success; 404 if row not found or IDOR mismatch.
   */
  @Patch('course-cycles/:ccId/alumnos/:id/printable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })
  async togglePrintable(
    @Param('ccId') ccId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SetPrintableSchema)) body: SetPrintableDto,
  ): Promise<void> {
    await this.togglePrintableUC.execute({ courseCycleId: ccId, id, value: body.value });
  }

  /**
   * POST /course-cycles/:ccId/alumnos/:id/cascade — Materialize all plan materias
   * and their active competencies for a single enrolled student.
   *
   * :id is the AlumnosXCursoXCiclo bridge-row id (same convention as DELETE / PATCH printable).
   * Additive / idempotent: existing rows are skipped, never updated or deleted.
   * Grade children (CompetenciaXPeriodo…) are structurally preserved (ADR-7).
   *
   * NOTE: registered here (after /printable bulk but before generic :id) — no route
   * conflict exists since this is POST while DELETE / PATCH use different HTTP methods.
   *
   * SDD-3 PR-3, R-17, R-18, R-19.
   */
  @Post('course-cycles/:ccId/alumnos/:id/cascade')
  @HttpCode(HttpStatus.OK)
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })
  async cascade(
    @Param('ccId') ccId: string,
    @Param('id') id: string,
  ): Promise<{ data: CascadeResult }> {
    const data = await this.cascadeUC.execute({ id, ccId });
    return { data };
  }

  /**
   * GET /students/:studentId/memberships — List all AlumnosXCursoXCiclo rows for a student.
   * Returns enriched data: id, courseCycleId, printable, level, academicYear, grade, division.
   * SDD-2 R16/R17: replaces GET /enrollments?studentId in web StudentLegajo + boletín dropdown.
   */
  @Get('students/:studentId/memberships')
  @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'READ' })
  async listStudentMemberships(
    @Param('studentId') studentId: string,
  ): Promise<{ data: StudentMembershipEnriched[] }> {
    const data = await this.listMembershipsUC.execute(studentId);
    return { data };
  }
}
