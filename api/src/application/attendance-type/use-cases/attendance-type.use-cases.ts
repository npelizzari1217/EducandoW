import { Injectable } from '@nestjs/common';
import {
  ok, err, Result,
  AttendanceType,
  AttendanceTypeRepository,
  AttendanceTypeFilters,
  AttendanceTypeCodeDuplicateError,
  AttendanceTypeNotFoundError,
  AttendanceTypeLevelOutOfScopeError,
  SystemAttendanceTypeError,
  AttendanceBehavior,
  AttendanceBehaviorValue,
  resolveAccessScope,
} from '@educandow/domain';

/**
 * Subconjunto de `AuthenticatedUser` (api/infra) requerido por `resolveAccessScope`.
 * Application no importa el tipo de infra — solo lo que necesita del scope de nivel
 * (REQ-16/REQ-17/REQ-18, design.md Q1). Precedente: list-grupos-global.use-case.ts.
 */
export interface AttendanceTypeCurrentUser {
  roles: string[];
  levels?: number[];
}

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export interface CreateAttendanceTypeInput {
  code: string;
  description: string;
  absenceValue: number;
  level: number;
  behavior: AttendanceBehaviorValue;
  active?: boolean;
}

@Injectable()
export class CreateAttendanceTypeUseCase {
  constructor(private readonly repo: AttendanceTypeRepository) {}

  async execute(
    input: CreateAttendanceTypeInput,
    currentUser: AttendanceTypeCurrentUser,
  ): Promise<Result<AttendanceType, AttendanceTypeCodeDuplicateError>> {
    const scope = resolveAccessScope(currentUser);
    if (!scope.allLevels && !scope.baseLevels.includes(input.level)) {
      throw new AttendanceTypeLevelOutOfScopeError(input.level);
    }

    const duplicate = await this.repo.existsByLevelCode(input.level, input.code.toUpperCase().trim());
    if (duplicate) {
      return err(new AttendanceTypeCodeDuplicateError(input.level, input.code));
    }

    const entity = AttendanceType.create({
      code: input.code,
      description: input.description,
      absenceValue: input.absenceValue,
      level: input.level,
      behavior: input.behavior,
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
  behavior?: AttendanceBehaviorValue;
}

@Injectable()
export class UpdateAttendanceTypeUseCase {
  constructor(private readonly repo: AttendanceTypeRepository) {}

  async execute(
    id: string,
    input: UpdateAttendanceTypeInput,
    currentUser: AttendanceTypeCurrentUser,
  ): Promise<Result<AttendanceType, AttendanceTypeNotFoundError | SystemAttendanceTypeError>> {
    const entity = await this.repo.findById(id);
    if (!entity) {
      return err(new AttendanceTypeNotFoundError(id));
    }

    const scope = resolveAccessScope(currentUser);
    if (!scope.allLevels && !scope.baseLevels.includes(entity.level)) {
      throw new AttendanceTypeLevelOutOfScopeError(entity.level);
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
      behavior: input.behavior
        ? AttendanceBehavior.create(input.behavior).unwrap()
        : entity.behavior,
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
    currentUser: AttendanceTypeCurrentUser,
  ): Promise<Result<void, AttendanceTypeNotFoundError | SystemAttendanceTypeError>> {
    const entity = await this.repo.findById(id);
    if (!entity) {
      return err(new AttendanceTypeNotFoundError(id));
    }

    const scope = resolveAccessScope(currentUser);
    if (!scope.allLevels && !scope.baseLevels.includes(entity.level)) {
      throw new AttendanceTypeLevelOutOfScopeError(entity.level);
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

  async execute(
    filters: AttendanceTypeFilters | undefined,
    currentUser: AttendanceTypeCurrentUser,
  ): Promise<AttendanceType[]> {
    const scope = resolveAccessScope(currentUser);

    if (scope.allLevels) {
      return this.repo.list(filters);
    }

    if (filters?.level !== undefined && !scope.baseLevels.includes(filters.level)) {
      throw new AttendanceTypeLevelOutOfScopeError(filters.level);
    }

    return this.repo.list({ ...filters, allowedLevels: scope.baseLevels });
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
    currentUser: AttendanceTypeCurrentUser,
  ): Promise<Result<AttendanceType, AttendanceTypeNotFoundError>> {
    const entity = await this.repo.findById(id);
    if (!entity) {
      return err(new AttendanceTypeNotFoundError(id));
    }

    const scope = resolveAccessScope(currentUser);
    if (!scope.allLevels && !scope.baseLevels.includes(entity.level)) {
      throw new AttendanceTypeLevelOutOfScopeError(entity.level);
    }

    return ok(entity);
  }
}
