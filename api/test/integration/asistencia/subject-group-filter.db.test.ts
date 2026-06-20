/**
 * Integration test: ListSubjectAttendanceUseCase — group filter (T-24).
 *
 * Tests against real PostgreSQL (:5433 test DBs):
 *
 *   GRP-DB-01: grupoId filter returns only the group's students (S-12)
 *   GRP-DB-02: no grupoId → all materia students returned (S-13, no-group fallback)
 *   GRP-DB-03: grupoId filter with empty group → empty array
 *
 * Uses D3 admin roles to bypass Door 2 — focusing on the data/filter behavior.
 * Spec: R-22, R-23, R-24, S-12, S-13.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { tenantI1Client, runInTenant, resetAll, disconnectAll } from '../setup/clients';
import {
  seedCourseCycle,
  createStudent,
  createAlumnosXCursoXCiclo,
  createMateriaXCursoXCiclo,
  createGrupo,
  createDocenteXCiclo,
} from '../setup/factories';
import { PrismaAsistenciaGeneralRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-asistencia-general.repository';
import { PrismaAsistenciaMateriaRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-asistencia-materia.repository';
import { PrismaAlumnosXCursoXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-alumnos-x-curso-x-ciclo.repository';
import { PrismaMateriaXCursoXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-materia-x-curso-x-ciclo.repository';
import { PrismaAlumnosXMateriaRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-alumnos-x-materia.repository';
import { PrismaGrupoRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-grupo.repository';
import { PrismaAlumnosXGrupoRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-alumnos-x-grupo.repository';
import { PrismaDocenteXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-docente-x-ciclo.repository';
import { GenerateMonthlyAttendanceUseCase } from '../../../src/application/asistencia/generate-monthly-attendance.use-case';
import { ListSubjectAttendanceUseCase } from '../../../src/application/asistencia/list-subject-attendance.use-case';

const generalRepo = new PrismaAsistenciaGeneralRepository();
const materiaAsistRepo = new PrismaAsistenciaMateriaRepository();
const alumnosCCRepo = new PrismaAlumnosXCursoXCicloRepository();
const mxccRepo = new PrismaMateriaXCursoXCicloRepository();
const alumnosXMateriaRepo = new PrismaAlumnosXMateriaRepository();
const grupoRepo = new PrismaGrupoRepository();
const alumnosXGrupoRepo = new PrismaAlumnosXGrupoRepository();
const docenteRepo = new PrismaDocenteXCicloRepository();

const generateUC = new GenerateMonthlyAttendanceUseCase(
  alumnosCCRepo,
  mxccRepo,
  alumnosXMateriaRepo,
  generalRepo,
  materiaAsistRepo,
);

const listSubjectUC = new ListSubjectAttendanceUseCase(
  materiaAsistRepo,
  grupoRepo,
  alumnosXGrupoRepo,
  docenteRepo,
);

const YEAR = 2026;
const MONTH = 6;
const ADMIN_INPUT = { userId: 'admin-1', userRoles: ['ADMIN'] };

describe('ListSubjectAttendanceUseCase — group filter DB integration (T-24)', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  describe('GRP-DB-01: grupoId filter returns only group members', () => {
    it('only stu-1 (in grupo-A) appears when filtered by grupo-A id', async () => {
      const i1 = tenantI1Client();
      const { cycle, courseCycle } = await seedCourseCycle(i1);

      const student1 = await createStudent(i1);
      const student2 = await createStudent(i1);

      // Both students enrolled in CC
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student1.id });
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student2.id });

      // One materia for the CC
      const subject = await i1.subject.create({ data: { name: 'Inglés', level: 1 } });
      const materia = await createMateriaXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, subjectId: subject.id });

      // Both students in materia
      const axm1 = await runInTenant(i1, () => alumnosXMateriaRepo.addStudent(materia.id, student1.id));
      const axm2 = await runInTenant(i1, () => alumnosXMateriaRepo.addStudent(materia.id, student2.id));

      // Create a docente for groups
      const docenteUser = 'docente-user-1';
      const docente = await createDocenteXCiclo(i1, { userId: docenteUser, cycleId: cycle.uuid });

      // Create grupo-A (only student1 is a member)
      const grupoA = await createGrupo(i1, { materiaXCursoXCicloId: materia.id, docenteXCicloId: docente.id });
      await runInTenant(i1, () => alumnosXGrupoRepo.addStudent(grupoA.id, axm1.id));
      // student2 (axm2) is NOT added to grupo-A

      // Generate subject attendance
      await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );

      // List with grupoId filter → only student1
      const filtered = await runInTenant(i1, () =>
        listSubjectUC.execute({
          materiaXCursoXCicloId: materia.id,
          year: YEAR,
          month: MONTH,
          grupoId: grupoA.id,
          ...ADMIN_INPUT,
        }),
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].studentId).toBe(student1.id);
    });
  });

  describe('GRP-DB-02: no grupoId → all materia students', () => {
    it('returns rows for all students in the materia when no grupoId filter', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1);

      const student1 = await createStudent(i1);
      const student2 = await createStudent(i1);

      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student1.id });
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student2.id });

      const subject = await i1.subject.create({ data: { name: 'Matemática', level: 1 } });
      const materia = await createMateriaXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, subjectId: subject.id });

      await runInTenant(i1, () => alumnosXMateriaRepo.addStudent(materia.id, student1.id));
      await runInTenant(i1, () => alumnosXMateriaRepo.addStudent(materia.id, student2.id));

      await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );

      // List WITHOUT grupoId → all students
      const allRows = await runInTenant(i1, () =>
        listSubjectUC.execute({
          materiaXCursoXCicloId: materia.id,
          year: YEAR,
          month: MONTH,
          ...ADMIN_INPUT,
        }),
      );

      expect(allRows).toHaveLength(2);
      const studentIds = allRows.map((r) => r.studentId).sort();
      expect(studentIds).toEqual([student1.id, student2.id].sort());
    });
  });

  describe('GRP-DB-03: grupoId with empty group → empty array', () => {
    it('returns empty array when grupo exists but has no student members', async () => {
      const i1 = tenantI1Client();
      const { cycle, courseCycle } = await seedCourseCycle(i1);

      const student1 = await createStudent(i1);
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student1.id });

      const subject = await i1.subject.create({ data: { name: 'Historia', level: 1 } });
      const materia = await createMateriaXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, subjectId: subject.id });
      await runInTenant(i1, () => alumnosXMateriaRepo.addStudent(materia.id, student1.id));

      const docente = await createDocenteXCiclo(i1, { userId: 'doc-2', cycleId: cycle.uuid });
      const emptyGrupo = await createGrupo(i1, { materiaXCursoXCicloId: materia.id, docenteXCicloId: docente.id });

      await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );

      const result = await runInTenant(i1, () =>
        listSubjectUC.execute({
          materiaXCursoXCicloId: materia.id,
          year: YEAR,
          month: MONTH,
          grupoId: emptyGrupo.id,
          ...ADMIN_INPUT,
        }),
      );

      expect(result).toHaveLength(0);
    });
  });
});
