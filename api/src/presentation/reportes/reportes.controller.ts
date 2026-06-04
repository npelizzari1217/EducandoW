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
   * GET /v1/reportes/boletin/:enrollmentId
   * Generates and returns a single student report card (PDF).
   */
  @Get('boletin/:enrollmentId')
  @Roles('ROOT', { module: 'REPORTS', action: 'READ' })
  async getBoletin(
    @Param('enrollmentId') enrollmentId: string,
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.singleUC.execute(enrollmentId);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="boletin-${enrollmentId}.pdf"`,
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
   * GET /v1/reportes/boletin/curso/:cycleId
   * Generates a ZIP archive with one PDF per printable student in the cycle.
   */
  @Get('boletin/curso/:cycleId')
  @Roles('ROOT', { module: 'REPORTS', action: 'READ' })
  async getBoletinBatch(
    @Param('cycleId') cycleId: string,
    @Res() res: Response,
  ) {
    try {
      const zipBuffer = await this.batchUC.execute(cycleId);
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="boletines-curso-${cycleId}.zip"`,
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
