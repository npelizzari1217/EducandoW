import { Injectable } from '@nestjs/common';
import type { AlumnosXCursoXCicloRepository } from '@educandow/domain';

/**
 * SetCoursePrintableUseCase — T06 (SDD-2 PR-1).
 *
 * Bulk-sets the `printable` flag for ALL AlumnosXCursoXCiclo rows of a CourseCycle.
 * Implements the "Todos" (value=true) and "Ninguno" (value=false) actions.
 *
 * Tenant isolation is enforced at the Prisma layer via TenantContext:
 * - `setPrintableBulk` runs a WHERE { courseCycleId } inside the tenant DB.
 * - Other tenants' rows are in separate DBs and cannot be affected.
 *
 * If the courseCycleId has no rows (e.g. empty panel), updateMany touches 0 rows —
 * this is safe and idempotent (REQ-PG-4 analogue for printable).
 */
@Injectable()
export class SetCoursePrintableUseCase {
  constructor(private readonly alumnosRepo: AlumnosXCursoXCicloRepository) {}

  async execute(input: { courseCycleId: string; value: boolean }): Promise<void> {
    await this.alumnosRepo.setPrintableBulk(input.courseCycleId, input.value);
  }
}
