/**
 * MGC-S13 — MateriaXCursoXCiclo cross-institution isolation.
 *
 * GIVEN a MateriaXCursoXCiclo M in institution I1, cycle C1,
 * WHEN institution I2's tenant lists its subjects for a cycle,
 * THEN M does not appear — each tenant only sees its own DB.
 *
 * Asserts against the production query `findByCourseCycleId` (the call inside
 * ListMateriasUseCase) routed through TenantContext.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaMateriaXCursoXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-materia-x-curso-x-ciclo.repository';
import {
  tenantI1Client,
  tenantI2Client,
  runInTenant,
  resetAll,
  disconnectAll,
} from '../setup/clients';
import { seedCourseCycle, createSubject, createMateriaXCursoXCiclo } from '../setup/factories';

const materiaRepo = new PrismaMateriaXCursoXCicloRepository();

describe('MGC-S13 — MateriaXCursoXCiclo cross-institution isolation', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  it("I2 does not see I1's MateriaXCursoXCiclo for the same course-cycle", async () => {
    const i1 = tenantI1Client();
    const i2 = tenantI2Client();

    // Seed a subject (materia) for a course-cycle in I1 only.
    const { courseCycle } = await seedCourseCycle(i1);
    const subject = await createSubject(i1);
    const materia = await createMateriaXCursoXCiclo(i1, {
      courseCycleId: courseCycle.uuid,
      subjectId: subject.id,
    });

    // I1 sees it.
    const fromI1 = await runInTenant(i1, () =>
      materiaRepo.findByCourseCycleId(courseCycle.uuid),
    );
    expect(fromI1.map((m) => m.id)).toEqual([materia.id]);

    // I2 queries the SAME courseCycle uuid → its DB has no such row.
    const fromI2 = await runInTenant(i2, () =>
      materiaRepo.findByCourseCycleId(courseCycle.uuid),
    );
    expect(fromI2).toHaveLength(0);
  });
});
