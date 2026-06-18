import { DomainError } from '../../shared/errors/domain-error';

export class CondicionCursadaInvalidaError extends DomainError {
  constructor(condicion: string) {
    super(
      `Condición de cursada inválida: ${condicion}. Los valores permitidos para confirmación son REGULAR, PROMOCIONAL o LIBRE`,
      'CONDICION_INVALIDA',
    );
  }
}
