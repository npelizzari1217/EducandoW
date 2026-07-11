/**
 * reporting-module-compartido (issue #101) — RPI-S9.
 *
 * Static assertion (no DI, no TestingModule) that the three real feature
 * modules delegate `PdfGeneratorService` to the shared `ReportingModule`
 * instead of registering their own copy — design.md ADR-02 "cierre del
 * drift con el spec". Reading `@Module` metadata directly avoids dragging
 * AuthModule/PrismaService/repos into this test.
 */
import { describe, it, expect } from 'vitest';
import { AttendanceTypeModule } from '../../../presentation/attendance-type/attendance-type.module';
import { AsistenciaReportingModule } from '../../../presentation/asistencia-reporting/asistencia-reporting.module';
import { ReportesModule } from '../../../presentation/reportes/reportes.module';
import { ReportingModule } from '../reporting.module';
import { PdfGeneratorService } from '../pdf-generator.service';

describe('feature modules delegate PdfGeneratorService to ReportingModule', () => {
  const featureModules = [
    ['AttendanceTypeModule', AttendanceTypeModule],
    ['AsistenciaReportingModule', AsistenciaReportingModule],
    ['ReportesModule', ReportesModule],
  ] as const;

  it.each(featureModules)('%s imports ReportingModule', (_name, Module_) => {
    const imports = Reflect.getMetadata('imports', Module_) as unknown[];
    expect(imports).toContain(ReportingModule);
  });

  it.each(featureModules)('%s does not register PdfGeneratorService in its own providers', (_name, Module_) => {
    const providers = Reflect.getMetadata('providers', Module_) as unknown[];
    expect(providers).not.toContain(PdfGeneratorService);
  });
});
