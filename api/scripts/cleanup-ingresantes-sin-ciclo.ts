/**
 * cleanup-ingresantes-sin-ciclo.ts
 *
 * D1 cleanup — elimina ingresantes sin ciclo lectivo asignado (cycle_id IS NULL).
 *
 * Para cada institución activa: cuenta y elimina ingresantes con cycleId null.
 * Aborta el tenant si el conteo supera DELETE_THRESHOLD (seguridad ante prod).
 * Idempotente: segunda corrida retorna deleted=0, sin errores.
 *
 * PASO MANUAL de deploy — ejecutar ANTES de la migración NOT NULL.
 * Hacer backup de producción antes de correr este script.
 *
 * Uso (desde api/):
 *   MASTER_DATABASE_URL=... npx tsx scripts/cleanup-ingresantes-sin-ciclo.ts
 *   DELETE_THRESHOLD=50 MASTER_DATABASE_URL=... npx tsx scripts/cleanup-ingresantes-sin-ciclo.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';

interface InstitutionRow {
  id: string;
  db_name: string;
}

// ── Configurable safety threshold ──────────────────────────────────────────
const DELETE_THRESHOLD = parseInt(process.env.DELETE_THRESHOLD ?? '100', 10);

// ── Exported helpers (for unit tests) ──────────────────────────────────────

/**
 * Counts ingresantes with cycleId IS NULL in the given tenant.
 */
export async function countNullCycleIngresantes(
  tenant: TenantPrismaClient,
): Promise<number> {
  return tenant.ingresante.count({ where: { cycleId: null } });
}

/**
 * Cleans up ingresantes with cycleId IS NULL for a single tenant.
 *
 * - If count === 0: no-op (idempotent).
 * - If count > threshold: skip tenant, log warning.
 * - Otherwise: deleteMany and return count deleted.
 */
export async function cleanupTenantIngresantes(
  tenant: TenantPrismaClient,
  threshold: number = DELETE_THRESHOLD,
): Promise<{ deleted: number; skipped: boolean }> {
  const count = await countNullCycleIngresantes(tenant);

  if (count === 0) {
    return { deleted: 0, skipped: false };
  }

  if (count > threshold) {
    console.warn(
      `  ABORTANDO: ${count} ingresante(s) sin ciclo superan el umbral ${threshold}.`,
    );
    console.warn(`  Ajustar DELETE_THRESHOLD si se quiere proceder.`);
    return { deleted: 0, skipped: true };
  }

  const result = await tenant.ingresante.deleteMany({ where: { cycleId: null } });
  return { deleted: result.count, skipped: false };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // ── Load .env ────────────────────────────────────────────────────────────
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

  console.log('Cleanup: ingresantes sin ciclo (cycle_id IS NULL)\n');
  console.log(`  Umbral de borrado: ${DELETE_THRESHOLD}\n`);

  const pool = new Pool({ connectionString: MASTER_URL });
  const { rows: institutions } = await pool.query<InstitutionRow>(
    `SELECT id, db_name FROM institutions WHERE active = true AND deleted_at IS NULL ORDER BY db_name`,
  );
  await pool.end();

  if (institutions.length === 0) {
    console.log('No hay instituciones activas.');
    return;
  }

  let totalDeleted = 0;
  let totalSkipped = 0;

  for (const inst of institutions) {
    const tenantUrl = MASTER_URL.replace(/\/[^/]+(\?.*)?$/, `/${inst.db_name}$1`);
    const tenant = new TenantPrismaClient({ datasources: { db: { url: tenantUrl } } });

    try {
      console.log(`\n[${inst.db_name}]`);
      const { deleted, skipped } = await cleanupTenantIngresantes(tenant);

      if (skipped) {
        totalSkipped++;
        console.log(`  Omitido por umbral (${DELETE_THRESHOLD}).`);
      } else {
        console.log(`  Ingresantes sin ciclo eliminados: ${deleted}`);
        totalDeleted += deleted;
      }
    } catch (e) {
      console.error(`  ERROR en ${inst.db_name}:`, (e as Error).message);
    } finally {
      await tenant.$disconnect();
    }
  }

  console.log(`
Resumen:
  Ingresantes sin ciclo borrados: ${totalDeleted}
  Tenants omitidos por umbral:    ${totalSkipped}
  `);
}

main().catch((e) => {
  console.error('Error inesperado:', e);
  process.exit(1);
});
