import { Injectable } from '@nestjs/common';
import {
  ok, err, Result,
  AttendanceType,
  AttendanceTypeRepository,
  AttendanceTypeFilters,
  AttendanceTypeCodeDuplicateError,
  AttendanceTypeNotFoundError,
  SystemAttendanceTypeError,
} from '@educandow/domain';

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export interface CreateAttendanceTypeInput {
  code: string;
  description: string;
  absenceValue: number;
  level: number;
  assignable: boolean;
  active?: boolean;
}

@Injectable()
export class CreateAttendanceTypeUseCase {
  constructor(private readonly repo: AttendanceTypeRepository) {}

  async execute(
    input: CreateAttendanceTypeInput,
  ): Promise<Result<AttendanceType, AttendanceTypeCodeDuplicateError>> {
    const duplicate = await this.repo.existsByLevelCode(input.level, input.code.toUpperCase().trim());
    if (duplicate) {
      return err(new AttendanceTypeCodeDuplicateError(input.level, input.code));
    }

    const entity = AttendanceType.create({
      code: input.code,
      description: input.description,
      absenceValue: input.absenceValue,
      level: input.level,
      assignable: input.assignable,
      active: input.active ?? true,
      isSystem: false,
    });

    await this.repo.save(entity);
    return ok(entity);
  }
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export interface UpdateAttendanceTypeInput {
  description?: string;
  absenceValue?: number;
  active?: boolean;
  assignable?: boolean;
}

@Injectable()
export class UpdateAttendanceTypeUseCase {
  constructor(private readonly repo: AttendanceTypeRepository) {}

  async execute(
    id: string,
    input: UpdateAttendanceTypeInput,
  ): Promise<Result<AttendanceType, AttendanceTypeNotFoundError | SystemAttendanceTypeError>> {
    const entity = await this.repo.findById(id);
    if (!entity) {
      return err(new AttendanceTypeNotFoundError(id));
    }

    try {
      entity.assertMutable();
    } catch (e) {
      return err(e as SystemAttendanceTypeError);
    }

    // Reconstruct with updated fields (code and level are invariants — not editable)
    const updated = AttendanceType.reconstruct({
      id: entity.id,
      code: entity.code,
      description: input.description ?? entity.description,
      absenceValue: input.absenceValue ?? entity.absenceValue,
      level: entity.level,
      assignable: input.assignable ?? entity.assignable,
      isSystem: entity.isSystem,
      active: input.active ?? entity.active,
      deletedAt: entity.deletedAt,
    });

    await this.repo.save(updated);
    return ok(updated);
  }
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

@Injectable()
export class DeleteAttendanceTypeUseCase {
  constructor(private readonly repo: AttendanceTypeRepository) {}

  async execute(
    id: string,
  ): Promise<Result<void, AttendanceTypeNotFoundError | SystemAttendanceTypeError>> {
    const entity = await this.repo.findById(id);
    if (!entity) {
      return err(new AttendanceTypeNotFoundError(id));
    }

    try {
      entity.assertMutable();
    } catch (e) {
      return err(e as SystemAttendanceTypeError);
    }

    await this.repo.delete(id);
    return ok(undefined);
  }
}

// ─────────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────────

@Injectable()
export class ListAttendanceTypesUseCase {
  constructor(private readonly repo: AttendanceTypeRepository) {}

  async execute(filters?: AttendanceTypeFilters): Promise<AttendanceType[]> {
    return this.repo.list(filters);
  }
}

// ─────────────────────────────────────────────────────────────
// Get
// ─────────────────────────────────────────────────────────────

@Injectable()
export class GetAttendanceTypeUseCase {
  constructor(private readonly repo: AttendanceTypeRepository) {}

  async execute(
    id: string,
  ): Promise<Result<AttendanceType, AttendanceTypeNotFoundError>> {
    const entity = await this.repo.findById(id);
    if (!entity) {
      return err(new AttendanceTypeNotFoundError(id));
    }
    return ok(entity);
  }
}
