import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';

export interface EnrolledStudentRow {
  studentId: string;
  firstName: string;
  lastName: string;
}

/**
 * Shared infra helper: resolves enrolled students for a CourseCycle using the
 * authoritative AlumnosXCursoXCiclo bridge table (SDD-2, R5).
 *
 * Replaces the legacy heuristic join (CourseCycle → CourseSection → Enrollment)
 * with a direct lookup on AlumnosXCursoXCiclo, which is the single source of truth
 * for which students belong to a CourseCycle.
 *
 * Transitively fixes:
 *  - ListStudentsByCourseCycleUC (via PrismaCourseCycleRepository.findEnrolledStudents)
 *  - AutoCreateCompetencyValuationsUC.execute (directly, to avoid circular DI)
 *  - GetSubjectGradesBySubjectUseCase (via courseCycleRepo.findEnrolledStudents)
 *
 * Design §R5: plain function, not a class method, so it is
 * importable from both the course-cycle and pedagogy layers without creating
 * a module circular dependency.
 */
export async function findEnrolledStudentsByCourseCycle(
  client: TenantPrismaClient,
  courseCycleUuid: string,
): Promise<EnrolledStudentRow[]> {
  const rows = await client.alumnosXCursoXCiclo.findMany({
    where: { courseCycleId: courseCycleUuid },
    select: {
      studentId: true,
      student: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows.map((r) => ({
    studentId: r.studentId,
    firstName: r.student.firstName,
    lastName: r.student.lastName,
  }));
}
