import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';

export interface EnrolledStudentRow {
  studentId: string;
  firstName: string;
  lastName: string;
}

/**
 * Shared infra helper: resolves enrolled students for a CourseCycle via the
 * existing heuristic join (no explicit Enrollment→CourseCycle FK until Fase 4).
 *
 * Join: CourseCycle.uuid → courseSection(level/grade/division/academicYear)
 *       → enrollment(status=ACTIVE, deletedAt=null) → student(firstName, lastName).
 *
 * Used by both:
 *  - ListStudentsByCourseCycleUC (via PrismaCourseCycleRepository.findEnrolledStudents)
 *  - AutoCreateCompetencyValuationsUC.execute (directly, to avoid circular DI)
 *
 * Design §ReadStudentsByCycle: plain function, not a class method, so it is
 * importable from both the course-cycle and pedagogy layers without creating
 * a module circular dependency.
 */
export async function findEnrolledStudentsByCourseCycle(
  client: TenantPrismaClient,
  courseCycleUuid: string,
): Promise<EnrolledStudentRow[]> {
  const cc = await client.courseCycle.findUnique({
    where: { uuid: courseCycleUuid },
    select: { courseId: true },
  });
  if (!cc) return [];

  const section = await client.courseSection.findUnique({
    where: { id: cc.courseId },
    select: { level: true, grade: true, division: true, academicYear: true },
  });
  if (!section) return [];

  // CourseSection.level is the composite code (levelCode*10 + modality), while
  // Enrollment stores the pair (level=levelCode, modality) separately. Decompose
  // the section's composite to match the enrollment's stored representation.
  const sectionLevelCode = Math.floor(section.level / 10);
  const sectionModality = section.level % 10;

  const enrollments = await client.enrollment.findMany({
    where: {
      level: sectionLevelCode,
      modality: sectionModality,
      grade: section.grade,
      division: section.division,
      academicYear: section.academicYear,
      status: 'ACTIVE',
      deletedAt: null,
    },
    select: {
      studentId: true,
      student: { select: { firstName: true, lastName: true } },
    },
  });

  return enrollments.map((e) => ({
    studentId: e.studentId,
    firstName: e.student.firstName,
    lastName: e.student.lastName,
  }));
}
