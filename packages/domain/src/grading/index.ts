// ── Grade Scales ────────────────────────────────────────────

// Value Objects
export { GradeInternalStatus } from './value-objects/grade-internal-status';
export type { GradeInternalStatusValue } from './value-objects/grade-internal-status';
export { GradeValueCode } from './value-objects/grade-value-code';

// Entities
export { GradeScale, GradeScaleValue } from './entities/grade-scale';
export type {
  CreateGradeScaleInput,
  ReconstructGradeScaleProps,
  CreateGradeScaleValueInput,
  ReconstructGradeScaleValueProps,
} from './entities/grade-scale';

// Errors (scales)
export {
  InvalidInternalStatusError,
  ScaleNameDuplicateError,
  ScaleNotFoundError,
  ScaleHasActiveValuesError,
  ValueCodeDuplicateError,
  ValueNotFoundError,
} from './errors/grade-scale.errors';

// Repositories
export type { GradeScaleRepository, GradeScaleFilters } from './repositories/grade-scale.repository';

// ── Grading Periods ─────────────────────────────────────────

// Value Objects
export { PeriodSortOrder } from './value-objects/period-sort-order';

// Entities
export { GradingPeriodTemplate, GradingPeriodTemplateItem } from './entities/grading-period-template';
export type {
  CreateGradingPeriodTemplateInput,
  ReconstructGradingPeriodTemplateProps,
  CreateGradingPeriodTemplateItemInput,
  ReconstructGradingPeriodTemplateItemProps,
} from './entities/grading-period-template';

export { GradingPeriodDate } from './entities/grading-period-date';
export type {
  CreateGradingPeriodDateInput,
  ReconstructGradingPeriodDateProps,
} from './entities/grading-period-date';

// Errors (periods)
export {
  PeriodTemplateNameDuplicateError,
  PeriodTemplateNotFoundError,
  PeriodSortOrderDuplicateError,
  PeriodTemplateItemNameDuplicateError,
  PeriodTemplateHasDatesError,
  PeriodDateOutOfCycleRangeError,
  PeriodDateOverlapError,
  PeriodDateInvalidRangeError,
  PeriodSortOrderInvalidError,
} from './errors/grading-period.errors';

// Repositories
export type {
  GradingPeriodRepository,
  GradingPeriodTemplateFilters,
} from './repositories/grading-period.repository';

// Ports (Fase 5)
export { ASSIGNMENT_AUTHORIZER } from './ports/assignment-authorizer.port';
export type { AssignmentAuthorizerPort } from './ports/assignment-authorizer.port';
