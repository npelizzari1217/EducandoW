import type { AttendanceType } from '../entities/attendance-type';

export interface AttendanceTypeFilters {
  level?: number;
  active?: boolean;
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
}
