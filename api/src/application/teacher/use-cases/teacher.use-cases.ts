import { Injectable } from '@nestjs/common';
import { ok, err, Result, ValidationError, NotFoundError, TeacherRepository, Teacher, Id, Dni, Email } from '@educandow/domain';

export interface CreateTeacherInput {
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  phone?: string;
  title?: string;
  institutionId: string;
  password?: string;
  active?: boolean;
}

@Injectable()
export class CreateTeacherUseCase {
  constructor(private readonly repo: TeacherRepository) {}

  async execute(input: CreateTeacherInput): Promise<Result<Teacher, ValidationError>> {
    const dniResult = Dni.create(input.dni);
    if (dniResult.isErr()) return err(dniResult.unwrapErr());

    const emailResult = Email.create(input.email);
    if (emailResult.isErr()) return err(emailResult.unwrapErr());

    const existing = await this.repo.findByDni(input.dni);
    if (existing) return err(new ValidationError('Ya existe un docente con ese DNI'));

    const teacher = Teacher.create({
      firstName: input.firstName,
      lastName: input.lastName,
      dni: dniResult.unwrap(),
      email: emailResult.unwrap(),
      phone: input.phone,
      title: input.title,
      institutionId: Id.create(input.institutionId),
      active: input.active ?? true,
    });

    await this.repo.save(teacher);
    return ok(teacher);
  }
}

@Injectable()
export class ListTeachersUseCase {
  constructor(private readonly repo: TeacherRepository) {}

  async execute(institutionId: string): Promise<Teacher[]> {
    return this.repo.findByInstitution(institutionId);
  }
}

@Injectable()
export class GetTeacherUseCase {
  constructor(private readonly repo: TeacherRepository) {}

  async execute(id: string): Promise<Teacher | null> {
    return this.repo.findById(id);
  }
}

@Injectable()
export class DeleteTeacherUseCase {
  constructor(private readonly repo: TeacherRepository) {}

  async execute(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}

@Injectable()
export class UpdateTeacherUseCase {
  constructor(private readonly repo: TeacherRepository) {}

  async execute(id: string, body: Record<string, unknown>): Promise<Teacher> {
    const teacher = await this.repo.findById(id);
    if (!teacher) throw new NotFoundError('Teacher', id);

    const emailVo = body.email !== undefined && body.email !== ''
      ? Email.reconstruct(body.email as string)
      : teacher.email;

    const dniVo = body.dni !== undefined
      ? Dni.reconstruct(body.dni as string)
      : teacher.dni;

    const updated = Teacher.reconstruct({
      id: teacher.id,
      firstName: body.firstName !== undefined ? (body.firstName as string) : teacher.firstName,
      lastName: body.lastName !== undefined ? (body.lastName as string) : teacher.lastName,
      dni: dniVo,
      email: emailVo,
      phone: body.phone !== undefined ? (body.phone as string | undefined) : teacher.phone,
      title: body.title !== undefined ? (body.title as string | undefined) : teacher.title,
      institutionId: teacher.institutionId,
      active: body.active !== undefined ? (body.active as boolean) : teacher.active,
      deletedAt: teacher.deletedAt,
    });

    await this.repo.save(updated);
    return updated;
  }
}
