// Entities
export { Curso } from './entities/curso';
export type { CursoProps, CreateCursoInput } from './entities/curso';
export { MesaExamen } from './entities/mesa-examen';
export type { MesaExamenProps, MesaExamenInscripcionProps, CreateMesaExamenInput } from './entities/mesa-examen';
export { RegimenAcademico } from './entities/regimen-academico';
export type { RegimenAcademicoProps, CreateRegimenAcademicoInput } from './entities/regimen-academico';
export { CalificacionSecundario } from './entities/calificacion-secundario';
export type { CalificacionSecundarioProps, CreateCalificacionSecundarioInput } from './entities/calificacion-secundario';

// Entities — grading-secundario (Fase 4, Etapa 2 — PR2)
export { MateriaPrevia, MateriaPreviaStatus } from './entities/materia-previa';
export type { CreateMateriaPreviaInput, ReconstructMateriaPreviaProps } from './entities/materia-previa';

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
export type { CalificacionSecundarioRepository, PendingExamDetail } from './repositories/calificacion-secundario-repository';

// Repositories — grading-secundario (Fase 4, Etapa 2 — PR2)
export type { MateriaPreviaRepository } from './repositories/materia-previa-repository';
export { MATERIA_PREVIA_REPOSITORY } from './repositories/materia-previa-repository';
