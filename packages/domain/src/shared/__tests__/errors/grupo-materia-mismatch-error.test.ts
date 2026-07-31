/**
 * GrupoMateriaMismatchError — Strict TDD (RED first).
 * Satisfies: MGCM-R3 (grupo⊆materia containment mismatch, 500 → 422).
 * Same pattern as AlumnoAlreadyInGrupoError / PresenteTypeNotFoundError.
 */
import { describe, it, expect } from 'vitest';
import { DomainError } from '../../errors/domain-error';
import { GrupoMateriaMismatchError } from '../../errors/grupo-materia-mismatch-error';

describe('GrupoMateriaMismatchError', () => {
  it('has code GRUPO_MATERIA_MISMATCH', () => {
    const e = new GrupoMateriaMismatchError();
    expect(e.code).toBe('GRUPO_MATERIA_MISMATCH');
  });

  it('is an instance of DomainError and Error', () => {
    const e = new GrupoMateriaMismatchError();
    expect(e).toBeInstanceOf(DomainError);
    expect(e).toBeInstanceOf(Error);
  });
});
