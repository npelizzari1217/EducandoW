import { DomainError } from './domain-error';

export class DocenteAlreadyAssignedError extends DomainError {
  constructor() {
    super('El docente ya está asignado a esta materia y año', 'DOCENTE_ALREADY_ASSIGNED');
  }
}
