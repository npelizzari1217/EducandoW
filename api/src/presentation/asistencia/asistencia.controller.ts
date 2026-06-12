/**
 * AsistenciaController — Fase 6 (F6-P1..P4).
 *
 * Subject absences (ausencias por materia):
 *   POST /grupos/:grupoId/ausencias      — F6-P1: record absence (teacher of group)
 *   GET  /grupos/:grupoId/ausencias      — F6-P2: list absences by date
 *
 * Daily attendance (asistencia diaria):
 *   POST /course-cycles/:ccId/asistencia-diaria  — F6-P3: record daily attendance
 *   GET  /course-cycles/:ccId/asistencia-diaria  — F6-P4: list by date
 *
 * Door 1 (module check) is enforced via @Roles at each endpoint.
 * Door 2 (scope check) is enforced inside the use-cases.
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ForbiddenError } from '@educandow/domain';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../infrastructure/auth/guards/auth.guard';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  RecordSubjectAbsenceSchema,
  RecordSubjectAbsenceDto,
  GetSubjectAbsencesQuerySchema,
  GetSubjectAbsencesQueryDto,
  RecordDailyAttendanceSchema,
  RecordDailyAttendanceDto,
  GetDailyAttendanceQuerySchema,
  GetDailyAttendanceQueryDto,
  type AusenciaXGrupoResponse,
  type AsistenciaDiariaResponse,
} from './dto/asistencia.dto';
import { RecordSubjectAbsenceUseCase } from '../../application/asistencia/record-subject-absence.use-case';
import { GetSubjectAbsencesUseCase } from '../../application/asistencia/get-subject-absences.use-case';
import { RecordDailyAttendanceUseCase } from '../../application/asistencia/record-daily-attendance.use-case';
import { GetDailyAttendanceUseCase } from '../../application/asistencia/get-daily-attendance.use-case';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class AsistenciaController {
  constructor(
    private readonly recordSubjectAbsenceUC: RecordSubjectAbsenceUseCase,
    private readonly getSubjectAbsencesUC: GetSubjectAbsencesUseCase,
    private readonly recordDailyAttendanceUC: RecordDailyAttendanceUseCase,
    private readonly getDailyAttendanceUC: GetDailyAttendanceUseCase,
  ) {}

  /**
   * POST /grupos/:grupoId/ausencias — F6-P1
   * Record a subject-level absence for a student in a group.
   * Door 1: ATTENDANCE module with CREATE action.
   * Door 2: teacher must be assigned to the group (use-case enforced).
   */
  @Post('grupos/:grupoId/ausencias')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ROOT', { module: 'ATTENDANCE', action: 'CREATE' })
  async recordSubjectAbsence(
    @Param('grupoId') grupoId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(RecordSubjectAbsenceSchema)) body: RecordSubjectAbsenceDto,
  ): Promise<{ data: AusenciaXGrupoResponse }> {
    try {
      const result = await this.recordSubjectAbsenceUC.execute({
        grupoId,
        studentId: body.studentId,
        date: new Date(body.date),
        observaciones: body.observaciones,
        userId: user.userId,
        userRoles: user.roles,
      });
      return { data: this.toAusenciaResponse(result) };
    } catch (err) {
      if (err instanceof ForbiddenError || (err as Error)?.constructor?.name === 'ForbiddenError') {
        throw new ForbiddenException((err as Error).message);
      }
      throw err;
    }
  }

  /**
   * GET /grupos/:grupoId/ausencias?date=YYYY-MM-DD — F6-P2
   * List subject absences for a group on a given date.
   * Door 1: ATTENDANCE module with READ action.
   * Door 2: teacher must be assigned to the group.
   */
  @Get('grupos/:grupoId/ausencias')
  @Roles('ROOT', { module: 'ATTENDANCE', action: 'READ' })
  async getSubjectAbsences(
    @Param('grupoId') grupoId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(GetSubjectAbsencesQuerySchema)) query: GetSubjectAbsencesQueryDto,
  ): Promise<{ data: AusenciaXGrupoResponse[] }> {
    try {
      const items = await this.getSubjectAbsencesUC.execute({
        grupoId,
        date: new Date(query.date),
        userId: user.userId,
        userRoles: user.roles,
      });
      return { data: items.map((a) => this.toAusenciaResponse(a)) };
    } catch (err) {
      if (err instanceof ForbiddenError || (err as Error)?.constructor?.name === 'ForbiddenError') {
        throw new ForbiddenException((err as Error).message);
      }
      throw err;
    }
  }

  /**
   * POST /course-cycles/:ccId/asistencia-diaria — F6-P3
   * Record daily attendance for a student in a CursoXCiclo.
   * Door 1: ATTENDANCE module with CREATE action.
   * Door 2: user must be a preceptor of the CC (use-case enforced).
   */
  @Post('course-cycles/:ccId/asistencia-diaria')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ROOT', { module: 'ATTENDANCE', action: 'CREATE' })
  async recordDailyAttendance(
    @Param('ccId') ccId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(RecordDailyAttendanceSchema)) body: RecordDailyAttendanceDto,
  ): Promise<{ data: AsistenciaDiariaResponse }> {
    try {
      const result = await this.recordDailyAttendanceUC.execute({
        courseCycleId: ccId,
        studentId: body.studentId,
        date: new Date(body.date),
        statusCode: body.statusCode,
        observaciones: body.observaciones,
        userId: user.userId,
        userRoles: user.roles,
      });
      return { data: this.toDiariaResponse(result) };
    } catch (err) {
      if (err instanceof ForbiddenError || (err as Error)?.constructor?.name === 'ForbiddenError') {
        throw new ForbiddenException((err as Error).message);
      }
      throw err;
    }
  }

  /**
   * GET /course-cycles/:ccId/asistencia-diaria?date=YYYY-MM-DD — F6-P4
   * List daily attendance for a CursoXCiclo on a given date.
   * Door 1: ATTENDANCE module with READ action.
   * Door 2: user must be a preceptor (use-case enforced).
   */
  @Get('course-cycles/:ccId/asistencia-diaria')
  @Roles('ROOT', { module: 'ATTENDANCE', action: 'READ' })
  async getDailyAttendance(
    @Param('ccId') ccId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(GetDailyAttendanceQuerySchema)) query: GetDailyAttendanceQueryDto,
  ): Promise<{ data: AsistenciaDiariaResponse[] }> {
    try {
      const items = await this.getDailyAttendanceUC.execute({
        courseCycleId: ccId,
        date: new Date(query.date),
        userId: user.userId,
        userRoles: user.roles,
      });
      return { data: items.map((a) => this.toDiariaResponse(a)) };
    } catch (err) {
      if (err instanceof ForbiddenError || (err as Error)?.constructor?.name === 'ForbiddenError') {
        throw new ForbiddenException((err as Error).message);
      }
      throw err;
    }
  }

  // ── Response mappers ───────────────────────────────────────────────────────

  private toAusenciaResponse(a: import('@educandow/domain').AusenciaXGrupo): AusenciaXGrupoResponse {
    return {
      id: a.id.get(),
      grupoId: a.grupoId,
      studentId: a.studentId,
      date: a.date.toISOString().split('T')[0],
      observaciones: a.observaciones,
      createdAt: (a.createdAt ?? new Date()).toISOString(),
    };
  }

  private toDiariaResponse(a: import('@educandow/domain').AsistenciaDiaria): AsistenciaDiariaResponse {
    return {
      id: a.id.get(),
      courseCycleId: a.courseCycleId,
      studentId: a.studentId,
      date: a.date.toISOString().split('T')[0],
      statusCode: a.statusCode,
      observaciones: a.observaciones,
      createdAt: (a.createdAt ?? new Date()).toISOString(),
    };
  }
}
