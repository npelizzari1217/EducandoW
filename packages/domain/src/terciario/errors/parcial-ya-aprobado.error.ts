import { DomainError } from '../../shared/errors/domain-error';

export class ParcialYaAprobadoError extends DomainError {
  constructor(slotParcial: string) {
    super(
      `El parcial ${slotParcial} ya fue aprobado; no puede rendir recuperatorio`,
      'PARCIAL_YA_APROBADO',
    );
  }
}
