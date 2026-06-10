import type { MateriaPrevia } from '../entities/materia-previa';

/**
 * DI token for the MateriaPreviaRepository port.
 * Injected via Symbol to avoid circular deps and keep domain free of decorators.
 */
export const MATERIA_PREVIA_REPOSITORY = Symbol('MATERIA_PREVIA_REPOSITORY');

/**
 * Port (interface) for the MateriaPrevia repository.
 *
 * All methods are tenant-scoped — the Prisma implementation joins through
 * Student to enforce institutionId from TenantContext (no explicit institutionId
 * param here — mirrors the convention used by other secundario/pedagogy repos).
 *
 * Returns domain entities/projections, never ORM rows.
 */
export interface MateriaPreviaRepository {
  /**
   * Finds all materias previas for a given student across all academic years.
   * Returns an empty array (never throws) when no records exist.
   */
  findByStudent(studentId: string): Promise<MateriaPrevia[]>;

  /**
   * Finds all materias previas for a given student filtered by a specific
   * origin academic year. Used by boletín generation (D2) to load previas
   * once per enrollment — NOT once per materia (N+1 guard).
   * Returns an empty array (never throws) when no records exist.
   */
  findByStudentAndAcademicYear(
    studentId: string,
    academicYear: string,
  ): Promise<MateriaPrevia[]>;

  /**
   * Upserts a batch of MateriaPrevia records.
   * The unique key is (studentId, subjectId, originAcademicYear) — the Prisma
   * implementation uses an ON CONFLICT DO UPDATE on that constraint.
   */
  saveMany(items: MateriaPrevia[]): Promise<void>;
}
