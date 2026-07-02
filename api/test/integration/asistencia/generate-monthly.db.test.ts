/**
 * Integration test: GenerateMonthlyAttendanceUseCase — generation + idempotency (T-23)
 * + autollenado de Presente en días hábiles (asistencia-autollenado-p, ATR-R11, PR-4).
 *
 * Tests against real PostgreSQL (:5433 test DBs):
 *
 *   GEN-DB-01: generation creates correct number of general + subject rows
 *   GEN-DB-02: re-generation (idempotency) creates 0 new rows and preserves recorded days
 *   GEN-DB-03: zero enrolled students → all-zero counts, no error
 *   GEN-DB-04 (ATR-S71/S73): grilla nueva General — hábiles → "P", SAB/DOM nunca reciben "P"
 *   GEN-DB-05 (ATR-S82): idempotencia — 2da corrida no altera nada tras la 1ra
 *   GEN-DB-06 (ATR-S74, CRÍTICO): regeneración General — día cargado a mano permanece igual
 *   GEN-DB-07 (ATR-S72/S75): eje Materia — mismo comportamiento que General
 *   GEN-DB-08 (ATR-S76): "Feriado" (behavior DIA_NO_HABIL) cargado a mano nunca es pisado
 *   GEN-DB-09 (ATR-S80): nivel sin AttendanceType Presente → 422 PRESENTE_TYPE_NOT_FOUND,
 *                        cero filas escritas (ni general ni materia)
 *   GEN-DB-10 (ATR-S81): mes CERRADO → Generar no autollena ninguna celda nueva
 *
 * Does NOT test HTTP layer. Tests the use-case + repositories against the real DB.
 *
 * Spec: R-10, R-11, R-12, R-13, S-01, S-02, S-03 (SDD-4);
 *       ATR-R11.1..R11.7, ATR-S71..S82 (asistencia-autollenado-p).
 *
 * NOTA (drift preexistente, corregido en esta PR): el use-case ahora requiere 7 args
 * (agregados monthStatusRepo y attendanceTypeRepo desde SDD-4 PR-3b / asistencia-autollenado-p
 * PR-3) y `execute()` devuelve `Result<GenerationResult, PresenteTypeNotFoundError>` en vez de
 * throwear/retornar el objeto plano — hay que `.unwrap()` en el camino feliz.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PresenteTypeNotFoundError } from '@educandow/domain';
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
import { PrismaAttendanceMonthStatusRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-attendance-month-status.repository';
import { PrismaAttendanceTypeRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-attendance-type.repository';
import { GenerateMonthlyAttendanceUseCase } from '../../../src/application/asistencia/generate-monthly-attendance.use-case';

const generalRepo = new PrismaAsistenciaGeneralRepository();
const materiaAsistRepo = new PrismaAsistenciaMateriaRepository();
const alumnosCCRepo = new PrismaAlumnosXCursoXCicloRepository();
const mxccRepo = new PrismaMateriaXCursoXCicloRepository();
const alumnosXMateriaRepo = new PrismaAlumnosXMateriaRepository();
const monthStatusRepo = new PrismaAttendanceMonthStatusRepository();
const attendanceTypeRepo = new PrismaAttendanceTypeRepository();

const generateUC = new GenerateMonthlyAttendanceUseCase(
  alumnosCCRepo,
  mxccRepo,
  alumnosXMateriaRepo,
  generalRepo,
  materiaAsistRepo,
  monthStatusRepo,
  attendanceTypeRepo,
);

const YEAR = 2026;
const MONTH = 6; // June 2026: day 1 = Monday. Hábiles: 1-5,8-12,15-19,22-26,29,30. SAB: 6,13,20,27. DOM: 7,14,21,28.
const ADMIN_INPUT = { userId: 'admin-1', userRoles: ['ADMIN'] };

/** Seeds the system "P" AttendanceType at the BASE educational level (1-4) derived
 *  from the composite course level (nivel×10+modalidad; ej. 30→3). Los AttendanceType
 *  se indexan por nivel base, igual que EnsureAttendanceTypesForLevelUseCase. */
function seedPresenteType(i1: ReturnType<typeof tenantI1Client>, compositeLevel = 30) {
  return i1.attendanceType.create({
    data: {
      level: Math.floor(compositeLevel / 10),
      code: 'P',
      description: 'Presente',
      absenceValue: 0,
      isPresent: true,
      assignable: true,
      behavior: 'NO_COMPUTA',
      isSystem: true,
      active: true,
    },
  });
}

/** Seeds a custom "Feriado" type — behavior DIA_NO_HABIL, assignable (loaded manually post-generación, ATR-S76). */
function seedFeriadoType(i1: ReturnType<typeof tenantI1Client>, compositeLevel = 30) {
  return i1.attendanceType.create({
    data: {
      level: Math.floor(compositeLevel / 10),
      code: 'FERIADO',
      description: 'Feriado',
      absenceValue: 0,
      isPresent: false,
      assignable: true,
      behavior: 'DIA_NO_HABIL',
      isSystem: false,
      active: true,
    },
  });
}

