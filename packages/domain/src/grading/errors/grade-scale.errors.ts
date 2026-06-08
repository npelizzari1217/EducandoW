import { DomainError } from '../../shared/errors/domain-error';

export class InvalidInternalStatusError extends DomainError {
  constructor(raw: string) {
    super(
      `"${raw}" is not a valid GradeInternalStatus. Must be one of: APROBADO, NO_APROBADO, EN_PROCESO, LIBRE`,
      'INVALID_INTERNAL_STATUS',
    );
  }
}

export class ScaleNameDuplicateError extends DomainError {
  constructor(level: number, modality: number, name: string) {
    super(
      `A GradeScale named "${name}" already exists for level=${level}, modality=${modality}`,
      'SCALE_NAME_DUPLICATE',
    );
  }
}

export class ScaleNotFoundError extends DomainError {
  constructor(id: string) {
    super(`GradeScale with id "${id}" not found`, 'SCALE_NOT_FOUND');
  }
}

export class ScaleHasActiveValuesError extends DomainError {
  constructor(id: string) {
    super(
      `GradeScale "${id}" has active values and cannot be deleted`,
      'SCALE_HAS_ACTIVE_VALUES',
    );
  }
}

export class ValueCodeDuplicateError extends DomainError {
  constructor(scaleId: string, code: string) {
    super(
      `A GradeScaleValue with code "${code}" already exists in scale "${scaleId}"`,
      'VALUE_CODE_DUPLICATE',
    );
  }
}

export class ValueNotFoundError extends DomainError {
  constructor(id: string) {
    super(`GradeScaleValue with id "${id}" not found`, 'VALUE_NOT_FOUND');
  }
}
