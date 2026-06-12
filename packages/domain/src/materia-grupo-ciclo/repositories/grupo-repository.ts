import type { GrupoXCursoXMateriaXCiclo } from '../entities/grupo-x-curso-x-materia-x-ciclo';

/**
 * Port (interface) for GrupoXCursoXMateriaXCiclo persistence.
 * Implementations live in the infrastructure layer (prisma-tenant).
 * Tenant scoping is implicit via TenantContext.
 *
 * Tasks: F3-D3
 */
export interface GrupoRepository {
  findById(id: string): Promise<GrupoXCursoXMateriaXCiclo | null>;
  findByMateria(materiaXCursoXCicloId: string): Promise<GrupoXCursoXMateriaXCiclo[]>;
  findByDocente(docenteXCicloId: string): Promise<GrupoXCursoXMateriaXCiclo[]>;
  /**
   * Find groups for a specific docente in a specific materia.
   * Used by the authorization layer (Fase 5).
   */
  findGroupsForDocente(
    docenteXCicloId: string,
    materiaXCursoXCicloId: string
  ): Promise<GrupoXCursoXMateriaXCiclo[]>;
  create(data: { materiaXCursoXCicloId: string; docenteXCicloId: string; name?: string }): Promise<GrupoXCursoXMateriaXCiclo>;
}
