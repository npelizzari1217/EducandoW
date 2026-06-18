import { DomainError } from '../../shared/errors/domain-error';

export class TpObligatorioFaltanteError extends DomainError {
  constructor() {
    super(
      'Falta el TP obligatorio aprobado para poder rendir el examen final', // [SUPUESTO]
      'TP_OBLIGATORIO_FALTANTE',
    );
  }
}
