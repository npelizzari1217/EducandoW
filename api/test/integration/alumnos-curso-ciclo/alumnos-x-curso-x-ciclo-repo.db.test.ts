/**
 * T-13 — PrismaAlumnosXCursoXCicloRepository integration tests (SDD-1).
 *
 * Tests run against the real tenant test DB (educandow_test_i1, port 5433).
 * Scenarios covered:
 *   - Idempotent upsert: adding same (courseCycleId, studentId) twice → 1 row, no error
 *   - Listing enriched: returns rows with resolved studentName
 *   - Empty list: returns [] when no students assigned
 *   - Removal by bridge-row id: deletes the correct row
 *   - Restrict FK: attempting to delete a CourseCycle with enrolled students → DB error
 *
 * Uses TenantContext.run() to wire the repository exactly as in production.
 * DB is reset in beforeEach via resetAll().
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaAlumnosXCursoXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-alumnos-x-curso-x-ciclo.repository';
import { AlumnosXCursoXCiclo, NotFoundError } from '@educandow/domain';
import {
  tenantI1Client,
  runInTenant,
  resetAll,
  disconnectAll,
} from '../setup/clients';
import {
  seedCourseCycle,
  createStudent,
  createAlumnosXCursoXCiclo,
} from '../setup/factories';

const repo = new PrismaAlumnosXCursoXCicloRepository();

describe('PrismaAlumnosXCursoXCicloRepository — integration', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  // ── addStudent (idempotent upsert) ──────────────────────────────────────────

  describe('addStudent', () => {
    it('creates a new enrollment row and returns the domain entity', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1);
      const student = await createStudent(i1, { firstName: 'Ana', lastName: 'García' });

      const result = await runInTenant(i1, () =>
        repo.addStudent(courseCycle.uuid, student.id),
      );

      expect(result).toBeInstanceOf(AlumnosXCursoXCiclo);
      expect(result.courseCycleId).toBe(courseCycle.uuid);
      expect(result.studentId).toBe(student.id);
      expect(result.printable).toBe(false);
    });

    it('idempotent — re-adding same student returns existing row, no duplicate', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1);
      const student = await createStudent(i1);

      const first = await runInTenant(i1, () =>
        repo.addStudent(courseCycle.uuid, student.id),
      );
      const second = await runInTenant(i1, () =>
        repo.addStudent(courseCycle.uuid, student.id),
      );

      // Same id returned (upsert found existing row)
      expect(second.id).toBe(first.id);

      // Exactly 1 row in DB
      const count = await i1.alumnosXCursoXCiclo.count({
        where: { courseCycleId: courseCycle.uuid, studentId: student.id },
      });
      expect(count).toBe(1);
    });
  });

  // ── findByCourseCycleEnriched ───────────────────────────────────────────────

  describe('findByCourseCycleEnriched', () => {
    it('S-04: returns empty array when no students assigned', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1);

      const result = await runInTenant(i1, () =>
        repo.findByCourseCycleEnriched(courseCycle.uuid),
      );

      expect(result).toEqual([]);
    });

    it('S-03: returns enriched entries with studentName for each enrolled student', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1);
      const s1 = await createStudent(i1, { firstName: 'Ana', lastName: 'García' });
      const s2 = await createStudent(i1, { firstName: 'Carlos', lastName: 'López' });
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: s1.id });
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: s2.id });

      const result = await runInTenant(i1, () =>
        repo.findByCourseCycleEnriched(courseCycle.uuid),
      );

      expect(result).toHaveLength(2);
      const names = result.map((r) => r.studentName).sort();
      expect(names).toEqual(['Ana García', 'Carlos López']);
      const ids = result.map((r) => r.studentId);
      expect(ids).toContain(s1.id);
      expect(ids).toContain(s2.id);
    });

    it('S-03: each entry has an id field (bridge-row id)', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1);
      const student = await createStudent(i1);
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student.id });

      const result = await runInTenant(i1, () =>
        repo.findByCourseCycleEnriched(courseCycle.uuid),
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBeDefined();
      expect(typeof result[0].id).toBe('string');
    });
  });

  // ── findById ────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns the domain entity when the row exists', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1);
      const student = await createStudent(i1);
      const row = await createAlumnosXCursoXCiclo(i1, {
        courseCycleId: courseCycle.uuid,
        studentId: student.id,
      });

      const result = await runInTenant(i1, () => repo.findById(row.id));

      expect(result).not.toBeNull();
      expect(result!.id).toBe(row.id);
      expect(result!.courseCycleId).toBe(courseCycle.uuid);
    });

    it('returns null when the row does not exist', async () => {
      const i1 = tenantI1Client();
      const result = await runInTenant(i1, () => repo.findById('nonexistent-id'));
      expect(result).toBeNull();
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('S-05: removes the enrollment row by id', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1);
      const student = await createStudent(i1);
      const row = await createAlumnosXCursoXCiclo(i1, {
        courseCycleId: courseCycle.uuid,
        studentId: student.id,
      });

      await runInTenant(i1, () => repo.remove(courseCycle.uuid, row.id));

      const remaining = await i1.alumnosXCursoXCiclo.count({
        where: { id: row.id },
      });
      expect(remaining).toBe(0);
    });

    it('S-08: throws NotFoundError when the row does not exist', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1);

      await expect(
        runInTenant(i1, () => repo.remove(courseCycle.uuid, 'nonexistent-id')),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('S-08 (IDOR): throws NotFoundError when row belongs to a different course-cycle', async () => {
      const i1 = tenantI1Client();
      const { courseCycle: cc1 } = await seedCourseCycle(i1);
      const { courseCycle: cc2 } = await seedCourseCycle(i1);
      const student = await createStudent(i1);
      const row = await createAlumnosXCursoXCiclo(i1, {
        courseCycleId: cc2.uuid,
        studentId: student.id,
      });

      // Try to remove cc2's row but scope it to cc1 — should fail
      await expect(
        runInTenant(i1, () => repo.remove(cc1.uuid, row.id)),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  // ── Restrict FK: CourseCycle cannot be deleted while students enrolled ───────

  describe('Restrict FK constraint', () => {
    it('prevents hard-deleting a CourseCycle that has enrolled students', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1);
      const student = await createStudent(i1);
      await createAlumnosXCursoXCiclo(i1, {
        courseCycleId: courseCycle.uuid,
        studentId: student.id,
      });

      // Attempt to hard-delete the CourseCycle → must fail due to onDelete: Restrict FK
      await expect(
        i1.courseCycle.delete({ where: { uuid: courseCycle.uuid } }),
      ).rejects.toThrow();
    });

    it('allows hard-deleting a CourseCycle after all students are removed', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1);
      const student = await createStudent(i1);
      const row = await createAlumnosXCursoXCiclo(i1, {
        courseCycleId: courseCycle.uuid,
        studentId: student.id,
      });

      // Remove the enrollment first
      await runInTenant(i1, () => repo.remove(courseCycle.uuid, row.id));

      // Now the hard-delete should succeed
      await expect(
        i1.courseCycle.delete({ where: { uuid: courseCycle.uuid } }),
      ).resolves.toBeDefined();
    });
  });
});
