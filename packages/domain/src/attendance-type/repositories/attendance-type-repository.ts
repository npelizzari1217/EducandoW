import type { AttendanceType } from '../entities/attendance-type';

export interface AttendanceTypeFilters {
  level?: number;
  active?: boolean;
  /**
   * Base pedagogical levels (1-4) the caller is scoped to, set by the use-case from
   * `AccessScope.baseLevels` when the caller is `!allLevels`. `undefined` = sin
   * restricción de nivel (ROOT/ADMIN). El repo aplica `WHERE level IN (allowedLevels)`.
   * Ver design.md Q4/ADR-07 — filtro en lenguaje de dominio del repo, sin filtrar en
   * memoria en application.
   */
  allowedLevels?: number[];
}

/**
 * Port: AttendanceTypeRepository
 *
 * Implemented by PrismaAttendanceTypeRepository in the infrastructure layer.
 * All methods operate on the tenant database of the current institution.
 */
export interface AttendanceTypeRepository {
  /** Find a single AttendanceType by its UUID. Returns null if not found. */
  findById(id: string): Promise<AttendanceType | null>;

  /**
   * Find a single AttendanceType by its composite key (level, code).
   * Returns null if not found.
   */
  findByLevelCode(level: number, code: string): Promise<AttendanceType | null>;

  /**
   * List all AttendanceTypes with optional filters.
   * Excludes soft-deleted records (deletedAt IS NOT NULL).
   */
  list(filters?: AttendanceTypeFilters): Promise<AttendanceType[]>;

  /** Persist a new or updated AttendanceType (upsert by id). */
  save(entity: AttendanceType): Promise<void>;

  /** Physically delete an AttendanceType by its UUID. */
  delete(id: string): Promise<void>;

  /**
   * Check whether a (level, code) combination already exists.
   * Optionally exclude a specific id (for update uniqueness checks).
   */
  existsByLevelCode(level: number, code: string, excludeId?: string): Promise<boolean>;

  /**
   * Resolves the Presente (attendance marker) AttendanceType for the level.
   * Filters by the system type with isPresent=true (isPresent && isSystem &&
   * active && deletedAt === null), unívoco by construction (only the seeded
   * "P" system type matches — see design.md ADR-2). Returns null if the level
   * has no Presente type configured (e.g. deactivated/soft-deleted). Does NOT
   * hardcode the "P" string — returns the entity, caller reads its real code.
   */
  findPresenteByLevel(level: number): Promise<AttendanceType | null>;
}
