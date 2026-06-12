// Shared
export { Ok, Err, ok, err } from './shared/result';
export type { Result } from './shared/result';
export { DomainError } from './shared/errors/domain-error';
export { NotFoundError } from './shared/errors/not-found-error';
export { ValidationError } from './shared/errors/validation-error';
export { ForbiddenError } from './shared/errors/forbidden-error';
export { DomainEvent } from './shared/events/domain-event';
export type { EventBus, EventHandler } from './shared/event-bus';

// Shared Value Objects
export { Id } from './shared/value-objects/id';
export { Email } from './shared/value-objects/email';
export { EducationalLevel, EducationalLevelCode } from './shared/value-objects/educational-level';
export { EducationalModality, EducationalModalityCode } from './shared/value-objects/educational-modality';
export { GradingPeriod } from './shared/value-objects/grading-period';
export type { PeriodType } from './shared/value-objects/grading-period';

// Institution
export { Institution } from './institution/entities';
export type { InstitutionLevelEntry } from './institution/entities/institution';
export { Level, LevelType, LEVEL_CATALOG, LEVEL_LABELS, LEVEL_NAMES, HexColor, Cue, LogoUrl, EncryptedSmtpPass, SmtpConfig } from './institution/value-objects';
export type { LevelCatalogEntry } from './institution/value-objects';
export type { SmtpEncryption, SmtpConfigProps } from './institution/value-objects';
export type { InstitutionRepository } from './institution/repositories/institution-repository';

// Personnel
export { Student, Teacher, StudentGuardian } from './personnel/entities';
export type { StudentGuardianProps, GuardianRelationship } from './personnel/entities';
export { Dni } from './personnel/value-objects';
export type { StudentRepository } from './personnel/repositories/student-repository';
export type { TeacherRepository } from './personnel/repositories/teacher-repository';
export type { StudentGuardianRepository } from './personnel/repositories/student-guardian-repository';

// Enrollment
export { Enrollment, EnrollmentStatus } from './enrollment/entities';
export type { EnrollmentStatusValue } from './enrollment/entities';
export type { EnrollmentRepository, FindByCourseParams } from './enrollment/repositories/enrollment-repository';

// Ingresante
export { Ingresante, IngresanteStatus, VALID_INGRESANTE_STATUSES } from './ingresante';
export type { IngresanteProps, IngresanteStatusValue, IngresanteRepository } from './ingresante';

// CourseCycle
export { CourseCycle, CourseName, PassingGrade, BimonthPeriod } from './course-cycle';
export type { CourseCycleProps, CreateCourseCycleInput, UpdateCourseCycleInput } from './course-cycle';
export type { CourseCycleRepository, CourseCycleFilters, PaginatedResult, CreateManyResult, EnrolledStudent } from './course-cycle';
export { GradingPeriodCalculator } from './course-cycle';
export type { DateRange } from './course-cycle';
export { CourseCycleClosedError, CourseCycleAlreadyExistsError, CourseCycleNotFoundError, BimonthPeriodInvalidError, AcademicCycleClosedError } from './course-cycle';

// Student Observation
export { StudentObservation, ObservationType, ObservationTypeValue } from './student-observation';
export type { StudentObservationProps, StudentObservationRepository } from './student-observation';

// Pedagogy
export { Subject, CourseSection, SubjectAssignment, Evaluacion, Nota, PeriodoEvaluacion, NotaTrimestral, Attendance, SubjectCompetency, CompetencyValuation, CompetencyPeriodValuation } from './pedagogy';
export type { SubjectProps, CourseSectionProps, SubjectAssignmentProps, EvaluacionProps, NotaProps, PeriodoEvaluacionProps, NotaTrimestralProps, AttendanceProps, AttendanceStatusCode, AttendanceStatusEntity, SubjectCompetencyProps, CompetencyValuationProps, CreateCompetencyPeriodValuationInput, ReconstructCompetencyPeriodValuationProps, AssignGradeInput } from './pedagogy';

// Pedagogy — Grading Primario (Fase 4, PR1)
export { SubjectGradingPeriod, SubjectPeriodGrade, PedagogicalFlags } from './pedagogy';
export type { SnapshotSubjectGradingPeriodInput, ReconstructSubjectGradingPeriodProps } from './pedagogy';
export type { CreateSubjectPeriodGradeInput, ReconstructSubjectPeriodGradeProps, AssignSubjectPeriodGradeInput, SetFlagsInput } from './pedagogy';
export type { PedagogicalFlagsInput } from './pedagogy';
export type { SubjectGradingPeriodRepository, SubjectPeriodGradeRepository } from './pedagogy';

// Pedagogy — Grading Primario (Fase 4, PR2)
export { SubjectFinalGrade, SubjectFinalGradeType, fromSubjectFinalGradeTypeString } from './pedagogy';
export type { CreateSubjectFinalGradeInput, ReconstructSubjectFinalGradeProps, AssignSubjectFinalGradeInput } from './pedagogy';
export type { SubjectFinalGradeRepository } from './pedagogy';

