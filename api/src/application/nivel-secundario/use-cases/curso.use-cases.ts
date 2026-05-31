import { Injectable } from '@nestjs/common';
import {
  Curso,
  CursoRepository,
  Orientacion,
  Result,
  ok,
  err,
  ValidationError,
  NotFoundError,
} from '@educandow/domain';

export interface CreateCursoInput {
  courseSectionId?: string;
  year: number;
  division: string;
  orientacion?: string;
  academicYear: string;
}

export interface UpdateCursoInput {
  year?: number;
  division?: string;
  orientacion?: string;
  academicYear?: string;
  courseSectionId?: string;
}

@Injectable()
export class CreateCursoUseCase {
  constructor(private readonly repo: CursoRepository) {}

  async execute(input: CreateCursoInput): Promise<Result<Curso, ValidationError>> {
    if (input.year < 1 || input.year > 6) {
      return err(new ValidationError('El año del curso debe estar entre 1 y 6'));
    }

    const orientacion = input.orientacion
      ? Orientacion.create(input.orientacion)
      : undefined;

    if (input.orientacion && !orientacion) {
      return err(new ValidationError(`Orientación inválida: ${input.orientacion}. Valores permitidos: NATURALES, SOCIALES, ECONOMIA, ARTE`));
    }

    const curso = Curso.create({
      courseSectionId: input.courseSectionId,
      year: input.year,
      division: input.division,
      orientacion: orientacion ?? undefined,
      academicYear: input.academicYear,
    });

    await this.repo.save(curso);
    return ok(curso);
  }
}

@Injectable()
export class ListCursosUseCase {
  constructor(private readonly repo: CursoRepository) {}

  async execute(academicYear?: string): Promise<Curso[]> {
    return this.repo.findAll(academicYear);
  }
}

@Injectable()
export class GetCursoUseCase {
  constructor(private readonly repo: CursoRepository) {}

  async execute(id: string): Promise<Result<Curso, NotFoundError>> {
    const curso = await this.repo.findById(id);
    if (!curso) return err(new NotFoundError('Curso', id));
    return ok(curso);
  }
}

@Injectable()
export class UpdateCursoUseCase {
  constructor(private readonly repo: CursoRepository) {}

  async execute(id: string, input: UpdateCursoInput): Promise<Result<Curso, ValidationError | NotFoundError>> {
    const curso = await this.repo.findById(id);
    if (!curso) return err(new NotFoundError('Curso', id));

    if (input.year !== undefined && (input.year < 1 || input.year > 6)) {
      return err(new ValidationError('El año del curso debe estar entre 1 y 6'));
    }

    const orientacion = input.orientacion
      ? Orientacion.create(input.orientacion)
      : undefined;

    if (input.orientacion && !orientacion) {
      return err(new ValidationError(`Orientación inválida: ${input.orientacion}`));
    }

    curso.update({
      year: input.year,
      division: input.division,
      orientacion: orientacion ?? undefined,
      academicYear: input.academicYear,
      courseSectionId: input.courseSectionId,
    });

    await this.repo.save(curso);
    return ok(curso);
  }
}

@Injectable()
export class DeleteCursoUseCase {
  constructor(private readonly repo: CursoRepository) {}

  async execute(id: string): Promise<Result<void, NotFoundError>> {
    const curso = await this.repo.findById(id);
    if (!curso) return err(new NotFoundError('Curso', id));
    await this.repo.delete(id);
    return ok(undefined);
  }
}
