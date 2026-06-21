import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SalaController } from './sala.controller';
import { PlanificacionController } from './planificacion.controller';
import {
  CreateSalaUseCase,
  ListSalasUseCase,
  GetSalaUseCase,
  UpdateSalaUseCase,
  DeleteSalaUseCase,
} from '../../application/nivel-inicial/use-cases/sala.use-cases';
import {
  CreatePlanificacionUseCase,
  ListPlanificacionesUseCase,
  UpdatePlanificacionUseCase,
} from '../../application/nivel-inicial/use-cases/planificacion.use-cases';
import { PrismaSalaRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-sala.repository';
import { PrismaPlanificacionRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-planificacion.repository';

@Module({
  imports: [AuthModule],
  controllers: [SalaController, PlanificacionController],
  providers: [
    PrismaSalaRepository,
    { provide: 'SalaRepository', useExisting: PrismaSalaRepository },
    PrismaPlanificacionRepository,
    { provide: 'PlanificacionRepository', useExisting: PrismaPlanificacionRepository },

    // Sala use cases
    { provide: CreateSalaUseCase, useFactory: (r) => new CreateSalaUseCase(r), inject: ['SalaRepository'] },
    { provide: ListSalasUseCase, useFactory: (r) => new ListSalasUseCase(r), inject: ['SalaRepository'] },
    { provide: GetSalaUseCase, useFactory: (r) => new GetSalaUseCase(r), inject: ['SalaRepository'] },
    { provide: UpdateSalaUseCase, useFactory: (r) => new UpdateSalaUseCase(r), inject: ['SalaRepository'] },
    { provide: DeleteSalaUseCase, useFactory: (r) => new DeleteSalaUseCase(r), inject: ['SalaRepository'] },

    // Planificacion use cases
    { provide: CreatePlanificacionUseCase, useFactory: (r) => new CreatePlanificacionUseCase(r), inject: ['PlanificacionRepository'] },
    { provide: ListPlanificacionesUseCase, useFactory: (r) => new ListPlanificacionesUseCase(r), inject: ['PlanificacionRepository'] },
    { provide: UpdatePlanificacionUseCase, useFactory: (r) => new UpdatePlanificacionUseCase(r), inject: ['PlanificacionRepository'] },
  ],
})
export class NivelInicialModule {}
