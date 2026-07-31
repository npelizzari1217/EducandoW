import { Injectable } from '@nestjs/common';
import type {
  CourseCycleRepository,
  AlumnosXCursoXCicloRepository,
  StudentRepository,
} from '@educandow/domain';
import { NotFoundError, PaseFechaInvalidaError, ok, err, Result } from '@educandow/domain';

/**
 * RegistrarPaseUseCase — PR2 task 2.4 (pase-alumno-egreso).
 *
 * Registers or reverts a student's "pase de egreso" via the AlumnosXCursoXCiclo bridge-row.
 * Validates CourseCycle existence and IDOR (enrollment must belong to the claimed ccId).
 * Delegates the business invariant (fecha no futura) to the Student domain entity.
 *
 * Route: PATCH /course-cycles/:ccId/alumnos/:id/pase
 * Design: §3.3
 */
@Injectable()
export class RegistrarPaseUseCase {
  constructor(
    private readonly ccRepo: CourseCycleRepository,
    private readonly alumnosRepo: AlumnosXCursoXCicloRepository,
    private readonly studentRepo: StudentRepository,
  ) {}

  async execute(input: {
    courseCycleId: string;
    id: string;
    fechaDePase: Date | null;
  }): Promise<Result<void, Error>> {
    // 1. Validate CourseCycle exists
    const cc = await this.ccRepo.findByUuid(input.courseCycleId);
    if (!cc) {
      return err(new NotFoundError('CourseCycle', input.courseCycleId));
    }

    // 2. Validate enrollment exists and belongs to this CourseCycle (IDOR guard)
    const row = await this.alumnosRepo.findById(input.id);
    if (!row || row.courseCycleId !== input.courseCycleId) {
      return err(new NotFoundError('AlumnosXCursoXCiclo', input.id));
    }

    // 3. Load the Student aggregate
    const student = await this.studentRepo.findById(row.studentId);
    if (!student) {
      return err(new NotFoundError('Student', row.studentId));
    }

    // 4. Apply domain invariant (fecha futura → PaseFechaInvalidaError thrown by entity).
    // Bridge: adapt the entity throw to Result — same seam as attendance-type.use-cases.ts:102-106.
    try {
      if (input.fechaDePase) {
        student.registrarPase(input.fechaDePase);
      } else {
        student.revertirPase();
      }
    } catch (e) {
      return err(e as PaseFechaInvalidaError);
    }

    // 5. Persist the pase date (null for revert)
    await this.studentRepo.setFechaDePase(student.id.get(), student.fechaDePase ?? null);
    return ok(undefined);
  }
}
