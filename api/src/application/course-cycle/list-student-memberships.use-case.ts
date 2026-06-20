import type { AlumnosXCursoXCicloRepository, StudentMembershipEnriched } from '@educandow/domain';

/**
 * ListStudentMembershipsUseCase — SDD-2 R16/R17.
 *
 * Returns all AlumnosXCursoXCiclo memberships for a student enriched with
 * CourseCycle → CourseSection display fields.
 *
 * Replaces the web layer's GET /enrollments?studentId pattern:
 *   - students.tsx per-student boletín dropdown (R16)
 *   - StudentLegajo.tsx "Matrículas" card (R17)
 */
export class ListStudentMembershipsUseCase {
  constructor(
    private readonly alumnosRepo: AlumnosXCursoXCicloRepository,
  ) {}

  async execute(studentId: string): Promise<StudentMembershipEnriched[]> {
    return this.alumnosRepo.findByStudentEnriched(studentId);
  }
}
