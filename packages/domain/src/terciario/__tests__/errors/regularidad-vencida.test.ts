import { describe, it, expect } from 'vitest';
import { RegularidadVencidaError } from '../../errors/regularidad-vencida.error';
import { DomainError } from '../../../shared/errors/domain-error';

describe('RegularidadVencidaError', () => {
  it('is an instance of DomainError', () => {
    const error = new RegularidadVencidaError();
    expect(error).toBeInstanceOf(DomainError);
  });

  it('has code REGULARIDAD_VENCIDA', () => {
    const error = new RegularidadVencidaError();
    expect(error.code).toBe('REGULARIDAD_VENCIDA');
  });

  it('has a non-empty message', () => {
    const error = new RegularidadVencidaError();
    expect(error.message).toBeTruthy();
    expect(error.message.length).toBeGreaterThan(0);
  });
});
