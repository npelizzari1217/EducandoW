/**
 * backfill-materia-grupo.ts
 *
 * Fase 3c — Materialización + Grupos + AlumnosXMateria + AlumnosXGrupo
 *
 * Por cada institución activa → por CourseCycle activo:
 *   1. Materializar plan: StudyPlanSubject del plan → upsert MateriaXCursoXCiclo (skipDuplicates)
 *   2. Por cada materia: upsert AlumnosXMateriaXCursoXCiclo = alumnos inscriptos en el CC
 *   3. Por cada SubjectAssignment activa en el CC:
 *      a. Buscar DocenteXCiclo del teacher
 *      b. Crear GrupoXCursoXMateriaXCiclo (upsert — 1 grupo por docente)
 *      c. Crear AlumnosXGrupoXCursoXMateriaXCiclo = universo completo de la materia
 *
 * Idempotente: doble corrida produce el mismo estado (skipDuplicates / upsert).
 * SubjectAssignment NO se elimina (D5).
 *
 * Uso (desde api/):
 *   MASTER_DATABASE_URL=postgresql://... npx tsx scripts/backfill-materia-grupo.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';

interface InstitutionRow {
  id: string;
  db_name: string;
}

// ── Exported helpers (for unit tests) ──────────────────────────────────────────

export interface PlanSubjectRef {
  subjectId: string;
  studyPlanSubjectId: string;
}

export interface CourseCycleRef {
  uuid: string;
  studyPlanId: string;
  courseId: string;
}

/**
 * Collects all StudyPlanSubject entries for a CourseCycle's plan course.
 * Returns [] if no matching StudyPlanCourse is found.
 */
export async function collectSubjectsForCourseCycle(
  tenant: TenantPrismaClient,
  cc: CourseCycleRef,
): Promise<PlanSubjectRef[]> {
  const planCourse = await tenant.studyPlanCourse.findFirst({
    where: { studyPlanId: cc.studyPlanId, courseSectionId: cc.courseId },
    include: { subjects: true },
  });
  if (!planCourse) return [];
  return planCourse.subjects.map((s) => ({
    subjectId: s.subjectId,
    studyPlanSubjectId: s.id,
  }));
}

/**
 * Collects enrolled student IDs for a CourseCycle using the same heuristic
 * join as findEnrolledStudentsByCourseCycle (level/grade/division/academicYear).
 * Returns [] if the CourseCycle or CourseSection is not found.
 */
