/**
 * archive-legacy-grading-data.spec.ts
 *
 * TDD — tests escritos ANTES de la implementación (RED).
 * Cubre los 4 scenarios del tasks.md 1.1:
 *   A — Export por tenant (5 tablas, paths correctos, contenido)
 *   B — Idempotencia (skip cuando el archivo ya existe con bytes > 0)
 *   C — Abort-on-fail por tenant (log [tenant][tabla], no propaga, abort resto)
 *   D — Tabla vacía (array vacío JSON, no es fallo)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import {
  LEGACY_TABLES,
  archiveTenantTables,
  shouldSkip,
} from '../archive-legacy-grading-data';

// ── Mock del módulo fs ────────────────────────────────────────────────────────

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// ── Mock factory del TenantPrismaClient ──────────────────────────────────────

type ModelMock = { findMany: ReturnType<typeof vi.fn> };

interface TenantMock {
  nota: ModelMock;
  evaluacion: ModelMock;
  notaTrimestral: ModelMock;
  periodoEvaluacion: ModelMock;
  subjectAssignment: ModelMock;
}

/**
 * Crea un mock de TenantPrismaClient.
 * Para cada modelo, se puede pasar un array de filas o un Error que se rechaza.
 */
function makeMockTenant(
  overrides: Partial<Record<keyof TenantMock, unknown[] | Error>> = {},
): TenantMock {
  function makeModel(key: keyof TenantMock): ModelMock {
    const value = overrides[key];
    if (value instanceof Error) {
      return { findMany: vi.fn().mockRejectedValue(value) };
    }
    return { findMany: vi.fn().mockResolvedValue(value ?? []) };
  }

  return {
    nota: makeModel('nota'),
    evaluacion: makeModel('evaluacion'),
    notaTrimestral: makeModel('notaTrimestral'),
    periodoEvaluacion: makeModel('periodoEvaluacion'),
    subjectAssignment: makeModel('subjectAssignment'),
  };
}

const OUTPUT_DIR = '/tmp/archival-test';

// ── Limpieza entre tests ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Por defecto: no hay archivos existentes
  vi.mocked(fs.existsSync).mockReturnValue(false);
  vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
  vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
});

// ── Scenario A — Export por tenant ───────────────────────────────────────────

describe('Scenario A — Export por tenant', () => {
  it('LEGACY_TABLES contiene exactamente las 5 tablas legacy', () => {
    expect(LEGACY_TABLES).toHaveLength(5);
    expect(LEGACY_TABLES).toEqual(
      expect.arrayContaining([
        'notas',
        'evaluaciones',
        'notas_trimestrales',
        'periodos_evaluacion',
        'subject_assignments',
      ]),
    );
  });

  it('escribe los 5 archivos con paths {tenant-slug}/{tabla}.json', async () => {
    const rows = [{ id: '1', value: 'test-row' }];
    const tenant = makeMockTenant({
      nota: rows,
      evaluacion: rows,
      notaTrimestral: rows,
      periodoEvaluacion: rows,
      subjectAssignment: rows,
    });

    const result = await archiveTenantTables(
      tenant as unknown as TenantPrismaClient,
      'alpha',
      OUTPUT_DIR,
    );

    expect(result.success).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalledTimes(5);

    const writtenPaths = vi
      .mocked(fs.writeFileSync)
      .mock.calls.map(([p]) => p as string);

    expect(writtenPaths).toContain(`${OUTPUT_DIR}/alpha/notas.json`);
    expect(writtenPaths).toContain(`${OUTPUT_DIR}/alpha/evaluaciones.json`);
    expect(writtenPaths).toContain(`${OUTPUT_DIR}/alpha/notas_trimestrales.json`);
    expect(writtenPaths).toContain(`${OUTPUT_DIR}/alpha/periodos_evaluacion.json`);
    expect(writtenPaths).toContain(`${OUTPUT_DIR}/alpha/subject_assignments.json`);
  });

  it('el contenido escrito incluye los datos del tenant', async () => {
    const rows = [{ id: 'abc-1', studentId: 's-1', value: 42 }];
    const tenant = makeMockTenant({
      nota: rows,
      evaluacion: rows,
      notaTrimestral: rows,
      periodoEvaluacion: rows,
      subjectAssignment: rows,
    });

    await archiveTenantTables(
      tenant as unknown as TenantPrismaClient,
      'alpha',
      OUTPUT_DIR,
    );

    const calls = vi.mocked(fs.writeFileSync).mock.calls;
    const notasCall = calls.find(([p]) => (p as string).endsWith('notas.json'));
    expect(notasCall).toBeDefined();
    // El contenido debe ser JSON válido que incluya los datos de la fila
    expect(notasCall![1] as string).toContain('"abc-1"');
    expect(notasCall![1] as string).toContain('"s-1"');
  });
});

// ── Scenario B — Idempotencia ────────────────────────────────────────────────

