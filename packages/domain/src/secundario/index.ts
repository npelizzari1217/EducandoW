// Entities
export { Curso } from './entities/curso';
export type { CursoProps, CreateCursoInput } from './entities/curso';
export { MesaExamen } from './entities/mesa-examen';
export type { MesaExamenProps, MesaExamenInscripcionProps, CreateMesaExamenInput } from './entities/mesa-examen';
export { RegimenAcademico } from './entities/regimen-academico';
export type { RegimenAcademicoProps, CreateRegimenAcademicoInput } from './entities/regimen-academico';

// Value Objects
export { Orientacion } from './value-objects/orientacion';
export type { OrientacionCode } from './value-objects/orientacion';
export { TurnoExamen } from './value-objects/turno-examen';
export type { TurnoExamenCode } from './value-objects/turno-examen';
export { CondicionAlumno } from './value-objects/condicion-alumno';
export type { CondicionAlumnoCode } from './value-objects/condicion-alumno';

// Repositories
export type { CursoRepository } from './repositories/curso-repository';
export type { MesaExamenRepository } from './repositories/mesa-examen-repository';
export type { RegimenAcademicoRepository } from './repositories/regimen-academico-repository';
