/**
 * F6-T8 — Attendance recording independence (use-case level, test-debt closure).
 *
 * GIVEN a student enrolled in a CourseCycle with one materia
 *   AND a generated monthly attendance register (general + subject rows both exist),
 * WHEN RecordGeneralAttendanceDayUseCase.execute() is called for day 5
 *  AND RecordSubjectAttendanceDayUseCase.execute() is called for day 10
 *   (same student, same month, different day values to make the assertion unambiguous),
 * THEN both records persist independently in their respective tables:
 *   - the general row has day 5 = 'P', day 10 untouched
 *   - the subject row has day 10 = 'P', day 5 untouched
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

// ── Use-cases ─────────────────────────────────────────────────────────────────

const generateUC = new GenerateMonthlyAttendanceUseCase(
  alumnosCCRepo,
  mxccRepo,
  alumnosXMateriaRepo,
  generalRepo,
  materiaAsistRepo,
);

const recordGeneralUC = new RecordGeneralAttendanceDayUseCase(
  generalRepo,
  attendanceTypeRepo,
  docenteRepo,
  asignacionRepo,
);

const recordSubjectUC = new RecordSubjectAttendanceDayUseCase(
  materiaAsistRepo,
  attendanceTypeRepo,
  grupoRepo,
  alumnosXGrupoRepo,
  docenteRepo,
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

    // Seed: AcademicCycle + CourseSection + StudyPlan + CourseCycle
    const { courseCycle } = await seedCourseCycle(i1);

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

    // Seed: attendance type needed by statusCode validation in both record use-cases
    await i1.attendanceType.create({
      data: {
        level: 1,
        code: 'P',
        description: 'Presente',
        absenceValue: 0,
        isPresent: true,
        assignable: true,
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

    // Record day 5 in the GENERAL register (ADMIN role → D3 bypass of Door 2)
    await runInTenant(i1, () =>
      recordGeneralUC.execute({
        courseCycleId: courseCycle.uuid,
        studentId: student.id,
        year: YEAR,
        month: MONTH,
        day: 5,
        statusCode: 'P',
        ...ADMIN_INPUT,
      }),
    );

    // Record day 10 in the SUBJECT register (ADMIN role → D3 bypass of Door 2)
    await runInTenant(i1, () =>
      recordSubjectUC.execute({
        materiaXCursoXCicloId: materia.id,
        studentId: student.id,
        year: YEAR,
        month: MONTH,
        day: 10,
        statusCode: 'P',
        ...ADMIN_INPUT,
      }),
    );

    // Assert: general row has day 5 = 'P' and day 10 untouched (no cross-write)
    const [generalRow] = await runInTenant(i1, () =>
      generalRepo.findByScopeAndMonth(courseCycle.uuid, YEAR, MONTH),
    );
    expect(generalRow).toBeDefined();
    expect(generalRow.studentId).toBe(student.id);
    expect(generalRow.days.get(5)).toBe('P');
    expect(generalRow.days.get(10)).toBeUndefined();

    // Assert: subject row has day 10 = 'P' and day 5 untouched (no cross-write)
    const [subjectRow] = await runInTenant(i1, () =>
      materiaAsistRepo.findByScopeAndMonth(materia.id, YEAR, MONTH),
    );
    expect(subjectRow).toBeDefined();
    expect(subjectRow.studentId).toBe(student.id);
    expect(subjectRow.days.get(10)).toBe('P');
    expect(subjectRow.days.get(5)).toBeUndefined();

    // Assert: the two rows are distinct (different IDs, different tables)
    expect(generalRow.id.get()).not.toBe(subjectRow.id.get());
  });
});
