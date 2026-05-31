import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CarreraController } from './carrera.controller';
import { InscripcionMateriaController } from './inscripcion-materia.controller';
import { ActaExamenController } from './acta-examen.controller';
import { TituloController } from './titulo.controller';
import { CreateCarreraUC, ListCarrerasUC, GetCarreraUC, UpdateCarreraUC, DeleteCarreraUC } from '../../application/nivel-terciario/use-cases/carrera.use-cases';
import { CreateInscripcionUC, ListInscripcionesUC, GetInscripcionUC, UpdateInscripcionEstadoUC } from '../../application/nivel-terciario/use-cases/inscripcion-materia.use-cases';
import { CreateActaExamenUC, ListActasExamenUC, GetActaExamenUC, RegistrarNotaUC } from '../../application/nivel-terciario/use-cases/acta-examen.use-cases';
import { CreateTituloUC, ListTitulosUC, GetTituloUC, UpdateTituloEstadoUC } from '../../application/nivel-terciario/use-cases/titulo.use-cases';
import { PrismaCarreraRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-carrera.repository';
import { PrismaInscripcionMateriaRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-inscripcion-materia.repository';
import { PrismaActaExamenRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-acta-examen.repository';
import { PrismaTituloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-titulo.repository';

@Module({
  imports: [AuthModule],
  controllers: [CarreraController, InscripcionMateriaController, ActaExamenController, TituloController],
  providers: [
    PrismaCarreraRepository,
    { provide: 'CarreraRepository', useExisting: PrismaCarreraRepository },
    PrismaInscripcionMateriaRepository,
    { provide: 'InscripcionRepository', useExisting: PrismaInscripcionMateriaRepository },
    PrismaActaExamenRepository,
    { provide: 'ActaExamenRepository', useExisting: PrismaActaExamenRepository },
    PrismaTituloRepository,
    { provide: 'TituloRepository', useExisting: PrismaTituloRepository },

    // Carrera use cases
    { provide: CreateCarreraUC, useFactory: (r: PrismaCarreraRepository) => new CreateCarreraUC(r), inject: ['CarreraRepository'] },
    { provide: ListCarrerasUC, useFactory: (r: PrismaCarreraRepository) => new ListCarrerasUC(r), inject: ['CarreraRepository'] },
    { provide: GetCarreraUC, useFactory: (r: PrismaCarreraRepository) => new GetCarreraUC(r), inject: ['CarreraRepository'] },
    { provide: UpdateCarreraUC, useFactory: (r: PrismaCarreraRepository) => new UpdateCarreraUC(r), inject: ['CarreraRepository'] },
    { provide: DeleteCarreraUC, useFactory: (r: PrismaCarreraRepository) => new DeleteCarreraUC(r), inject: ['CarreraRepository'] },

    // Inscripcion use cases
    { provide: CreateInscripcionUC, useFactory: (r: PrismaInscripcionMateriaRepository) => new CreateInscripcionUC(r), inject: ['InscripcionRepository'] },
    { provide: ListInscripcionesUC, useFactory: (r: PrismaInscripcionMateriaRepository) => new ListInscripcionesUC(r), inject: ['InscripcionRepository'] },
    { provide: GetInscripcionUC, useFactory: (r: PrismaInscripcionMateriaRepository) => new GetInscripcionUC(r), inject: ['InscripcionRepository'] },
    { provide: UpdateInscripcionEstadoUC, useFactory: (r: PrismaInscripcionMateriaRepository) => new UpdateInscripcionEstadoUC(r), inject: ['InscripcionRepository'] },

    // Acta examen use cases
    { provide: CreateActaExamenUC, useFactory: (r: PrismaActaExamenRepository) => new CreateActaExamenUC(r), inject: ['ActaExamenRepository'] },
    { provide: ListActasExamenUC, useFactory: (r: PrismaActaExamenRepository) => new ListActasExamenUC(r), inject: ['ActaExamenRepository'] },
    { provide: GetActaExamenUC, useFactory: (r: PrismaActaExamenRepository) => new GetActaExamenUC(r), inject: ['ActaExamenRepository'] },
    { provide: RegistrarNotaUC, useFactory: (r: PrismaActaExamenRepository) => new RegistrarNotaUC(r), inject: ['ActaExamenRepository'] },

    // Titulo use cases
    { provide: CreateTituloUC, useFactory: (r: PrismaTituloRepository) => new CreateTituloUC(r), inject: ['TituloRepository'] },
    { provide: ListTitulosUC, useFactory: (r: PrismaTituloRepository) => new ListTitulosUC(r), inject: ['TituloRepository'] },
    { provide: GetTituloUC, useFactory: (r: PrismaTituloRepository) => new GetTituloUC(r), inject: ['TituloRepository'] },
    { provide: UpdateTituloEstadoUC, useFactory: (r: PrismaTituloRepository) => new UpdateTituloEstadoUC(r), inject: ['TituloRepository'] },
  ],
})
export class NivelTerciarioModule {}
