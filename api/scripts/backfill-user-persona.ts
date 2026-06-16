/**
 * backfill-user-persona.ts
 *
 * Fase 1 — Persona en User (master) — UP-R2
 *
 * Copia los campos de persona (firstName/lastName/dni/title/phone) desde los
 * Teacher de cada tenant al User de master vinculado (Teacher.userId).
 *
 * Reglas de idempotencia (UP-S5):
 *   - Si el User ya tiene un campo poblado (no null), NO se pisa con el valor
 *     del Teacher. Solo se copian campos que actualmente son NULL en el User.
 *   - Teachers con userId = null se omiten (UP-S4) y se loguean.
 *   - Segunda ejecución sobre el mismo dataset produce el mismo resultado sin
 *     errores de unicidad (el index @@unique([institutionId, dni]) permite NULLs
 *     múltiples en Postgres, y los DNIs ya seteados no se re-escriben).
 *
 * Uso (desde api/):
 *   MASTER_DATABASE_URL=... npx ts-node --transpile-only scripts/backfill-user-persona.ts
 *   O con tsx:
 *   MASTER_DATABASE_URL=... npx tsx scripts/backfill-user-persona.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { PrismaClient as MasterPrismaClient } from '@prisma/client';

interface InstitutionRow {
  id: string;
  db_name: string;
}

interface UserPersonaRow {
  id: string;
  institutionId: string | null;
  firstName: string | null;
  lastName: string | null;
  dni: string | null;
  title: string | null;
  phone: string | null;
}

interface TeacherPersonaFields {
  firstName: string;
  lastName: string;
  dni: string;
  title?: string | null;
  phone?: string | null;
}

/**
 * Builds the update payload for a User from a Teacher's persona fields.
 * Only includes fields that are currently null in the User (idempotency — UP-S5).
 * Never overwrites a non-null User field with a Teacher value.
 */
export function buildPersonaUpdate(
  user: Pick<UserPersonaRow, 'firstName' | 'lastName' | 'dni' | 'title' | 'phone'>,
  teacher: TeacherPersonaFields,
): Record<string, string> {
  const update: Record<string, string> = {};

  if (!user.firstName && teacher.firstName) update.firstName = teacher.firstName;
  if (!user.lastName  && teacher.lastName)  update.lastName  = teacher.lastName;
  if (!user.dni       && teacher.dni)       update.dni       = teacher.dni;
  if (!user.title     && teacher.title)     update.title     = teacher.title;
  if (!user.phone     && teacher.phone)     update.phone     = teacher.phone;

  return update;
}

export interface UserPersonaBackfillCounts {
  updated: number;
  skippedOrphan: number;
  skippedAlreadyPopulated: number;
}

/**
 * Backfills User persona (master) from Teacher persona (one tenant).
 * - Teachers with userId=null are skipped (UP-S4).
 * - Only null User fields are filled, never overwritten (UP-S5 idempotency).
 * Pure w.r.t. the passed-in clients → callable from integration tests.
 */
export async function backfillUserPersonaForTenant(
  master: MasterPrismaClient,
  tenant: TenantPrismaClient,
): Promise<UserPersonaBackfillCounts> {
  const teachers = await tenant.teacher.findMany({
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      dni: true,
      title: true,
      phone: true,
    },
    where: { deletedAt: null },
  });

  const linked = teachers.filter((t) => t.userId);
  const skippedOrphan = teachers.length - linked.length; // UP-S4

  let updated = 0;
  let skippedAlreadyPopulated = 0;

  for (const teacher of linked) {
    const userId = teacher.userId!;

    const user = (await master.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        institutionId: true,
        firstName: true,
        lastName: true,
        dni: true,
        title: true,
        phone: true,
      },
    })) as UserPersonaRow | null;

    if (!user) continue; // linked userId not present in master → skip

    const updateData = buildPersonaUpdate(user, {
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      dni: teacher.dni,
      title: teacher.title,
      phone: teacher.phone,
    });

    if (Object.keys(updateData).length === 0) {
      skippedAlreadyPopulated++; // UP-S5
      continue;
    }

    await master.user.update({ where: { id: userId }, data: updateData });
    updated++;
  }

  return { updated, skippedOrphan, skippedAlreadyPopulated };
}

async function main() {
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
    console.error('MASTER_DATABASE_URL no está seteada.');
    process.exit(1);
  }

  console.log('Backfill: copiando campos de persona de Teacher → User (master)\n');

  const pool = new Pool({ connectionString: MASTER_URL });
  const { rows: institutions } = await pool.query<InstitutionRow>(
    `SELECT id, db_name
       FROM institutions
      WHERE active = true AND deleted_at IS NULL
      ORDER BY db_name`,
  );
  await pool.end();

  if (institutions.length === 0) {
    console.log('No hay instituciones activas.');
    return;
  }

  const master = new MasterPrismaClient({ datasources: { db: { url: MASTER_URL } } });

  let totalUpdated = 0;
  let totalSkippedOrphan = 0;
  let totalSkippedAlreadyPopulated = 0;

  for (const inst of institutions) {
    const tenantUrl = MASTER_URL!.replace(/\/[^/]+(\?.*)?$/, `/${inst.db_name}$1`);
    const tenant = new TenantPrismaClient({ datasources: { db: { url: tenantUrl } } });

    try {
      const c = await backfillUserPersonaForTenant(master, tenant);
      totalUpdated += c.updated;
      totalSkippedOrphan += c.skippedOrphan;
      totalSkippedAlreadyPopulated += c.skippedAlreadyPopulated;
      console.log(
        `  [${inst.db_name}] updated=${c.updated} skippedOrphan=${c.skippedOrphan} alreadyPopulated=${c.skippedAlreadyPopulated}`,
      );
    } catch (e) {
      console.error(`  [${inst.db_name}] ERROR:`, (e as Error).message);
    } finally {
      await tenant.$disconnect();
    }
  }

  await master.$disconnect();

  console.log(`
Resumen:
  Users actualizados:               ${totalUpdated}
  Users sin cambios (ya poblados):  ${totalSkippedAlreadyPopulated}
  Teachers sin userId (huérfanos):  ${totalSkippedOrphan}
  `);
}

// Only run when executed directly (tsx scripts/...), not when imported by tests.
if (typeof require !== 'undefined' && require.main === module) {
  main().catch((e) => {
    console.error('Error inesperado:', e);
    process.exit(1);
  });
}
