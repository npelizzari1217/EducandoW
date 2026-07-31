import { DomainError } from './domain-error';

/**
 * Thrown when a student's materia membership does not belong to the target grupo's materia
 * (grupo ⊆ materia containment, MGC-R4 / MGC-S10 / MGC-S11).
 * HTTP mapping: 422 Unprocessable Entity (see exception.filter.ts DOMAIN_STATUS).
 * Semantics: a syntactically valid but semantically unprocessable relation between two entities
 * — NOT a state conflict (409), NOT infrastructure (500).
 */
export class GrupoMateriaMismatchError extends DomainError {
  constructor() {
    super(
      'El alumno no pertenece al universo de la materia de este grupo',
      'GRUPO_MATERIA_MISMATCH',
    );
  }
}
