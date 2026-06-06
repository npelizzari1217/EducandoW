import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportesController } from './reportes.controller';
import { GenerateBoletinUseCase } from '../../application/reportes/generate-boletin.use-case';
import { GenerateBoletinBatchUseCase } from '../../application/reportes/generate-boletin-batch.use-case';
import { BoletinInvalidationService } from '../../application/reportes/boletin-invalidation.service';
import { PdfGeneratorService } from '../../infrastructure/reporting/pdf-generator.service';
import { PdfStorageService } from '../../infrastructure/reporting/pdf-storage.service';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

@Module({
  imports: [AuthModule],
  controllers: [ReportesController],
  providers: [
    PdfGeneratorService,
    PdfStorageService,
    GenerateBoletinUseCase,
    GenerateBoletinBatchUseCase,
    BoletinInvalidationService,
    PrismaService,
  ],
  exports: [BoletinInvalidationService, PdfStorageService],
})
export class ReportesModule {}
