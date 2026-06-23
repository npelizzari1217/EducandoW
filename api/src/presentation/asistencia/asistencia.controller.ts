/**
 * AsistenciaController — Monthly attendance register (SDD-4, PR-3).
 *
 * Replaces the old daily/absence endpoints (F6-P1..P4) with the monthly register.
 *
 * Endpoints:
 *   POST  /course-cycles/:ccId/asistencia-mensual/generate → generate register for CC+month (admin)
 *   GET   /course-cycles/:ccId/asistencia-mensual          → list general register for CC+month
 *   PATCH /course-cycles/:ccId/asistencia-mensual/dia      → record a day in general register
 *   GET   /materias-curso-ciclo/:materiaId/asistencia-mensual → list subject register (+ optional grupoId)
 *   PATCH /materias-curso-ciclo/:materiaId/asistencia-mensual/dia → record a day in subject register
 *
 * Door 1 (module check) is enforced via @Roles at each endpoint.
 * Door 2 (scope check) is enforced inside the use-cases.
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ForbiddenError } from '@educandow/domain';
import type {
  AsistenciaXAlumnoXCursoXCiclo,
  AsistenciaXMateriaXAlumnoXCursoXCiclo,
} from '@educandow/domain';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../infrastructure/auth/guards/auth.guard';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  GenerateMonthlySchema,
  GenerateMonthlyDto,
  GenerationResultResponse,
  GeneralAttendanceQuerySchema,
  GeneralAttendanceQueryDto,
  RecordGeneralDaySchema,
  RecordGeneralDayDto,
  SubjectAttendanceQuerySchema,
  SubjectAttendanceQueryDto,
  RecordSubjectDaySchema,
  RecordSubjectDayDto,
  AsistenciaGeneralResponse,
  AsistenciaMateriaResponse,
} from './dto/asistencia.dto';
import { GenerateMonthlyAttendanceUseCase } from '../../application/asistencia/generate-monthly-attendance.use-case';
import { ListGeneralAttendanceUseCase } from '../../application/asistencia/list-general-attendance.use-case';
import { RecordGeneralAttendanceDayUseCase } from '../../application/asistencia/record-general-attendance-day.use-case';
import { ListSubjectAttendanceUseCase } from '../../application/asistencia/list-subject-attendance.use-case';
import { RecordSubjectAttendanceDayUseCase } from '../../application/asistencia/record-subject-attendance-day.use-case';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class AsistenciaController {
  constructor(
    private readonly generateMonthlyUC: GenerateMonthlyAttendanceUseCase,
    private readonly listGeneralUC: ListGeneralAttendanceUseCase,
    private readonly recordGeneralUC: RecordGeneralAttendanceDayUseCase,
    private readonly listSubjectUC: ListSubjectAttendanceUseCase,
    private readonly recordSubjectUC: RecordSubjectAttendanceDayUseCase,
  ) {}

  /**
   * POST /course-cycles/:ccId/asistencia-mensual/generate
   * Materializes the monthly attendance register for a CourseCycle+month.
   * Admin-only (D3 — SECRETARIO/DIRECTOR/ADMIN/ROOT). Idempotent (ADR-3).
   * Returns row counts: { generalCreated, generalSkipped, materiaCreated, materiaSkipped }.
   */
  @Post('course-cycles/:ccId/asistencia-mensual/generate')
  @HttpCode(HttpStatus.OK)
  @Roles('ROOT', { module: 'ATTENDANCE', action: 'CREATE' })
  async generateMonthly(
    @Param('ccId') ccId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(GenerateMonthlySchema)) body: GenerateMonthlyDto,
  ): Promise<{ data: GenerationResultResponse }> {
    try {
      const result = await this.generateMonthlyUC.execute({
        courseCycleId: ccId,
        year: body.year,
        month: body.month,
        userId: user.userId,
        userRoles: user.roles,
      });
      return { data: result };
    } catch (err) {
      if (err instanceof ForbiddenError || (err as Error)?.constructor?.name === 'ForbiddenError') {
        throw new ForbiddenException((err as Error).message);
      }
      throw err;
    }
  }

  /**
   * GET /course-cycles/:ccId/asistencia-mensual?year=&month=
   * Returns the general monthly register rows for a CourseCycle+month.
   * Door 2: preceptor of the CC or D3 admin.
   */
  @Get('course-cycles/:ccId/asistencia-mensual')
  @Roles('ROOT', { module: 'ATTENDANCE', action: 'READ' })
  async listGeneral(
    @Param('ccId') ccId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(GeneralAttendanceQuerySchema)) query: GeneralAttendanceQueryDto,
  ): Promise<{ data: AsistenciaGeneralResponse[] }> {
    try {
      const rows = await this.listGeneralUC.execute({
        courseCycleId: ccId,
        year: query.year,
        month: query.month,
        userId: user.userId,
        userRoles: user.roles,
      });
      return { data: rows.map((e) => this.toGeneralResponse(e.attendance, e.studentName)) };
    } catch (err) {
      if (err instanceof ForbiddenError || (err as Error)?.constructor?.name === 'ForbiddenError') {
        throw new ForbiddenException((err as Error).message);
      }
      throw err;
    }
  }

  /**
   * PATCH /course-cycles/:ccId/asistencia-mensual/dia
   * Sets a single day's attendance status in the general monthly register.
   * Door 2: preceptor of the CC or D3 admin.
   */
  @Patch('course-cycles/:ccId/asistencia-mensual/dia')
  @Roles('ROOT', { module: 'ATTENDANCE', action: 'CREATE' })
  async recordGeneralDay(
    @Param('ccId') ccId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(RecordGeneralDaySchema)) body: RecordGeneralDayDto,
  ): Promise<{ data: AsistenciaGeneralResponse }> {
    try {
      const row = await this.recordGeneralUC.execute({
        courseCycleId: ccId,
        studentId: body.studentId,
        year: body.year,
        month: body.month,
        day: body.day,
        statusCode: body.statusCode,
        userId: user.userId,
        userRoles: user.roles,
      });
      return { data: this.toGeneralResponse(row, '') };
    } catch (err) {
      if (err instanceof ForbiddenError || (err as Error)?.constructor?.name === 'ForbiddenError') {
        throw new ForbiddenException((err as Error).message);
      }
      throw err;
    }
  }

  /**
   * GET /materias-curso-ciclo/:materiaId/asistencia-mensual?year=&month=&grupoId=
   * Returns per-materia monthly register rows.
   * Optional grupoId filter: when provided, scopes rows to that group's students (ADR-2).
   * Door 2: teacher with a group in the materia or D3 admin.
   */
  @Get('materias-curso-ciclo/:materiaId/asistencia-mensual')
  @Roles('ROOT', { module: 'ATTENDANCE', action: 'READ' })
  async listSubject(
    @Param('materiaId') materiaId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(SubjectAttendanceQuerySchema)) query: SubjectAttendanceQueryDto,
  ): Promise<{ data: AsistenciaMateriaResponse[] }> {
    try {
      const rows = await this.listSubjectUC.execute({
        materiaXCursoXCicloId: materiaId,
        year: query.year,
        month: query.month,
        grupoId: query.grupoId,
        userId: user.userId,
        userRoles: user.roles,
      });
      return { data: rows.map((e) => this.toMateriaResponse(e.attendance, e.studentName)) };
    } catch (err) {
      if (err instanceof ForbiddenError || (err as Error)?.constructor?.name === 'ForbiddenError') {
        throw new ForbiddenException((err as Error).message);
      }
      throw err;
    }
  }

  /**
   * PATCH /materias-curso-ciclo/:materiaId/asistencia-mensual/dia
   * Sets a single day's attendance status in the per-materia monthly register.
   * Door 2: teacher who owns a group for the materia AND target student ∈ that group, or D3 admin.
   */
  @Patch('materias-curso-ciclo/:materiaId/asistencia-mensual/dia')
  @Roles('ROOT', { module: 'ATTENDANCE', action: 'CREATE' })
  async recordSubjectDay(
    @Param('materiaId') materiaId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(RecordSubjectDaySchema)) body: RecordSubjectDayDto,
  ): Promise<{ data: AsistenciaMateriaResponse }> {
    try {
      const row = await this.recordSubjectUC.execute({
        materiaXCursoXCicloId: materiaId,
        studentId: body.studentId,
        year: body.year,
        month: body.month,
        day: body.day,
        statusCode: body.statusCode,
        userId: user.userId,
        userRoles: user.roles,
      });
      return { data: this.toMateriaResponse(row, '') };
    } catch (err) {
      if (err instanceof ForbiddenError || (err as Error)?.constructor?.name === 'ForbiddenError') {
        throw new ForbiddenException((err as Error).message);
      }
      throw err;
    }
  }

  // ── Response mappers ───────────────────────────────────────────────────────

  /**
   * Map a general attendance entity + resolved name to the response DTO.
   * List path: pass e.studentName ("Apellido, Nombre").
   * PATCH /dia path: pass '' (ADR-5 — frontend only reads updated.days on that path).
   */
  private toGeneralResponse(row: AsistenciaXAlumnoXCursoXCiclo, studentName: string): AsistenciaGeneralResponse {
    return {
      id: row.id.get(),
      courseCycleId: row.courseCycleId,
      studentId: row.studentId,
      studentName,
      year: row.year,
      month: row.month,
      days: row.days.toJSON(),
    };
  }

  /**
   * Map a subject attendance entity + resolved name to the response DTO.
   * List path: pass e.studentName ("Apellido, Nombre").
   * PATCH /dia path: pass '' (ADR-5).
   */
  private toMateriaResponse(row: AsistenciaXMateriaXAlumnoXCursoXCiclo, studentName: string): AsistenciaMateriaResponse {
    return {
      id: row.id.get(),
      materiaXCursoXCicloId: row.materiaXCursoXCicloId,
      studentId: row.studentId,
      studentName,
      year: row.year,
      month: row.month,
      days: row.days.toJSON(),
    };
  }
}
