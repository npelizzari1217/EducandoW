import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CarreraController } from './carrera.controller';
import { InscripcionMateriaController } from './inscripcion-materia.controller';
import { ActaExamenController } from './acta-examen.controller';
import { TituloController } from './titulo.controller';
import { NotaCursadaTerciarioController } from './nota-cursada-terciario.controller';
import { LlamadoExamenController } from './llamado-examen.controller';
import { DocenteMateriaAdminController } from './docente-materia-admin.controller';
import { CreateCarreraUC, ListCarrerasUC, GetCarreraUC, UpdateCarreraUC, DeleteCarreraUC } from '../../application/nivel-terciario/use-cases/carrera.use-cases';
import { CreateInscripcionUC, ListInscripcionesUC, GetInscripcionUC, UpdateInscripcionEstadoUC } from '../../application/nivel-terciario/use-cases/inscripcion-materia.use-cases';
import { CreateActaExamenUC, ListActasExamenUC, GetActaExamenUC, RegistrarNotaUC, RegistrarNotaFinalUC, RegistrarPromocionalUC } from '../../application/nivel-terciario/use-cases/acta-examen.use-cases';
import { CreateTituloUC, ListTitulosUC, GetTituloUC, UpdateTituloEstadoUC } from '../../application/nivel-terciario/use-cases/titulo.use-cases';
import { CreateNotaCursadaSlotUC, UpdateNotaCursadaSlotUC, ListNotaCursadaSlotsUC, ConfirmarNotaCursadaUC, ListInscripcionesDocenteUC } from '../../application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases';
import { AssignDocenteMateriaUC, ListAssignmentsUC, UnassignDocenteMateriaUC } from '../../application/nivel-terciario/use-cases/docente-materia.use-cases';
import { PrismaLlamadoExamenRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-llamado-examen.repository';
import { CreateLlamadoExamenUC, UpdateLlamadoExamenUC, ListLlamadosExamenUC, DeleteLlamadoExamenUC } from '../../application/nivel-terciario/use-cases/llamado-examen.use-cases';
import { LLAMADO_EXAMEN_REPOSITORY, DOCENTE_X_MATERIA_CARRERA_REPOSITORY, TERCIARIO_AUTHORIZER } from '@educandow/domain';
import type { DocenteXMateriaCarreraRepository, TerciarioAuthorizerPort } from '@educandow/domain';
import { PrismaCarreraRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-carrera.repository';
import { PrismaInscripcionMateriaRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-inscripcion-materia.repository';
import { PrismaActaExamenRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-acta-examen.repository';
import { PrismaTituloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-titulo.repository';
import { PrismaNotaCursadaTerciarioRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-nota-cursada-terciario.repository';
import { PrismaTenantTransactionRunner } from '../../infrastructure/persistence/prisma/tenant-transaction-runner';
import { PrismaDocenteXMateriaCarreraRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-docente-x-materia-carrera.repository';
import { TerciarioAuthorizerService } from '../../application/grading/terciario-authorizer.service';

@Module({
  imports: [AuthModule],
  controllers: [
    CarreraController,
    InscripcionMateriaController,
    ActaExamenController,
    TituloController,
    NotaCursadaTerciarioController,
    LlamadoExamenController,
    DocenteMateriaAdminController,
  ],
  providers: [
    PrismaCarreraRepository,
    { provide: 'CarreraRepository', useExisting: PrismaCarreraRepository },
    PrismaInscripcionMateriaRepository,
    { provide: 'InscripcionRepository', useExisting: PrismaInscripcionMateriaRepository },
    PrismaActaExamenRepository,
    { provide: 'ActaExamenRepository', useExisting: PrismaActaExamenRepository },
    PrismaTituloRepository,
    { provide: 'TituloRepository', useExisting: PrismaTituloRepository },
    PrismaNotaCursadaTerciarioRepository,
    { provide: 'NotaCursadaTerciarioRepository', useExisting: PrismaNotaCursadaTerciarioRepository },
    PrismaTenantTransactionRunner,
    { provide: 'TenantTransactionRunner', useExisting: PrismaTenantTransactionRunner },

    // DocenteXMateriaCarrera repo
    PrismaDocenteXMateriaCarreraRepository,
    { provide: DOCENTE_X_MATERIA_CARRERA_REPOSITORY, useExisting: PrismaDocenteXMateriaCarreraRepository },

    // TerciarioAuthorizerService (Door 3 for Terciario)
    {
      provide: TERCIARIO_AUTHORIZER,
      useFactory: (repo: DocenteXMateriaCarreraRepository) => new TerciarioAuthorizerService(repo),
      inject: [DOCENTE_X_MATERIA_CARRERA_REPOSITORY],
    },

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
    {
      provide: RegistrarNotaUC,
      useFactory: (r: PrismaActaExamenRepository, i: PrismaInscripcionMateriaRepository) => new RegistrarNotaUC(r, i),
      inject: ['ActaExamenRepository', 'InscripcionRepository'],
    },
    {
      provide: RegistrarNotaFinalUC,
      useFactory: (
        r: PrismaActaExamenRepository,
        i: PrismaInscripcionMateriaRepository,
        nc: PrismaNotaCursadaTerciarioRepository,
        tx: PrismaTenantTransactionRunner,
        le: PrismaLlamadoExamenRepository,
        ca: PrismaCarreraRepository,
      ) => new RegistrarNotaFinalUC(r, i, nc, tx, le, ca),
      inject: [
        'ActaExamenRepository',
        'InscripcionRepository',
        'NotaCursadaTerciarioRepository',
        'TenantTransactionRunner',
        LLAMADO_EXAMEN_REPOSITORY,
        'CarreraRepository',
      ],
    },
    {
      provide: RegistrarPromocionalUC,
      useFactory: (i: PrismaInscripcionMateriaRepository) => new RegistrarPromocionalUC(i),
      inject: ['InscripcionRepository'],
    },

    // Nota cursada use cases (updated with authz injection)
    {
      provide: CreateNotaCursadaSlotUC,
      useFactory: (r: PrismaNotaCursadaTerciarioRepository, authz: TerciarioAuthorizerPort) =>
        new CreateNotaCursadaSlotUC(r, authz),
      inject: ['NotaCursadaTerciarioRepository', TERCIARIO_AUTHORIZER],
    },
    {
      provide: UpdateNotaCursadaSlotUC,
      useFactory: (r: PrismaNotaCursadaTerciarioRepository, authz: TerciarioAuthorizerPort) =>
        new UpdateNotaCursadaSlotUC(r, authz),
      inject: ['NotaCursadaTerciarioRepository', TERCIARIO_AUTHORIZER],
    },
    {
      provide: ListNotaCursadaSlotsUC,
      useFactory: (r: PrismaNotaCursadaTerciarioRepository) => new ListNotaCursadaSlotsUC(r),
      inject: ['NotaCursadaTerciarioRepository'],
    },
    {
      provide: ConfirmarNotaCursadaUC,
      useFactory: (i: PrismaInscripcionMateriaRepository, authz: TerciarioAuthorizerPort) =>
        new ConfirmarNotaCursadaUC(i, authz),
      inject: ['InscripcionRepository', TERCIARIO_AUTHORIZER],
    },

    // ListInscripcionesDocenteUC
    {
      provide: ListInscripcionesDocenteUC,
      useFactory: (authz: TerciarioAuthorizerPort, i: PrismaInscripcionMateriaRepository) =>
        new ListInscripcionesDocenteUC(authz, i),
      inject: [TERCIARIO_AUTHORIZER, 'InscripcionRepository'],
    },

    // Admin assignment use cases
    {
      provide: AssignDocenteMateriaUC,
      useFactory: (r: PrismaDocenteXMateriaCarreraRepository) => new AssignDocenteMateriaUC(r),
      inject: [DOCENTE_X_MATERIA_CARRERA_REPOSITORY],
    },
    {
      provide: ListAssignmentsUC,
      useFactory: (r: PrismaDocenteXMateriaCarreraRepository) => new ListAssignmentsUC(r),
      inject: [DOCENTE_X_MATERIA_CARRERA_REPOSITORY],
    },
    {
      provide: UnassignDocenteMateriaUC,
      useFactory: (r: PrismaDocenteXMateriaCarreraRepository) => new UnassignDocenteMateriaUC(r),
      inject: [DOCENTE_X_MATERIA_CARRERA_REPOSITORY],
    },

    // Titulo use cases
    { provide: CreateTituloUC, useFactory: (r: PrismaTituloRepository) => new CreateTituloUC(r), inject: ['TituloRepository'] },
    { provide: ListTitulosUC, useFactory: (r: PrismaTituloRepository) => new ListTitulosUC(r), inject: ['TituloRepository'] },
    { provide: GetTituloUC, useFactory: (r: PrismaTituloRepository) => new GetTituloUC(r), inject: ['TituloRepository'] },
    { provide: UpdateTituloEstadoUC, useFactory: (r: PrismaTituloRepository) => new UpdateTituloEstadoUC(r), inject: ['TituloRepository'] },

    // LlamadoExamen repository + use cases
    PrismaLlamadoExamenRepository,
    { provide: LLAMADO_EXAMEN_REPOSITORY, useExisting: PrismaLlamadoExamenRepository },
    { provide: CreateLlamadoExamenUC, useFactory: (r: PrismaLlamadoExamenRepository) => new CreateLlamadoExamenUC(r), inject: [LLAMADO_EXAMEN_REPOSITORY] },
    { provide: UpdateLlamadoExamenUC, useFactory: (r: PrismaLlamadoExamenRepository) => new UpdateLlamadoExamenUC(r), inject: [LLAMADO_EXAMEN_REPOSITORY] },
    { provide: ListLlamadosExamenUC, useFactory: (r: PrismaLlamadoExamenRepository) => new ListLlamadosExamenUC(r), inject: [LLAMADO_EXAMEN_REPOSITORY] },
    { provide: DeleteLlamadoExamenUC, useFactory: (r: PrismaLlamadoExamenRepository) => new DeleteLlamadoExamenUC(r), inject: [LLAMADO_EXAMEN_REPOSITORY] },
  ],
})
export class NivelTerciarioModule {}
