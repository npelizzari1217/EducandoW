import type { DocenteXCiclo } from '../entities/docente-x-ciclo';

/**
 * Port (interface) for DocenteXCiclo persistence.
 * Implementations live in the infrastructure layer (prisma-tenant).
 * Tenant scoping is implicit via TenantContext — no institutionId param needed.
 */
export interface DocenteXCicloRepository {
  findById(id: string): Promise<DocenteXCiclo | null>;
  findByUserId(userId: string): Promise<DocenteXCiclo[]>;
  findByCycleId(cycleId: string): Promise<DocenteXCiclo[]>;
  findByUserAndCycle(userId: string, cycleId: string): Promise<DocenteXCiclo | null>;
  /** Upsert keyed on (userId, cycleId). Returns the persisted record. */
  upsert(data: { userId: string; cycleId: string }): Promise<DocenteXCiclo>;
}
