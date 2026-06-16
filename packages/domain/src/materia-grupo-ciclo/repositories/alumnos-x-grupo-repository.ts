import type { AlumnosXGrupoXCursoXMateriaXCiclo } from '../entities/alumnos-x-grupo-x-curso-x-materia-x-ciclo';

/** Enriched projection: AlumnosXGrupo record with resolved studentId + displayName. */
export interface AlumnoGrupoEnriched {
  id: string;
  studentId: string;
  studentName: string;
}

/**
 * Port (interface) for AlumnosXGrupoXCursoXMateriaXCiclo persistence.
 * Implementations live in the infrastructure layer (prisma-tenant).
 * Tenant scoping is implicit via TenantContext.
 *
 * Tasks: F3-D4
 */
export interface AlumnosXGrupoRepository {
  findByGrupo(grupoId: string): Promise<AlumnosXGrupoXCursoXMateriaXCiclo[]>;
  /**
   * Returns alumnos of a group enriched with studentId + studentName.
   * Resolution: AlumnosXGrupo → AlumnosXMateriaXCursoXCiclo.studentId → Student name.
   */
  findByGrupoEnriched(grupoId: string): Promise<AlumnoGrupoEnriched[]>;
  /**
   * Add a student (via their AlumnosXMateriaXCursoXCiclo membership) to a group.
   * The FK at DB level enforces grupo ⊆ materia (MGC-R4).
   * Co-docencia (MGC-R5): same alumnosXMateriaId in multiple grupos is allowed.
   */
  addStudent(
    grupoId: string,
    alumnosXMateriaXCursoXCicloId: string
  ): Promise<AlumnosXGrupoXCursoXMateriaXCiclo>;
  /** Check if a membership exists for (grupoId, alumnosXMateriaId). */
  isMember(grupoId: string, alumnosXMateriaXCursoXCicloId: string): Promise<boolean>;
  /**
   * Remove a student from a group, scoped to the grupo.
   * Uses deleteMany({where:{id, grupoId}}) — idempotent; count=0 when record
   * does not exist or belongs to a different grupo (IDOR prevention).
   */
  removeStudent(grupoId: string, id: string): Promise<void>;
  /** Bulk-upsert for backfill (skipDuplicates). */
  upsertMany(
    data: Array<{ grupoId: string; alumnosXMateriaXCursoXCicloId: string }>
  ): Promise<void>;
  /**
   * Returns the deduplicated set of studentIds for a list of grupo IDs.
   * Two-hop resolution: AlumnosXGrupo → AlumnosXMateria.studentId.
   * Returns [] when grupoIds is empty or no memberships exist.
   * Satisfies: MGC-GET-AUTHZ / F5-T8 (multi-grupo dedup).
   */
  findStudentIdsByGrupoIds(grupoIds: string[]): Promise<string[]>;
}
