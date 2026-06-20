import {
  Controller, Get, Param, Res, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '../../infrastructure/auth/guards/auth.guard';
import { RolesGuard } from '../../infrastructure/auth/guards/roles.guard';
import { Roles } from '../../infrastructure/auth/decorators/roles.decorator';
import { GenerateBoletinUseCase, BoletinError } from '../../application/reportes/generate-boletin.use-case';
import { GenerateBoletinBatchUseCase } from '../../application/reportes/generate-boletin-batch.use-case';

@Controller('reportes')
@UseGuards(AuthGuard, RolesGuard)
export class ReportesController {
  constructor(
    private readonly singleUC: GenerateBoletinUseCase,
    private readonly batchUC: GenerateBoletinBatchUseCase,
  ) {}

  /**
   * GET /v1/reportes/boletin/:alumnosXCursoXCicloId
   * Generates and returns a single student report card (PDF).
   * SDD-2: param renamed from enrollmentId → alumnosXCursoXCicloId.
   */
  @Get('boletin/:alumnosXCursoXCicloId')
  @Roles('ROOT', { module: 'REPORTS', action: 'READ' })
  async getBoletin(
    @Param('alumnosXCursoXCicloId') alumnosXCursoXCicloId: string,
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.singleUC.execute(alumnosXCursoXCicloId);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="boletin-${alumnosXCursoXCicloId}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      });
      res.send(pdfBuffer);
    } catch (err) {
      if (err instanceof BoletinError) {
        res.status(err.httpStatus).json({
          statusCode: err.httpStatus,
          error: err.code,
          message: err.message,
        });
      } else {
        throw err;
      }
    }
  }

  /**
   * GET /v1/reportes/boletin/curso/:courseCycleId
   * Generates a ZIP archive with one PDF per printable student in the CourseCycle.
   * SDD-2: param renamed from cycleId (AcademicCycle grain) → courseCycleId (CourseCycle grain).
   */
  @Get('boletin/curso/:courseCycleId')
  @Roles('ROOT', { module: 'REPORTS', action: 'READ' })
  async getBoletinBatch(
    @Param('courseCycleId') courseCycleId: string,
    @Res() res: Response,
  ) {
    try {
      const zipBuffer = await this.batchUC.execute(courseCycleId);
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="boletines-curso-${courseCycleId}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      });
      res.send(zipBuffer);
    } catch (err) {
      if (err instanceof BoletinError) {
        res.status(err.httpStatus).json({
          statusCode: err.httpStatus,
          error: err.code,
          message: err.message,
        });
      } else {
        throw err;
      }
    }
  }
}
