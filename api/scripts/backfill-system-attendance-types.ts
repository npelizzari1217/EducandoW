/**
 * backfill-system-attendance-types.ts
 *
 * Genera los códigos de asistencia del sistema (P, SAB, DOM, X) para cada
 * nivel que YA tiene cada institución activa. Pensado para instituciones
 * creadas antes del módulo de Tipos de Asistencia, donde la cascada
 * (Create/UpdateInstitution) todavía no corrió.
 *
 * Reutiliza la función real seedSystemAttendanceTypes() del seed, así que
 * usa exactamente los mismos valores y es idempotente (upsert con update:{}).
 *
 * Uso (desde api/):
 *   npx ts-node --transpile-only scripts/backfill-system-attendance-types.ts
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { seedSystemAttendanceTypes } from '../prisma/seed';

// ── Carga mínima de .env ────────────────────────────────
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
  console.error('❌ MASTER_DATABASE_URL no está seteada.');
  process.exit(1);
}

async function main() {
  console.log('🔄 Backfill de códigos de sistema (P, SAB, DOM, X) por nivel\n');

  const pool = new Pool({ connectionString: MASTER_URL });
  const { rows } = await pool.query<{ id: string; db_name: string; levels: number[] }>(
    `SELECT i.id, i.db_name,
            array_agg(DISTINCT il.level) FILTER (WHERE il.level IS NOT NULL) AS levels
       FROM institutions i
       LEFT JOIN institution_levels il
         ON il."institutionId" = i.id AND il."deletedAt" IS NULL
      WHERE i.active = true AND i.deleted_at IS NULL
      GROUP BY i.id, i.db_name`,
  );
  await pool.end();

  if (rows.length === 0) {
    console.log('⏩ No hay instituciones activas.');
    return;
  }

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    const levels = (row.levels ?? []).filter((l) => l != null);
    if (levels.length === 0) {
      console.log(`  ⏩ ${row.db_name}: sin niveles asignados, se omite.`);
      skipped++;
      continue;
    }
    const tenantUrl = MASTER_URL!.replace(/\/[^/]+$/, `/${row.db_name}`);
    const tenant = new TenantPrismaClient({ datasources: { db: { url: tenantUrl } } });
    try {
      await seedSystemAttendanceTypes(tenant, levels);
      console.log(`  ✅ ${row.db_name}: niveles [${levels.join(', ')}]`);
      ok++;
    } catch (e) {
      console.error(`  ❌ ${row.db_name}:`, (e as Error).message);
      failed++;
    } finally {
      await tenant.$disconnect();
    }
  }

  console.log(`\n📊 OK: ${ok} · omitidas: ${skipped} · fallidas: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('❌ Error inesperado:', e);
  process.exit(1);
});
