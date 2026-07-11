import { Module } from '@nestjs/common';
import { PdfGeneratorService } from './pdf-generator.service';
import { PDF_PORT } from '../../application/shared/ports/pdf.port';

/**
 * ReportingModule — shared leaf provider module for `PdfGeneratorService`.
 *
 * Imported (not re-declared) by the three PDF-generating feature modules
 * (`AttendanceTypeModule`, `AsistenciaReportingModule`, `ReportesModule`) so
 * that Nest resolves a single `PdfGeneratorService` instance — and therefore
 * a single Puppeteer `Browser` — across the whole process (RPI-R1/R2/R3).
 *
 * Also aliases `PDF_PORT` to the same singleton via `useExisting` (ADR-06,
 * PDP-R5) — NOT `useClass` (would instantiate a second `PdfGeneratorService`/
 * second `Browser`) and NOT `useValue` (would lose `onModuleDestroy`).
 *
 * No controller: pure infrastructure wiring, same shape as `EventBusModule`.
 */
@Module({
  providers: [PdfGeneratorService, { provide: PDF_PORT, useExisting: PdfGeneratorService }],
  exports: [PdfGeneratorService, PDF_PORT],
})
export class ReportingModule {}
