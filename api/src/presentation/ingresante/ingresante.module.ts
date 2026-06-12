import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PedagogyModule } from '../pedagogy/pedagogy.module';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { StudentModule } from '../student/student.module';
import { IngresanteController } from './ingresante.controller';
import {
  CreateIngresanteUseCase,
  UpdateIngresanteStatusUseCase,
  ListIngresantesUseCase,
  PromoteIngresanteUseCase,
} from '../../application/ingresante/use-cases/ingresante.use-cases';
import { PrismaIngresanteRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-ingresante.repository';
import { PrismaTenantTransactionRunner } from '../../infrastructure/persistence/prisma/tenant-transaction-runner';
import { CreateStudentUseCase } from '../../application/student/use-cases/student.use-cases';
import { CreateEnrollmentUseCase } from '../../application/enrollment/use-cases/enrollment.use-cases';

@Module({
  imports: [AuthModule, PedagogyModule, EnrollmentModule, StudentModule],
  controllers: [IngresanteController],
  providers: [
    PrismaIngresanteRepository,
    { provide: 'IngresanteRepository', useExisting: PrismaIngresanteRepository },

    PrismaTenantTransactionRunner,
    { provide: 'TenantTransactionRunner', useExisting: PrismaTenantTransactionRunner },

    {
      provide: CreateIngresanteUseCase,
      useFactory: (r, cycleRepo) => new CreateIngresanteUseCase(r, cycleRepo),
      inject: ['IngresanteRepository', 'AcademicCycleRepository'],
    },
    {
      provide: UpdateIngresanteStatusUseCase,
      useFactory: (r) => new UpdateIngresanteStatusUseCase(r),
      inject: ['IngresanteRepository'],
    },
    {
      provide: ListIngresantesUseCase,
      useFactory: (r) => new ListIngresantesUseCase(r),
      inject: ['IngresanteRepository'],
    },

    // Internal UC instances needed by PromoteIngresanteUseCase
    // Using namespaced tokens to avoid conflicts with sibling modules
    {
      provide: 'Ingresante_CreateStudentUC',
      useFactory: (r) => new CreateStudentUseCase(r),
      inject: ['StudentRepository'],
    },
    {
      provide: 'Ingresante_CreateEnrollmentUC',
      useFactory: (r) => new CreateEnrollmentUseCase(r),
      inject: ['EnrollmentRepository'],
    },

    {
      provide: PromoteIngresanteUseCase,
      useFactory: (ingresanteRepo, createStudentUC, createEnrollmentUC, cycleRepo, runner) =>
        new PromoteIngresanteUseCase(ingresanteRepo, createStudentUC, createEnrollmentUC, cycleRepo, runner),
      inject: [
        'IngresanteRepository',
        'Ingresante_CreateStudentUC',
        'Ingresante_CreateEnrollmentUC',
        'AcademicCycleRepository',
        'TenantTransactionRunner',
      ],
    },
  ],
  exports: ['IngresanteRepository', ListIngresantesUseCase],
})
export class IngresanteModule {}
