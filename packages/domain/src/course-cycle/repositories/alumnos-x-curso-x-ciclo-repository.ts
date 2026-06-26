import type { AlumnosXCursoXCiclo } from '../entities/alumnos-x-curso-x-ciclo';

/** Enriched projection: AlumnosXCursoXCiclo record with resolved studentId + displayName + printable gate. */
export interface AlumnoCursoCicloEnriched {
  id: string;
  studentId: string;
  studentName: string;
  /** Whether this student's boletín is included in the next print batch (SDD-2). */
  printable: boolean;
  /** ISO 8601 string or null — pase de egreso global al alumno (pase-alumno-egreso). */
  fechaDePase: string | null;
}

/**
 * Student membership enriched with CourseCycle → CourseSection display fields.
 * Used by the web StudentLegajo "Cursos Ciclo" card (T39) and per-student
 * boletín dropdown in students.tsx (T36). Replaces GET /enrollments usage (SDD-2 R16/R17).
 */
export interface StudentMembershipEnriched {
  /** AlumnosXCursoXCiclo bridge-row id — used as alumnosXCursoXCicloId for boletín download. */
  id: string;
  courseCycleId: string;
  printable: boolean;
  /** CourseCycle.level as number. */
  level: number;
  /** CourseSection.academicYear string, e.g. "2026". */
  academicYear: string;
  /** CourseSection.grade, nullable. */
  grade: string | null;
  /** CourseSection.division, nullable. */
  division: string | null;
  /** ISO timestamp. */
  createdAt: string;
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

  /**
   * Toggle the printable flag for a single AlumnosXCursoXCiclo row (SDD-2).
   * Scoped to tenant via TenantContext. Returns the updated entity.
   */
  setPrintable(id: string, value: boolean): Promise<AlumnosXCursoXCiclo>;

  /**
   * Bulk-set printable for ALL rows of a CourseCycle (SDD-2).
   * Implements Todos (value=true) and Ninguno (value=false).
   * Scoped to tenant via TenantContext — does NOT affect other tenants or CourseCycles.
   */
  setPrintableBulk(courseCycleId: string, value: boolean): Promise<void>;

  /**
   * Returns all AlumnosXCursoXCiclo rows for a student, enriched with CourseCycle display info.
   * Used by GET /students/:studentId/memberships (SDD-2 R16/R17).
   * Replaces GET /enrollments?studentId usage in the web layer.
   */
  findByStudentEnriched(studentId: string): Promise<StudentMembershipEnriched[]>;
}
