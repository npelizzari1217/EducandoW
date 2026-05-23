// Shared
export { Ok, Err, ok, err } from './shared/result';
export type { Result } from './shared/result';
export { DomainError } from './shared/errors/domain-error';
export { NotFoundError } from './shared/errors/not-found-error';
export { ValidationError } from './shared/errors/validation-error';
export { DomainEvent } from './shared/events/domain-event';
export type { EventBus, EventHandler } from './shared/event-bus';

// Shared Value Objects
export { Id } from './shared/value-objects/id';
export { Email } from './shared/value-objects/email';
export { EducationalLevel, EducationalLevelCode } from './shared/value-objects/educational-level';
export { EducationalModality, EducationalModalityCode } from './shared/value-objects/educational-modality';

// Institution
export { Institution } from './institution/entities';
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
export { Subject, CourseSection, SubjectAssignment, Grade, Attendance } from './pedagogy';
export type { SubjectProps, CourseSectionProps, SubjectAssignmentProps, GradeProps, GradeStatus, AttendanceProps, AttendanceStatus } from './pedagogy';
export type { SubjectRepository, CourseSectionRepository, SubjectAssignmentRepository, GradeRepository, AttendanceRepository } from './pedagogy';

// Auth
export { User } from './auth/entities/user';
export type { UserRole } from './auth/entities/user';
export { Password } from './auth/value-objects/password';
export type { UserRepository } from './auth/repositories/user-repository';
export type { RefreshTokenRepository, RefreshTokenData } from './auth/repositories/refresh-token-repository';
export { UserRegistered } from './auth/events/user-registered';
export { UserNotFoundError, EmailAlreadyExistsError, InvalidCredentialsError } from './auth/errors/user.errors';
