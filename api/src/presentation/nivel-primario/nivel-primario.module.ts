import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GradoController } from './grado.controller';
import { CalificacionController } from './calificacion.controller';
import {
  CreateGradoUseCase,
  ListGradosUseCase,
  GetGradoUseCase,
  UpdateGradoUseCase,
  DeleteGradoUseCase,
} from '../../application/nivel-primario/use-cases/grado.use-cases';
import {
  CreateCalificacionUseCase,
  ListCalificacionesUseCase,
  GetCalificacionUseCase,
  UpdateCalificacionUseCase,
} from '../../application/nivel-primario/use-cases/calificacion.use-cases';
import { PrismaGradoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-grado.repository';
import { PrismaCalificacionPrimariaRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-calificacion-primaria.repository';

@Module({
  imports: [AuthModule],
  controllers: [GradoController, CalificacionController],
  providers: [
    PrismaGradoRepository,
    { provide: 'GradoRepository', useExisting: PrismaGradoRepository },

    PrismaCalificacionPrimariaRepository,
    { provide: 'CalificacionPrimarioRepository', useExisting: PrismaCalificacionPrimariaRepository },

    { provide: CreateGradoUseCase, useFactory: (r) => new CreateGradoUseCase(r), inject: ['GradoRepository'] },
    { provide: ListGradosUseCase, useFactory: (r) => new ListGradosUseCase(r), inject: ['GradoRepository'] },
    { provide: GetGradoUseCase, useFactory: (r) => new GetGradoUseCase(r), inject: ['GradoRepository'] },
    { provide: UpdateGradoUseCase, useFactory: (r) => new UpdateGradoUseCase(r), inject: ['GradoRepository'] },
    { provide: DeleteGradoUseCase, useFactory: (r) => new DeleteGradoUseCase(r), inject: ['GradoRepository'] },

    { provide: CreateCalificacionUseCase, useFactory: (r) => new CreateCalificacionUseCase(r), inject: ['CalificacionPrimarioRepository'] },
    { provide: ListCalificacionesUseCase, useFactory: (r) => new ListCalificacionesUseCase(r), inject: ['CalificacionPrimarioRepository'] },
    { provide: GetCalificacionUseCase, useFactory: (r) => new GetCalificacionUseCase(r), inject: ['CalificacionPrimarioRepository'] },
    { provide: UpdateCalificacionUseCase, useFactory: (r) => new UpdateCalificacionUseCase(r), inject: ['CalificacionPrimarioRepository'] },
  ],
})
export class NivelPrimarioModule {}
