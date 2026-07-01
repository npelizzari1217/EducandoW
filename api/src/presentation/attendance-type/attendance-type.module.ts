import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttendanceTypeController } from './attendance-type.controller';
import {
  CreateAttendanceTypeUseCase,
  UpdateAttendanceTypeUseCase,
  DeleteAttendanceTypeUseCase,
  ListAttendanceTypesUseCase,
  GetAttendanceTypeUseCase,
} from '../../application/attendance-type/use-cases/attendance-type.use-cases';
import { GenerateAttendanceTypesPdfUseCase } from '../../application/attendance-type/use-cases/generate-attendance-types-pdf.use-case';
import { PrismaAttendanceTypeRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-attendance-type.repository';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { PdfGeneratorService } from '../../infrastructure/reporting/pdf-generator.service';

@Module({
  imports: [AuthModule],
  controllers: [AttendanceTypeController],
  providers: [
    PrismaService,
    // PdfGeneratorService: NO shared ReportingModule exists in this codebase to import
    // from (verified — asistencia-reporting.module.ts and reportes.module.ts each list
    // it directly in their own `providers` array too, so 2 separate Puppeteer browser
    // singletons already coexist today). Following that SAME established precedent here
    // (a 3rd module-scoped instance) instead of introducing a new shared module out of
    // scope for this PR. See design.md §9 ("aceptable, o mover a un ReportingModule
    // compartido") — documented tradeoff, not a regression.
    PdfGeneratorService,
    {
      provide: PrismaAttendanceTypeRepository,
      useClass: PrismaAttendanceTypeRepository,
    },
    { provide: 'AttendanceTypeRepository', useExisting: PrismaAttendanceTypeRepository },
    {
      provide: CreateAttendanceTypeUseCase,
      useFactory: (repo: PrismaAttendanceTypeRepository) => new CreateAttendanceTypeUseCase(repo),
      inject: ['AttendanceTypeRepository'],
    },
    {
      provide: UpdateAttendanceTypeUseCase,
      useFactory: (repo: PrismaAttendanceTypeRepository) => new UpdateAttendanceTypeUseCase(repo),
      inject: ['AttendanceTypeRepository'],
    },
    {
      provide: DeleteAttendanceTypeUseCase,
      useFactory: (repo: PrismaAttendanceTypeRepository) => new DeleteAttendanceTypeUseCase(repo),
      inject: ['AttendanceTypeRepository'],
    },
    {
      provide: ListAttendanceTypesUseCase,
      useFactory: (repo: PrismaAttendanceTypeRepository) => new ListAttendanceTypesUseCase(repo),
      inject: ['AttendanceTypeRepository'],
    },
    {
      provide: GetAttendanceTypeUseCase,
      useFactory: (repo: PrismaAttendanceTypeRepository) => new GetAttendanceTypeUseCase(repo),
      inject: ['AttendanceTypeRepository'],
    },
    {
      provide: GenerateAttendanceTypesPdfUseCase,
      useFactory: (
        pdfGen: PdfGeneratorService,
        prisma: PrismaService,
        repo: PrismaAttendanceTypeRepository,
      ) => new GenerateAttendanceTypesPdfUseCase(pdfGen, prisma, repo),
      inject: [PdfGeneratorService, PrismaService, 'AttendanceTypeRepository'],
    },
  ],
})
export class AttendanceTypeModule {}
