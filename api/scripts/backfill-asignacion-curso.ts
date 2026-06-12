/**
 * backfill-asignacion-curso.ts
 *
 * Fase 4 — AsignacionCursoXCiclo backfill: migrate CourseCycle.homeroomTeacherId
 * into AsignacionCursoXCiclo with rol=TITULAR.
 *
 * For each active CourseCycle with homeroomTeacherId != null:
 *   1. Find the Teacher → get userId
 *   2. Find the DocenteXCiclo for (userId, cycleId)
 *   3. Upsert AsignacionCursoXCiclo(courseCycleId, docenteXCicloId, rol=TITULAR, turno=null)
 *
 * homeroomTeacherId is NOT removed (D5 — coexistence with legacy column).
 * Logs CCs where no DocenteXCiclo found (should be 0 after Fase 2 backfill).
 *
 * Idempotent: second run produces the same state (skipDuplicates pattern via upsert).
 *
 * Usage (from api/):
 *   MASTER_DATABASE_URL=... npx tsx scripts/backfill-asignacion-curso.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { v4 as uuidv4 } from 'uuid';

interface InstitutionRow {
  id: string;
  db_name: string;
}

// ── Exported helpers (for unit tests) ──────────────────────────────────────

export interface CourseCycleWithTeacher {
  uuid: string;
  homeroomTeacherId: string;
  cycleId: string;
  teacher: { userId: string } | null;
}

export interface TitularAsignacion {
  courseCycleId: string;
  docenteXCicloId: string;
}

/**
 * For each CC (with homeroomTeacher + teacher.userId), find the matching
 * DocenteXCiclo for (teacher.userId, cc.cycleId) and return the asignacion data.
 *
 * Skips CCs where teacher has no userId or no DocenteXCiclo exists.
 * Returns array of {courseCycleId, docenteXCicloId} to upsert.
 */
export async function buildTitularAsignaciones(
  tenant: TenantPrismaClient,
  courseCycles: CourseCycleWithTeacher[],
): Promise<TitularAsignacion[]> {
  const result: TitularAsignacion[] = [];

  for (const cc of courseCycles) {
    // Skip CCs where the teacher has no userId
    if (!cc.teacher?.userId) {
      console.log(`  ⚠️  CC ${cc.uuid}: teacher has no userId — skipping`);
      continue;
    }

    // Find the matching DocenteXCiclo
    const dxc = await (tenant as unknown as { docenteXCiclo: { findFirst: (args: unknown) => Promise<{ id: string } | null> } }).docenteXCiclo.findFirst({
      where: { userId: cc.teacher.userId, cycleId: cc.cycleId },
    });

    if (!dxc) {
      console.log(
        `  ⚠️  CC ${cc.uuid}: no DocenteXCiclo for user=${cc.teacher.userId} cycle=${cc.cycleId} — skipping`,
      );
      continue;
    }

    result.push({ courseCycleId: cc.uuid, docenteXCicloId: dxc.id });
  }

  return result;
}

// ── Main ───────────────────────────────────────────────────────────────────

// Load .env
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  const MASTER_URL = process.env.MASTER_DATABASE_URL;
  if (!MASTER_URL) {
    console.error('❌ MASTER_DATABASE_URL is not set.');
    process.exit(1);
  }

  console.log('🔄 Backfill: AsignacionCursoXCiclo — homeroomTeacherId → TITULAR\n');

  const pool = new Pool({ connectionString: MASTER_URL });
  const { rows: institutions } = await pool.query<InstitutionRow>(
    `SELECT id, db_name FROM institutions WHERE active = true AND deleted_at IS NULL`,
  );
  console.log(`📋 Found ${institutions.length} institution(s)\n`);

  let totalUpserted = 0;
  let totalSkipped = 0;

  for (const inst of institutions) {
    const dbName = inst.db_name;
    const tenantUrl = MASTER_URL.replace(
      /\/[^/]+(\?.*)?$/,
      `/${dbName}$1`,
    );
    const tenant = new TenantPrismaClient({ datasources: { db: { url: tenantUrl } } });

    try {
      console.log(`  📦 ${dbName}`);

      // Fetch all active CCs with homeroomTeacherId + teacher.userId
      const courseCycles = await tenant.courseCycle.findMany({
        where: { active: true, homeroomTeacherId: { not: null } },
        select: {
          uuid: true,
          homeroomTeacherId: true,
          cycleId: true,
          homeroomTeacher: { select: { userId: true } },
        },
      });

      console.log(`     ${courseCycles.length} CCs with homeroomTeacherId`);

      const toProcess: CourseCycleWithTeacher[] = courseCycles.map((cc) => ({
        uuid: cc.uuid,
        homeroomTeacherId: cc.homeroomTeacherId!,
        cycleId: cc.cycleId,
        teacher: cc.homeroomTeacher ? { userId: cc.homeroomTeacher.userId! } : null,
      }));

      const asignaciones = await buildTitularAsignaciones(
        tenant as unknown as TenantPrismaClient,
        toProcess,
      );

      totalSkipped += courseCycles.length - asignaciones.length;

      // Idempotent insert: check existence before creating.
      // Note: the unique index uses NULLS NOT DISTINCT (Postgres 15+) so turno=NULL IS unique,
      // but we use findFirst to be explicit about idempotency.
      for (const asg of asignaciones) {
        const existing = await (tenant as unknown as {
          asignacionCursoXCiclo: {
            findFirst: (args: unknown) => Promise<{ id: string } | null>;
            create: (args: unknown) => Promise<unknown>;
          };
        }).asignacionCursoXCiclo.findFirst({
          where: {
            courseCycleId: asg.courseCycleId,
            docenteXCicloId: asg.docenteXCicloId,
            rol: 'TITULAR',
          },
        });

        if (!existing) {
          await (tenant as unknown as {
            asignacionCursoXCiclo: {
              create: (args: unknown) => Promise<unknown>;
            };
          }).asignacionCursoXCiclo.create({
            data: {
              id: uuidv4(),
              courseCycleId: asg.courseCycleId,
              docenteXCicloId: asg.docenteXCicloId,
              rol: 'TITULAR',
              turno: null,
            },
          });
          totalUpserted++;
        } else {
          console.log(`     ℹ️  Already exists: CC ${asg.courseCycleId} — skipping`);
        }
      }

      console.log(`     ✅ ${asignaciones.length} candidates processed`);
    } finally {
      await tenant.$disconnect();
    }
  }

  await pool.end();

  console.log(`\n✅ Backfill complete: ${totalUpserted} upserted, ${totalSkipped} skipped`);
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
