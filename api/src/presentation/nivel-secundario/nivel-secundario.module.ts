import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CursoController } from './curso.controller';
import { MesaExamenController } from './mesa-examen.controller';
import { RegimenAcademicoController } from './regimen-academico.controller';
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
import { PrismaCursoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-curso.repository';
import { PrismaMesaExamenRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-mesa-examen.repository';
import { PrismaRegimenAcademicoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-regimen-academico.repository';

@Module({
  imports: [AuthModule],
  controllers: [CursoController, MesaExamenController, RegimenAcademicoController],
  providers: [
    // Repositories
    PrismaCursoRepository,
    { provide: 'CursoRepository', useExisting: PrismaCursoRepository },
    PrismaMesaExamenRepository,
    { provide: 'MesaExamenRepository', useExisting: PrismaMesaExamenRepository },
    PrismaRegimenAcademicoRepository,
    { provide: 'RegimenAcademicoRepository', useExisting: PrismaRegimenAcademicoRepository },

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
  ],
})
export class NivelSecundarioModule {}
