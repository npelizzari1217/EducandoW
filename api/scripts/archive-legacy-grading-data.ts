/**
 * archive-legacy-grading-data.ts
 *
 * Archiva las 5 tablas de grading legacy (notas, evaluaciones, notas_trimestrales,
 * periodos_evaluacion, subject_assignments) para todos los tenants activos, exportando
 * cada tabla a un archivo JSON en {outputDir}/{tenant-slug}/{tabla}.json.
 *
 * Comportamiento:
 *  - Idempotente: si el archivo ya existe con bytes > 0, se omite la tabla (skip).
 *  - Abort-per-tenant: si falla una tabla, se abortan las restantes del mismo tenant
 *    y se continúa con el siguiente. El script sale con exit 1 si algún tenant falló.
 *  - Tabla vacía: genera un archivo con '[]'. No se trata como fallo.
 *
 * PRE-REQUISITO de PR-b: ejecutar con exit 0 en todos los tenants ANTES del DROP.
 *
 * Uso (desde api/):
 *   MASTER_DATABASE_URL=... npx tsx scripts/archive-legacy-grading-data.ts
 *   ARCHIVAL_OUTPUT_DIR=./backup MASTER_DATABASE_URL=... npx tsx scripts/archive-legacy-grading-data.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';

// ── Constantes exportadas (usadas en tests) ───────────────────────────────────

/**
 * Orden de exportación de las 5 tablas legacy.
 * El mismo orden no afecta la integridad (solo es lectura), pero lo mantenemos
 * consistente con el orden de DROP de la migración (hijo→padre) para referencia.
 */
export const LEGACY_TABLES = [
  'notas',
  'evaluaciones',
  'notas_trimestrales',
  'periodos_evaluacion',
  'subject_assignments',
] as const;

export type LegacyTable = (typeof LEGACY_TABLES)[number];

// ── Mapeo tabla DB → propiedad del Prisma client ─────────────────────────────

const TABLE_TO_MODEL: Record<LegacyTable, string> = {
  notas: 'nota',
  evaluaciones: 'evaluacion',
  notas_trimestrales: 'notaTrimestral',
  periodos_evaluacion: 'periodoEvaluacion',
  subject_assignments: 'subjectAssignment',
};

// ── Helpers exportados (testeables sin DB real) ───────────────────────────────

/**
 * Determina si el archivo de salida ya existe con contenido (bytes > 0).
 * Si es así, la exportación de esa tabla se omite.
 */
export function shouldSkip(outputPath: string): boolean {
  if (!fs.existsSync(outputPath)) return false;
  try {
    const stat = fs.statSync(outputPath);
    return stat.size > 0;
  } catch {
    return false;
  }
}

/**
 * Exporta una tabla legacy de un tenant a un archivo JSON.
 *
 * @returns 'skipped' si el archivo ya existía con bytes > 0, 'exported' si se escribió.
 * @throws Si la consulta a la DB o la escritura del archivo falla.
 */
export async function exportTableForTenant(
  tenant: TenantPrismaClient,
  table: LegacyTable,
  outputPath: string,
): Promise<'exported' | 'skipped'> {
  if (shouldSkip(outputPath)) {
    return 'skipped';
  }

  const modelName = TABLE_TO_MODEL[table];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: unknown[] = await (tenant as any)[modelName].findMany();

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2));

  return 'exported';
}

/**
 * Archiva las 5 tablas legacy de un tenant.
 *
 * - Si una tabla falla, aborta las restantes del mismo tenant y retorna { success: false }.
 * - Si todas se exportan (o se omiten por idempotencia), retorna { success: true }.
 * - Los errores se loguean con el formato [tenantSlug][tabla] pero NO se propagan.
 */
export async function archiveTenantTables(
  tenant: TenantPrismaClient,
  tenantSlug: string,
  outputDir: string,
): Promise<{ success: boolean; failedTable?: LegacyTable }> {
  for (const table of LEGACY_TABLES) {
    const outputPath = path.join(outputDir, tenantSlug, `${table}.json`);
    try {
      const outcome = await exportTableForTenant(tenant, table, outputPath);
      if (outcome === 'skipped') {
        console.log(`  [${tenantSlug}][${table}] skip (archivo ya existe)`);
      } else {
        console.log(`  [${tenantSlug}][${table}] exportado → ${outputPath}`);
      }
    } catch (e) {
      console.error(`[${tenantSlug}][${table}]`, (e as Error).message);
      return { success: false, failedTable: table };
    }
  }
  return { success: true };
}

// ── Main ─────────────────────────────────────────────────────────────────────

interface InstitutionRow {
  id: string;
  db_name: string;
}

async function main() {
  // ── Carga .env ──────────────────────────────────────────────────────────────
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }

  const MASTER_URL = process.env.MASTER_DATABASE_URL;
  if (!MASTER_URL) {
    console.error('MASTER_DATABASE_URL no está seteada.');
    process.exit(1);
  }

  const OUTPUT_DIR = process.env.ARCHIVAL_OUTPUT_DIR ?? path.resolve(__dirname, '..', 'archival-output');

  console.log('Archival: grading legacy (5 tablas × tenant)\n');
  console.log(`  Directorio de salida: ${OUTPUT_DIR}\n`);

  // ── Lista tenants activos desde el master DB ────────────────────────────────
  const pool = new Pool({ connectionString: MASTER_URL });
  const { rows: institutions } = await pool.query<InstitutionRow>(
    `SELECT id, db_name FROM institutions WHERE active = true AND deleted_at IS NULL ORDER BY db_name`,
  );
  await pool.end();

  if (institutions.length === 0) {
    console.log('No hay instituciones activas.');
    return;
  }

  console.log(`Procesando ${institutions.length} tenants...\n`);

  let failedCount = 0;

  for (const inst of institutions) {
    const tenantUrl = MASTER_URL.replace(/\/[^/]+(\?.*)?$/, `/${inst.db_name}$1`);
    const tenant = new TenantPrismaClient({ datasources: { db: { url: tenantUrl } } });

    try {
      console.log(`\n[${inst.db_name}]`);
      const { success, failedTable } = await archiveTenantTables(tenant, inst.db_name, OUTPUT_DIR);

      if (!success) {
        console.error(`  [${inst.db_name}] Archival FALLIDO en tabla '${failedTable}'.`);
        failedCount++;
      } else {
        console.log(`  [${inst.db_name}] OK`);
      }
    } finally {
      await tenant.$disconnect();
    }
  }

  console.log(`
Resumen:
  Tenants procesados: ${institutions.length}
  Tenants fallidos:   ${failedCount}
  `);

  if (failedCount > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Error inesperado:', e);
    process.exit(1);
  });
}
