import type { AlumnosXCursoXCiclo } from '../entities/alumnos-x-curso-x-ciclo';

/** Enriched projection: AlumnosXCursoXCiclo record with resolved studentId + displayName. */
export interface AlumnoCursoCicloEnriched {
  id: string;
  studentId: string;
  studentName: string;
}

/**
 * Port (interface) for AlumnosXCursoXCiclo persistence.
 * Implementations live in the infrastructure layer (prisma-tenant).
 * Tenant scoping is implicit via TenantContext.
 *
 * Tasks: T-05 (SDD-1)
 */
export interface AlumnosXCursoXCicloRepository {
  /** Returns all enrollment rows for the given courseCycle. */
  findByCourseCycle(courseCycleId: string): Promise<AlumnosXCursoXCiclo[]>;

  /**
   * Returns enrollments of a courseCycle enriched with studentId + studentName.
   * Resolution: AlumnosXCursoXCiclo.studentId → Student firstName + lastName.
   * Throws if no tenant client (surfaces the error instead of silently returning []).
   */
  findByCourseCycleEnriched(courseCycleId: string): Promise<AlumnoCursoCicloEnriched[]>;

  /** Returns a single enrollment row by its bridge-row id, or null if not found. */
  findById(id: string): Promise<AlumnosXCursoXCiclo | null>;

  /**
   * Add a student to a courseCycle. Idempotent (upsert on @@unique([courseCycleId, studentId])).
   * If the pair already exists, returns the existing record without error.
   */
  addStudent(courseCycleId: string, studentId: string): Promise<AlumnosXCursoXCiclo>;

  /** Check if a student is enrolled in a courseCycle. */
  isMember(courseCycleId: string, studentId: string): Promise<boolean>;

  /**
   * Remove a student from a courseCycle by bridge-row id.
   * `courseCycleId` is used as defensive scope to ensure the row belongs to the cycle.
   * Throws NotFoundError if the row does not exist or doesn't belong to the courseCycle.
   */
  remove(courseCycleId: string, id: string): Promise<void>;
}
