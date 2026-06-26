/**
 * T-11 [RED] — ReportesController#getConstanciaRegular handler tests.
 * Written before the handler exists (TDD RED phase).
 * Satisfies: REQ-2, REQ-6 (Sc6.1)
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { ConstanciaError } from '../../../application/reportes/templates/constancia.template';

let ReportesController: any;

beforeAll(async () => {
  const mod = await import('../reportes.controller');
  ReportesController = mod.ReportesController;
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  const json = vi.fn();
  const send = vi.fn();
  const set = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, set, send, json, _statusJson: json };
}

function makeController(executeImpl: () => Promise<unknown>) {
  const ctrl = Object.create(ReportesController.prototype);
  ctrl.singleUC = { execute: vi.fn() };
  ctrl.batchUC = { execute: vi.fn() };
  ctrl.constanciaUC = { execute: vi.fn().mockImplementation(executeImpl) };
  return ctrl;
}

const AXCC_ID = 'axcc-uuid-001';
const VALID_DTO = { destinatario: 'A pedido', fechaEmision: '2026-06-26' };

// ── ConstanciaError 404 → status+json ────────────────────────────────────────

describe('ReportesController#getConstanciaRegular — ConstanciaError 404', () => {
  it('returns status(404).json with statusCode/error/message (REQ-2)', async () => {
    const err404 = new ConstanciaError('AXCC no encontrado', 'AXCC_NOT_FOUND', 404);
    const ctrl = makeController(() => Promise.reject(err404));
    const res = makeRes();

    await ctrl.getConstanciaRegular(AXCC_ID, VALID_DTO, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res._statusJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: 'AXCC_NOT_FOUND',
        message: 'AXCC no encontrado',
      }),
    );
    expect(res.send).not.toHaveBeenCalled();
  });
});

// ── ConstanciaError 422 → status+json ────────────────────────────────────────

describe('ReportesController#getConstanciaRegular — ConstanciaError 422', () => {
  it('returns status(422).json with STUDENT_NOT_ELIGIBLE (REQ-2)', async () => {
    const err422 = new ConstanciaError('Alumno egresado', 'STUDENT_NOT_ELIGIBLE', 422);
    const ctrl = makeController(() => Promise.reject(err422));
    const res = makeRes();

    await ctrl.getConstanciaRegular(AXCC_ID, VALID_DTO, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res._statusJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 422,
        error: 'STUDENT_NOT_ELIGIBLE',
      }),
    );
    expect(res.send).not.toHaveBeenCalled();
  });
});

// ── Happy path → PDF response ─────────────────────────────────────────────────

describe('ReportesController#getConstanciaRegular — happy path', () => {
  it('sets Content-Type application/pdf, Content-Disposition inline, and sends buffer (REQ-6 Sc6.1)', async () => {
    const pdfBuffer = Buffer.from('%PDF-mock');
    const ctrl = makeController(() => Promise.resolve(pdfBuffer));
    const res = makeRes();

    await ctrl.getConstanciaRegular(AXCC_ID, VALID_DTO, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'application/pdf',
        'Content-Disposition': expect.stringContaining('inline'),
      }),
    );
    expect(res.send).toHaveBeenCalledWith(pdfBuffer);
  });

  it('includes axccId in the Content-Disposition filename', async () => {
    const pdfBuffer = Buffer.from('%PDF-mock');
    const ctrl = makeController(() => Promise.resolve(pdfBuffer));
    const res = makeRes();

    await ctrl.getConstanciaRegular(AXCC_ID, VALID_DTO, res);

    const setCall = res.set.mock.calls[0][0] as Record<string, string>;
    expect(setCall['Content-Disposition']).toContain(AXCC_ID);
  });
});

// ── Non-ConstanciaError is re-thrown ─────────────────────────────────────────

describe('ReportesController#getConstanciaRegular — non-ConstanciaError re-thrown', () => {
  it('re-throws unknown errors without swallowing (REQ-2)', async () => {
    const genericError = new Error('DB connection lost');
    const ctrl = makeController(() => Promise.reject(genericError));
    const res = makeRes();

    await expect(ctrl.getConstanciaRegular(AXCC_ID, VALID_DTO, res)).rejects.toThrow(
      'DB connection lost',
    );
    expect(res.status).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });
});
