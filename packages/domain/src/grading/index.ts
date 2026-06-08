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

// Errors
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
