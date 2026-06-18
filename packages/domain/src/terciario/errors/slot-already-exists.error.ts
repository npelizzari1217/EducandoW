import { DomainError } from '../../shared/errors/domain-error';

export class SlotAlreadyExistsError extends DomainError {
  constructor(slot: string, inscripcionMateriaId: string) {
    super(
      `El slot ${slot} ya existe para la inscripción ${inscripcionMateriaId}`,
      'SLOT_ALREADY_EXISTS',
    );
  }
}
