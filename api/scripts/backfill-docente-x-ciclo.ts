/**
 * backfill-docente-x-ciclo.ts
 *
 * Fase 2 — DocenteXCiclo + migración Teacher→User+DocenteXCiclo
 *
 * Para cada institución activa:
 *   1. Busca Teachers con userId != null que tengan SubjectAssignment activa
 *      O sean homeroomTeacherId de un CourseCycle activo
 *      → para cada ciclo involucrado → upsert DocenteXCiclo(userId, cycleId)
 *   2. D4: Elimina Teachers con userId = null (huérfanos).
 *      Aborta si count > ORPHAN_DELETE_THRESHOLD (seguridad ante prod).
 *
 * Idempotente: segunda corrida produce el mismo estado, sin duplicados ni errores.
 *
 * Uso (desde api/):
 *   MASTER_DATABASE_URL=... npx tsx scripts/backfill-docente-x-ciclo.ts
 *   ORPHAN_DELETE_THRESHOLD=0 MASTER_DATABASE_URL=... npx tsx scripts/backfill-docente-x-ciclo.ts
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
const ORPHAN_DELETE_THRESHOLD = parseInt(
  process.env.ORPHAN_DELETE_THRESHOLD ?? '100',
  10,
);

// ── Exported helpers (for unit tests) ──────────────────────────────────────

/**
 * Collects the set of cycleIds that a teacher is active in:
 *   - Via CourseCycle.homeroomTeacherId (preceptor/titular)
 *   - Via SubjectAssignment → CourseSection → CourseCycle
 *
 * Returns an array of unique cycleIds (AcademicCycle.uuid values).
 */
export async function collectCycleIdsForTeacher(
  tenant: TenantPrismaClient,
  teacherId: string,
): Promise<string[]> {
  const cycleIds = new Set<string>();

  // Path 1: CourseCycle.homeroomTeacherId
  const homeroomCycles = await tenant.courseCycle.findMany({
    where: { homeroomTeacherId: teacherId, active: true },
    select: { cycleId: true },
  });
  for (const cc of homeroomCycles) {
    cycleIds.add(cc.cycleId);
  }

  // Path 2: SubjectAssignment → CourseSection → CourseCycle
  const assignments = await tenant.subjectAssignment.findMany({
    where: { teacherId, active: true },
    select: { courseSectionId: true },
  });

  if (assignments.length > 0) {
    const courseSectionIds = [...new Set(assignments.map((a) => a.courseSectionId))];
    const courseCycles = await tenant.courseCycle.findMany({
      where: { courseId: { in: courseSectionIds }, active: true },
      select: { cycleId: true },
    });
    for (const cc of courseCycles) {
      cycleIds.add(cc.cycleId);
    }
  }

  return [...cycleIds];
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

  console.log('Backfill Fase 2: DocenteXCiclo + eliminación de Teachers huérfanos\n');
  console.log(`  Umbral de borrado de huérfanos: ${ORPHAN_DELETE_THRESHOLD}\n`);

  const pool = new Pool({ connectionString: MASTER_URL });
  const { rows: institutions } = await pool.query<InstitutionRow>(
    `SELECT id, db_name FROM institutions WHERE active = true AND deleted_at IS NULL ORDER BY db_name`,
  );
  await pool.end();

  if (institutions.length === 0) {
    console.log('No hay instituciones activas.');
    return;
  }

  let totalDocenteXCicloUpserted = 0;
  let totalOrphansDeleted = 0;
  let totalOrphansSkipped = 0; // when above threshold

  for (const inst of institutions) {
    const tenantUrl = MASTER_URL!.replace(/\/[^/]+(\?.*)?$/, `/${inst.db_name}$1`);
    const tenant = new TenantPrismaClient({ datasources: { db: { url: tenantUrl } } });

    try {
      console.log(`\n[${inst.db_name}]`);

      // ── Read all teachers ─────────────────────────────────────────────────
      const teachers = await tenant.teacher.findMany({
        select: { id: true, userId: true, firstName: true, lastName: true },
        where: { deletedAt: null },
      });

      const orphans = teachers.filter((t) => !t.userId);
      const linked  = teachers.filter((t) =>  t.userId);

      console.log(`  Teachers totales: ${teachers.length} (linked: ${linked.length}, huérfanos: ${orphans.length})`);

      // ── D4: Delete orphan Teachers ────────────────────────────────────────
      if (orphans.length > 0) {
        if (orphans.length > ORPHAN_DELETE_THRESHOLD) {
          console.warn(
            `  ABORTANDO borrado de huérfanos: ${orphans.length} supera el umbral ${ORPHAN_DELETE_THRESHOLD}.`,
          );
          console.warn(`  Ajustar ORPHAN_DELETE_THRESHOLD si se quiere proceder.`);
          totalOrphansSkipped += orphans.length;
        } else {
          console.log(`  Eliminando ${orphans.length} Teacher(s) huérfano(s)…`);
          const orphanIds = orphans.map((t) => t.id);
          const result = await tenant.teacher.deleteMany({
            where: { id: { in: orphanIds } },
          });
          console.log(`  Eliminados: ${result.count}`);
          totalOrphansDeleted += result.count;
        }
      }

      // ── Upsert DocenteXCiclo for linked teachers ──────────────────────────
      let instUpserted = 0;
      for (const teacher of linked) {
        const userId = teacher.userId!;
        const cycleIds = await collectCycleIdsForTeacher(tenant, teacher.id);

        if (cycleIds.length === 0) {
          console.log(`  Teacher ${teacher.id} (${teacher.lastName}): sin ciclos activos — se omite.`);
          continue;
        }

        for (const cycleId of cycleIds) {
          // upsert keyed on @@unique([userId, cycleId])
          await tenant.docenteXCiclo.upsert({
            where: { userId_cycleId: { userId, cycleId } },
            create: { userId, cycleId, active: true },
            update: { updatedAt: new Date() },
          });
          instUpserted++;
        }

        console.log(
          `  Teacher ${teacher.id} (${teacher.lastName}): userId=${userId}, ${cycleIds.length} ciclo(s) → ${cycleIds.length} DocenteXCiclo`,
        );
      }

      console.log(`  DocenteXCiclo upserted: ${instUpserted}`);
      totalDocenteXCicloUpserted += instUpserted;
    } catch (e) {
      console.error(`  ERROR en ${inst.db_name}:`, (e as Error).message);
    } finally {
      await tenant.$disconnect();
    }
  }

  console.log(`
Resumen:
  DocenteXCiclo upserted:      ${totalDocenteXCicloUpserted}
  Teachers huérfanos borrados: ${totalOrphansDeleted}
  Teachers huérfanos omitidos (umbral): ${totalOrphansSkipped}
  `);
}

main().catch((e) => {
  console.error('Error inesperado:', e);
  process.exit(1);
});
