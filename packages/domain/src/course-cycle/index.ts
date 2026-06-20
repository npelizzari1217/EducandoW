// Entities
export { CourseCycle } from './entities/course-cycle';
export type { CourseCycleProps, CreateCourseCycleInput, UpdateCourseCycleInput } from './entities/course-cycle';

export { AlumnosXCursoXCiclo } from './entities/alumnos-x-curso-x-ciclo';
export type { AlumnosXCursoXCicloProps, CreateAlumnosXCursoXCicloInput } from './entities/alumnos-x-curso-x-ciclo';

// Value Objects
export { CourseName } from './value-objects/course-name';
export { PassingGrade } from './value-objects/passing-grade';
export { BimonthPeriod } from './value-objects/bimonth-period';

// Services
export { GradingPeriodCalculator } from './services/grading-period-calculator';
export type { DateRange } from './services/grading-period-calculator';

// Repository ports
export type { CourseCycleRepository, CourseCycleFilters, PaginatedResult, CreateManyResult, EnrolledStudent } from './repositories/course-cycle-repository';
export type { AlumnosXCursoXCicloRepository, AlumnoCursoCicloEnriched, StudentMembershipEnriched } from './repositories/alumnos-x-curso-x-ciclo-repository';

// Errors
export {
  CourseCycleClosedError,
  CourseCycleAlreadyExistsError,
  CourseCycleNotFoundError,
  BimonthPeriodInvalidError,
  AcademicCycleClosedError,
} from './errors';