describe('Scenario B — Idempotencia', () => {
  it('skippea todas las tablas cuando los archivos existen con bytes > 0', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ size: 500 } as ReturnType<typeof fs.statSync>);

    const tenant = makeMockTenant();

    const result = await archiveTenantTables(
      tenant as unknown as TenantPrismaClient,
      'alpha',
      OUTPUT_DIR,
    );

    expect(result.success).toBe(true);
    // No debe consultar la DB
    expect(tenant.nota.findMany).not.toHaveBeenCalled();
    expect(tenant.evaluacion.findMany).not.toHaveBeenCalled();
    expect(tenant.notaTrimestral.findMany).not.toHaveBeenCalled();
    expect(tenant.periodoEvaluacion.findMany).not.toHaveBeenCalled();
    expect(tenant.subjectAssignment.findMany).not.toHaveBeenCalled();
    // No debe escribir archivos
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('NO skippea si el archivo existe pero tiene 0 bytes (re-exporta)', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ size: 0 } as ReturnType<typeof fs.statSync>);

    const tenant = makeMockTenant({ nota: [], evaluacion: [], notaTrimestral: [], periodoEvaluacion: [], subjectAssignment: [] });

    const result = await archiveTenantTables(
      tenant as unknown as TenantPrismaClient,
      'alpha',
      OUTPUT_DIR,
    );

    expect(result.success).toBe(true);
    // Con size=0 no debe saltear — debe consultar DB y re-exportar
    expect(tenant.nota.findMany).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledTimes(5);
  });
});

// ── shouldSkip — rama de error de statSync ───────────────────────────────────

describe('shouldSkip — statSync falla', () => {
  it('retorna false si el archivo existe pero statSync lanza', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockImplementation(() => {
      throw new Error('EACCES');
    });

    expect(shouldSkip(`${OUTPUT_DIR}/alpha/notas.json`)).toBe(false);
  });
});

// ── Scenario C — Abort-on-fail por tenant ────────────────────────────────────

describe('Scenario C — Abort-on-fail por tenant', () => {
  it('aborta las tablas restantes de beta cuando notas falla', async () => {
    const tenant = makeMockTenant({
      nota: new Error('DB connection error'),
      evaluacion: [{ id: '1' }],
      notaTrimestral: [],
      periodoEvaluacion: [],
      subjectAssignment: [],
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await archiveTenantTables(
      tenant as unknown as TenantPrismaClient,
      'beta',
      OUTPUT_DIR,
    );

    expect(result.success).toBe(false);
    expect(result.failedTable).toBe('notas');

    // Las tablas restantes de beta NO se deben intentar
    expect(tenant.evaluacion.findMany).not.toHaveBeenCalled();
    expect(tenant.notaTrimestral.findMany).not.toHaveBeenCalled();
    expect(tenant.periodoEvaluacion.findMany).not.toHaveBeenCalled();
    expect(tenant.subjectAssignment.findMany).not.toHaveBeenCalled();

    // No debe haber escrito nada
    expect(fs.writeFileSync).not.toHaveBeenCalled();

    // Debe loguear [beta][notas]
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[beta][notas]'),
      expect.any(String),
    );

    errorSpy.mockRestore();
  });

  it('no propaga la excepción — retorna { success: false } en lugar de throw', async () => {
    const tenant = makeMockTenant({
      nota: new Error('fatal error'),
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      archiveTenantTables(tenant as unknown as TenantPrismaClient, 'gamma', OUTPUT_DIR),
    ).resolves.toMatchObject({ success: false });

    errorSpy.mockRestore();
  });
});

// ── Scenario D — Tabla vacía ─────────────────────────────────────────────────

describe('Scenario D — Tabla vacía', () => {
  it('crea un archivo con array JSON vacío cuando la tabla tiene 0 filas', async () => {
    // Todas las tablas devuelven 0 filas
    const tenant = makeMockTenant({
      nota: [],
      evaluacion: [],
      notaTrimestral: [],
      periodoEvaluacion: [],
      subjectAssignment: [],
    });

    const result = await archiveTenantTables(
      tenant as unknown as TenantPrismaClient,
      'alpha',
      OUTPUT_DIR,
    );

    expect(result.success).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalledTimes(5);

    const calls = vi.mocked(fs.writeFileSync).mock.calls;
    const notasCall = calls.find(([p]) => (p as string).endsWith('notas.json'));
    expect(notasCall).toBeDefined();
    // Array vacío → contenido '[]'
    expect(notasCall![1]).toBe('[]');
  });

  it('tabla vacía no se trata como fallo', async () => {
    const tenant = makeMockTenant({
      nota: [],
      evaluacion: [],
      notaTrimestral: [],
      periodoEvaluacion: [],
      subjectAssignment: [],
    });

    const result = await archiveTenantTables(
      tenant as unknown as TenantPrismaClient,
      'alpha',
      OUTPUT_DIR,
    );

    expect(result.success).toBe(true);
    expect(result.failedTable).toBeUndefined();
  });
});
