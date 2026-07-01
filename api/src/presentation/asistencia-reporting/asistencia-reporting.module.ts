/**
 * AsistenciaReportingModule — Impresión de Asistencia Mensual (PR3c).
 *
 * Wires GenerateAsistenciaMensualPdfUseCase, reusing the SAME repositories
 * already registered by AsistenciaModule/AttendanceTypeModule/ReportesModule
 * (findByScopeAndMonthEnriched — general and materia — plus AttendanceType
 * catalog and Door 2 repos), per ADR-08.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AsistenciaReportingController } from './asistencia-reporting.controller';
import { GenerateAsistenciaMensualPdfUseCase } from '../../application/asistencia-reporting/generate-asistencia-mensual-pdf.use-case';

// ── Infrastructure ─────────────────────────────────────────────────────────
import { PdfGeneratorService } from '../../infrastructure/reporting/pdf-generator.service';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

// ── Repositories — asistencia + catalog (existing) ────────────────────────
import { PrismaAsistenciaGeneralRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-asistencia-general.repository';
import { PrismaAsistenciaMateriaRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-asistencia-materia.repository';
import { PrismaAttendanceTypeRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-attendance-type.repository';

// ── Repositories — groups + Door 2 (existing) ─────────────────────────────
import { PrismaGrupoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-grupo.repository';
import { PrismaAlumnosXGrupoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-alumnos-x-grupo.repository';
import { PrismaDocenteXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-docente-x-ciclo.repository';
import { PrismaAsignacionCursoXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-asignacion-curso-x-ciclo.repository';

@Module({
  imports: [AuthModule],
  controllers: [AsistenciaReportingController],
  providers: [
    PdfGeneratorService,
    PrismaService,

    PrismaAsistenciaGeneralRepository,
    PrismaAsistenciaMateriaRepository,
    PrismaAttendanceTypeRepository,
    PrismaGrupoRepository,
    PrismaAlumnosXGrupoRepository,
    PrismaDocenteXCicloRepository,
    PrismaAsignacionCursoXCicloRepository,

    {
      provide: GenerateAsistenciaMensualPdfUseCase,
      useFactory: (
        pdfGen: PdfGeneratorService,
        prisma: PrismaService,
        attendanceTypeRepo: PrismaAttendanceTypeRepository,
        generalRepo: PrismaAsistenciaGeneralRepository,
        materiaRepo: PrismaAsistenciaMateriaRepository,
        docenteRepo: PrismaDocenteXCicloRepository,
        asignacionRepo: PrismaAsignacionCursoXCicloRepository,
        grupoRepo: PrismaGrupoRepository,
        alumnosXGrupoRepo: PrismaAlumnosXGrupoRepository,
      ) => new GenerateAsistenciaMensualPdfUseCase(
        pdfGen, prisma, attendanceTypeRepo, generalRepo, materiaRepo,
        docenteRepo, asignacionRepo, grupoRepo, alumnosXGrupoRepo,
      ),
      inject: [
        PdfGeneratorService,
        PrismaService,
        PrismaAttendanceTypeRepository,
        PrismaAsistenciaGeneralRepository,
        PrismaAsistenciaMateriaRepository,
        PrismaDocenteXCicloRepository,
        PrismaAsignacionCursoXCicloRepository,
        PrismaGrupoRepository,
        PrismaAlumnosXGrupoRepository,
      ],
    },
  ],
})
export class AsistenciaReportingModule {}
