import { DomainError } from '../../shared/errors/domain-error';

export class MaxIntentosAlcanzadoError extends DomainError {
  constructor() {
    super(
      'El alumno alcanzó el máximo de 3 intentos para rendir el examen final y quedó LIBRE',
      'MAX_INTENTOS_ALCANZADO',
    );
  }
}
