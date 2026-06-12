import type { AlumnosXGrupoXCursoXMateriaXCiclo } from '../entities/alumnos-x-grupo-x-curso-x-materia-x-ciclo';

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
  /** Bulk-upsert for backfill (skipDuplicates). */
  upsertMany(
    data: Array<{ grupoId: string; alumnosXMateriaXCursoXCicloId: string }>
  ): Promise<void>;
}