export async function collectEnrolledStudentIds(
  tenant: TenantPrismaClient,
  courseCycleUuid: string,
): Promise<string[]> {
  const cc = await tenant.courseCycle.findUnique({
    where: { uuid: courseCycleUuid },
    select: { courseId: true },
  });
  if (!cc) return [];

  const section = await tenant.courseSection.findUnique({
    where: { id: cc.courseId },
    select: { level: true, grade: true, division: true, academicYear: true },
  });
  if (!section) return [];

  const sectionLevelCode = Math.floor(section.level / 10);
  const sectionModality = section.level % 10;

  const enrollments = await tenant.enrollment.findMany({
    where: {
      level: sectionLevelCode,
      modality: sectionModality,
      grade: section.grade,
      division: section.division ?? undefined,
      academicYear: section.academicYear,
      status: 'ACTIVE',
      deletedAt: null,
    },
    select: { studentId: true },
  });

  return enrollments.map((e) => e.studentId);
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  // ── Load .env ──────────────────────────────────────────────────────────────
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

  console.log('Backfill Fase 3c: MateriaXCursoXCiclo + AlumnosXMateria + Grupos + AlumnosXGrupo\n');

  const pool = new Pool({ connectionString: MASTER_URL });
  const { rows: institutions } = await pool.query<InstitutionRow>(
    `SELECT id, db_name FROM institutions WHERE active = true AND deleted_at IS NULL ORDER BY db_name`,
  );
  await pool.end();

  if (institutions.length === 0) {
    console.log('No hay instituciones activas.');
    return;
  }

  let totalMaterias = 0;
  let totalAlumnosXMateria = 0;
  let totalGrupos = 0;
  let totalAlumnosXGrupo = 0;

  for (const inst of institutions) {
    const tenantUrl = MASTER_URL!.replace(/\/[^/]+(\?.*)?$/, `/${inst.db_name}$1`);
    const tenant = new TenantPrismaClient({ datasources: { db: { url: tenantUrl } } });

    try {
      console.log(`\n[${inst.db_name}]`);

      // Get all active CourseCycles
      const courseCycles = await tenant.courseCycle.findMany({
        where: { active: true, deletedAt: null },
        select: { uuid: true, studyPlanId: true, courseId: true },
      });

      console.log(`  CourseCycles activos: ${courseCycles.length}`);

      let instMaterias = 0;
      let instAlumnosXMateria = 0;
      let instGrupos = 0;
      let instAlumnosXGrupo = 0;

      for (const cc of courseCycles) {
        // ── Step 1: Materialize subjects from study plan ───────────────────────
        const planSubjects = await collectSubjectsForCourseCycle(tenant, cc);

        if (planSubjects.length > 0) {
          await tenant.materiaXCursoXCiclo.createMany({
            data: planSubjects.map((s) => ({
              courseCycleId: cc.uuid,
              subjectId: s.subjectId,
              studyPlanSubjectId: s.studyPlanSubjectId,
            })),
            skipDuplicates: true,
          });
          instMaterias += planSubjects.length;
        }

        // ── Step 2: Add enrolled students to each materia ─────────────────────
        const enrolledStudentIds = await collectEnrolledStudentIds(tenant, cc.uuid);

        if (enrolledStudentIds.length > 0) {
          // Get all materias for this CC (including ones just created)
          const materias = await tenant.materiaXCursoXCiclo.findMany({
            where: { courseCycleId: cc.uuid },
            select: { id: true },
          });

          for (const materia of materias) {
            const alumnosData = enrolledStudentIds.map((studentId) => ({
              materiaXCursoXCicloId: materia.id,
              studentId,
            }));
            const result = await tenant.alumnosXMateriaXCursoXCiclo.createMany({
              data: alumnosData,
              skipDuplicates: true,
            });
            instAlumnosXMateria += result.count;
          }
        }

        // ── Step 3: Create groups from SubjectAssignments ─────────────────────
        // Find active SubjectAssignments for this CourseSection
        const assignments = await tenant.subjectAssignment.findMany({
          where: { courseSectionId: cc.courseId, active: true, deletedAt: null },
          select: { teacherId: true, subjectId: true },
        });

        for (const sa of assignments) {
          // Find the teacher's userId and their DocenteXCiclo
          const teacher = await tenant.teacher.findUnique({
            where: { id: sa.teacherId },
            select: { userId: true },
          });
          if (!teacher?.userId) continue;

          // Find DocenteXCiclo for this teacher in the cycle of the CC
          const ccWithCycle = await tenant.courseCycle.findUnique({
            where: { uuid: cc.uuid },
            select: { cycleId: true },
          });
          if (!ccWithCycle) continue;

          const dxc = await tenant.docenteXCiclo.findUnique({
            where: { userId_cycleId: { userId: teacher.userId, cycleId: ccWithCycle.cycleId } },
            select: { id: true },
          });
          if (!dxc) continue;

          // Find the MateriaXCursoXCiclo for this subject in this CC
          const materia = await tenant.materiaXCursoXCiclo.findUnique({
            where: { courseCycleId_subjectId: { courseCycleId: cc.uuid, subjectId: sa.subjectId } },
            select: { id: true },
          });
          if (!materia) continue;

          // Upsert group (1 group per docente per materia)
          const grupo = await tenant.grupoXCursoXMateriaXCiclo.upsert({
            where: {
              materiaXCursoXCicloId_docenteXCicloId: {
                materiaXCursoXCicloId: materia.id,
                docenteXCicloId: dxc.id,
              },
            },
            create: {
              materiaXCursoXCicloId: materia.id,
              docenteXCicloId: dxc.id,
            },
            update: { updatedAt: new Date() },
          });
          instGrupos++;

          // Add all AlumnosXMateriaXCursoXCiclo of this materia to the group
          const axmRows = await tenant.alumnosXMateriaXCursoXCiclo.findMany({
            where: { materiaXCursoXCicloId: materia.id },
            select: { id: true },
          });

          if (axmRows.length > 0) {
            const result = await tenant.alumnosXGrupoXCursoXMateriaXCiclo.createMany({
              data: axmRows.map((axm) => ({
                grupoId: grupo.id,
                alumnosXMateriaXCursoXCicloId: axm.id,
              })),
              skipDuplicates: true,
            });
            instAlumnosXGrupo += result.count;
          }
        }
      }

      console.log(`  MateriaXCursoXCiclo upserted:          ${instMaterias}`);
      console.log(`  AlumnosXMateriaXCursoXCiclo upserted:  ${instAlumnosXMateria}`);
      console.log(`  GrupoXCursoXMateriaXCiclo upserted:    ${instGrupos}`);
      console.log(`  AlumnosXGrupoXCursoXMateriaXCiclo:     ${instAlumnosXGrupo}`);

      totalMaterias += instMaterias;
      totalAlumnosXMateria += instAlumnosXMateria;
      totalGrupos += instGrupos;
      totalAlumnosXGrupo += instAlumnosXGrupo;
    } catch (e) {
      console.error(`  ERROR en ${inst.db_name}:`, (e as Error).message);
    } finally {
      await tenant.$disconnect();
    }
  }

  console.log(`
Resumen:
  MateriaXCursoXCiclo upserted:          ${totalMaterias}
  AlumnosXMateriaXCursoXCiclo upserted:  ${totalAlumnosXMateria}
  GrupoXCursoXMateriaXCiclo upserted:    ${totalGrupos}
  AlumnosXGrupoXCursoXMateriaXCiclo:     ${totalAlumnosXGrupo}
  `);
}

main().catch((e) => {
  console.error('Error inesperado:', e);
  process.exit(1);
});
