import { DomainError } from '../../shared/errors/domain-error';

/** Reporting NOT_FOUND / invariant errors — specific codes preserved (RER-R1). */

export class AxccNotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 'AXCC_NOT_FOUND');
  }
}

export class ReporteStudentNotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 'STUDENT_NOT_FOUND');
  }
}

export class ReporteCourseCycleNotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 'COURSE_CYCLE_NOT_FOUND');
  }
}

export class MateriaXCursoXCicloNotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 'MATERIA_X_CURSO_X_CICLO_NOT_FOUND');
  }
}

export class StudentNotPrintableError extends DomainError {
  constructor(message: string) {
    super(message, 'STUDENT_NOT_PRINTABLE');
  }
}

export class StudentNotEligibleError extends DomainError {
  constructor(message: string) {
    super(message, 'STUDENT_NOT_ELIGIBLE');
  }
}

export class BoletinLevelUnknownError extends DomainError {
  constructor(message: string) {
    super(message, 'BOLETIN_LEVEL_UNKNOWN');
  }
}

export class BatchAllFailedError extends DomainError {
  constructor(message: string) {
    super(message, 'BATCH_ALL_FAILED');
  }
}
