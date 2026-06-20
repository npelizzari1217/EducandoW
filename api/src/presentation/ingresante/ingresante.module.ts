import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PedagogyModule } from '../pedagogy/pedagogy.module';
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

@Module({
  imports: [AuthModule, PedagogyModule, StudentModule],
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

    // Internal UC instance needed by PromoteIngresanteUseCase
    {
      provide: 'Ingresante_CreateStudentUC',
      useFactory: (r) => new CreateStudentUseCase(r),
      inject: ['StudentRepository'],
    },

    {
      provide: PromoteIngresanteUseCase,
      useFactory: (ingresanteRepo, createStudentUC, cycleRepo, runner) =>
        new PromoteIngresanteUseCase(ingresanteRepo, createStudentUC, cycleRepo, runner),
      inject: [
        'IngresanteRepository',
        'Ingresante_CreateStudentUC',
        'AcademicCycleRepository',
        'TenantTransactionRunner',
      ],
    },
  ],
  exports: ['IngresanteRepository', ListIngresantesUseCase],
})
export class IngresanteModule {}
