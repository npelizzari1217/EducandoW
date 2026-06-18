import { DomainError } from '../../shared/errors/domain-error';

export class CursadaNoConfirmadaError extends DomainError {
  constructor() {
    super(
      'La cursada no está confirmada (estado debe ser REGULAR, PROMOCIONAL, LIBRE o APROBADO)',
      'CURSADA_NO_CONFIRMADA',
    );
  }
}
