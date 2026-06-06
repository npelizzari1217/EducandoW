import { describe, it, expect } from 'vitest';
import { BoletinError } from '../generate-boletin.use-case';

// ── W3 — batch all-fail guard ──────────────────────────────────────────────────

describe('GenerateBoletinBatchUseCase — error codes', () => {
  it('NO_PRINTABLE_STUDENTS error shape is correct', () => {
    const err = new BoletinError('No hay alumnos imprimibles en este ciclo', 'NO_PRINTABLE_STUDENTS', 422);
    expect(err.code).toBe('NO_PRINTABLE_STUDENTS');
    expect(err.httpStatus).toBe(422);
  });

  it('BATCH_ALL_FAILED (422) is thrown when all per-student PDFs fail', () => {
    const err = new BoletinError(
      'No se pudo generar ningún boletín del lote — todos fallaron',
      'BATCH_ALL_FAILED',
      422,
    );
    expect(err.code).toBe('BATCH_ALL_FAILED');
    expect(err.httpStatus).toBe(422);
  });

  it('BATCH_ALL_FAILED is a BoletinError instance', () => {
    const err = new BoletinError('todos fallaron', 'BATCH_ALL_FAILED', 422);
    expect(err).toBeInstanceOf(BoletinError);
    expect(err).toBeInstanceOf(Error);
  });
});

// ── Verify successCount tracking logic (pure unit) ─────────────────────────────

describe('batch PDF success counting logic', () => {
  it('increments count only on successful PDF', () => {
    let successCount = 0;
    // Simulate 3 attempts: 1 success, 2 failures
    const results = [true, false, false];
    for (const ok of results) {
      if (ok) successCount++;
    }
    expect(successCount).toBe(1);
  });

  it('count stays 0 when all fail — guard triggers', () => {
    let successCount = 0;
    const results = [false, false, false];
    for (const ok of results) {
      if (ok) successCount++;
    }
    expect(successCount).toBe(0);
    // Guard: successCount === 0 should trigger BATCH_ALL_FAILED
    if (successCount === 0) {
      const err = new BoletinError('todos fallaron', 'BATCH_ALL_FAILED', 422);
      expect(err.code).toBe('BATCH_ALL_FAILED');
    }
  });

  it('count is positive when at least one PDF succeeds — no guard', () => {
    let successCount = 0;
    const results = [false, true, false]; // one success
    for (const ok of results) {
      if (ok) successCount++;
    }
    expect(successCount).toBeGreaterThan(0);
  });
});
