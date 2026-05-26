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

// Institution
export { Institution } from './institution/entities';
export type { InstitutionLevelEntry } from './institution/entities/institution';
export { Level, LevelType, LEVEL_CATALOG, LEVEL_LABELS, LEVEL_NAMES, HexColor, Cue, LogoUrl, EncryptedSmtpPass, SmtpConfig } from './institution/value-objects';
export type { LevelCatalogEntry } from './institution/value-objects';
export type { SmtpEncryption, SmtpConfigProps } from './institution/value-objects';
export type { InstitutionRepository } from './institution/repositories/institution-repository';

// Personnel
export { Student, Teacher } from './personnel/entities';
export { Dni } from './personnel/value-objects';
export type { StudentRepository } from './personnel/repositories/student-repository';
export type { TeacherRepository } from './personnel/repositories/teacher-repository';

// Enrollment
export { Enrollment } from './enrollment/entities';
export type { EnrollmentStatus } from './enrollment/entities';
export type { EnrollmentRepository } from './enrollment/repositories/enrollment-repository';

// Pedagogy
export { Subject, CourseSection, SubjectAssignment, Evaluacion, Nota, PeriodoEvaluacion, NotaTrimestral, Attendance, GradeScale, GradeScaleValue } from './pedagogy';
export type { SubjectProps, CourseSectionProps, SubjectAssignmentProps, EvaluacionProps, NotaProps, PeriodoEvaluacionProps, NotaTrimestralProps, AttendanceProps, AttendanceStatusCode, AttendanceStatusEntity, GradeScaleProps, GradeScaleValueProps } from './pedagogy';
export { AcademicCycle } from './pedagogy';
export type { AcademicCycleProps } from './pedagogy';
export { StudyPlan } from './pedagogy';
export type { StudyPlanProps } from './pedagogy';
export type { SubjectRepository, CourseSectionRepository, SubjectAssignmentRepository, EvaluacionRepository, NotaRepository, PeriodoEvaluacionRepository, NotaTrimestralRepository, AttendanceRepository, GradeScaleRepository } from './pedagogy';
export type { AcademicCycleRepository } from './pedagogy';
export type { StudyPlanRepository, StudyPlanCourseDto } from './pedagogy';

// Auth
export { User } from './auth/entities/user';
export type { UserRole, ModuleAccess } from './auth/entities/user';
export { Role } from './auth/entities/role';
export { Module } from './auth/entities/module';
export { ModuleAction } from './auth/entities/module-action';
export { Password } from './auth/value-objects/password';
export type { UserRepository } from './auth/repositories/user-repository';
export type { RefreshTokenRepository, RefreshTokenData } from './auth/repositories/refresh-token-repository';
export { UserRegistered } from './auth/events/user-registered';
export { UserNotFoundError, EmailAlreadyExistsError, InvalidCredentialsError } from './auth/errors/user.errors';
export { ROLE_HIERARCHY, ROLE_LABELS, getHighestRoleRank, canManageUser } from './auth/role-hierarchy';
