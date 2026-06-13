import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DocenteCicloModule } from '../docente-ciclo/docente-ciclo.module';
import { StudentModule } from '../student/student.module';
import { MateriasGruposController } from './materia-grupo-ciclo.controller';
import { PrismaMateriaXCursoXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-materia-x-curso-x-ciclo.repository';
import { PrismaAlumnosXMateriaRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-alumnos-x-materia.repository';
import { PrismaGrupoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-grupo.repository';
import { PrismaAlumnosXGrupoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-alumnos-x-grupo.repository';
import { PrismaDocenteXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-docente-x-ciclo.repository';
import { MaterializeMateriasUseCase } from '../../application/materia-grupo-ciclo/materialize-materias.use-case';
import { AddStudentToMateriaUseCase } from '../../application/materia-grupo-ciclo/add-student-to-materia.use-case';
import { CreateGrupoUseCase } from '../../application/materia-grupo-ciclo/create-grupo.use-case';
import { AddStudentToGrupoUseCase } from '../../application/materia-grupo-ciclo/add-student-to-grupo.use-case';
import { ListMateriasUseCase } from '../../application/materia-grupo-ciclo/list-materias.use-case';
import { ListGruposUseCase } from '../../application/materia-grupo-ciclo/list-grupos.use-case';
import { ListGruposGlobalUseCase } from '../../application/materia-grupo-ciclo/list-grupos-global.use-case';
import { UpdateGrupoUseCase } from '../../application/materia-grupo-ciclo/update-grupo.use-case';
import { DeleteGrupoUseCase } from '../../application/materia-grupo-ciclo/delete-grupo.use-case';
import { DocenteXCicloService } from '../../application/docente-ciclo/docente-x-ciclo.service';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

/**
 * MateriasGruposModule — Fase 3c (F3-I5).
 *
 * Wires the 4 repositories + 6 use-cases + controller for the
 * MateriaXCursoXCiclo / Grupo / Alumnos slice of the domain.
 *
 * Exports MaterializeMateriasUseCase so CourseCycleModule can import it
 * and inject it into GenerateCourseCyclesUseCase.
 */
@Module({
  imports: [AuthModule, DocenteCicloModule, StudentModule],
  controllers: [MateriasGruposController],
  providers: [
    // ── Repositories ──────────────────────────────────────────────────────────
    PrismaMateriaXCursoXCicloRepository,
    PrismaAlumnosXMateriaRepository,
    PrismaGrupoRepository,
    PrismaAlumnosXGrupoRepository,
    PrismaService,

    // ── Use-cases ─────────────────────────────────────────────────────────────

    {
      provide: MaterializeMateriasUseCase,
      useFactory: (materiaRepo: PrismaMateriaXCursoXCicloRepository) =>
        new MaterializeMateriasUseCase(materiaRepo),
      inject: [PrismaMateriaXCursoXCicloRepository],
    },

    {
      provide: AddStudentToMateriaUseCase,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useFactory: (materiaRepo: PrismaMateriaXCursoXCicloRepository, alumnosRepo: PrismaAlumnosXMateriaRepository, studentRepo: any) =>
        new AddStudentToMateriaUseCase(materiaRepo, alumnosRepo, studentRepo),
      inject: [PrismaMateriaXCursoXCicloRepository, PrismaAlumnosXMateriaRepository, 'StudentRepository'],
    },

    {
      provide: CreateGrupoUseCase,
      useFactory: (
        materiaRepo: PrismaMateriaXCursoXCicloRepository,
        grupoRepo: PrismaGrupoRepository,
        docenteService: DocenteXCicloService,
        prisma: PrismaService,
      ) => new CreateGrupoUseCase(materiaRepo, grupoRepo, docenteService, prisma),
      inject: [PrismaMateriaXCursoXCicloRepository, PrismaGrupoRepository, DocenteXCicloService, PrismaService],
    },

    {
      provide: AddStudentToGrupoUseCase,
      useFactory: (
        grupoRepo: PrismaGrupoRepository,
        alumnosGrupoRepo: PrismaAlumnosXGrupoRepository,
        alumnosMateriaRepo: PrismaAlumnosXMateriaRepository,
      ) => new AddStudentToGrupoUseCase(grupoRepo, alumnosGrupoRepo, alumnosMateriaRepo),
      inject: [PrismaGrupoRepository, PrismaAlumnosXGrupoRepository, PrismaAlumnosXMateriaRepository],
    },

    {
      provide: ListMateriasUseCase,
      useFactory: (
        materiaRepo: PrismaMateriaXCursoXCicloRepository,
        alumnosRepo: PrismaAlumnosXMateriaRepository,
        grupoRepo: PrismaGrupoRepository,
      ) => new ListMateriasUseCase(materiaRepo, alumnosRepo, grupoRepo),
      inject: [PrismaMateriaXCursoXCicloRepository, PrismaAlumnosXMateriaRepository, PrismaGrupoRepository],
    },

    {
      provide: ListGruposUseCase,
      useFactory: (
        grupoRepo: PrismaGrupoRepository,
        alumnosGrupoRepo: PrismaAlumnosXGrupoRepository,
      ) => new ListGruposUseCase(grupoRepo, alumnosGrupoRepo),
      inject: [PrismaGrupoRepository, PrismaAlumnosXGrupoRepository],
    },

    {
      provide: ListGruposGlobalUseCase,
      useFactory: (grupoRepo: PrismaGrupoRepository, docenteRepo: PrismaDocenteXCicloRepository) =>
        new ListGruposGlobalUseCase(grupoRepo, docenteRepo),
      inject: [PrismaGrupoRepository, PrismaDocenteXCicloRepository],
    },

    {
      provide: UpdateGrupoUseCase,
      useFactory: (
        grupoRepo: PrismaGrupoRepository,
        materiaRepo: PrismaMateriaXCursoXCicloRepository,
        docenteService: DocenteXCicloService,
        prisma: PrismaService,
      ) => new UpdateGrupoUseCase(grupoRepo, materiaRepo, docenteService, prisma),
      inject: [PrismaGrupoRepository, PrismaMateriaXCursoXCicloRepository, DocenteXCicloService, PrismaService],
    },

    {
      provide: DeleteGrupoUseCase,
      useFactory: (grupoRepo: PrismaGrupoRepository) => new DeleteGrupoUseCase(grupoRepo),
      inject: [PrismaGrupoRepository],
    },
  ],
  exports: [MaterializeMateriasUseCase, PrismaMateriaXCursoXCicloRepository],
})
export class MateriasGruposModule {}
