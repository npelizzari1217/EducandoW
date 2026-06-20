/**
 * Integration test: GenerateMonthlyAttendanceUseCase — generation + idempotency (T-23).
 *
 * Tests against real PostgreSQL (:5433 test DBs):
 *
 *   GEN-DB-01: generation creates correct number of general + subject rows
 *   GEN-DB-02: re-generation (idempotency) creates 0 new rows and preserves recorded days
 *   GEN-DB-03: zero enrolled students → all-zero counts, no error
 *
 * Does NOT test HTTP layer. Tests the use-case + repositories against the real DB.
 *
 * Spec: R-10, R-11, R-12, R-13, S-01, S-02, S-03.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { tenantI1Client, runInTenant, resetAll, disconnectAll } from '../setup/clients';
import {
  seedCourseCycle,
  createStudent,
  createAlumnosXCursoXCiclo,
  createMateriaXCursoXCiclo,
} from '../setup/factories';
import { PrismaAsistenciaGeneralRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-asistencia-general.repository';
import { PrismaAsistenciaMateriaRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-asistencia-materia.repository';
import { PrismaAlumnosXCursoXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-alumnos-x-curso-x-ciclo.repository';
import { PrismaMateriaXCursoXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-materia-x-curso-x-ciclo.repository';
import { PrismaAlumnosXMateriaRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-alumnos-x-materia.repository';
import { GenerateMonthlyAttendanceUseCase } from '../../../src/application/asistencia/generate-monthly-attendance.use-case';

const generalRepo = new PrismaAsistenciaGeneralRepository();
const materiaAsistRepo = new PrismaAsistenciaMateriaRepository();
const alumnosCCRepo = new PrismaAlumnosXCursoXCicloRepository();
const mxccRepo = new PrismaMateriaXCursoXCicloRepository();
const alumnosXMateriaRepo = new PrismaAlumnosXMateriaRepository();

const generateUC = new GenerateMonthlyAttendanceUseCase(
  alumnosCCRepo,
  mxccRepo,
  alumnosXMateriaRepo,
  generalRepo,
  materiaAsistRepo,
);

const YEAR = 2026;
const MONTH = 6;
const ADMIN_INPUT = { userId: 'admin-1', userRoles: ['ADMIN'] };

describe('GenerateMonthlyAttendanceUseCase — DB integration (T-23)', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  describe('GEN-DB-01: generation creates correct rows', () => {
    it('creates 2 general rows and 3 subject rows for 2 students with different materia coverage', async () => {
      const i1 = tenantI1Client();

      // Seed: CC + 2 students + 2 materias
      const { courseCycle } = await seedCourseCycle(i1);
      const student1 = await createStudent(i1);
      const student2 = await createStudent(i1);
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student1.id });
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student2.id });

      const materia1 = await createMateriaXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, subjectId: (await i1.subject.create({ data: { name: 'M1', level: 1 } })).id });
      const materia2 = await createMateriaXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, subjectId: (await i1.subject.create({ data: { name: 'M2', level: 1 } })).id });

      // Add students to materias: stu-1 → both, stu-2 → only materia-1
      await runInTenant(i1, () => alumnosXMateriaRepo.addStudent(materia1.id, student1.id));
      await runInTenant(i1, () => alumnosXMateriaRepo.addStudent(materia1.id, student2.id));
      await runInTenant(i1, () => alumnosXMateriaRepo.addStudent(materia2.id, student1.id));

      const result = await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );

      // 2 enrolled students → 2 general rows
      expect(result.generalCreated).toBe(2);
      expect(result.generalSkipped).toBe(0);
      // 3 student-materia pairs → 3 subject rows
      expect(result.materiaCreated).toBe(3);
      expect(result.materiaSkipped).toBe(0);

      // Verify actual DB rows
      const generalRows = await runInTenant(i1, () =>
        generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
      );
      expect(generalRows).toHaveLength(2);

      const subjectRows1 = await runInTenant(i1, () =>
        materiaAsistRepo.findByScopeAndMonth(materia1.id, YEAR, MONTH),
      );
      expect(subjectRows1).toHaveLength(2); // both students in materia-1

      const subjectRows2 = await runInTenant(i1, () =>
        materiaAsistRepo.findByScopeAndMonth(materia2.id, YEAR, MONTH),
      );
      expect(subjectRows2).toHaveLength(1); // only student-1 in materia-2
    });
  });

  describe('GEN-DB-02: idempotency — re-generation preserves recorded days', () => {
    it('re-run creates 0 new rows and leaves recorded days unchanged', async () => {
      const i1 = tenantI1Client();

      const { courseCycle } = await seedCourseCycle(i1);
      const student1 = await createStudent(i1);
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student1.id });
      const subject = await i1.subject.create({ data: { name: 'M1', level: 1 } });
      const materia1 = await createMateriaXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, subjectId: subject.id });
      await runInTenant(i1, () => alumnosXMateriaRepo.addStudent(materia1.id, student1.id));

      // First generation
      const result1 = await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      expect(result1.generalCreated).toBe(1);
      expect(result1.materiaCreated).toBe(1);

      // Record day 5 in the general register
      const [generalRow] = await runInTenant(i1, () =>
        generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
      );
      await runInTenant(i1, () => generalRepo.setDay(generalRow.id.get(), 5, 'P'));

      // Re-generate (idempotent)
      const result2 = await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      expect(result2.generalCreated).toBe(0);
      expect(result2.generalSkipped).toBe(1);
      expect(result2.materiaCreated).toBe(0);
      expect(result2.materiaSkipped).toBe(1);

      // Day 5 must still be 'P' — days were not reset (ADR-3)
      const [updatedRow] = await runInTenant(i1, () =>
        generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
      );
      expect(updatedRow.days.get(5)).toBe('P');
    });
  });

  describe('GEN-DB-03: zero enrolled students', () => {
    it('succeeds with all-zero counts when CC has no enrolled students', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1);

      const result = await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );

      expect(result).toEqual({
        generalCreated: 0,
        generalSkipped: 0,
        materiaCreated: 0,
        materiaSkipped: 0,
      });

      const rows = await runInTenant(i1, () =>
        generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
      );
      expect(rows).toHaveLength(0);
    });
  });
});
