import { describe, it, expect } from 'vitest';
import { IngresanteStatus, VALID_INGRESANTE_STATUSES } from '../../value-objects/ingresante-status';

describe('IngresanteStatus', () => {
  // ── Valid statuses ──────────────────────────────────────

  it.each(['INSCRIPTO', 'PAGO_MATRICULA', 'ACEPTADO', 'INGRESO', 'NO_INGRESARA'] as const)(
    'create accepts valid status: %s',
    (status) => {
      const result = IngresanteStatus.create(status);
      expect(result.isOk()).toBe(true);
      const vo = result.unwrap();
      expect(vo.value).toBe(status);
      expect(vo.toString()).toBe(status);
    },
  );

  it('create handles lowercase input', () => {
    const result = IngresanteStatus.create('inscripto');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().value).toBe('INSCRIPTO');
  });

  // ── Invalid statuses ────────────────────────────────────

  it('create rejects invalid status', () => {
    const result = IngresanteStatus.create('PENDING');
    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error.message).toContain('Invalid ingresante status');
    expect(error.message).toContain('PENDING');
  });

  it('create rejects empty string', () => {
    const result = IngresanteStatus.create('');
    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error.message).toContain('Invalid ingresante status');
  });

  it('create handles null/undefined gracefully', () => {
    const result = IngresanteStatus.create(null as unknown as string);
    expect(result.isErr()).toBe(true);
  });

  // ── Reconstruct bypasses validation ─────────────────────

  it('reconstruct returns instance without Result wrapping', () => {
    const status = IngresanteStatus.reconstruct('ACEPTADO');
    expect(status).toBeInstanceOf(IngresanteStatus);
    expect(status.value).toBe('ACEPTADO');
  });

  // ── Equality ────────────────────────────────────────────

  it('equals returns true for same value', () => {
    const a = IngresanteStatus.reconstruct('INSCRIPTO');
    const b = IngresanteStatus.reconstruct('INSCRIPTO');
    expect(a.equals(b)).toBe(true);
    expect(b.equals(a)).toBe(true);
  });

  it('equals returns false for different values', () => {
    const a = IngresanteStatus.reconstruct('INSCRIPTO');
    const b = IngresanteStatus.reconstruct('ACEPTADO');
    expect(a.equals(b)).toBe(false);
  });

  // ── VALID_STATUSES list ─────────────────────────────────

  it('VALID_INGRESANTE_STATUSES contains exactly the 5 expected values', () => {
    expect(VALID_INGRESANTE_STATUSES).toHaveLength(5);
    expect(VALID_INGRESANTE_STATUSES).toContain('INSCRIPTO');
    expect(VALID_INGRESANTE_STATUSES).toContain('PAGO_MATRICULA');
    expect(VALID_INGRESANTE_STATUSES).toContain('ACEPTADO');
    expect(VALID_INGRESANTE_STATUSES).toContain('INGRESO');
    expect(VALID_INGRESANTE_STATUSES).toContain('NO_INGRESARA');
  });
});
