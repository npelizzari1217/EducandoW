import type { AlumnosXMateriaXCursoXCiclo } from '../entities/alumnos-x-materia-x-curso-x-ciclo';

/**
 * Port (interface) for AlumnosXMateriaXCursoXCiclo persistence.
 * Implementations live in the infrastructure layer (prisma-tenant).
 * Tenant scoping is implicit via TenantContext.
 *
 * Tasks: F3-D2
 */
export interface AlumnosXMateriaRepository {
  findByMateria(materiaXCursoXCicloId: string): Promise<AlumnosXMateriaXCursoXCiclo[]>;
  findById(id: string): Promise<AlumnosXMateriaXCursoXCiclo | null>;
  /** Add a student to the subject universe. Idempotent (skipDuplicates). */
  addStudent(materiaXCursoXCicloId: string, studentId: string): Promise<AlumnosXMateriaXCursoXCiclo>;
  /** Check if a student is in the universe of a subject. */
  isMember(materiaXCursoXCicloId: string, studentId: string): Promise<boolean>;
  /** Bulk-upsert for backfill (skipDuplicates). */
  upsertMany(data: Array<{ materiaXCursoXCicloId: string; studentId: string }>): Promise<void>;
}
