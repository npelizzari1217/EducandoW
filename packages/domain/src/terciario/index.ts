// Entities
export { Carrera } from './entities/carrera';
export type { CarreraProps } from './entities/carrera';
export { InscripcionMateria } from './entities/inscripcion-materia';
export type { InscripcionMateriaProps, CorrelativaRequerida } from './entities/inscripcion-materia';
export { ActaExamen } from './entities/acta-examen';
export type { ActaExamenProps, ActaExamenNota } from './entities/acta-examen';
export { Titulo } from './entities/titulo';
export type { TituloProps } from './entities/titulo';
export { NotaCursadaTerciario } from './entities/nota-cursada-terciario';
export type { NotaCursadaTerciarioProps } from './entities/nota-cursada-terciario';

// Value Objects
export { RegimenMateria } from './value-objects/regimen-materia';
export type { RegimenMateriaValue } from './value-objects/regimen-materia';
export { EstadoInscripcion } from './value-objects/estado-inscripcion';
export type { EstadoInscripcionValue } from './value-objects/estado-inscripcion';
export { EstadoTitulo } from './value-objects/estado-titulo';
export type { EstadoTituloValue } from './value-objects/estado-titulo';
export { CondicionExamen } from './value-objects/condicion-examen';
export type { CondicionExamenValue } from './value-objects/condicion-examen';
export { SlotCursadaTerciario } from './value-objects/slot-cursada-terciario';
export type { SlotCursadaTerciarioValue } from './value-objects/slot-cursada-terciario';
export { CondicionCursada } from './value-objects/condicion-cursada';
export type { CondicionCursadaValue } from './value-objects/condicion-cursada';
export { IntentoFinal } from './value-objects/intento-final';
export type { IntentoFinalValue } from './value-objects/intento-final';

// Errors
export { SlotAlreadyExistsError } from './errors/slot-already-exists.error';
export { PrerequisiteSlotMissingError } from './errors/prerequisite-slot-missing.error';
export { ParcialYaAprobadoError } from './errors/parcial-ya-aprobado.error';
export { InvalidIntentoError } from './errors/invalid-intento.error';
export { AlumnoLibreNoPuedeRendirError } from './errors/alumno-libre-no-puede-rendir.error';
export { CursadaNoConfirmadaError } from './errors/cursada-no-confirmada.error';
export { TpObligatorioFaltanteError } from './errors/tp-obligatorio-faltante.error';
export { MaxIntentosAlcanzadoError } from './errors/max-intentos-alcanzado.error';
export { CondicionCursadaInvalidaError } from './errors/condicion-cursada-invalida.error';

// Policies
export { RecuperatorioPolicy } from './policies/recuperatorio-policy';
export { FinalEligibilityPolicy } from './policies/final-eligibility-policy';

// Repositories
export type { CarreraRepository } from './repositories/carrera-repository';
export type { InscripcionRepository } from './repositories/inscripcion-repository';
export type { ActaExamenRepository } from './repositories/acta-examen-repository';
export type { TituloRepository } from './repositories/titulo-repository';
export type { NotaCursadaTerciarioRepository } from './repositories/nota-cursada-terciario-repository';
