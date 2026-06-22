import type { MateriaXCursoXCiclo } from '../entities/materia-x-curso-x-ciclo';

/**
 * Port (interface) for MateriaXCursoXCiclo persistence.
 * Implementations live in the infrastructure layer (prisma-tenant).
 * Tenant scoping is implicit via TenantContext.
 *
 * Tasks: F3-D1
 */
export interface MateriaXCursoXCicloRepository {
  findById(id: string): Promise<MateriaXCursoXCiclo | null>;
  findByCourseCycleId(courseCycleId: string): Promise<MateriaXCursoXCiclo[]>;
  /** Upsert keyed on @@unique([courseCycleId, subjectId]). Idempotent. esOptativa is optional; omitting defaults to false. */
  upsertMany(
    data: Array<{ courseCycleId: string; subjectId: string; studyPlanSubjectId?: string; esOptativa?: boolean }>
  ): Promise<void>;
  updateDescription(id: string, data: { studyPlanSubjectId?: string }): Promise<MateriaXCursoXCiclo>;
  /** Toggle the optativa flag for a materia. Returns the updated entity. MGC-R10, D3. */
  setEsOptativa(id: string, esOptativa: boolean): Promise<MateriaXCursoXCiclo>;
}
