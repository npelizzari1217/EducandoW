// ── Asistencia (Fase 6) ──────────────────────────────────────────────────────

export { AusenciaXGrupo } from './entities/ausencia-x-grupo';
export type { AusenciaXGrupoProps, CreateAusenciaXGrupoInput } from './entities/ausencia-x-grupo';

export { AsistenciaDiaria } from './entities/asistencia-diaria';
export type { AsistenciaDiariaProps, CreateAsistenciaDiariaInput } from './entities/asistencia-diaria';

export type { SubjectAbsenceRepository } from './repositories/subject-absence-repository';
export type { DailyAttendanceRepository } from './repositories/daily-attendance-repository';

// ── Asistencia Mensual (SDD-4) ───────────────────────────────────────────────

export { DayMap } from './value-objects/day-map';

export { AsistenciaXAlumnoXCursoXCiclo } from './entities/asistencia-x-alumno-x-curso-x-ciclo';
export type {
  AsistenciaXAlumnoXCursoXCicloProps,
  CreateAsistenciaXAlumnoXCursoXCicloInput,
} from './entities/asistencia-x-alumno-x-curso-x-ciclo';

export { AsistenciaXMateriaXAlumnoXCursoXCiclo } from './entities/asistencia-x-materia-x-alumno-x-curso-x-ciclo';
export type {
  AsistenciaXMateriaXAlumnoXCursoXCicloProps,
  CreateAsistenciaXMateriaXAlumnoXCursoXCicloInput,
} from './entities/asistencia-x-materia-x-alumno-x-curso-x-ciclo';

export type { AsistenciaGeneralRepository, GenerateGeneralInput } from './repositories/asistencia-general-repository';
export type { AsistenciaMateriaRepository, GenerateMateriaInput } from './repositories/asistencia-materia-repository';
