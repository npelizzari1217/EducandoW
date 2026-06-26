/**
 * T-09 [RED] — ConstanciaBodySchema Zod validation tests.
 * Written before the DTO exists (TDD RED phase).
 * Satisfies: REQ-3 (Sc3.1–Sc3.5)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { BadRequestException } from '@nestjs/common';

let ConstanciaBodySchema: any;

beforeAll(async () => {
  const mod = await import('../dto/constancia.dto');
  ConstanciaBodySchema = mod.ConstanciaBodySchema;
});

const VALID_BODY = { destinatario: 'A pedido', fechaEmision: '2026-06-26' };

describe('ConstanciaBodySchema — ZodValidationPipe', () => {
  // REQ-3 Sc3.1 — body válido pasa sin errores
  it('accepts a valid body (Sc3.1)', () => {
    const pipe = new ZodValidationPipe(ConstanciaBodySchema);
    expect(() => pipe.transform(VALID_BODY)).not.toThrow();
  });

  // REQ-3 Sc3.2 — destinatario ausente → 400
  it('rejects body with missing destinatario → 400 (Sc3.2)', () => {
    const pipe = new ZodValidationPipe(ConstanciaBodySchema);
    expect(() => pipe.transform({ fechaEmision: '2026-06-26' })).toThrow(BadRequestException);
  });

  // REQ-3 Sc3.3 — destinatario vacío → 400
  it('rejects empty destinatario → 400 (Sc3.3)', () => {
    const pipe = new ZodValidationPipe(ConstanciaBodySchema);
    expect(() => pipe.transform({ destinatario: '', fechaEmision: '2026-06-26' })).toThrow(
      BadRequestException,
    );
  });

  // REQ-3 Sc3.3 — destinatario solo espacios → 400 (trim + min(1))
  it('rejects whitespace-only destinatario → 400 (Sc3.3 trim+min1)', () => {
    const pipe = new ZodValidationPipe(ConstanciaBodySchema);
    expect(() => pipe.transform({ destinatario: '   ', fechaEmision: '2026-06-26' })).toThrow(
      BadRequestException,
    );
  });

  // REQ-3 Sc3.4 — fechaEmision formato incorrecto → 400
  it('rejects fechaEmision in dd/mm/yyyy format → 400 (Sc3.4)', () => {
    const pipe = new ZodValidationPipe(ConstanciaBodySchema);
    expect(() =>
      pipe.transform({ destinatario: 'A pedido', fechaEmision: '26/06/2026' }),
    ).toThrow(BadRequestException);
  });

  // REQ-3 Sc3.5 — fechaEmision ausente → 400
  it('rejects body with missing fechaEmision → 400 (Sc3.5)', () => {
    const pipe = new ZodValidationPipe(ConstanciaBodySchema);
    expect(() => pipe.transform({ destinatario: 'A pedido' })).toThrow(BadRequestException);
  });
});

describe('ConstanciaBodySchema — calendar date validation', () => {
  // Fechas imposibles — pasan el regex pero no son fechas reales
  it('rejects month 13 (2026-13-45) → 400', () => {
    const pipe = new ZodValidationPipe(ConstanciaBodySchema);
    expect(() =>
      pipe.transform({ destinatario: 'A pedido', fechaEmision: '2026-13-45' }),
    ).toThrow(BadRequestException);
  });

  it('rejects month 00 (2026-00-10) → 400', () => {
    const pipe = new ZodValidationPipe(ConstanciaBodySchema);
    expect(() =>
      pipe.transform({ destinatario: 'A pedido', fechaEmision: '2026-00-10' }),
    ).toThrow(BadRequestException);
  });

  it('rejects February 30 (2026-02-30) → 400', () => {
    const pipe = new ZodValidationPipe(ConstanciaBodySchema);
    expect(() =>
      pipe.transform({ destinatario: 'A pedido', fechaEmision: '2026-02-30' }),
    ).toThrow(BadRequestException);
  });

  // Fechas válidas que deben pasar
  it('accepts a regular valid date (2026-06-26)', () => {
    const pipe = new ZodValidationPipe(ConstanciaBodySchema);
    expect(() =>
      pipe.transform({ destinatario: 'A pedido', fechaEmision: '2026-06-26' }),
    ).not.toThrow();
  });

  it('accepts leap year Feb 29 (2024-02-29)', () => {
    const pipe = new ZodValidationPipe(ConstanciaBodySchema);
    expect(() =>
      pipe.transform({ destinatario: 'A pedido', fechaEmision: '2024-02-29' }),
    ).not.toThrow();
  });
});
