/**
 * Test data factories — minimal valid rows for integration scenarios.
 *
 * Master-DB factories take a MasterPrismaClient; tenant-DB factories take a
 * TenantPrismaClient so the caller chooses which tenant DB the row lands in.
 * Every field has a sensible default; override via the `overrides` arg.
 */
import { PrismaClient as MasterPrismaClient } from '@prisma/client';
import { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';

let seq = 0;
const uniq = (): number => ++seq;

// ── Master DB ──────────────────────────────────────────────

export function createInstitution(
  master: MasterPrismaClient,
  overrides: { name?: string; dbName?: string } = {},
) {
  const n = uniq();
  return master.institution.create({
    data: {
      name: overrides.name ?? `Institución ${n}`,
      dbName: overrides.dbName ?? `educandow_test_i${n}`,
    },
  });
}

export function createUser(
  master: MasterPrismaClient,
  overrides: { email?: string; name?: string; institutionId?: string } = {},
) {
  const n = uniq();
  return master.user.create({
    data: {
      email: overrides.email ?? `user${n}@test.local`,
      passwordHash: 'x', // not exercised by these scenarios
      name: overrides.name ?? `Usuario ${n}`,
      institutionId: overrides.institutionId ?? null,
    },
  });
}

// ── Tenant DB ──────────────────────────────────────────────

export function createAcademicCycle(
  tenant: TenantPrismaClient,
  overrides: { code?: string; name?: string; level?: number } = {},
) {
  const n = uniq();
  return tenant.academicCycle.create({
    data: {
      code: overrides.code ?? `CIC-${n}`,
      name: overrides.name ?? `Ciclo ${n}`,
      level: overrides.level ?? 1,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-12-15'),
    },
  });
}

export function createDocenteXCiclo(
  tenant: TenantPrismaClient,
  data: { userId: string; cycleId: string },
) {
  return tenant.docenteXCiclo.create({
    data: { userId: data.userId, cycleId: data.cycleId },
  });
}

export function createCourseSection(
  tenant: TenantPrismaClient,
  overrides: { name?: string; level?: number; academicYear?: string } = {},
) {
  const n = uniq();
  return tenant.courseSection.create({
    data: {
      name: overrides.name ?? `Curso ${n}`,
      level: overrides.level ?? 1,
      academicYear: overrides.academicYear ?? '2026',
    },
  });
}

export function createStudyPlan(
  tenant: TenantPrismaClient,
  overrides: { name?: string; level?: number } = {},
) {
  const n = uniq();
  return tenant.studyPlan.create({
    data: { name: overrides.name ?? `Plan ${n}`, level: overrides.level ?? 1 },
  });
}

export function createCourseCycle(
  tenant: TenantPrismaClient,
  data: {
    cycleId: string; // AcademicCycle.uuid
    courseId: string; // CourseSection.id
    studyPlanId: string; // StudyPlan.id
    courseName?: string;
    level?: number;
    passingGrade?: number;
  },
) {
  const n = uniq();
  return tenant.courseCycle.create({
    data: {
      cycleId: data.cycleId,
      courseId: data.courseId,
      studyPlanId: data.studyPlanId,
      courseName: data.courseName ?? `Curso-Ciclo ${n}`,
      level: data.level ?? 1,
      passingGrade: data.passingGrade ?? 6,
    },
  });
}

export function createSubject(
  tenant: TenantPrismaClient,
  overrides: { name?: string; level?: number } = {},
) {
  const n = uniq();
  return tenant.subject.create({
    data: { name: overrides.name ?? `Materia ${n}`, level: overrides.level ?? 1 },
  });
}

export function createStudyPlanCourse(
  tenant: TenantPrismaClient,
  data: { studyPlanId: string; courseSectionId: string },
) {
  return tenant.studyPlanCourse.create({
    data: { studyPlanId: data.studyPlanId, courseSectionId: data.courseSectionId },
  });
}

export function createStudyPlanSubject(
  tenant: TenantPrismaClient,
  data: { studyPlanCourseId: string; subjectId: string },
) {
  return tenant.studyPlanSubject.create({
    data: { studyPlanCourseId: data.studyPlanCourseId, subjectId: data.subjectId },
  });
}

export function createMateriaXCursoXCiclo(
  tenant: TenantPrismaClient,
  data: { courseCycleId: string; subjectId: string },
) {
  return tenant.materiaXCursoXCiclo.create({
    data: { courseCycleId: data.courseCycleId, subjectId: data.subjectId },
  });
}

export function createGrupo(
  tenant: TenantPrismaClient,
  data: { materiaXCursoXCicloId: string; docenteXCicloId: string; name?: string },
) {
  return tenant.grupoXCursoXMateriaXCiclo.create({
    data: {
      materiaXCursoXCicloId: data.materiaXCursoXCicloId,
      docenteXCicloId: data.docenteXCicloId,
      name: data.name ?? null,
    },
  });
}

export function createAsignacionPreceptor(
  tenant: TenantPrismaClient,
  data: { courseCycleId: string; docenteXCicloId: string },
) {
  return tenant.asignacionCursoXCiclo.create({
    data: { courseCycleId: data.courseCycleId, docenteXCicloId: data.docenteXCicloId, rol: 'PRECEPTOR' },
  });
}

export function createStudent(
  tenant: TenantPrismaClient,
  overrides: { firstName?: string; lastName?: string; dni?: string } = {},
) {
  const n = uniq();
  return tenant.student.create({
    data: {
      firstName: overrides.firstName ?? `Nombre${n}`,
      lastName: overrides.lastName ?? `Apellido${n}`,
      dni: overrides.dni ?? `DNI${n}`,
    },
  });
}

export function createTeacher(
  tenant: TenantPrismaClient,
  overrides: {
    userId?: string;
    firstName?: string;
    lastName?: string;
    dni?: string;
    email?: string;
    title?: string;
    phone?: string;
  } = {},
) {
  const n = uniq();
  return tenant.teacher.create({
    data: {
      firstName: overrides.firstName ?? `Docente${n}`,
      lastName: overrides.lastName ?? `Apellido${n}`,
      dni: overrides.dni ?? `TDNI${n}`,
      email: overrides.email ?? `docente${n}@test.local`,
      title: overrides.title ?? null,
      phone: overrides.phone ?? null,
      userId: overrides.userId ?? null,
    },
  });
}

export function createSubjectAssignment(
  tenant: TenantPrismaClient,
  data: { subjectId: string; teacherId: string; courseSectionId: string },
) {
  return tenant.subjectAssignment.create({
    data: {
      subjectId: data.subjectId,
      teacherId: data.teacherId,
      courseSectionId: data.courseSectionId,
    },
  });
}

export function createEnrollment(
  tenant: TenantPrismaClient,
  data: {
    studentId: string;
    level: number;
    modality?: number;
    academicYear: string;
    grade?: string;
    division?: string;
  },
) {
  return tenant.enrollment.create({
    data: {
      studentId: data.studentId,
      level: data.level,
      modality: data.modality ?? 0,
      academicYear: data.academicYear,
      grade: data.grade ?? null,
      division: data.division ?? null,
      status: 'ACTIVE',
    },
  });
}

/**
 * Composite: AcademicCycle + CourseSection + StudyPlan + CourseCycle.
 * Returns all four so tests can reference uuids/ids downstream.
 */
export async function seedCourseCycle(tenant: TenantPrismaClient) {
  const cycle = await createAcademicCycle(tenant);
  const courseSection = await createCourseSection(tenant);
  const studyPlan = await createStudyPlan(tenant);
  const courseCycle = await createCourseCycle(tenant, {
    cycleId: cycle.uuid,
    courseId: courseSection.id,
    studyPlanId: studyPlan.id,
  });
  return { cycle, courseSection, studyPlan, courseCycle };
}
