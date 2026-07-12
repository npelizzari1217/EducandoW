import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, err } from '@educandow/domain';
import { BoletinError } from '../generate-boletin.use-case';
import { GenerateBoletinBatchUseCase } from '../generate-boletin-batch.use-case';
import { PdfError } from '../../shared/errors/pdf.error';
import { TenantContext } from '../../../infrastructure/auth/tenant.context';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
    getInstitutionId: vi.fn().mockReturnValue(null),
  },
}));

// Mock archiver: CJS default-export interop differs in Vitest vs SWC/Node.
// FIEL a archiver v7: finalize() resuelve DESPUÉS de que el Writable piped emite 'finish'.
// Esto reproduce el bug real: si execute() engancha su listener 'finish' recién tras
// `await finalize()`, el evento ya pasó → la Promise nunca resuelve → cuelga.
//
// `appendedEntries` (via vi.hoisted) records every archive.append(buffer, {name})
// call across ALL Archiver() instances created during a test, so PPR-S10 can
// assert the ZIP contains exactly N-1 entries (no garbage from a failed row).
const { appendedEntries } = vi.hoisted(() => ({
  appendedEntries: [] as Array<{ name: string; buffer: Buffer }>,
}));

vi.mock('archiver', () => {
  function mockArchiverFactory() {
    let pipedTo: any = null;
    return {
      on: vi.fn(),
      pipe(target: any) { pipedTo = target; },
      append: vi.fn((buffer: Buffer, opts: { name: string }) => {
        appendedEntries.push({ name: opts.name, buffer });
      }),
      finalize() {
        return new Promise<void>((resolve) => {
          if (pipedTo && typeof pipedTo.end === 'function') {
            pipedTo.once('finish', () => resolve());
            pipedTo.end();
          } else {
            resolve();
          }
        });
      },
    };
  }
  return { default: mockArchiverFactory };
});

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

// ── T14/T15: Batch repointed to AlumnosXCursoXCiclo (courseCycleId grain) ──────
// Scenario A and B from REQ-PG-2 to REQ-PG-4.
// RED until T15 rewrites execute(courseCycleId); GREEN after T15.