// Pedagogy — Grading Secundario (Fase 4, Etapa 2 — PR1)
export { SubjectFinalGradeCondicion, fromSubjectFinalGradeCondicionString } from './pedagogy';
export { AcademicCycle } from './pedagogy';
export type { AcademicCycleProps, CreateAcademicCycleInput, UpdateAcademicCycleInput } from './pedagogy';
export { CycleCode } from './pedagogy';
export { CycleCodeInvalidError, CycleCodeAlreadyExistsError, AcademicCycleNotFoundError } from './pedagogy';
export { StudyPlanHasDependenciesError } from './pedagogy';
export { StudyPlan } from './pedagogy';
export type { StudyPlanProps } from './pedagogy';
export type { SubjectRepository, CourseSectionRepository, SubjectAssignmentRepository, EvaluacionRepository, NotaRepository, PeriodoEvaluacionRepository, NotaTrimestralRepository, AttendanceRepository, SubjectCompetencyRepository, CompetencyValuationRepository, CompetencyPeriodValuationRepository, CompetencyValuationWithPeriods, CompetencyPeriodValuationData } from './pedagogy';
export { CompetencyValuationNotFoundError, GradeScaleNotConfiguredError, PeriodItemNotInTemplateError, GradeScaleValueMismatchError, PeriodLockedError } from './pedagogy';
export type { AcademicCycleRepository, AcademicCycleFilters } from './pedagogy';
export type { StudyPlanRepository, StudyPlanCourseDto } from './pedagogy';

// Nivel Inicial
export { Sala, InformeEvolutivo, Planificacion } from './inicial';
export type { SalaProps, CreateSalaProps, InformeEvolutivoProps, CreateInformeEvolutivoProps, AreaDesarrolloProps, PlanificacionProps, CreatePlanificacionProps, SecuenciaDidacticaProps } from './inicial';
export { AgeGroup, Turno, Periodo } from './inicial';
export type { AgeGroupValue, TurnoValue, PeriodoValue } from './inicial';
export type { SalaRepository, SalaFilters, InformeRepository, InformeFilters, PlanificacionRepository, PlanificacionFilters } from './inicial';

// Primario
export { Grado, CalificacionPrimario } from './primario';
export type { GradoProps, CreateGradoInput, CalificacionPrimarioProps, CreateCalificacionPrimarioInput } from './primario';
export { GradoNumero, Division, Trimestre } from './primario';
export type { GradoNumeroValue, DivisionValue, TrimestreValue } from './primario';
export type { GradoRepository, CalificacionPrimarioRepository } from './primario';

// Secundario
export { Curso, MesaExamen, RegimenAcademico, CalificacionSecundario } from './secundario';
export type { CursoProps, CreateCursoInput, MesaExamenProps, MesaExamenInscripcionProps, CreateMesaExamenInput, RegimenAcademicoProps, CreateRegimenAcademicoInput, CalificacionSecundarioProps, CreateCalificacionSecundarioInput } from './secundario';
export { Orientacion, TurnoExamen, CondicionAlumno } from './secundario';
export type { OrientacionCode, TurnoExamenCode, CondicionAlumnoCode } from './secundario';
export type { CursoRepository, MesaExamenRepository, RegimenAcademicoRepository, CalificacionSecundarioRepository, PendingExamDetail } from './secundario';

// Secundario — grading-secundario (Fase 4, Etapa 2 — PR2)
export { MateriaPrevia, MateriaPreviaStatus } from './secundario';
export type { CreateMateriaPreviaInput, ReconstructMateriaPreviaProps } from './secundario';
export { MATERIA_PREVIA_REPOSITORY } from './secundario';
export type { MateriaPreviaRepository } from './secundario';

// Terciario
export { Carrera, InscripcionMateria, ActaExamen, Titulo } from './terciario';
export type { CarreraProps, InscripcionMateriaProps, CorrelativaRequerida, ActaExamenProps, ActaExamenNota, TituloProps } from './terciario';
export { RegimenMateria, EstadoInscripcion, EstadoTitulo, CondicionExamen } from './terciario';
export type { RegimenMateriaValue, EstadoInscripcionValue, EstadoTituloValue, CondicionExamenValue } from './terciario';
export type { CarreraRepository, InscripcionRepository, ActaExamenRepository, TituloRepository } from './terciario';

// AttendanceType
export { AttendanceType } from './attendance-type/entities/attendance-type';
export type { CreateAttendanceTypeInput, ReconstructAttendanceTypeProps } from './attendance-type/entities/attendance-type';
export { AttendanceTypeCode } from './attendance-type/value-objects/attendance-type-code';
export { SystemAttendanceTypeError } from './attendance-type/errors/system-attendance-type-error';
export { AttendanceTypeCodeDuplicateError } from './attendance-type/errors/attendance-type-code-duplicate-error';
export { AttendanceTypeNotFoundError } from './attendance-type/errors/attendance-type-not-found-error';
export type { AttendanceTypeRepository, AttendanceTypeFilters } from './attendance-type/repositories/attendance-type-repository';

