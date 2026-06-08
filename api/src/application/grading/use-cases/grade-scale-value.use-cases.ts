import { Injectable } from '@nestjs/common';
import {
  ok, err, Result,
  GradeScaleValue,
  GradeScaleRepository,
  ScaleNotFoundError,
  ValueCodeDuplicateError,
  ValueNotFoundError,
  InvalidInternalStatusError,
} from '@educandow/domain';

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export interface CreateGradeScaleValueInput {
  scaleId: string;
  code: string;
  label: string;
  internalStatus: string;
  sortOrder?: number;
}

@Injectable()
export class CreateGradeScaleValueUseCase {
  constructor(private readonly repo: GradeScaleRepository) {}

  async execute(
    input: CreateGradeScaleValueInput,
  ): Promise<Result<GradeScaleValue, ScaleNotFoundError | ValueCodeDuplicateError | InvalidInternalStatusError>> {
    const scale = await this.repo.findById(input.scaleId);
    if (!scale) {
      return err(new ScaleNotFoundError(input.scaleId));
    }

    const duplicate = await this.repo.existsValueCode(input.scaleId, input.code);
    if (duplicate) {
      return err(new ValueCodeDuplicateError(input.scaleId, input.code));
    }

    // GradeScaleValue.create validates code and internalStatus, throws on invalid
    let value: GradeScaleValue;
    try {
      value = GradeScaleValue.create({
        scaleId: input.scaleId,
        code: input.code,
        label: input.label,
        internalStatus: input.internalStatus,
        sortOrder: input.sortOrder ?? 0,
      });
    } catch (e) {
      return err(e as InvalidInternalStatusError);
    }

    await this.repo.saveValue(value);
    return ok(value);
  }
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export interface UpdateGradeScaleValueInput {
  label?: string;
  internalStatus?: string;
  sortOrder?: number;
  active?: boolean;
}

@Injectable()
export class UpdateGradeScaleValueUseCase {
  constructor(private readonly repo: GradeScaleRepository) {}

  async execute(
    id: string,
    input: UpdateGradeScaleValueInput,
  ): Promise<Result<GradeScaleValue, ValueNotFoundError | InvalidInternalStatusError>> {
    const entity = await this.repo.findValueById(id);
    if (!entity) {
      return err(new ValueNotFoundError(id));
    }

    let updated: GradeScaleValue;
    try {
      updated = GradeScaleValue.reconstruct({
        id: entity.id,
        scaleId: entity.scaleId,
        code: entity.code,
        label: input.label ?? entity.label,
        internalStatus: (input.internalStatus ?? entity.internalStatus) as import('@educandow/domain').GradeInternalStatusValue,
        sortOrder: input.sortOrder ?? entity.sortOrder,
        active: input.active ?? entity.active,
        deletedAt: entity.deletedAt,
      });
    } catch (e) {
      return err(e as InvalidInternalStatusError);
    }

    await this.repo.saveValue(updated);
    return ok(updated);
  }
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

@Injectable()
export class DeleteGradeScaleValueUseCase {
  constructor(private readonly repo: GradeScaleRepository) {}

  async execute(
    id: string,
  ): Promise<Result<void, ValueNotFoundError>> {
    const entity = await this.repo.findValueById(id);
    if (!entity) {
      return err(new ValueNotFoundError(id));
    }

    await this.repo.softDeleteValue(id);
    return ok(undefined);
  }
}
