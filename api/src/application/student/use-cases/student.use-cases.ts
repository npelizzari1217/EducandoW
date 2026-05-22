import { Injectable } from '@nestjs/common';
import { ok, err, Result, ValidationError, StudentRepository, Student, Dni } from '@educandow/domain';

export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  dni: string;
  email?: string;
  birthDate?: string;
  guardianName?: string;
  guardianPhone?: string;
  institutionId: string;
}

@Injectable()
export class CreateStudentUseCase {
  constructor(private readonly repo: StudentRepository) {}

  async execute(input: CreateStudentInput): Promise<Result<Student, ValidationError>> {
    const dniResult = Dni.create(input.dni);
    if (dniResult.isErr()) return err(dniResult.unwrapErr());

    const existing = await this.repo.findByDni(input.dni);
    if (existing) return err(new ValidationError('Ya existe un estudiante con ese DNI'));

    const student = Student.create({
      firstName: input.firstName,
      lastName: input.lastName,
      dni: dniResult.unwrap(),
      birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
      guardianName: input.guardianName,
      guardianPhone: input.guardianPhone,
      institutionId: input.institutionId,
    });

    await this.repo.save(student);
    return ok(student);
  }
}

@Injectable()
export class ListStudentsUseCase {
  constructor(private readonly repo: StudentRepository) {}

  async execute(institutionId: string): Promise<Student[]> {
    return this.repo.findByInstitution(institutionId);
  }
}

@Injectable()
export class GetStudentUseCase {
  constructor(private readonly repo: StudentRepository) {}

  async execute(id: string): Promise<Student | null> {
    return this.repo.findById(id);
  }
}

@Injectable()
export class DeleteStudentUseCase {
  constructor(private readonly repo: StudentRepository) {}

  async execute(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
