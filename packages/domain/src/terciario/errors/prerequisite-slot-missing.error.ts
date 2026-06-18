import { DomainError } from '../../shared/errors/domain-error';

export class PrerequisiteSlotMissingError extends DomainError {
  constructor(slotRequerido: string) {
    super(
      `Falta el slot prerequisito ${slotRequerido} (debe estar DESAPROBADO o AUSENTE para habilitarse el recuperatorio)`,
      'PREREQUISITE_SLOT_MISSING',
    );
  }
}
