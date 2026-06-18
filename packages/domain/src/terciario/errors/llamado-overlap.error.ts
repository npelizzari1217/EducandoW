import { DomainError } from '../../shared/errors/domain-error';

export class LlamadoOverlapError extends DomainError {
  constructor(anioAcademico: string) {
    super(
      `Ya existe un llamado activo solapado en el año académico ${anioAcademico}`,
      'LLAMADO_OVERLAP',
    );
  }
}
