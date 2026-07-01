/**
 * AsistenciaReportingController — Impresión de Asistencia Mensual (PR3c).
 *
 * Endpoints:
 *   GET /course-cycles/:ccId/asistencia-mensual/print?year=&month=
 *     → PDF apaisado (General), Content-Disposition attachment.
 *   GET /materias-curso-ciclo/:materiaId/asistencia-mensual/print?year=&month=&grupoId=
 *     → PDF apaisado (Por Materia), Content-Disposition attachment.
 *
 * @Roles module/action: ATTENDANCE/READ (not REPORTS/READ).
 * Rationale: this endpoint renders the SAME underlying data already exposed by
 * GET .../asistencia-mensual (ListGeneralAttendanceUseCase / ListSubjectAttendanceUseCase),
 * just as a printable PDF instead of JSON. Both list endpoints already gate on
 * ATTENDANCE/READ and enforce the identical Door 2 checks (preceptor / teacher-group)
 * inside the use-case. Gating the print button behind REPORTS/READ instead would
 * require granting a SEPARATE permission to the exact same preceptores/docentes who
 * already view this data on screen — REPORTS/READ is reserved for the boletín/constancia
 * family (student-report-card documents, a different authorization surface: D3 admins
 * only, see ReportesController). Keeping ATTENDANCE/READ here means the "Imprimir"
 * button is available to precisely the same audience as the on-screen grid.
 */
import {
  Controller, Get, Param, Query, Res, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { ForbiddenError } from '@educandow/domain';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../../infrastructure/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../infrastructure/auth/guards/auth.guard';
import { ZodValidationPipe } from '../shared/pipes/zod-validation.pipe';
import {
  AsistenciaMensualPrintGeneralQuerySchema,
  AsistenciaMensualPrintGeneralQueryDto,
  AsistenciaMensualPrintMateriaQuerySchema,
  AsistenciaMensualPrintMateriaQueryDto,
} from './dto/asistencia-reporting.dto';
import { GenerateAsistenciaMensualPdfUseCase } from '../../application/asistencia-reporting/generate-asistencia-mensual-pdf.use-case';
import { AsistenciaReportingError } from '../../application/asistencia-reporting/asistencia-reporting.errors';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class AsistenciaReportingController {
  constructor(
    private readonly generateUC: GenerateAsistenciaMensualPdfUseCase,
  ) {}

  /**
   * GET /course-cycles/:ccId/asistencia-mensual/print?year=&month=
   * Returns the General monthly attendance print (landscape PDF).
   */
  @Get('course-cycles/:ccId/asistencia-mensual/print')
  @Roles('ROOT', { module: 'ATTENDANCE', action: 'READ' })
  async printGeneral(
    @Param('ccId') ccId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(AsistenciaMensualPrintGeneralQuerySchema)) query: AsistenciaMensualPrintGeneralQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const pdfBuffer = await this.generateUC.executeGeneral({
        courseCycleId: ccId,
        year: query.year,
        month: query.month,
        userId: user.userId,
        userRoles: user.roles,
      });
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="asistencia-mensual-${ccId}-${query.year}-${query.month}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      });
      res.send(pdfBuffer);
    } catch (err) {
      this.handleError(err, res);
    }
  }

  /**
   * GET /materias-curso-ciclo/:materiaId/asistencia-mensual/print?year=&month=&grupoId=
   * Returns the Por Materia monthly attendance print (landscape PDF).
   * Optional grupoId filter (ADR-2 parity with the list endpoint).
   */
  @Get('materias-curso-ciclo/:materiaId/asistencia-mensual/print')
  @Roles('ROOT', { module: 'ATTENDANCE', action: 'READ' })
  async printMateria(
    @Param('materiaId') materiaId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(AsistenciaMensualPrintMateriaQuerySchema)) query: AsistenciaMensualPrintMateriaQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const pdfBuffer = await this.generateUC.executeMateria({
        materiaXCursoXCicloId: materiaId,
        year: query.year,
        month: query.month,
        grupoId: query.grupoId,
        userId: user.userId,
        userRoles: user.roles,
      });
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="asistencia-mensual-${materiaId}-${query.year}-${query.month}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      });
      res.send(pdfBuffer);
    } catch (err) {
      this.handleError(err, res);
    }
  }

  // ── Shared error mapping ────────────────────────────────────────────────

  private handleError(err: unknown, res: Response): void {
    if (err instanceof AsistenciaReportingError) {
      res.status(err.httpStatus).json({
        statusCode: err.httpStatus,
        error: err.code,
        message: err.message,
      });
      return;
    }
    if (err instanceof ForbiddenError || (err as Error)?.constructor?.name === 'ForbiddenError') {
      throw new ForbiddenException((err as Error).message);
    }
    throw err;
  }
}
