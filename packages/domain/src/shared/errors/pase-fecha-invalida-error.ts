import { DomainError } from './domain-error';

/**
 * Thrown when a pase date is in the future.
 * HTTP mapping: 400 Bad Request (see exception.filter.ts DOMAIN_STATUS).
 */
export class PaseFechaInvalidaError extends DomainError {
  constructor() {
    super('La fecha de pase no puede ser futura', 'PASE_FECHA_INVALIDA');
  }
}
