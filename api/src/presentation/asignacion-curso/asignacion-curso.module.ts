import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DocenteCicloModule } from '../docente-ciclo/docente-ciclo.module';
import { AsignacionCursoController } from './asignacion-curso.controller';
import { PrismaAsignacionCursoXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-asignacion-curso-x-ciclo.repository';
import { AssignDocenteToCursoUseCase } from '../../application/asignacion-curso/assign-docente-to-curso.use-case';
import { ListAsignacionesCursoUseCase } from '../../application/asignacion-curso/list-asignaciones-curso.use-case';
import { RemoveAsignacionCursoUseCase } from '../../application/asignacion-curso/remove-asignacion-curso.use-case';
import { DocenteXCicloService } from '../../application/docente-ciclo/docente-x-ciclo.service';

/**
 * AsignacionCursoModule — Fase 4 (F4-I2).
 *
 * Wires the AsignacionCursoXCicloRepository + 3 use-cases + controller.
 * Imports DocenteCicloModule to access DocenteXCicloService (for getOrCreateForCycle).
 * Exports PrismaAsignacionCursoXCicloRepository for Fase 6 (isPreceptor check).
 */
@Module({
  imports: [AuthModule, DocenteCicloModule],
  controllers: [AsignacionCursoController],
  providers: [
    PrismaAsignacionCursoXCicloRepository,
    { provide: 'AsignacionCursoXCicloRepository', useExisting: PrismaAsignacionCursoXCicloRepository },

    {
      provide: AssignDocenteToCursoUseCase,
      useFactory: (
        repo: PrismaAsignacionCursoXCicloRepository,
        service: DocenteXCicloService,
      ) => new AssignDocenteToCursoUseCase(repo, service),
      inject: [PrismaAsignacionCursoXCicloRepository, DocenteXCicloService],
    },

    {
      provide: ListAsignacionesCursoUseCase,
      useFactory: (repo: PrismaAsignacionCursoXCicloRepository) =>
        new ListAsignacionesCursoUseCase(repo),
      inject: [PrismaAsignacionCursoXCicloRepository],
    },

    {
      provide: RemoveAsignacionCursoUseCase,
      useFactory: (repo: PrismaAsignacionCursoXCicloRepository) =>
        new RemoveAsignacionCursoUseCase(repo),
      inject: [PrismaAsignacionCursoXCicloRepository],
    },
  ],
  exports: ['AsignacionCursoXCicloRepository', PrismaAsignacionCursoXCicloRepository],
})
export class AsignacionCursoModule {}
