// Entities
export { Carrera } from './entities/carrera';
export type { CarreraProps } from './entities/carrera';
export { InscripcionMateria } from './entities/inscripcion-materia';
export type { InscripcionMateriaProps, CorrelativaRequerida } from './entities/inscripcion-materia';
export { ActaExamen } from './entities/acta-examen';
export type { ActaExamenProps, ActaExamenNota } from './entities/acta-examen';
export { Titulo } from './entities/titulo';
export type { TituloProps } from './entities/titulo';

// Value Objects
export { RegimenMateria } from './value-objects/regimen-materia';
export type { RegimenMateriaValue } from './value-objects/regimen-materia';
export { EstadoInscripcion } from './value-objects/estado-inscripcion';
export type { EstadoInscripcionValue } from './value-objects/estado-inscripcion';
export { EstadoTitulo } from './value-objects/estado-titulo';
export type { EstadoTituloValue } from './value-objects/estado-titulo';
export { CondicionExamen } from './value-objects/condicion-examen';
export type { CondicionExamenValue } from './value-objects/condicion-examen';

// Repositories
export type { CarreraRepository } from './repositories/carrera-repository';
export type { InscripcionRepository } from './repositories/inscripcion-repository';
export type { ActaExamenRepository } from './repositories/acta-examen-repository';
export type { TituloRepository } from './repositories/titulo-repository';
