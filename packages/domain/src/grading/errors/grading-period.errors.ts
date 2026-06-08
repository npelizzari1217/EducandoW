import { DomainError } from '../../shared/errors/domain-error';

export class PeriodTemplateNameDuplicateError extends DomainError {
  constructor(level: number, modality: number, name: string) {
    super(
      `A GradingPeriodTemplate named "${name}" already exists for level=${level}, modality=${modality}`,
      'PERIOD_TEMPLATE_NAME_DUPLICATE',
    );
  }
}

export class PeriodTemplateNotFoundError extends DomainError {
  constructor(id: string) {
    super(`GradingPeriodTemplate with id "${id}" not found`, 'PERIOD_TEMPLATE_NOT_FOUND');
  }
}

export class PeriodSortOrderDuplicateError extends DomainError {
  constructor(sortOrders: number[]) {
    super(
      `Items have duplicate sortOrder values: [${sortOrders.join(', ')}]. sortOrder must be unique within a template`,
      'PERIOD_SORT_ORDER_DUPLICATE',
    );
  }
}

export class PeriodTemplateItemNameDuplicateError extends DomainError {
  constructor(names: string[]) {
    super(
      `Items have duplicate names: [${names.join(', ')}]. Item names must be unique within a template`,
      'PERIOD_TEMPLATE_ITEM_NAME_DUPLICATE',
    );
  }
}

export class PeriodTemplateHasDatesError extends DomainError {
  constructor(id: string) {
    super(
      `GradingPeriodTemplate "${id}" has associated dates and cannot be deleted`,
      'PERIOD_TEMPLATE_HAS_DATES',
    );
  }
}

export class PeriodDateOutOfCycleRangeError extends DomainError {
  constructor(date: Date, cycleStart: Date, cycleEnd: Date) {
    super(
      `Date ${date.toISOString()} is outside the cycle range [${cycleStart.toISOString()}, ${cycleEnd.toISOString()}]`,
      'PERIOD_DATE_OUT_OF_CYCLE_RANGE',
    );
  }
}

export class PeriodDateOverlapError extends DomainError {
  constructor(itemId1: string, itemId2: string) {
    super(
      `Period date for item "${itemId1}" overlaps with existing period date for item "${itemId2}"`,
      'PERIOD_DATE_OVERLAP',
    );
  }
}

export class PeriodDateInvalidRangeError extends DomainError {
  constructor(startDate: Date, endDate: Date) {
    super(
      `startDate ${startDate.toISOString()} must be strictly before endDate ${endDate.toISOString()}`,
      'PERIOD_DATE_INVALID_RANGE',
    );
  }
}

export class PeriodSortOrderInvalidError extends DomainError {
  constructor(value: number) {
    super(
      `sortOrder must be an integer >= 1; got ${value}`,
      'PERIOD_SORT_ORDER_INVALID',
    );
  }
}
