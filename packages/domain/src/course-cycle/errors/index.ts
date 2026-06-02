import { DomainError } from '../../shared/errors/domain-error';
import { NotFoundError } from '../../shared/errors/not-found-error';
import { ValidationError } from '../../shared/errors/validation-error';

export class CourseCycleClosedError extends DomainError {
  constructor(id: string) {
    super(`CourseCycle ${id} is closed and cannot be modified`, 'COURSE_CYCLE_CLOSED');
  }
}

export class CourseCycleAlreadyExistsError extends DomainError {
  constructor(courseId: string, cycleId: string) {
    super(`CourseCycle already exists for course ${courseId} and cycle ${cycleId}`, 'COURSE_CYCLE_ALREADY_EXISTS');
  }
}

export class CourseCycleNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('CourseCycle', id);
  }
}

export class BimonthPeriodInvalidError extends ValidationError {
  constructor(bimonth: string) {
    super(`Invalid ${bimonth} bimonth period: end date must be after start date`);
  }
}

export class AcademicCycleClosedError extends DomainError {
  constructor(id: string) {
    super(`AcademicCycle ${id} is closed and cannot have courses generated`, 'ACADEMIC_CYCLE_CLOSED');
  }
}