describe('GenerateMonthlyAttendanceUseCase — DB integration (T-23 + asistencia-autollenado-p)', () => {
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
      const { courseCycle } = await seedCourseCycle(i1, { level: 30 });
      await seedPresenteType(i1, courseCycle.level);
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

      const outcome = await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      const result = outcome.unwrap();

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

      const { courseCycle } = await seedCourseCycle(i1, { level: 30 });
      await seedPresenteType(i1, courseCycle.level);
      const student1 = await createStudent(i1);
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student1.id });
      const subject = await i1.subject.create({ data: { name: 'M1', level: 1 } });
      const materia1 = await createMateriaXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, subjectId: subject.id });
      await runInTenant(i1, () => alumnosXMateriaRepo.addStudent(materia1.id, student1.id));

      // First generation
      const outcome1 = await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      const result1 = outcome1.unwrap();
      expect(result1.generalCreated).toBe(1);
      expect(result1.materiaCreated).toBe(1);

      // Record day 5 in the general register
      const [generalRow] = await runInTenant(i1, () =>
        generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
      );
      await runInTenant(i1, () => generalRepo.setDay(generalRow.id.get(), 5, 'P'));

      // Re-generate (idempotent)
      const outcome2 = await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      const result2 = outcome2.unwrap();
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
      const { courseCycle } = await seedCourseCycle(i1, { level: 30 });
      // No AttendanceType seeded on purpose: zero-enrollment early-return happens
      // BEFORE Presente resolution, so this must succeed with no PresenteTypeNotFoundError.

      const outcome = await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      const result = outcome.unwrap();

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

  describe('GEN-DB-04 (ATR-S71/S73): grilla nueva General — hábiles reciben "P", SAB/DOM nunca', () => {
    it('fills every hábil day with "P" and never writes "P" on SAB/DOM keys', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1, { level: 30 });
      await seedPresenteType(i1, courseCycle.level);
      const student = await createStudent(i1);
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student.id });

      const outcome = await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      expect(outcome.isOk()).toBe(true);

      const [row] = await runInTenant(i1, () =>
        generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
      );

      // Hábiles (Mon-Fri) — sample across the month
      for (const d of [1, 2, 3, 4, 5, 8, 12, 30]) {
        expect(row.days.get(d)).toBe('P');
      }
      // SAB/DOM — never "P"
      expect(row.days.get(6)).toBe('SAB');
      expect(row.days.get(7)).toBe('DOM');
      expect(row.days.get(13)).toBe('SAB');
      expect(row.days.get(14)).toBe('DOM');
    });
  });

  describe('GEN-DB-05 (ATR-S82): idempotencia — 2da corrida no altera nada', () => {
    it('running generate twice in a row produces the exact same days map', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1, { level: 30 });
      await seedPresenteType(i1, courseCycle.level);
      const student = await createStudent(i1);
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student.id });

      await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      const [row1] = await runInTenant(i1, () =>
        generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
      );

      const outcome2 = await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      const result2 = outcome2.unwrap();
      expect(result2.generalCreated).toBe(0);
      expect(result2.generalSkipped).toBe(1);

      const [row2] = await runInTenant(i1, () =>
        generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
      );
      expect(row2.days.toJSON()).toEqual(row1.days.toJSON());
    });
  });

  describe('GEN-DB-06 (ATR-S74, invariante CRÍTICO de no-sobrescritura): día cargado a mano', () => {
    it('a day recorded by hand before regeneration is never overwritten by autofill', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1, { level: 30 });
      await seedPresenteType(i1, courseCycle.level);
      const student = await createStudent(i1);
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student.id });

      await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      const [row] = await runInTenant(i1, () =>
        generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
      );
      // Day 3 (Wednesday, hábil) was auto-filled to "P" by generate — manually override to "A".
      expect(row.days.get(3)).toBe('P');
      await runInTenant(i1, () => generalRepo.setDay(row.id.get(), 3, 'A'));

      // Regenerate — must NOT touch day 3.
      await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      const [updated] = await runInTenant(i1, () =>
        generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
      );
      expect(updated.days.get(3)).toBe('A');
      // Other hábiles remain "P"; SAB remains SAB.
      expect(updated.days.get(1)).toBe('P');
      expect(updated.days.get(6)).toBe('SAB');
    });
  });

  describe('GEN-DB-07 (ATR-S72/S75): eje Materia — mismo comportamiento que General', () => {
    it('subject register autofills hábiles and preserves a manually-loaded day identically to general', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1, { level: 30 });
      await seedPresenteType(i1, courseCycle.level);
      const student = await createStudent(i1);
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student.id });
      const subject = await i1.subject.create({ data: { name: 'M1', level: 1 } });
      const materia = await createMateriaXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, subjectId: subject.id });
      await runInTenant(i1, () => alumnosXMateriaRepo.addStudent(materia.id, student.id));

      await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      const [subjectRow] = await runInTenant(i1, () =>
        materiaAsistRepo.findByScopeAndMonth(materia.id, YEAR, MONTH),
      );
      expect(subjectRow.days.get(1)).toBe('P');
      expect(subjectRow.days.get(6)).toBe('SAB');

      // Manually load day 10 (Wednesday, hábil) as "T" — must survive regeneration.
      await runInTenant(i1, () => materiaAsistRepo.setDay(subjectRow.id.get(), 10, 'T'));
      await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      const [updatedSubjectRow] = await runInTenant(i1, () =>
        materiaAsistRepo.findByScopeAndMonth(materia.id, YEAR, MONTH),
      );
      expect(updatedSubjectRow.days.get(10)).toBe('T');
      expect(updatedSubjectRow.days.get(1)).toBe('P');
    });
  });

  describe('GEN-DB-08 (ATR-S76): "Feriado" cargado a mano nunca es pisado por el autollenado', () => {
    it('a manually-loaded FERIADO day is preserved across regeneration', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1, { level: 30 });
      await seedPresenteType(i1, courseCycle.level);
      await seedFeriadoType(i1, courseCycle.level);
      const student = await createStudent(i1);
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student.id });

      await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      const [row] = await runInTenant(i1, () =>
        generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
      );
      // Day 4 (Thursday, hábil) — mark as Feriado by hand (post-generación, fuera de alcance del autollenado).
      await runInTenant(i1, () => generalRepo.setDay(row.id.get(), 4, 'FERIADO'));

      await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      const [updated] = await runInTenant(i1, () =>
        generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
      );
      expect(updated.days.get(4)).toBe('FERIADO');
    });
  });

  describe('GEN-DB-09 (ATR-S80): nivel sin AttendanceType Presente → 422, sin escritura parcial', () => {
    it('returns Result.err(PresenteTypeNotFoundError) and writes zero rows in both axes', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1, { level: 30 });
      // No "P" AttendanceType seeded for this level on purpose (ATR-S80).
      const student = await createStudent(i1);
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student.id });
      const subject = await i1.subject.create({ data: { name: 'M1', level: 1 } });
      const materia = await createMateriaXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, subjectId: subject.id });
      await runInTenant(i1, () => alumnosXMateriaRepo.addStudent(materia.id, student.id));

      const outcome = await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );

      expect(outcome.isErr()).toBe(true);
      expect(outcome.unwrapErr()).toBeInstanceOf(PresenteTypeNotFoundError);
      expect(outcome.unwrapErr().code).toBe('PRESENTE_TYPE_NOT_FOUND');

      const generalRows = await runInTenant(i1, () =>
        generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
      );
      expect(generalRows).toHaveLength(0);
      const subjectRows = await runInTenant(i1, () =>
        materiaAsistRepo.findByScopeAndMonth(materia.id, YEAR, MONTH),
      );
      expect(subjectRows).toHaveLength(0);
    });
  });

  describe('GEN-DB-10 (ATR-S81): mes CERRADO — Generar no autollena ninguna celda nueva', () => {
    it('a row created while the month is CLOSED is never autofilled with "P"', async () => {
      const i1 = tenantI1Client();
      const { courseCycle } = await seedCourseCycle(i1, { level: 30 });
      await seedPresenteType(i1, courseCycle.level);
      const student1 = await createStudent(i1);
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student1.id });

      // First generation — creates the month's status row (OPEN) + student1's row (autofilled).
      const outcome1 = await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      expect(outcome1.unwrap().generalCreated).toBe(1);
      const [row1] = await runInTenant(i1, () =>
        generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
      );
      expect(row1.days.get(1)).toBe('P');

      // Close the month.
      const status = await runInTenant(i1, () => monthStatusRepo.findOne(courseCycle.uuid, YEAR, MONTH));
      expect(status).not.toBeNull();
      status!.close('secretario-1');
      await runInTenant(i1, () => monthStatusRepo.upsert(status!));

      // Enroll a NEW student after closing — their row does not exist yet.
      const student2 = await createStudent(i1);
      await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student2.id });

      // Regenerate while CLOSED — must create student2's row WITHOUT autofilling "P"
      // (ATR-R11.6: preserves preexisting Generar-on-CLOSED behavior, no new error/bypass).
      const outcome2 = await runInTenant(i1, () =>
        generateUC.execute({ courseCycleId: courseCycle.uuid, year: YEAR, month: MONTH, ...ADMIN_INPUT }),
      );
      expect(outcome2.isOk()).toBe(true);
      expect(outcome2.unwrap().generalCreated).toBe(1);

      const rows = await runInTenant(i1, () =>
        generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
      );
      const row2 = rows.find((r) => r.studentId === student2.id)!;
      expect(row2).toBeDefined();
      // No autofill: hábil day 1 has NO entry at all (lockedMap only carries SAB/DOM/X).
      expect(row2.days.get(1)).toBeUndefined();
      // student1's already-autofilled day 1 is untouched (fill-only merge never removes it).
      const row1After = rows.find((r) => r.studentId === student1.id)!;
      expect(row1After.days.get(1)).toBe('P');
    });
  });
});
