import { Module } from '@nestjs/common';
import { PdfGeneratorService } from './pdf-generator.service';

/**
 * ReportingModule — shared leaf provider module for `PdfGeneratorService`.
 *
 * Imported (not re-declared) by the three PDF-generating feature modules
 * (`AttendanceTypeModule`, `AsistenciaReportingModule`, `ReportesModule`) so
 * that Nest resolves a single `PdfGeneratorService` instance — and therefore
 * a single Puppeteer `Browser` — across the whole process (RPI-R1/R2/R3).
 *
 * No controller: pure infrastructure wiring, same shape as `EventBusModule`.
 */
@Module({
  providers: [PdfGeneratorService],
  exports: [PdfGeneratorService],
})
export class ReportingModule {}
