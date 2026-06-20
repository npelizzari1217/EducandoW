export { Subject } from './entities/subject';
export type { SubjectProps } from './entities/subject';
export { CourseSection } from './entities/course-section';
export type { CourseSectionProps } from './entities/course-section';
// GradeScale and GradeScaleValue moved to grading/ module — grading-foundations
export { AcademicCycle } from './entities/academic-cycle';
export type { AcademicCycleProps, CreateAcademicCycleInput, UpdateAcademicCycleInput } from './entities/academic-cycle';
export { StudyPlan } from './entities/study-plan';
export type { StudyPlanProps } from './entities/study-plan';
export { SubjectCompetency } from './entities/subject-competency';
export type { SubjectCompetencyProps } from './entities/subject-competency';
export { CompetenciaXMateriaXAlumnoXCursoXCiclo } from './entities/competency-valuation';
export type { CompetenciaXMateriaXAlumnoXCursoXCicloProps } from './entities/competency-valuation';
export { CompetenciaXPeriodoXMateriaXAlumnoXCursoXCiclo } from './entities/competency-period-valuation';
export type {
  CreateCompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloInput,
  ReconstructCompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloProps,
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
export { SubjectFinalGradeCondicion, fromSubjectFinalGradeCondicionString } from './value-objects/subject-final-grade-condicion';

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
// GradeScaleRepository moved to grading/ module — grading-foundations
export type { AcademicCycleRepository, AcademicCycleFilters, PaginatedResult } from './repositories/academic-cycle-repository';
export type { StudyPlanRepository, StudyPlanCourseDto } from './repositories/study-plan-repository';
export type { SubjectCompetencyRepository } from './repositories/subject-competency-repository';
export type {
  CompetenciaXMateriaXAlumnoXCursoXCicloRepository,
  CompetenciaXMateriaXAlumnoXCursoXCicloConPeriodos,
  CompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloData,
} from './repositories/competency-valuation-repository';
export type { CompetenciaXPeriodoXMateriaXAlumnoXCursoXCicloRepository } from './repositories/competency-period-valuation-repository';

// Competency valuation errors
export {
  CompetenciaXMateriaXAlumnoXCursoXCicloNotFoundError,
  GradeScaleNotConfiguredError,
  PeriodItemNotInTemplateError,
  GradeScaleValueMismatchError,
  PeriodLockedError,
} from './errors/competency-valuation.errors';
