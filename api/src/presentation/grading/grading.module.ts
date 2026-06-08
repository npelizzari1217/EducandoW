import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GradingScalesController } from './grading-scales.controller';
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
import { PrismaGradeScaleRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-grade-scale.repository';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

/**
 * GradingModule (Fase 1a — escalas).
 * Diseñado para recibir los providers de períodos en 1b sin reestructuración.
 * El array `controllers` y `providers` se ampliarán en 1b.
 */
@Module({
  imports: [AuthModule],
  controllers: [
    GradingScalesController,
    // 1b: GradingPeriodsController irá aquí
  ],
  providers: [
    PrismaService,
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
    // 1b: providers de GradingPeriodRepository, grading-period-template use cases,
    //     grading-period-date use cases irán aquí
  ],
})
export class GradingModule {}
