import { DomainError } from '../../shared/errors/domain-error';

export class InvalidIntentoError extends DomainError {
  constructor(intento: number) {
    super(
      `Intento inválido: ${intento}. Los valores válidos son 1, 2 o 3`,
      'INVALID_INTENTO',
    );
  }
}
