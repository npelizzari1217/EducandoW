// ── Asistencia Mensual (SDD-4) ───────────────────────────────────────────────

export { DayMap } from './value-objects/day-map';

// ── asistencia-dias-bloqueados — Phase 1: Calendar utils ─────────────────────
export { daysInMonth, dayOfWeek, buildLockedDayMap } from './utils/calendar-utils';

// ── asistencia-dias-bloqueados — Phase 2: Domain errors ──────────────────────
export { DayNotAssignableError } from './errors/day-not-assignable-error';
export { StatusNotAssignableError } from './errors/status-not-assignable-error';

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

export type { AsistenciaGeneralRepository, GenerateGeneralInput, EnrichedGeneralAttendance } from './repositories/asistencia-general-repository';
export type { AsistenciaMateriaRepository, GenerateMateriaInput, EnrichedMateriaAttendance } from './repositories/asistencia-materia-repository';
