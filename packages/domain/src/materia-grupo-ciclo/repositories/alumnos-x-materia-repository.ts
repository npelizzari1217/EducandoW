import type { MateriasXAlumnoXCursoXCiclo } from '../entities/alumnos-x-materia-x-curso-x-ciclo';

/** Enriched projection: AlumnosXMateria record with resolved studentId + displayName. */
export interface AlumnoMateriaEnriched {
  id: string;
  studentId: string;
  studentName: string;
}

/**
 * Port (interface) for MateriasXAlumnoXCursoXCiclo persistence.
 * Implementations live in the infrastructure layer (prisma-tenant).
 * Tenant scoping is implicit via TenantContext.
 *
 * Tasks: F3-D2
 */
export interface AlumnosXMateriaRepository {
  findByMateria(materiaXCursoXCicloId: string): Promise<MateriasXAlumnoXCursoXCiclo[]>;
  findById(id: string): Promise<MateriasXAlumnoXCursoXCiclo | null>;
  /** Add a student to the subject universe. Idempotent (skipDuplicates). */
  addStudent(materiaXCursoXCicloId: string, studentId: string): Promise<MateriasXAlumnoXCursoXCiclo>;
  /** Check if a student is in the universe of a subject. */
  isMember(materiaXCursoXCicloId: string, studentId: string): Promise<boolean>;
  /** Bulk-upsert for backfill (skipDuplicates). */
  /**
   * Bulk-upsert for cascade (skipDuplicates).
   * Returns `{ count }` = rows actually inserted; callers that don't need the count
   * can safely ignore the return value.
   */
  upsertMany(data: Array<{ materiaXCursoXCicloId: string; studentId: string }>): Promise<{ count: number }>;
  /**
   * Returns alumnos of a materia enriched with studentId + studentName.
   * Resolution: AlumnosXMateria.studentId → Student name.
   * Throws if no tenant client (surfaces the error instead of silently returning []).
   */
  findByMateriaEnriched(materiaXCursoXCicloId: string): Promise<AlumnoMateriaEnriched[]>;
  /**
   * Remove a student from the subject universe by bridge-row id. Idempotent (deleteMany).
   * MGC-R9, D4.
   */
  removeStudent(id: string): Promise<void>;
}
