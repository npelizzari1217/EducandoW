import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MesaExamenController } from './mesa-examen.controller';
import { RegimenAcademicoController } from './regimen-academico.controller';
import { MateriasPreviasController } from '../secundario/materias-previas.controller';
import { MATERIA_PREVIA_REPOSITORY } from '@educandow/domain';
import { PrismaMateriaPreviaRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-materia-previa.repository';
import { UpsertMateriaPreviaUseCase } from '../../application/secundario/upsert-materia-previa.use-case';
import { ListMateriasPreviasByStudentUseCase } from '../../application/secundario/list-materias-previas-by-student.use-case';
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
import { PrismaMesaExamenRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-mesa-examen.repository';
import { PrismaRegimenAcademicoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-regimen-academico.repository';

@Module({
  imports: [AuthModule],
  controllers: [
    MesaExamenController,
    RegimenAcademicoController,
    // PR5: MateriasPrevias endpoints (POST+GET /students/:studentId/materias-previas)
    MateriasPreviasController,
  ],
  providers: [
    // Repositories
    PrismaMesaExamenRepository,
    { provide: 'MesaExamenRepository', useExisting: PrismaMesaExamenRepository },
    PrismaRegimenAcademicoRepository,
    { provide: 'RegimenAcademicoRepository', useExisting: PrismaRegimenAcademicoRepository },
    // PR3: MateriaPrevia repository (Symbol DI token — PR4 use cases inject via @Inject(MATERIA_PREVIA_REPOSITORY))
    PrismaMateriaPreviaRepository,
    { provide: MATERIA_PREVIA_REPOSITORY, useExisting: PrismaMateriaPreviaRepository },

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
