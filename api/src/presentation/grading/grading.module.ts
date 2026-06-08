import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GradingScalesController } from './grading-scales.controller';
import { GradingPeriodsController } from './grading-periods.controller';
import {
  CreateGradeScaleUseCase,
  UpdateGradeScaleUseCase,
  DeleteGradeScaleUseCase,
  ListGradeScalesUseCase,
  GetGradeScaleUseCase,
} from '../../application/grading/use-cases/grade-scale.use-cases';
import {
  CreateGradeScaleValueUseCase,
  UpdateGradeScaleValueUseCase,
  DeleteGradeScaleValueUseCase,
} from '../../application/grading/use-cases/grade-scale-value.use-cases';
import {
  CreateGradingPeriodTemplateUseCase,
  UpdateGradingPeriodTemplateUseCase,
  DeleteGradingPeriodTemplateUseCase,
  ListGradingPeriodTemplatesUseCase,
  GetGradingPeriodTemplateUseCase,
} from '../../application/grading/use-cases/grading-period-template.use-cases';
import {
  UpsertPeriodDatesUseCase,
  ListPeriodDatesUseCase,
} from '../../application/grading/use-cases/grading-period-date.use-cases';
import { PrismaGradeScaleRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-grade-scale.repository';
import { PrismaGradingPeriodRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-grading-period.repository';
import { PrismaAcademicCycleRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-academic-cycle.repository';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

/**
 * GradingModule — escalas (1a) + períodos (1b).
 */
@Module({
  imports: [AuthModule],
  controllers: [
    GradingScalesController,
    GradingPeriodsController,
  ],
  providers: [
    PrismaService,

    // ── Grade Scale repo + use cases ──────────────────────
    {
      provide: PrismaGradeScaleRepository,
      useClass: PrismaGradeScaleRepository,
    },
    { provide: 'GradeScaleRepository', useExisting: PrismaGradeScaleRepository },
    {
      provide: CreateGradeScaleUseCase,
      useFactory: (repo: PrismaGradeScaleRepository) => new CreateGradeScaleUseCase(repo),
      inject: ['GradeScaleRepository'],
    },
    {
      provide: UpdateGradeScaleUseCase,
      useFactory: (repo: PrismaGradeScaleRepository) => new UpdateGradeScaleUseCase(repo),
      inject: ['GradeScaleRepository'],
    },
    {
      provide: DeleteGradeScaleUseCase,
      useFactory: (repo: PrismaGradeScaleRepository) => new DeleteGradeScaleUseCase(repo),
      inject: ['GradeScaleRepository'],
    },
    {
      provide: ListGradeScalesUseCase,
      useFactory: (repo: PrismaGradeScaleRepository) => new ListGradeScalesUseCase(repo),
      inject: ['GradeScaleRepository'],
    },
    {
      provide: GetGradeScaleUseCase,
      useFactory: (repo: PrismaGradeScaleRepository) => new GetGradeScaleUseCase(repo),
      inject: ['GradeScaleRepository'],
    },
    {
      provide: CreateGradeScaleValueUseCase,
      useFactory: (repo: PrismaGradeScaleRepository) => new CreateGradeScaleValueUseCase(repo),
      inject: ['GradeScaleRepository'],
    },
    {
      provide: UpdateGradeScaleValueUseCase,
      useFactory: (repo: PrismaGradeScaleRepository) => new UpdateGradeScaleValueUseCase(repo),
      inject: ['GradeScaleRepository'],
    },
    {
      provide: DeleteGradeScaleValueUseCase,
      useFactory: (repo: PrismaGradeScaleRepository) => new DeleteGradeScaleValueUseCase(repo),
      inject: ['GradeScaleRepository'],
    },

    // ── Grading Period repo + AcademicCycle repo + use cases ─
    {
      provide: PrismaGradingPeriodRepository,
      useClass: PrismaGradingPeriodRepository,
    },
    { provide: 'GradingPeriodRepository', useExisting: PrismaGradingPeriodRepository },
    {
      provide: PrismaAcademicCycleRepository,
      useClass: PrismaAcademicCycleRepository,
    },
    { provide: 'AcademicCycleRepository', useExisting: PrismaAcademicCycleRepository },
    {
      provide: CreateGradingPeriodTemplateUseCase,
      useFactory: (repo: PrismaGradingPeriodRepository) =>
        new CreateGradingPeriodTemplateUseCase(repo),
      inject: ['GradingPeriodRepository'],
    },
    {
      provide: UpdateGradingPeriodTemplateUseCase,
      useFactory: (repo: PrismaGradingPeriodRepository) =>
        new UpdateGradingPeriodTemplateUseCase(repo),
      inject: ['GradingPeriodRepository'],
    },
    {
      provide: DeleteGradingPeriodTemplateUseCase,
      useFactory: (repo: PrismaGradingPeriodRepository) =>
        new DeleteGradingPeriodTemplateUseCase(repo),
      inject: ['GradingPeriodRepository'],
    },
    {
      provide: ListGradingPeriodTemplatesUseCase,
      useFactory: (repo: PrismaGradingPeriodRepository) =>
        new ListGradingPeriodTemplatesUseCase(repo),
      inject: ['GradingPeriodRepository'],
    },
    {
      provide: GetGradingPeriodTemplateUseCase,
      useFactory: (repo: PrismaGradingPeriodRepository) =>
        new GetGradingPeriodTemplateUseCase(repo),
      inject: ['GradingPeriodRepository'],
    },
    {
      provide: UpsertPeriodDatesUseCase,
      useFactory: (
        periodRepo: PrismaGradingPeriodRepository,
        cycleRepo: PrismaAcademicCycleRepository,
      ) => new UpsertPeriodDatesUseCase(periodRepo, cycleRepo),
      inject: ['GradingPeriodRepository', 'AcademicCycleRepository'],
    },
    {
      provide: ListPeriodDatesUseCase,
      useFactory: (repo: PrismaGradingPeriodRepository) => new ListPeriodDatesUseCase(repo),
      inject: ['GradingPeriodRepository'],
    },
  ],
})
export class GradingModule {}
