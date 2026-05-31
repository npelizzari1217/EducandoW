import { Injectable } from '@nestjs/common';
import { Result, ok, err, ValidationError, CalificacionPrimario, CalificacionPrimarioRepository } from '@educandow/domain';

export interface CreateCalificacionInput {
  studentId: string;
  gradoId: string;
  subjectId: string;
  trimestre: string;
  nota: number;
  concepto: string;
  aprobado: boolean;
}

export interface UpdateCalificacionInput {
  nota?: number;
  concepto?: string;
  aprobado?: boolean;
}

@Injectable()
export class CreateCalificacionUseCase {
  constructor(private readonly repo: CalificacionPrimarioRepository) {}

  async execute(input: CreateCalificacionInput): Promise<Result<CalificacionPrimario, ValidationError>> {
    const result = CalificacionPrimario.create(input);
    if (result.isErr()) return result;

    const calificacion = result.unwrap();
    await this.repo.save(calificacion);
    return ok(calificacion);
  }
}

@Injectable()
export class ListCalificacionesUseCase {
  constructor(private readonly repo: CalificacionPrimarioRepository) {}

  async execute(gradoId?: string, studentId?: string): Promise<CalificacionPrimario[]> {
    return this.repo.findAll(gradoId, studentId);
  }
}

@Injectable()
export class GetCalificacionUseCase {
  constructor(private readonly repo: CalificacionPrimarioRepository) {}

  async execute(id: string): Promise<CalificacionPrimario | null> {
    return this.repo.findById(id);
  }
}

@Injectable()
export class UpdateCalificacionUseCase {
  constructor(private readonly repo: CalificacionPrimarioRepository) {}

  async execute(id: string, input: UpdateCalificacionInput): Promise<Result<CalificacionPrimario, ValidationError>> {
    const calificacion = await this.repo.findById(id);
    if (!calificacion) {
      return err(new ValidationError(`Calificación no encontrada: ${id}`));
    }

    const updateResult = calificacion.update(input);
    if (updateResult.isErr()) return err(updateResult.unwrapErr());

    await this.repo.save(calificacion);
    return ok(calificacion);
  }
}
