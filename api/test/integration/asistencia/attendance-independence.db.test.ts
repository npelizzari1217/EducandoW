/**
 * F6-T8 — Attendance recording independence (use-case level, test-debt closure).
 *
 * GIVEN a student enrolled in a CourseCycle with one materia
 *   AND a generated monthly attendance register (general + subject rows both exist),
 * WHEN RecordGeneralAttendanceDayUseCase.execute() records day 5 = 'A'
 *  AND RecordSubjectAttendanceDayUseCase.execute() records day 10 = 'A'
 *   (same student, same month; 'A' differs from the 'P' the autollenado pre-fills
 *    on every hábil day, so a cross-table leak would be visible),
 * THEN both records persist independently in their respective tables:
 *   - the general row has day 5 = 'A' (our write) and day 10 = 'P' (autofill intact)
 *   - the subject row has day 10 = 'A' (our write) and day 5 = 'P' (autofill intact)
 *   - the two row IDs are distinct (separate DB rows in separate tables)
 *
 * Spec: R-16 (general recording), R-17 (subject recording).
 * Uses ADMIN role to bypass Door 2 so the test focuses on persistence isolation.
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
import { PrismaAttendanceTypeRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-attendance-type.repository';
import { PrismaDocenteXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-docente-x-ciclo.repository';
import { PrismaAsignacionCursoXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-asignacion-curso-x-ciclo.repository';
import { PrismaGrupoRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-grupo.repository';
import { PrismaAlumnosXGrupoRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-alumnos-x-grupo.repository';
import { PrismaAttendanceMonthStatusRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-attendance-month-status.repository';
import { GenerateMonthlyAttendanceUseCase } from '../../../src/application/asistencia/generate-monthly-attendance.use-case';
import { RecordGeneralAttendanceDayUseCase } from '../../../src/application/asistencia/record-general-attendance-day.use-case';
import { RecordSubjectAttendanceDayUseCase } from '../../../src/application/asistencia/record-subject-attendance-day.use-case';

// ── Repos ──────────────────────────────────────────────────────────────────────

const generalRepo = new PrismaAsistenciaGeneralRepository();
const materiaAsistRepo = new PrismaAsistenciaMateriaRepository();
const alumnosCCRepo = new PrismaAlumnosXCursoXCicloRepository();
const mxccRepo = new PrismaMateriaXCursoXCicloRepository();
const alumnosXMateriaRepo = new PrismaAlumnosXMateriaRepository();
const attendanceTypeRepo = new PrismaAttendanceTypeRepository();
const docenteRepo = new PrismaDocenteXCicloRepository();
const asignacionRepo = new PrismaAsignacionCursoXCicloRepository();
const grupoRepo = new PrismaGrupoRepository();
const alumnosXGrupoRepo = new PrismaAlumnosXGrupoRepository();
const monthStatusRepo = new PrismaAttendanceMonthStatusRepository();

// ── Use-cases ─────────────────────────────────────────────────────────────────

const generateUC = new GenerateMonthlyAttendanceUseCase(
  alumnosCCRepo,
  mxccRepo,
  alumnosXMateriaRepo,
  generalRepo,
  materiaAsistRepo,
  monthStatusRepo,
  attendanceTypeRepo,
);

const recordGeneralUC = new RecordGeneralAttendanceDayUseCase(
  generalRepo,
  attendanceTypeRepo,
  docenteRepo,
  asignacionRepo,
  monthStatusRepo,
);

const recordSubjectUC = new RecordSubjectAttendanceDayUseCase(
  materiaAsistRepo,
  attendanceTypeRepo,
  grupoRepo,
  alumnosXGrupoRepo,
  docenteRepo,
  monthStatusRepo,
);

const YEAR = 2026;
const MONTH = 6;
const ADMIN_INPUT = { userId: 'admin-1', userRoles: ['ADMIN'] };

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('F6-T8 — Attendance recording independence (use-case level)', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  it('records general-day and subject-day for the same student independently in separate tables', async () => {
    const i1 = tenantI1Client();

    // Seed: AcademicCycle + CourseSection + StudyPlan + CourseCycle.
    // Composite level 30 (base 3) so autollenado resolves the Presente type.
    const { courseCycle } = await seedCourseCycle(i1, { level: 30 });

    // Seed: one student enrolled in the CC
    const student = await createStudent(i1);
    await createAlumnosXCursoXCiclo(i1, { courseCycleId: courseCycle.uuid, studentId: student.id });

    // Seed: one materia for the CC + enroll the student in it
    const subject = await i1.subject.create({ data: { name: 'Matemática', level: 1 } });
    const materia = await createMateriaXCursoXCiclo(i1, {
      courseCycleId: courseCycle.uuid,
      subjectId: subject.id,
    });
    await runInTenant(i1, () => alumnosXMateriaRepo.addStudent(materia.id, student.id));

    // Seed: attendance type needed by statusCode validation in both record
    // use-cases AND by the autollenado (behavior NO_COMPUTA, base level 3).
    await i1.attendanceType.create({
      data: {
        level: 3,
        code: 'P',
        description: 'Presente',
        absenceValue: 0,
        isPresent: true,
        assignable: true,
        behavior: 'NO_COMPUTA',
        // isSystem must be true: findPresenteByLevel (autollenado) only matches
        // system types; a non-system 'P' would leave the rows ungenerated.
        isSystem: true,
        active: true,
      },
    });

    // Seed: an assignable "A" (Ausente) type. The autollenado pre-fills every
    // hábil day with 'P', so to prove table independence we record a status that
    // DIFFERS from the autofilled 'P' and check it never crosses over.
    await i1.attendanceType.create({
      data: {
        level: 3,
        code: 'A',
        description: 'Ausente',
        absenceValue: 1,
        isPresent: false,
        assignable: true,
        behavior: 'AUSENTE_INJUSTIFICADO',
        isSystem: false,
        active: true,
      },
    });

    // Generate monthly attendance (creates one general row + one subject row for the student)
    await runInTenant(i1, () =>
      generateUC.execute({
        courseCycleId: courseCycle.uuid,
        year: YEAR,
        month: MONTH,
        ...ADMIN_INPUT,
      }),
    );

    // Record day 5 = 'A' in the GENERAL register (ADMIN role → D3 bypass of Door 2)
    await runInTenant(i1, () =>
      recordGeneralUC.execute({
        courseCycleId: courseCycle.uuid,
        studentId: student.id,
        year: YEAR,
        month: MONTH,
        day: 5,
        statusCode: 'A',
        ...ADMIN_INPUT,
      }),
    );

    // Record day 10 = 'A' in the SUBJECT register (ADMIN role → D3 bypass of Door 2)
    await runInTenant(i1, () =>
      recordSubjectUC.execute({
        materiaXCursoXCicloId: materia.id,
        studentId: student.id,
        year: YEAR,
        month: MONTH,
        day: 10,
        statusCode: 'A',
        ...ADMIN_INPUT,
      }),
    );

    // Assert: GENERAL row carries our day-5 'A' write; day 10 keeps the autofilled
    // 'P' — the SUBJECT's day-10 'A' write did NOT leak into the general table.
    const [generalRow] = await runInTenant(i1, () =>
      generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
    );
    expect(generalRow).toBeDefined();
    expect(generalRow.studentId).toBe(student.id);
    expect(generalRow.days.get(5)).toBe('A');
    expect(generalRow.days.get(10)).toBe('P');

    // Assert: SUBJECT row carries our day-10 'A' write; day 5 keeps the autofilled
    // 'P' — the GENERAL's day-5 'A' write did NOT leak into the subject table.
    const [subjectRow] = await runInTenant(i1, () =>
      materiaAsistRepo.findByScopeAndMonth(materia.id, YEAR, MONTH),
    );
    expect(subjectRow).toBeDefined();
    expect(subjectRow.studentId).toBe(student.id);
    expect(subjectRow.days.get(10)).toBe('A');
    expect(subjectRow.days.get(5)).toBe('P');

    // Assert: the two rows are distinct (different IDs, different tables)
    expect(generalRow.id.get()).not.toBe(subjectRow.id.get());
  });
});
