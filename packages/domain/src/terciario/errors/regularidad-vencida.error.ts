import { DomainError } from '../../shared/errors/domain-error';

export class RegularidadVencidaError extends DomainError {
  constructor() {
    super(
      'La regularidad del alumno ha vencido: se han superado los llamados de examen permitidos',
      'REGULARIDAD_VENCIDA',
    );
  }
}