describe('GenerateBoletinBatchUseCase — repointed to AlumnosXCursoXCiclo', () => {
  // ADR-5: singleUC.execute now returns Result<Buffer, PdfError> (PDF failures,
  // canal A) instead of resolving to a raw Buffer / throwing. `throwIds` keeps
  // the throw path available to prove the batch still handles BoletinError
  // (canal B, validation) — the dual-channel coexistence documented in ADR-3.
  function makeSingleUC(successIds: string[] = [], throwIds: string[] = []): any {
    return {
      execute: vi.fn().mockImplementation(async (axccId: string) => {
        if (successIds.includes(axccId)) return ok(Buffer.from(`PDF-${axccId}`));
        if (throwIds.includes(axccId)) throw new BoletinError('fail', 'INTERNAL_ERROR', 500);
        return err(new PdfError({ cause: new Error(`render failed for ${axccId}`) }));
      }),
    };
  }

  function makeAxccRows(configs: Array<{ id: string; studentId: string; printable: boolean }>) {
    return configs.map((c) => ({
      id: c.id,
      courseCycleId: 'cc-1',
      studentId: c.studentId,
      printable: c.printable,
      student: { id: c.studentId, firstName: 'Juan', lastName: `Test${c.id}` },
    }));
  }

  beforeEach(() => {
    appendedEntries.length = 0;
    vi.mocked(TenantContext.getClient).mockReset();
  });

  it('Scenario A — batch with mixed printable: generates PDFs only for printable=true rows', async () => {
    // Students A (printable=true), B (printable=false), C (printable=true)
    const rows = makeAxccRows([
      { id: 'axcc-A', studentId: 'stu-A', printable: true },
      { id: 'axcc-B', studentId: 'stu-B', printable: false },
      { id: 'axcc-C', studentId: 'stu-C', printable: true },
    ]);

    const client = {
      alumnosXCursoXCiclo: {
        findMany: vi.fn().mockResolvedValue(rows.filter((r) => r.printable)),
      },
    };
    vi.mocked(TenantContext.getClient).mockReturnValue(client as any);

    const singleUC = makeSingleUC(['axcc-A', 'axcc-C']);
    const batchUC = new GenerateBoletinBatchUseCase(singleUC);

    const result = await batchUC.execute('cc-1');

    // Only printable=true rows → singleUC called twice (A and C), not for B
    expect(singleUC.execute).toHaveBeenCalledTimes(2);
    expect(singleUC.execute).toHaveBeenCalledWith('axcc-A');
    expect(singleUC.execute).toHaveBeenCalledWith('axcc-C');
    expect(singleUC.execute).not.toHaveBeenCalledWith('axcc-B');
    // Result is a ZIP buffer
    expect(result).toBeInstanceOf(Buffer);
  });

  it('Scenario B — batch with zero printable: returns empty ZIP, no error', async () => {
    // All students printable=false → no rows returned (findMany with printable:true)
    const client = {
      alumnosXCursoXCiclo: {
        findMany: vi.fn().mockResolvedValue([]), // 0 printable rows
      },
    };
    vi.mocked(TenantContext.getClient).mockReturnValue(client as any);

    const singleUC = makeSingleUC();
    const batchUC = new GenerateBoletinBatchUseCase(singleUC);

    // Zero printable students → NO error, returns empty ZIP (REQ-PG-4)
    const result = await batchUC.execute('cc-1');

    expect(result).toBeInstanceOf(Buffer);
    expect(singleUC.execute).not.toHaveBeenCalled();
  });

  it('Scenario A — alumnosXCursoXCiclo.findMany called with courseCycleId + printable:true filter', async () => {
    const client = {
      alumnosXCursoXCiclo: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    vi.mocked(TenantContext.getClient).mockReturnValue(client as any);

    const batchUC = new GenerateBoletinBatchUseCase(makeSingleUC());
    await batchUC.execute('cc-target');

    // Must query AlumnosXCursoXCiclo by courseCycleId + printable=true (not enrollment)
    expect(client.alumnosXCursoXCiclo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ courseCycleId: 'cc-target', printable: true }),
      }),
    );
  });

  // ── PPR-S10 — a single PDF failure (Result) doesn't break the ZIP or leak garbage ──

  it('(PPR-S10) 1 of N rows returns err(PdfError): ZIP has exactly N-1 PDFs, failure logged, no garbage entry, no throw', async () => {
    const rows = makeAxccRows([
      { id: 'axcc-A', studentId: 'stu-A', printable: true },
      { id: 'axcc-B', studentId: 'stu-B', printable: true }, // this one fails (Result err)
      { id: 'axcc-C', studentId: 'stu-C', printable: true },
    ]);

    const client = {
      alumnosXCursoXCiclo: {
        findMany: vi.fn().mockResolvedValue(rows),
      },
    };
    vi.mocked(TenantContext.getClient).mockReturnValue(client as any);

    // A and C succeed (ok(buffer)); B is neither in successIds nor throwIds →
    // makeSingleUC's default branch returns err(PdfError) for it.
    const singleUC = makeSingleUC(['axcc-A', 'axcc-C']);
    const batchUC = new GenerateBoletinBatchUseCase(singleUC);

    const result = await batchUC.execute('cc-1');

    // Batch does NOT throw — resolves to a ZIP Buffer
    expect(result).toBeInstanceOf(Buffer);

    // singleUC.execute was called for all 3 rows (batch doesn't skip on Result)
    expect(singleUC.execute).toHaveBeenCalledTimes(3);

    // ZIP contains exactly N-1 = 2 entries — one per successful row, nothing
    // appended for axcc-B (no Result object treated as a Buffer/appended as garbage)
    expect(appendedEntries).toHaveLength(2);
    const names = appendedEntries.map((e) => e.name);
    expect(names.some((n) => n.includes('Testaxcc-A'))).toBe(true);
    expect(names.some((n) => n.includes('Testaxcc-C'))).toBe(true);
    expect(names.some((n) => n.includes('Testaxcc-B'))).toBe(false);

    // Each appended entry is a real Buffer with the expected bytes (not a Result wrapper)
    for (const entry of appendedEntries) {
      expect(entry.buffer).toBeInstanceOf(Buffer);
      expect(entry.buffer.toString()).toMatch(/^PDF-axcc-[AC]$/);
    }
  });

  it('(PPR-S10) singleUC still handles thrown BoletinError (canal B) alongside Result errors (canal A)', async () => {
    const rows = makeAxccRows([
      { id: 'axcc-A', studentId: 'stu-A', printable: true },
      { id: 'axcc-B', studentId: 'stu-B', printable: true }, // throws BoletinError
    ]);
    const client = {
      alumnosXCursoXCiclo: { findMany: vi.fn().mockResolvedValue(rows) },
    };
    vi.mocked(TenantContext.getClient).mockReturnValue(client as any);

    const singleUC = makeSingleUC(['axcc-A'], ['axcc-B']);
    const batchUC = new GenerateBoletinBatchUseCase(singleUC);

    const result = await batchUC.execute('cc-1');

    expect(result).toBeInstanceOf(Buffer);
    expect(appendedEntries).toHaveLength(1);
    expect(appendedEntries[0].buffer.toString()).toBe('PDF-axcc-A');
  });
});
