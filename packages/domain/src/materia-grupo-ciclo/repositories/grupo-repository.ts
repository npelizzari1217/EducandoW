import type { GrupoXCursoXMateriaXCiclo } from '../entities/grupo-x-curso-x-materia-x-ciclo';

/**
 * Filters for findAllGlobal — all fields optional.
 */
export interface GrupoGlobalFilters {
  level?: number;
  levelIn?: number[];
  courseCycleId?: string;
  materiaId?: string;
  docenteXCicloIds?: string[];
}

/**
 * Flat projection returned by findAllGlobal (enriched across relations).
 */
export interface GrupoGlobalRow {
  id: string;
  name?: string;
  docenteXCicloId: string;
  docenteUserId: string;
  materiaId: string;
  subjectId: string;
  subjectName: string;
  courseCycleId: string;
  courseName: string;
  level: number;
  alumnosCount: number;
}

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
  /** Cross-materia global listing with optional filters and enrichment. */
  findAllGlobal(filters: GrupoGlobalFilters): Promise<GrupoGlobalRow[]>;
  update(id: string, data: { name?: string; docenteXCicloId?: string }): Promise<GrupoXCursoXMateriaXCiclo>;
  delete(id: string): Promise<void>;
}
