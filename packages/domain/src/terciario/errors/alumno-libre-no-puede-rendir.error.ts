import { DomainError } from '../../shared/errors/domain-error';

export class AlumnoLibreNoPuedeRendirError extends DomainError {
  constructor() {
    super(
      'El alumno está en condición LIBRE y no puede rendir el examen final',
      'ALUMNO_LIBRE_NO_PUEDE_RENDIR',
    );
  }
}
