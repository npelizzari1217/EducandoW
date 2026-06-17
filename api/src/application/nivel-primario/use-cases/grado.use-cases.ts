import { Injectable } from '@nestjs/common';
import { Result, ok, err, ValidationError, Grado, GradoRepository } from '@educandow/domain';
import type { NotFoundError } from '@educandow/domain';

export interface CreateGradoInput {
  courseSectionId?: string;
  grade: number;
  division: string;
  academicYear: string;
}

export interface UpdateGradoInput {
  courseSectionId?: string;
  academicYear?: string;
}

@Injectable()
export class CreateGradoUseCase {
  constructor(private readonly repo: GradoRepository) {}

  async execute(input: CreateGradoInput): Promise<Result<Grado, ValidationError>> {
    const result = Grado.create(input);
    if (result.isErr()) return result;

    const grado = result.unwrap();
    await this.repo.save(grado);
    return ok(grado);
  }
}

@Injectable()
export class ListGradosUseCase {
  constructor(private readonly repo: GradoRepository) {}

  async execute(academicYear?: string): Promise<Grado[]> {
    return this.repo.findAll(academicYear);
  }
}

@Injectable()
export class GetGradoUseCase {
  constructor(private readonly repo: GradoRepository) {}

  async execute(id: string): Promise<Grado | null> {
    return this.repo.findById(id);
  }
}

@Injectable()
export class UpdateGradoUseCase {
  constructor(private readonly repo: GradoRepository) {}

  async execute(id: string, input: UpdateGradoInput): Promise<Result<Grado, ValidationError | NotFoundError>> {
    const grado = await this.repo.findById(id);
    if (!grado) {
      return err(new ValidationError(`Grado no encontrado: ${id}`));
    }

    grado.update(input);
    await this.repo.save(grado);
    return ok(grado);
  }
}

@Injectable()
export class DeleteGradoUseCase {
  constructor(private readonly repo: GradoRepository) {}

  async execute(id: string): Promise<void> {
    const grado = await this.repo.findById(id);
    if (!grado) return;
    grado.softDelete();
    await this.repo.save(grado);
  }
}
