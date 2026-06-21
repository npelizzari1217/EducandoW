import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlanificacionCursoController } from './planificacion-curso.controller';
import { PrismaPlanificacionCursoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-planificacion-curso.repository';
import { CreatePlanificacionCursoUseCase } from '../../application/planificacion-curso/create-planificacion-curso.use-case';
import { ListPlanificacionesCursoUseCase } from '../../application/planificacion-curso/list-planificaciones-curso.use-case';
import { UpdatePlanificacionCursoUseCase } from '../../application/planificacion-curso/update-planificacion-curso.use-case';
import { DeletePlanificacionCursoUseCase } from '../../application/planificacion-curso/delete-planificacion-curso.use-case';

@Module({
  imports: [AuthModule],
  controllers: [PlanificacionCursoController],
  providers: [
    PrismaPlanificacionCursoRepository,
    { provide: 'PlanificacionCursoRepository', useExisting: PrismaPlanificacionCursoRepository },
    {
      provide: CreatePlanificacionCursoUseCase,
      useFactory: (repo: PrismaPlanificacionCursoRepository) => new CreatePlanificacionCursoUseCase(repo),
      inject: [PrismaPlanificacionCursoRepository],
    },
    {
      provide: ListPlanificacionesCursoUseCase,
      useFactory: (repo: PrismaPlanificacionCursoRepository) => new ListPlanificacionesCursoUseCase(repo),
      inject: [PrismaPlanificacionCursoRepository],
    },
    {
      provide: UpdatePlanificacionCursoUseCase,
      useFactory: (repo: PrismaPlanificacionCursoRepository) => new UpdatePlanificacionCursoUseCase(repo),
      inject: [PrismaPlanificacionCursoRepository],
    },
    {
      provide: DeletePlanificacionCursoUseCase,
      useFactory: (repo: PrismaPlanificacionCursoRepository) => new DeletePlanificacionCursoUseCase(repo),
      inject: [PrismaPlanificacionCursoRepository],
    },
  ],
})
export class PlanificacionCursoModule {}
