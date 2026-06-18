import { DomainError } from '../../shared/errors/domain-error';

export class InvalidLlamadoRangeError extends DomainError {
  constructor(inicio: Date, fin: Date) {
    super(
      `fechaInicio (${inicio.toISOString()}) debe ser <= fechaFin (${fin.toISOString()})`,
      'INVALID_LLAMADO_RANGE',
    );
  }
}