// Grading
export { GradeInternalStatus, GradeValueCode } from './grading';
export type { GradeInternalStatusValue } from './grading';
export { GradeScale, GradeScaleValue } from './grading';
export type {
  CreateGradeScaleInput,
  ReconstructGradeScaleProps,
  CreateGradeScaleValueInput,
  ReconstructGradeScaleValueProps,
} from './grading';
export {
  InvalidInternalStatusError,
  ScaleNameDuplicateError,
  ScaleNotFoundError,
  ScaleHasActiveValuesError,
  ValueCodeDuplicateError,
  ValueNotFoundError,
} from './grading';
export type { GradeScaleRepository, GradeScaleFilters } from './grading';
export { ASSIGNMENT_AUTHORIZER } from './grading';
export type { AssignmentAuthorizerPort } from './grading';

// Grading — Periods
export { PeriodSortOrder } from './grading';
export {
  GradingPeriodTemplate,
  GradingPeriodTemplateItem,
} from './grading';
export type {
  CreateGradingPeriodTemplateInput,
  ReconstructGradingPeriodTemplateProps,
  CreateGradingPeriodTemplateItemInput,
  ReconstructGradingPeriodTemplateItemProps,
} from './grading';
export { GradingPeriodDate } from './grading';
export type {
  CreateGradingPeriodDateInput,
  ReconstructGradingPeriodDateProps,
} from './grading';
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
} from './grading';
export type {
  GradingPeriodRepository,
  GradingPeriodTemplateFilters,
} from './grading';

// Docente x Ciclo (Fase 2)
export { DocenteXCiclo } from './docente-ciclo';
export type { DocenteXCicloProps, CreateDocenteXCicloInput } from './docente-ciclo';
export type { DocenteXCicloRepository } from './docente-ciclo';

// Materia / Grupo por Ciclo (Fase 3b)
export { MateriaXCursoXCiclo } from './materia-grupo-ciclo';
export type { MateriaXCursoXCicloProps, CreateMateriaXCursoXCicloInput } from './materia-grupo-ciclo';
export type { MateriaXCursoXCicloRepository } from './materia-grupo-ciclo';

export { AlumnosXMateriaXCursoXCiclo } from './materia-grupo-ciclo';
export type { AlumnosXMateriaXCursoXCicloProps, CreateAlumnosXMateriaXCursoXCicloInput } from './materia-grupo-ciclo';
export type { AlumnosXMateriaRepository } from './materia-grupo-ciclo';

export { GrupoXCursoXMateriaXCiclo } from './materia-grupo-ciclo';
export type { GrupoXCursoXMateriaXCicloProps, CreateGrupoXCursoXMateriaXCicloInput } from './materia-grupo-ciclo';
export type { GrupoRepository } from './materia-grupo-ciclo';

export { AlumnosXGrupoXCursoXMateriaXCiclo } from './materia-grupo-ciclo';
export type { AlumnosXGrupoXCursoXMateriaXCicloProps, CreateAlumnosXGrupoXCursoXMateriaXCicloInput } from './materia-grupo-ciclo';
export type { AlumnosXGrupoRepository } from './materia-grupo-ciclo';

// Asignacion Curso x Ciclo (Fase 4)
export { AsignacionCursoXCiclo, RolCurso, TurnoCurso } from './asignacion-curso-ciclo';
export type {
  AsignacionCursoXCicloProps,
  CreateAsignacionCursoXCicloInput,
} from './asignacion-curso-ciclo';
export type { AsignacionCursoXCicloRepository } from './asignacion-curso-ciclo';

// Auth
export { User } from './auth/entities/user';
export type { UserRole, ModuleAccess, UserLevelEntry } from './auth/entities/user';
export { Role } from './auth/entities/role';
export { Module } from './auth/entities/module';
export { ModuleAction } from './auth/entities/module-action';
export { Password } from './auth/value-objects/password';
export type { UserRepository } from './auth/repositories/user-repository';
export type { RefreshTokenRepository, RefreshTokenData } from './auth/repositories/refresh-token-repository';
export { UserRegistered } from './auth/events/user-registered';
export { UserNotFoundError, EmailAlreadyExistsError, InvalidCredentialsError } from './auth/errors/user.errors';
export { ROLE_HIERARCHY, ROLE_LABELS, getHighestRoleRank, canManageUser, canViewUser } from './auth/role-hierarchy';
export { resolveAccessScope } from './auth/access-scope';
export type { AccessScope } from './auth/access-scope';

// ── Asistencia (Fase 6) ─────────────────────────────────────────────────────
export { AusenciaXGrupo } from './asistencia';
export type { AusenciaXGrupoProps, CreateAusenciaXGrupoInput } from './asistencia';
export { AsistenciaDiaria } from './asistencia';
export type { AsistenciaDiariaProps, CreateAsistenciaDiariaInput } from './asistencia';
export type { SubjectAbsenceRepository } from './asistencia';
export type { DailyAttendanceRepository } from './asistencia';
