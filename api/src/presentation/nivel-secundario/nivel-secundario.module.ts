import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CursoController } from './curso.controller';
import { MesaExamenController } from './mesa-examen.controller';
import { RegimenAcademicoController } from './regimen-academico.controller';
import { CalificacionSecundarioController } from './calificacion-secundario.controller';
import { MateriasPreviasController } from '../secundario/materias-previas.controller';
import { MATERIA_PREVIA_REPOSITORY } from '@educandow/domain';
import { PrismaMateriaPreviaRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-materia-previa.repository';
import { UpsertMateriaPreviaUseCase } from '../../application/secundario/upsert-materia-previa.use-case';
import { ListMateriasPreviasByStudentUseCase } from '../../application/secundario/list-materias-previas-by-student.use-case';
import {
  CreateCursoUseCase,
  ListCursosUseCase,
  GetCursoUseCase,
  UpdateCursoUseCase,
  DeleteCursoUseCase,
} from '../../application/nivel-secundario/use-cases/curso.use-cases';
import {
  CreateMesaExamenUseCase,
  ListMesasExamenUseCase,
  GetMesaExamenUseCase,
  InscribirAlumnoUseCase,
  ListInscripcionesUseCase,
} from '../../application/nivel-secundario/use-cases/mesa-examen.use-cases';
import {
  CreateRegimenAcademicoUseCase,
  GetRegimenAcademicoUseCase,
  UpdateRegimenAcademicoUseCase,
} from '../../application/nivel-secundario/use-cases/regimen-academico.use-cases';
import {
  RegistrarNotaSuplementariaUseCase,
  ConsultarAlumnosExamenUseCase,
  CalcularDefinitivaUseCase,
} from '../../application/nivel-secundario/use-cases/calificacion-secundario.use-cases';
import { PrismaCursoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-curso.repository';
import { PrismaMesaExamenRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-mesa-examen.repository';
import { PrismaRegimenAcademicoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-regimen-academico.repository';
import { PrismaCalificacionSecundarioRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-calificacion-secundario.repository';

const REPO_TOKEN = 'CalificacionSecundarioRepository';

@Module({
  imports: [AuthModule],
  controllers: [
    CursoController,
    MesaExamenController,
    RegimenAcademicoController,
    CalificacionSecundarioController,
    // PR5: MateriasPrevias endpoints (POST+GET /students/:studentId/materias-previas)
    MateriasPreviasController,
  ],
  providers: [
    // Repositories
    PrismaCursoRepository,
    { provide: 'CursoRepository', useExisting: PrismaCursoRepository },
    PrismaMesaExamenRepository,
    { provide: 'MesaExamenRepository', useExisting: PrismaMesaExamenRepository },
    PrismaRegimenAcademicoRepository,
    { provide: 'RegimenAcademicoRepository', useExisting: PrismaRegimenAcademicoRepository },
    PrismaCalificacionSecundarioRepository,
    { provide: REPO_TOKEN, useExisting: PrismaCalificacionSecundarioRepository },
    // PR3: MateriaPrevia repository (Symbol DI token — PR4 use cases inject via @Inject(MATERIA_PREVIA_REPOSITORY))
    PrismaMateriaPreviaRepository,
    { provide: MATERIA_PREVIA_REPOSITORY, useExisting: PrismaMateriaPreviaRepository },

    // Curso use cases
    { provide: CreateCursoUseCase, useFactory: (r) => new CreateCursoUseCase(r), inject: ['CursoRepository'] },
    { provide: ListCursosUseCase, useFactory: (r) => new ListCursosUseCase(r), inject: ['CursoRepository'] },
    { provide: GetCursoUseCase, useFactory: (r) => new GetCursoUseCase(r), inject: ['CursoRepository'] },
    { provide: UpdateCursoUseCase, useFactory: (r) => new UpdateCursoUseCase(r), inject: ['CursoRepository'] },
    { provide: DeleteCursoUseCase, useFactory: (r) => new DeleteCursoUseCase(r), inject: ['CursoRepository'] },

    // MesaExamen use cases
    { provide: CreateMesaExamenUseCase, useFactory: (r) => new CreateMesaExamenUseCase(r), inject: ['MesaExamenRepository'] },
    { provide: ListMesasExamenUseCase, useFactory: (r) => new ListMesasExamenUseCase(r), inject: ['MesaExamenRepository'] },
    { provide: GetMesaExamenUseCase, useFactory: (r) => new GetMesaExamenUseCase(r), inject: ['MesaExamenRepository'] },
    { provide: InscribirAlumnoUseCase, useFactory: (r) => new InscribirAlumnoUseCase(r), inject: ['MesaExamenRepository'] },
    { provide: ListInscripcionesUseCase, useFactory: (r) => new ListInscripcionesUseCase(r), inject: ['MesaExamenRepository'] },

    // RegimenAcademico use cases
    { provide: CreateRegimenAcademicoUseCase, useFactory: (r) => new CreateRegimenAcademicoUseCase(r), inject: ['RegimenAcademicoRepository'] },
    { provide: GetRegimenAcademicoUseCase, useFactory: (r) => new GetRegimenAcademicoUseCase(r), inject: ['RegimenAcademicoRepository'] },
    { provide: UpdateRegimenAcademicoUseCase, useFactory: (r) => new UpdateRegimenAcademicoUseCase(r), inject: ['RegimenAcademicoRepository'] },

    // CalificacionSecundario use cases
    { provide: RegistrarNotaSuplementariaUseCase, useFactory: (r) => new RegistrarNotaSuplementariaUseCase(r), inject: [REPO_TOKEN] },
    { provide: ConsultarAlumnosExamenUseCase, useFactory: (r) => new ConsultarAlumnosExamenUseCase(r), inject: [REPO_TOKEN] },
    { provide: CalcularDefinitivaUseCase, useFactory: (r) => new CalcularDefinitivaUseCase(r), inject: [REPO_TOKEN] },

    // PR5: MateriaPrevia use cases (wired with MATERIA_PREVIA_REPOSITORY Symbol token)
    {
      provide: UpsertMateriaPreviaUseCase,
      useFactory: (repo: PrismaMateriaPreviaRepository) => new UpsertMateriaPreviaUseCase(repo),
      inject: [MATERIA_PREVIA_REPOSITORY],
    },
    {
      provide: ListMateriasPreviasByStudentUseCase,
      useFactory: (repo: PrismaMateriaPreviaRepository) => new ListMateriasPreviasByStudentUseCase(repo),
      inject: [MATERIA_PREVIA_REPOSITORY],
    },
  ],
})
export class NivelSecundarioModule {}
