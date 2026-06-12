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

  // ── canTransitionTo — valid edges ───────────────────────

  it.each([
    ['INSCRIPTO', 'PAGO_MATRICULA'],
    ['INSCRIPTO', 'NO_INGRESARA'],
    ['PAGO_MATRICULA', 'ACEPTADO'],
    ['PAGO_MATRICULA', 'NO_INGRESARA'],
    ['ACEPTADO', 'NO_INGRESARA'],
    ['ACEPTADO', 'INGRESO'],
  ] as const)(
    'canTransitionTo: %s → %s is valid',
    (from, to) => {
      const current = IngresanteStatus.reconstruct(from);
      const next = IngresanteStatus.reconstruct(to);
      expect(current.canTransitionTo(next)).toBe(true);
    },
  );

  // ── canTransitionTo — invalid edges ─────────────────────

  it.each([
    ['INSCRIPTO', 'ACEPTADO'],    // skip
    ['INSCRIPTO', 'INGRESO'],     // skip
    ['PAGO_MATRICULA', 'INSCRIPTO'], // backward
    ['ACEPTADO', 'INSCRIPTO'],    // backward
    ['ACEPTADO', 'PAGO_MATRICULA'], // backward
    ['INGRESO', 'INSCRIPTO'],     // terminal
    ['INGRESO', 'PAGO_MATRICULA'], // terminal
    ['INGRESO', 'ACEPTADO'],      // terminal
    ['INGRESO', 'NO_INGRESARA'],  // terminal
    ['NO_INGRESARA', 'INSCRIPTO'], // terminal
    ['NO_INGRESARA', 'PAGO_MATRICULA'], // terminal
  ] as const)(
    'canTransitionTo: %s → %s is invalid',
    (from, to) => {
      const current = IngresanteStatus.reconstruct(from);
      const next = IngresanteStatus.reconstruct(to);
      expect(current.canTransitionTo(next)).toBe(false);
    },
  );

  // ── isTerminal ───────────────────────────────────────────

  it.each(['INGRESO', 'NO_INGRESARA'] as const)(
    'isTerminal() returns true for terminal state: %s',
    (status) => {
      expect(IngresanteStatus.reconstruct(status).isTerminal()).toBe(true);
    },
  );

  it.each(['INSCRIPTO', 'PAGO_MATRICULA', 'ACEPTADO'] as const)(
    'isTerminal() returns false for non-terminal state: %s',
    (status) => {
      expect(IngresanteStatus.reconstruct(status).isTerminal()).toBe(false);
    },
  );

  it('canTransitionTo from terminal is always false regardless of destination', () => {
    const ingreso = IngresanteStatus.reconstruct('INGRESO');
    const noIngresara = IngresanteStatus.reconstruct('NO_INGRESARA');
    for (const s of ['INSCRIPTO', 'PAGO_MATRICULA', 'ACEPTADO', 'INGRESO', 'NO_INGRESARA'] as const) {
      const target = IngresanteStatus.reconstruct(s);
      expect(ingreso.canTransitionTo(target)).toBe(false);
      expect(noIngresara.canTransitionTo(target)).toBe(false);
    }
  });
});
