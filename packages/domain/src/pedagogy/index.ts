export { Subject } from './entities/subject';
export type { SubjectProps } from './entities/subject';
export { CourseSection } from './entities/course-section';
export type { CourseSectionProps } from './entities/course-section';
export { SubjectAssignment } from './entities/subject-assignment';
export type { SubjectAssignmentProps } from './entities/subject-assignment';
export { Evaluacion } from './entities/evaluacion';
export type { EvaluacionProps } from './entities/evaluacion';
export { Nota } from './entities/nota';
export type { NotaProps } from './entities/nota';
export { PeriodoEvaluacion } from './entities/periodo-evaluacion';
export type { PeriodoEvaluacionProps } from './entities/periodo-evaluacion';
export { NotaTrimestral } from './entities/nota-trimestral';
export type { NotaTrimestralProps } from './entities/nota-trimestral';
export { Attendance } from './entities/attendance';
export type { AttendanceProps, AttendanceStatusCode, AttendanceStatusEntity } from './entities/attendance';
// GradeScale and GradeScaleValue moved to grading/ module — grading-foundations
export { AcademicCycle } from './entities/academic-cycle';
export type { AcademicCycleProps, CreateAcademicCycleInput, UpdateAcademicCycleInput } from './entities/academic-cycle';
export { StudyPlan } from './entities/study-plan';
export type { StudyPlanProps } from './entities/study-plan';
export { SubjectCompetency } from './entities/subject-competency';
export type { SubjectCompetencyProps } from './entities/subject-competency';
export { CompetencyValuation } from './entities/competency-valuation';
export type { CompetencyValuationProps } from './entities/competency-valuation';
export { CompetencyPeriodValuation } from './entities/competency-period-valuation';
export type {
  CreateCompetencyPeriodValuationInput,
  ReconstructCompetencyPeriodValuationProps,
  AssignGradeInput,
} from './entities/competency-period-valuation';

// ── Grading Primario (Fase 4, PR2) ─────────────────────────────────────────────
export { SubjectFinalGrade } from './entities/subject-final-grade';
export type {
  CreateSubjectFinalGradeInput,
  ReconstructSubjectFinalGradeProps,
  AssignSubjectFinalGradeInput,
} from './entities/subject-final-grade';

export { SubjectFinalGradeType, fromSubjectFinalGradeTypeString } from './value-objects/subject-final-grade-type';

export type { SubjectFinalGradeRepository } from './repositories/subject-final-grade-repository';

// ── Grading Primario (Fase 4, PR1) ─────────────────────────────────────────────
export { SubjectGradingPeriod } from './entities/subject-grading-period';
export type {
  SnapshotSubjectGradingPeriodInput,
  ReconstructSubjectGradingPeriodProps,
} from './entities/subject-grading-period';

export { SubjectPeriodGrade } from './entities/subject-period-grade';
export type {
  CreateSubjectPeriodGradeInput,
  ReconstructSubjectPeriodGradeProps,
  AssignSubjectPeriodGradeInput,
  SetFlagsInput,
} from './entities/subject-period-grade';

export { PedagogicalFlags } from './value-objects/pedagogical-flags';
export type { PedagogicalFlagsInput } from './value-objects/pedagogical-flags';

export type { SubjectGradingPeriodRepository } from './repositories/subject-grading-period-repository';
export type { SubjectPeriodGradeRepository } from './repositories/subject-period-grade-repository';

// Value Objects
export { CycleCode } from './value-objects/cycle-code';

// Errors
export { CycleCodeInvalidError, CycleCodeAlreadyExistsError, AcademicCycleNotFoundError } from './errors/academic-cycle.errors';
export { StudyPlanHasDependenciesError } from './errors/study-plan.errors';

export type { SubjectRepository } from './repositories/subject-repository';
export type { CourseSectionRepository } from './repositories/course-section-repository';
export type { SubjectAssignmentRepository } from './repositories/subject-assignment-repository';
export type { EvaluacionRepository } from './repositories/evaluacion-repository';
export type { NotaRepository } from './repositories/nota-repository';
export type { PeriodoEvaluacionRepository } from './repositories/periodo-evaluacion-repository';
export type { NotaTrimestralRepository } from './repositories/nota-trimestral-repository';
export type { AttendanceRepository } from './repositories/attendance-repository';
// GradeScaleRepository moved to grading/ module — grading-foundations
export type { AcademicCycleRepository, AcademicCycleFilters, PaginatedResult } from './repositories/academic-cycle-repository';
export type { StudyPlanRepository, StudyPlanCourseDto } from './repositories/study-plan-repository';
export type { SubjectCompetencyRepository } from './repositories/subject-competency-repository';
export type {
  CompetencyValuationRepository,
  CompetencyValuationWithPeriods,
  CompetencyPeriodValuationData,
} from './repositories/competency-valuation-repository';
export type { CompetencyPeriodValuationRepository } from './repositories/competency-period-valuation-repository';

// Competency valuation errors
export {
  CompetencyValuationNotFoundError,
  GradeScaleNotConfiguredError,
  PeriodItemNotInTemplateError,
  GradeScaleValueMismatchError,
  PeriodLockedError,
} from './errors/competency-valuation.errors';
