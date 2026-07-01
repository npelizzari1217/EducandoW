/**
 * AsistenciaModule — Monthly attendance register (SDD-4, PR-3) + cierre mensual
 * de asistencia (Capacidad B, fase-bimestre-cierre-asistencia PR-3b).
 *
 * Wires the monthly attendance use-cases and all required repositories.
 *
 * Use-cases:
 *   - GenerateMonthlyAttendanceUseCase  (admin: materializes register rows)
 *   - ListGeneralAttendanceUseCase      (preceptor/admin: read general register)
 *   - RecordGeneralAttendanceDayUseCase (preceptor/admin: write one day)
 *   - ListSubjectAttendanceUseCase      (teacher/admin: read per-materia register)
 *   - RecordSubjectAttendanceDayUseCase (teacher/admin: write one day per-materia)
 *   - GetAttendanceMonthStatusUseCase   (broad read: month open/closed status)
 *   - OpenAttendanceMonthUseCase        (Secretario+: reopen a month)
 *   - CloseAttendanceMonthUseCase       (Secretario+: close a month)
 *
 * Repositories consumed:
 *   Asistencia (new):
 *     PrismaAsistenciaGeneralRepository — general monthly register
 *     PrismaAsistenciaMateriaRepository — per-materia monthly register
 *     PrismaAttendanceMonthStatusRepository — cierre mensual (PR-3b)
 *   Enrollment (existing):
 *     PrismaAlumnosXCursoXCicloRepository — general roster for generate
 *     PrismaMateriaXCursoXCicloRepository — materia list for generate
 *     PrismaAlumnosXMateriaRepository     — student-materia assignments for generate
 *   Catalog (existing):
 *     PrismaAttendanceTypeRepository      — validate statusCode
 *   Groups (existing):
 *     PrismaGrupoRepository               — teacher's groups for Door 2
 *     PrismaAlumnosXGrupoRepository       — students in group for filter + Door 2
 *   Auth (existing):
 *     PrismaDocenteXCicloRepository       — cycleId resolution + Door 2
 *     PrismaAsignacionCursoXCicloRepository — isPreceptor check
 *
 * AsistenciaModule is already registered in AppModule (l.25, l.64) — no change needed there.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AsistenciaController } from './asistencia.controller';

// ── Repositories — asistencia (new in SDD-4) ──────────────────────────────────
import { PrismaAsistenciaGeneralRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-asistencia-general.repository';
import { PrismaAsistenciaMateriaRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-asistencia-materia.repository';
import { PrismaAttendanceMonthStatusRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-attendance-month-status.repository';

// ── Repositories — enrollment ─────────────────────────────────────────────────
import { PrismaAlumnosXCursoXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-alumnos-x-curso-x-ciclo.repository';
import { PrismaMateriaXCursoXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-materia-x-curso-x-ciclo.repository';
import { PrismaAlumnosXMateriaRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-alumnos-x-materia.repository';

// ── Repositories — catalog ────────────────────────────────────────────────────
import { PrismaAttendanceTypeRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-attendance-type.repository';

// ── Repositories — groups ─────────────────────────────────────────────────────
import { PrismaGrupoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-grupo.repository';
import { PrismaAlumnosXGrupoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-alumnos-x-grupo.repository';

// ── Repositories — auth (Door 2) ──────────────────────────────────────────────
import { PrismaDocenteXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-docente-x-ciclo.repository';
import { PrismaAsignacionCursoXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-asignacion-curso-x-ciclo.repository';

// ── Use-cases ─────────────────────────────────────────────────────────────────
import { GenerateMonthlyAttendanceUseCase } from '../../application/asistencia/generate-monthly-attendance.use-case';
import { ListGeneralAttendanceUseCase } from '../../application/asistencia/list-general-attendance.use-case';
import { RecordGeneralAttendanceDayUseCase } from '../../application/asistencia/record-general-attendance-day.use-case';
import { ListSubjectAttendanceUseCase } from '../../application/asistencia/list-subject-attendance.use-case';
import { RecordSubjectAttendanceDayUseCase } from '../../application/asistencia/record-subject-attendance-day.use-case';
import {
  GetAttendanceMonthStatusUseCase,
  OpenAttendanceMonthUseCase,
  CloseAttendanceMonthUseCase,
} from '../../application/asistencia/attendance-month-status.use-cases';

@Module({
  imports: [AuthModule],
  controllers: [AsistenciaController],
  providers: [
    // ── Repositories ──────────────────────────────────────────────────────────
    PrismaAsistenciaGeneralRepository,
    PrismaAsistenciaMateriaRepository,
    PrismaAttendanceMonthStatusRepository,
    PrismaAlumnosXCursoXCicloRepository,
    PrismaMateriaXCursoXCicloRepository,
    PrismaAlumnosXMateriaRepository,
    PrismaAttendanceTypeRepository,
    PrismaGrupoRepository,
    PrismaAlumnosXGrupoRepository,
    PrismaDocenteXCicloRepository,
    PrismaAsignacionCursoXCicloRepository,

    // ── Use-cases ─────────────────────────────────────────────────────────────

    {
      provide: GenerateMonthlyAttendanceUseCase,
      useFactory: (
        alumnosCCRepo: PrismaAlumnosXCursoXCicloRepository,
        mxccRepo: PrismaMateriaXCursoXCicloRepository,
        alumnosXMateriaRepo: PrismaAlumnosXMateriaRepository,
        generalRepo: PrismaAsistenciaGeneralRepository,
        materiaAsistRepo: PrismaAsistenciaMateriaRepository,
        monthStatusRepo: PrismaAttendanceMonthStatusRepository,
      ) => new GenerateMonthlyAttendanceUseCase(
        alumnosCCRepo, mxccRepo, alumnosXMateriaRepo, generalRepo, materiaAsistRepo, monthStatusRepo,
      ),
      inject: [
        PrismaAlumnosXCursoXCicloRepository,
        PrismaMateriaXCursoXCicloRepository,
        PrismaAlumnosXMateriaRepository,
        PrismaAsistenciaGeneralRepository,
        PrismaAsistenciaMateriaRepository,
        PrismaAttendanceMonthStatusRepository,
      ],
    },

    {
      provide: ListGeneralAttendanceUseCase,
      useFactory: (
        generalRepo: PrismaAsistenciaGeneralRepository,
        docenteRepo: PrismaDocenteXCicloRepository,
        asignacionRepo: PrismaAsignacionCursoXCicloRepository,
      ) => new ListGeneralAttendanceUseCase(generalRepo, docenteRepo, asignacionRepo),
      inject: [
        PrismaAsistenciaGeneralRepository,
        PrismaDocenteXCicloRepository,
        PrismaAsignacionCursoXCicloRepository,
      ],
    },

    {
      provide: RecordGeneralAttendanceDayUseCase,
      useFactory: (
        generalRepo: PrismaAsistenciaGeneralRepository,
        attendanceTypeRepo: PrismaAttendanceTypeRepository,
        docenteRepo: PrismaDocenteXCicloRepository,
        asignacionRepo: PrismaAsignacionCursoXCicloRepository,
        monthStatusRepo: PrismaAttendanceMonthStatusRepository,
      ) => new RecordGeneralAttendanceDayUseCase(
        generalRepo, attendanceTypeRepo, docenteRepo, asignacionRepo, monthStatusRepo,
      ),
      inject: [
        PrismaAsistenciaGeneralRepository,
        PrismaAttendanceTypeRepository,
        PrismaDocenteXCicloRepository,
        PrismaAsignacionCursoXCicloRepository,
        PrismaAttendanceMonthStatusRepository,
      ],
    },

    {
      provide: ListSubjectAttendanceUseCase,
      useFactory: (
        materiaAsistRepo: PrismaAsistenciaMateriaRepository,
        grupoRepo: PrismaGrupoRepository,
        alumnosXGrupoRepo: PrismaAlumnosXGrupoRepository,
        docenteRepo: PrismaDocenteXCicloRepository,
      ) => new ListSubjectAttendanceUseCase(materiaAsistRepo, grupoRepo, alumnosXGrupoRepo, docenteRepo),
      inject: [
        PrismaAsistenciaMateriaRepository,
        PrismaGrupoRepository,
        PrismaAlumnosXGrupoRepository,
        PrismaDocenteXCicloRepository,
      ],
    },

    {
      provide: RecordSubjectAttendanceDayUseCase,
      useFactory: (
        materiaAsistRepo: PrismaAsistenciaMateriaRepository,
        attendanceTypeRepo: PrismaAttendanceTypeRepository,
        grupoRepo: PrismaGrupoRepository,
        alumnosXGrupoRepo: PrismaAlumnosXGrupoRepository,
        docenteRepo: PrismaDocenteXCicloRepository,
        monthStatusRepo: PrismaAttendanceMonthStatusRepository,
      ) => new RecordSubjectAttendanceDayUseCase(
        materiaAsistRepo, attendanceTypeRepo, grupoRepo, alumnosXGrupoRepo, docenteRepo, monthStatusRepo,
      ),
      inject: [
        PrismaAsistenciaMateriaRepository,
        PrismaAttendanceTypeRepository,
        PrismaGrupoRepository,
        PrismaAlumnosXGrupoRepository,
        PrismaDocenteXCicloRepository,
        PrismaAttendanceMonthStatusRepository,
      ],
    },

    {
      provide: GetAttendanceMonthStatusUseCase,
      useFactory: (monthStatusRepo: PrismaAttendanceMonthStatusRepository) =>
        new GetAttendanceMonthStatusUseCase(monthStatusRepo),
      inject: [PrismaAttendanceMonthStatusRepository],
    },

    {
      provide: OpenAttendanceMonthUseCase,
      useFactory: (monthStatusRepo: PrismaAttendanceMonthStatusRepository) =>
        new OpenAttendanceMonthUseCase(monthStatusRepo),
      inject: [PrismaAttendanceMonthStatusRepository],
    },

    {
      provide: CloseAttendanceMonthUseCase,
      useFactory: (monthStatusRepo: PrismaAttendanceMonthStatusRepository) =>
        new CloseAttendanceMonthUseCase(monthStatusRepo),
      inject: [PrismaAttendanceMonthStatusRepository],
    },
  ],
})
export class AsistenciaModule {}
