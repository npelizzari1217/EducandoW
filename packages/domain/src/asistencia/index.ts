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
