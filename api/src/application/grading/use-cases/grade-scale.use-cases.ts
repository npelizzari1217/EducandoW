import { Injectable } from '@nestjs/common';
import {
  ok, err, Result,
  GradeScale,
  GradeScaleRepository,
  GradeScaleFilters,
  ScaleNameDuplicateError,
  ScaleNotFoundError,
  ScaleHasActiveValuesError,
} from '@educandow/domain';

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export interface CreateGradeScaleInput {
  name: string;
  level: number;
  modality: number;
}

@Injectable()
export class CreateGradeScaleUseCase {
  constructor(private readonly repo: GradeScaleRepository) {}

  async execute(
    input: CreateGradeScaleInput,
  ): Promise<Result<GradeScale, ScaleNameDuplicateError>> {
    const duplicate = await this.repo.existsByName(input.level, input.modality, input.name);
    if (duplicate) {
      return err(new ScaleNameDuplicateError(input.level, input.modality, input.name));
    }

    const entity = GradeScale.create({
      name: input.name,
      level: input.level,
      modality: input.modality,
    });

    await this.repo.save(entity);
    return ok(entity);
  }
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export interface UpdateGradeScaleInput {
  name?: string;
  active?: boolean;
}

@Injectable()
export class UpdateGradeScaleUseCase {
  constructor(private readonly repo: GradeScaleRepository) {}

  async execute(
    id: string,
    input: UpdateGradeScaleInput,
  ): Promise<Result<GradeScale, ScaleNotFoundError | ScaleNameDuplicateError>> {
    const entity = await this.repo.findById(id);
    if (!entity) {
      return err(new ScaleNotFoundError(id));
    }

    const newName = input.name ?? entity.name;

    if (input.name && input.name !== entity.name) {
      const duplicate = await this.repo.existsByName(entity.level, entity.modality, input.name, id);
      if (duplicate) {
        return err(new ScaleNameDuplicateError(entity.level, entity.modality, input.name));
      }
    }

    const updated = GradeScale.reconstruct({
      id: entity.id,
      name: newName,
      level: entity.level,
      modality: entity.modality,
      active: input.active ?? entity.active,
      deletedAt: entity.deletedAt,
      values: entity.values,
    });

    await this.repo.save(updated);
    return ok(updated);
  }
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

@Injectable()
export class DeleteGradeScaleUseCase {
  constructor(private readonly repo: GradeScaleRepository) {}

  async execute(
    id: string,
  ): Promise<Result<void, ScaleNotFoundError | ScaleHasActiveValuesError>> {
    const entity = await this.repo.findById(id);
    if (!entity) {
      return err(new ScaleNotFoundError(id));
    }

    const activeCount = await this.repo.countActiveValues(id);
    if (activeCount > 0) {
      return err(new ScaleHasActiveValuesError(id));
    }

    await this.repo.softDelete(id);
    return ok(undefined);
  }
}

// ─────────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────────

@Injectable()
export class ListGradeScalesUseCase {
  constructor(private readonly repo: GradeScaleRepository) {}

  async execute(filters?: GradeScaleFilters): Promise<GradeScale[]> {
    return this.repo.list(filters);
  }
}

// ─────────────────────────────────────────────────────────────
// Get
// ─────────────────────────────────────────────────────────────

@Injectable()
export class GetGradeScaleUseCase {
  constructor(private readonly repo: GradeScaleRepository) {}

  async execute(
    id: string,
  ): Promise<Result<GradeScale, ScaleNotFoundError>> {
    const entity = await this.repo.findById(id);
    if (!entity) {
      return err(new ScaleNotFoundError(id));
    }
    return ok(entity);
  }
}
