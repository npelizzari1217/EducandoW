/**
 * AsistenciaModule — Monthly attendance register (SDD-4, PR-3).
 *
 * Wires the 5 new monthly attendance use-cases and all required repositories.
 *
 * Use-cases:
 *   - GenerateMonthlyAttendanceUseCase  (admin: materializes register rows)
 *   - ListGeneralAttendanceUseCase      (preceptor/admin: read general register)
 *   - RecordGeneralAttendanceDayUseCase (preceptor/admin: write one day)
 *   - ListSubjectAttendanceUseCase      (teacher/admin: read per-materia register)
 *   - RecordSubjectAttendanceDayUseCase (teacher/admin: write one day per-materia)
 *
 * Repositories consumed:
 *   Asistencia (new):
 *     PrismaAsistenciaGeneralRepository — general monthly register
 *     PrismaAsistenciaMateriaRepository — per-materia monthly register
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

@Module({
  imports: [AuthModule],
  controllers: [AsistenciaController],
  providers: [
    // ── Repositories ──────────────────────────────────────────────────────────
    PrismaAsistenciaGeneralRepository,
    PrismaAsistenciaMateriaRepository,
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
      ) => new GenerateMonthlyAttendanceUseCase(alumnosCCRepo, mxccRepo, alumnosXMateriaRepo, generalRepo, materiaAsistRepo),
      inject: [
        PrismaAlumnosXCursoXCicloRepository,
        PrismaMateriaXCursoXCicloRepository,
        PrismaAlumnosXMateriaRepository,
        PrismaAsistenciaGeneralRepository,
        PrismaAsistenciaMateriaRepository,
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
      ) => new RecordGeneralAttendanceDayUseCase(generalRepo, attendanceTypeRepo, docenteRepo, asignacionRepo),
      inject: [
        PrismaAsistenciaGeneralRepository,
        PrismaAttendanceTypeRepository,
        PrismaDocenteXCicloRepository,
        PrismaAsignacionCursoXCicloRepository,
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
      ) => new RecordSubjectAttendanceDayUseCase(materiaAsistRepo, attendanceTypeRepo, grupoRepo, alumnosXGrupoRepo, docenteRepo),
      inject: [
        PrismaAsistenciaMateriaRepository,
        PrismaAttendanceTypeRepository,
        PrismaGrupoRepository,
        PrismaAlumnosXGrupoRepository,
        PrismaDocenteXCicloRepository,
      ],
    },
  ],
})
export class AsistenciaModule {}
