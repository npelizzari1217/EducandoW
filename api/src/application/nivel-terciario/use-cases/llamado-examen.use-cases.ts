import { Injectable } from '@nestjs/common';
import {
  ok,
  err,
  Result,
  NotFoundError,
  LlamadoExamen,
  LlamadoOverlapError,
  InvalidLlamadoRangeError,
  LLAMADO_EXAMEN_REPOSITORY,
} from '@educandow/domain';
import type { LlamadoExamenRepository } from '@educandow/domain';

export interface CreateLlamadoExamenInput {
  nombre: string;
  anioAcademico: string;
  fechaInicio: Date;
  fechaFin: Date;
}

export interface UpdateLlamadoExamenInput {
  nombre?: string;
  fechaInicio?: Date;
  fechaFin?: Date;
}

async function assertNoOverlap(
  repo: LlamadoExamenRepository,
  anioAcademico: string,
  inicio: Date,
  fin: Date,
  excludeId?: string,
): Promise<Result<void, LlamadoOverlapError>> {
  const clashes = await repo.findOverlapping(anioAcademico, inicio, fin, excludeId);
  if (clashes.length > 0) return err(new LlamadoOverlapError(anioAcademico));
  return ok(undefined);
}

@Injectable()
export class CreateLlamadoExamenUC {
  constructor(private readonly repo: LlamadoExamenRepository) {}

  async execute(
    input: CreateLlamadoExamenInput,
  ): Promise<Result<LlamadoExamen, InvalidLlamadoRangeError | LlamadoOverlapError>> {
    const entityResult = LlamadoExamen.create(input);
    if (entityResult.isErr()) return err(entityResult.unwrapErr());
    const entity = entityResult.unwrap();

    const overlapResult = await assertNoOverlap(
      this.repo,
      input.anioAcademico,
      input.fechaInicio,
      input.fechaFin,
    );
    if (overlapResult.isErr()) return err(overlapResult.unwrapErr());

    await this.repo.save(entity);
    return ok(entity);
  }
}

@Injectable()
export class UpdateLlamadoExamenUC {
  constructor(private readonly repo: LlamadoExamenRepository) {}

  async execute(
    id: string,
    input: UpdateLlamadoExamenInput,
  ): Promise<Result<LlamadoExamen, NotFoundError | InvalidLlamadoRangeError | LlamadoOverlapError>> {
    const entity = await this.repo.findById(id);
    if (!entity || entity.deletedAt != null) {
      return err(new NotFoundError('LlamadoExamen', id));
    }

    const updateResult = entity.update(input);
    if (updateResult.isErr()) return err(updateResult.unwrapErr());

    const overlapResult = await assertNoOverlap(
      this.repo,
      entity.anioAcademico,
      entity.fechaInicio,
      entity.fechaFin,
      id,
    );
    if (overlapResult.isErr()) return err(overlapResult.unwrapErr());

    await this.repo.save(entity);
    return ok(entity);
  }
}

@Injectable()
export class ListLlamadosExamenUC {
  constructor(private readonly repo: LlamadoExamenRepository) {}

  async execute(anioAcademico: string): Promise<Result<LlamadoExamen[], never>> {
    const items = await this.repo.findByAnioAcademico(anioAcademico);
    return ok(items);
  }
}

@Injectable()
export class DeleteLlamadoExamenUC {
  constructor(private readonly repo: LlamadoExamenRepository) {}

  async execute(id: string): Promise<Result<void, NotFoundError>> {
    const entity = await this.repo.findById(id);
    if (!entity || entity.deletedAt != null) {
      return err(new NotFoundError('LlamadoExamen', id));
    }
    entity.softDelete();
    await this.repo.save(entity);
    return ok(undefined);
  }
}

export { LLAMADO_EXAMEN_REPOSITORY };
