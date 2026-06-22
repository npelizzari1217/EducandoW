import { Injectable } from '@nestjs/common';
import type {
  MateriaXCursoXCicloRepository,
  AlumnosXMateriaRepository,
  AlumnosXCursoXCicloRepository,
  AlumnoMateriaEnriched,
} from '@educandow/domain';
import { NotFoundError } from '@educandow/domain';

/**
 * ListEnrollableStudentsForMateriaUseCase — D5.
 *
 * Returns students enrolled in the CourseCycle but NOT yet in the materia universe.
 * Eligible = CC students MINUS already-enrolled students (set diff on studentId).
 *
 * Addresses the empty-optativa problem: the existing ?unassigned=true filter operates
 * within the materia universe (students in the materia but not in any grupo). For an
 * empty optativa there are no universe members, so ?unassigned returns nothing.
 * This UC reaches into AlumnosXCursoXCiclo (a different aggregate) to get the source list.
 *
 * Reuses findByCourseCycleEnriched which already exists in both the port and Prisma impl.
 */
@Injectable()
export class ListEnrollableStudentsForMateriaUseCase {
  constructor(
    private readonly materiaRepo: MateriaXCursoXCicloRepository,
    private readonly alumnosXMateriaRepo: AlumnosXMateriaRepository,
    private readonly alumnosCCRepo: AlumnosXCursoXCicloRepository,
  ) {}

  async execute(input: { materiaXCursoXCicloId: string }): Promise<AlumnoMateriaEnriched[]> {
    const materia = await this.materiaRepo.findById(input.materiaXCursoXCicloId);
    if (!materia) {
      throw new NotFoundError('MateriaXCursoXCiclo', input.materiaXCursoXCicloId);
    }

    const ccStudents = await this.alumnosCCRepo.findByCourseCycleEnriched(materia.courseCycleId);
    const enrolledRows = await this.alumnosXMateriaRepo.findByMateria(input.materiaXCursoXCicloId);
    const enrolled = new Set(enrolledRows.map((a) => a.studentId));

    return ccStudents
      .filter((s) => !enrolled.has(s.studentId))
      .map((s) => ({ id: s.id, studentId: s.studentId, studentName: s.studentName }));
  }
}
