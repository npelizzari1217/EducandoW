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
  /** Upsert keyed on @@unique([courseCycleId, subjectId]). Idempotent. */
  upsertMany(
    data: Array<{ courseCycleId: string; subjectId: string; studyPlanSubjectId?: string }>
  ): Promise<void>;
  updateDescription(id: string, data: { studyPlanSubjectId?: string }): Promise<MateriaXCursoXCiclo>;
}
