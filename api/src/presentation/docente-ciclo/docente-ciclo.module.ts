import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DocenteCicloController } from './docente-ciclo.controller';
import { PrismaDocenteXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-docente-x-ciclo.repository';
import { DocenteXCicloService } from '../../application/docente-ciclo/docente-x-ciclo.service';
import { ListDocentesXCicloUseCase } from '../../application/docente-ciclo/list-docentes-x-ciclo.use-case';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

/**
 * DocenteCicloModule — Fase 2 (F2-A2).
 * Provides DocenteXCicloRepository, DocenteXCicloService, and the list endpoint.
 * Exports the repository and service so Fases 3 and 4 can import this module.
 */
@Module({
  imports: [AuthModule],
  controllers: [DocenteCicloController],
  providers: [
    PrismaService,
    PrismaDocenteXCicloRepository,
    { provide: 'DocenteXCicloRepository', useExisting: PrismaDocenteXCicloRepository },
    {
      provide: DocenteXCicloService,
      useFactory: (repo: PrismaDocenteXCicloRepository) => new DocenteXCicloService(repo),
      inject: ['DocenteXCicloRepository'],
    },
    {
      provide: ListDocentesXCicloUseCase,
      useFactory: (repo: PrismaDocenteXCicloRepository, prisma: PrismaService) =>
        new ListDocentesXCicloUseCase(repo, prisma),
      inject: ['DocenteXCicloRepository', PrismaService],
    },
  ],
  exports: [
    'DocenteXCicloRepository',
    PrismaDocenteXCicloRepository,
    DocenteXCicloService,
  ],
})
export class DocenteCicloModule {}
