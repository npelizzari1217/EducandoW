import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportesController } from './reportes.controller';
import { GenerateBoletinUseCase } from '../../application/reportes/generate-boletin.use-case';
import { GenerateBoletinBatchUseCase } from '../../application/reportes/generate-boletin-batch.use-case';
import { BoletinInvalidationService } from '../../application/reportes/boletin-invalidation.service';
import { PdfGeneratorService } from '../../infrastructure/reporting/pdf-generator.service';
import { PdfStorageService } from '../../infrastructure/reporting/pdf-storage.service';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { PrismaSubjectGradingPeriodRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-subject-grading-period.repository';
import { PrismaSubjectPeriodGradeRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-subject-period-grade.repository';
import { PrismaSubjectFinalGradeRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-subject-final-grade.repository';
import { PrismaCompetenciaXMateriaXAlumnoXCursoXCicloRepo } from '../../infrastructure/persistence/prisma/repositories/prisma-competency-valuation.repository';
import { PrismaInformeRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-informe.repository';

@Module({
  imports: [AuthModule],
  controllers: [ReportesController],
  providers: [
    PdfGeneratorService,
    PdfStorageService,
    PrismaService,

    // ── PR7: Primario branch repositories ─────────────────────────────────────
    PrismaSubjectGradingPeriodRepository,
    PrismaSubjectPeriodGradeRepository,
    PrismaSubjectFinalGradeRepository,
    PrismaCompetenciaXMateriaXAlumnoXCursoXCicloRepo,

    // ── Inicial branch repository ──────────────────────────────────────────────
    PrismaInformeRepository,

    // ── Use cases ──────────────────────────────────────────────────────────────
    {
      provide: GenerateBoletinUseCase,
      useFactory: (
        pdfGen: PdfGeneratorService,
        pdfStorage: PdfStorageService,
        prisma: PrismaService,
        sgpRepo: PrismaSubjectGradingPeriodRepository,
        pgRepo: PrismaSubjectPeriodGradeRepository,
        fgRepo: PrismaSubjectFinalGradeRepository,
        cvRepo: PrismaCompetenciaXMateriaXAlumnoXCursoXCicloRepo,
        informeRepo: PrismaInformeRepository,
      ) => new GenerateBoletinUseCase(pdfGen, pdfStorage, prisma, sgpRepo, pgRepo, fgRepo, cvRepo, undefined, informeRepo),
      inject: [
        PdfGeneratorService,
        PdfStorageService,
        PrismaService,
        PrismaSubjectGradingPeriodRepository,
        PrismaSubjectPeriodGradeRepository,
        PrismaSubjectFinalGradeRepository,
        PrismaCompetenciaXMateriaXAlumnoXCursoXCicloRepo,
        PrismaInformeRepository,
      ],
    },
    GenerateBoletinBatchUseCase,
    BoletinInvalidationService,
  ],
  exports: [BoletinInvalidationService, PdfStorageService],
})
export class ReportesModule {}
