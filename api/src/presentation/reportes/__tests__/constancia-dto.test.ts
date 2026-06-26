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
