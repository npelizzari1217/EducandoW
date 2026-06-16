/**
 * ACC-S8 — AsignacionCursoXCiclo cross-tenant isolation.
 *
 * GIVEN DocenteXCiclo D1 assigned as preceptor to CC1 in institution I1,
 * WHEN institution I2's tenant queries preceptor assignments for its CursoXCiclo,
 * THEN D1's assignment does not appear.
 *
 * Asserts against the production query `findByCourseId` (the call inside
 * ListAsignacionesCursoUseCase) routed through TenantContext.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { RolCurso } from '@educandow/domain';
import { PrismaAsignacionCursoXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-asignacion-curso-x-ciclo.repository';
import { PrismaDocenteXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-docente-x-ciclo.repository';
import { DocenteXCicloService } from '../../../src/application/docente-ciclo/docente-x-ciclo.service';
import { AssignDocenteToCursoUseCase } from '../../../src/application/asignacion-curso/assign-docente-to-curso.use-case';
import {
  tenantI1Client,
  tenantI2Client,
  runInTenant,
  resetAll,
  disconnectAll,
} from '../setup/clients';
import { seedCourseCycle } from '../setup/factories';

const asignacionRepo = new PrismaAsignacionCursoXCicloRepository();

describe('ACC-S8 — AsignacionCursoXCiclo cross-tenant isolation', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  it("I2 does not see I1's preceptor assignment for the same course-cycle", async () => {
    const i1 = tenantI1Client();
    const i2 = tenantI2Client();

    const { cycle, courseCycle } = await seedCourseCycle(i1);

    // Assign a preceptor to CC1 in I1 via the production use-case.
    const uc = new AssignDocenteToCursoUseCase(
      new PrismaAsignacionCursoXCicloRepository(),
      new DocenteXCicloService(new PrismaDocenteXCicloRepository()),
    );
    const asignacion = await runInTenant(i1, () =>
      uc.execute({
        courseCycleId: courseCycle.uuid,
        courseCycleUuid: courseCycle.uuid,
        cycleId: cycle.uuid,
        userId: 'user-acc-s8',
        rol: RolCurso.PRECEPTOR,
      }),
    );

    // I1 sees its assignment.
    const fromI1 = await runInTenant(i1, () => asignacionRepo.findByCourseId(courseCycle.uuid));
    expect(fromI1.map((a) => a.id)).toEqual([asignacion.id]);
    expect(fromI1[0].rol).toBe(RolCurso.PRECEPTOR);

    // I2 queries the SAME courseCycle uuid → its DB has no such assignment.
    const fromI2 = await runInTenant(i2, () => asignacionRepo.findByCourseId(courseCycle.uuid));
    expect(fromI2).toHaveLength(0);
  });
});
