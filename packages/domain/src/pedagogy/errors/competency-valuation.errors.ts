import { DomainError } from '../../shared/errors/domain-error';

export class CompetencyValuationNotFoundError extends DomainError {
  constructor(uuid: string) {
    super(
      `CompetencyValuation with id "${uuid}" not found`,
      'COMPETENCY_VALUATION_NOT_FOUND',
    );
  }
}

export class GradeScaleNotConfiguredError extends DomainError {
  constructor(level: number, modality: number) {
    super(
      `No active GradeScale configured for level=${level}, modality=${modality}`,
      'SCALE_NOT_CONFIGURED',
    );
  }
}

export class PeriodItemNotInTemplateError extends DomainError {
  constructor(periodItemId: string, templateId: string) {
    super(
      `PeriodItem "${periodItemId}" does not belong to template "${templateId}"`,
      'PERIOD_ITEM_NOT_IN_TEMPLATE',
    );
  }
}

export class GradeScaleValueMismatchError extends DomainError {
  constructor(valueId: string, scaleId: string) {
    super(
      `GradeScaleValue "${valueId}" does not belong to scale "${scaleId}"`,
      'GRADE_SCALE_VALUE_MISMATCH',
    );
  }
}

export class PeriodLockedError extends DomainError {
  constructor(periodItemId: string) {
    super(
      `Period "${periodItemId}" is locked (modificable=false) and cannot be modified`,
      'PERIOD_LOCKED',
    );
  }
}
