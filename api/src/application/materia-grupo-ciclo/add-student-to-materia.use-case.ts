import { Injectable } from '@nestjs/common';
import type {
  MateriaXCursoXCicloRepository,
  AlumnosXMateriaRepository,
  MateriasXAlumnoXCursoXCiclo,
  StudentRepository,
} from '@educandow/domain';
import { NotFoundError } from '@educandow/domain';

/**
 * AddStudentToMateriaUseCase — Fase 3c (F3-A2).
 *
 * Adds an enrolled student to the universe of a MateriaXCursoXCiclo.
 * The student MUST exist in the Student registry (not ingresantes — MGC-S5).
 * Idempotent: if the student is already in the universe the operation returns
 * the existing record without error.
 */
@Injectable()
export class AddStudentToMateriaUseCase {
  constructor(
    private readonly materiaRepo: MateriaXCursoXCicloRepository,
    private readonly alumnosRepo: AlumnosXMateriaRepository,
    private readonly studentRepo: StudentRepository,
  ) {}

  async execute(input: {
    materiaXCursoXCicloId: string;
    studentId: string;
  }): Promise<MateriasXAlumnoXCursoXCiclo> {
    // Validate materia exists
    const materia = await this.materiaRepo.findById(input.materiaXCursoXCicloId);
    if (!materia) {
      throw new NotFoundError('MateriaXCursoXCiclo', input.materiaXCursoXCicloId);
    }

    // Validate student is in the enrolled registry (not ingresante — MGC-S5)
    const student = await this.studentRepo.findById(input.studentId);
    if (!student) {
      throw new NotFoundError('Student', input.studentId);
    }

    // Add to universe (idempotent via @@unique)
    return this.alumnosRepo.addStudent(input.materiaXCursoXCicloId, input.studentId);
  }
}
