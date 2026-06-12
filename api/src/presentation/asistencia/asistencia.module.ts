/**
 * AsistenciaModule — Fase 6 (F6-I3).
 *
 * Wires:
 *   - PrismaSubjectAbsenceRepository
 *   - PrismaDailyAttendanceRepository
 *   - PrismaGrupoRepository (for Door 2 group check)
 *   - PrismaDocenteXCicloRepository (for cycleId resolution + Door 2)
 *   - PrismaAsignacionCursoXCicloRepository (for isPreceptor check)
 *   - 4 use-cases + controller
 *
 * Imports DocenteCicloModule for PrismaDocenteXCicloRepository.
 * Imports AsignacionCursoModule for PrismaAsignacionCursoXCicloRepository.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AsistenciaController } from './asistencia.controller';
import { PrismaSubjectAbsenceRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-subject-absence.repository';
import { PrismaDailyAttendanceRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-daily-attendance.repository';
import { PrismaGrupoRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-grupo.repository';
import { PrismaDocenteXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-docente-x-ciclo.repository';
import { PrismaAsignacionCursoXCicloRepository } from '../../infrastructure/persistence/prisma/repositories/prisma-asignacion-curso-x-ciclo.repository';
import { RecordSubjectAbsenceUseCase } from '../../application/asistencia/record-subject-absence.use-case';
import { GetSubjectAbsencesUseCase } from '../../application/asistencia/get-subject-absences.use-case';
import { RecordDailyAttendanceUseCase } from '../../application/asistencia/record-daily-attendance.use-case';
import { GetDailyAttendanceUseCase } from '../../application/asistencia/get-daily-attendance.use-case';

@Module({
  imports: [AuthModule],
  controllers: [AsistenciaController],
  providers: [
    // ── Repositories ──────────────────────────────────────────────────────────
    PrismaSubjectAbsenceRepository,
    PrismaDailyAttendanceRepository,
    PrismaGrupoRepository,
    PrismaDocenteXCicloRepository,
    PrismaAsignacionCursoXCicloRepository,

    // ── Use-cases ─────────────────────────────────────────────────────────────

    {
      provide: RecordSubjectAbsenceUseCase,
      useFactory: (
        absenceRepo: PrismaSubjectAbsenceRepository,
        grupoRepo: PrismaGrupoRepository,
        docenteRepo: PrismaDocenteXCicloRepository,
      ) => new RecordSubjectAbsenceUseCase(absenceRepo, grupoRepo, docenteRepo),
      inject: [PrismaSubjectAbsenceRepository, PrismaGrupoRepository, PrismaDocenteXCicloRepository],
    },

    {
      provide: GetSubjectAbsencesUseCase,
      useFactory: (
        absenceRepo: PrismaSubjectAbsenceRepository,
        grupoRepo: PrismaGrupoRepository,
        docenteRepo: PrismaDocenteXCicloRepository,
      ) => new GetSubjectAbsencesUseCase(absenceRepo, grupoRepo, docenteRepo),
      inject: [PrismaSubjectAbsenceRepository, PrismaGrupoRepository, PrismaDocenteXCicloRepository],
    },

    {
      provide: RecordDailyAttendanceUseCase,
      useFactory: (
        attendanceRepo: PrismaDailyAttendanceRepository,
        docenteRepo: PrismaDocenteXCicloRepository,
        asignacionRepo: PrismaAsignacionCursoXCicloRepository,
      ) => new RecordDailyAttendanceUseCase(attendanceRepo, docenteRepo, asignacionRepo),
      inject: [PrismaDailyAttendanceRepository, PrismaDocenteXCicloRepository, PrismaAsignacionCursoXCicloRepository],
    },

    {
      provide: GetDailyAttendanceUseCase,
      useFactory: (
        attendanceRepo: PrismaDailyAttendanceRepository,
        docenteRepo: PrismaDocenteXCicloRepository,
        asignacionRepo: PrismaAsignacionCursoXCicloRepository,
      ) => new GetDailyAttendanceUseCase(attendanceRepo, docenteRepo, asignacionRepo),
      inject: [PrismaDailyAttendanceRepository, PrismaDocenteXCicloRepository, PrismaAsignacionCursoXCicloRepository],
    },
  ],
})
export class AsistenciaModule {}
