/**
 * F1-T6 (UP-S6) — ListDocentesXCicloUseCase returns persona from User (master DB).
 *
 * GIVEN User u1 has title "Mg." and is assigned to a cycle,
 * WHEN ListDocentesXCicloUseCase executes,
 * THEN the returned docente has title "Mg." — persona is sourced from User (DC-R2).
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { ListDocentesXCicloUseCase } from '../../../src/application/docente-ciclo/list-docentes-x-ciclo.use-case';
import { PrismaDocenteXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-docente-x-ciclo.repository';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma/prisma.service';
import { masterClient, tenantI1Client, runInTenant, resetAll, disconnectAll } from '../setup/clients';
import { createAcademicCycle, createDocenteXCiclo } from '../setup/factories';

describe('F1-T6 / UP-S6 — ListDocentesXCicloUseCase reads persona from User', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  it('returns persona fields from the master User record', async () => {
    const master = masterClient();
    const i1 = tenantI1Client();

    const user = await master.user.create({
      data: { email: 'u1@test.local', passwordHash: 'x', name: 'u1', title: 'Mg.', firstName: 'Luis', lastName: 'Pérez' },
    });

    const cycle = await createAcademicCycle(i1);
    await createDocenteXCiclo(i1, { userId: user.id, cycleId: cycle.uuid });

    const uc = new ListDocentesXCicloUseCase(new PrismaDocenteXCicloRepository(), new PrismaService());
    const docentes = await runInTenant(i1, () => uc.execute(cycle.uuid));

    expect(docentes).toHaveLength(1);
    expect(docentes[0].userId).toBe(user.id);
    expect(docentes[0].title).toBe('Mg.');
  });
});
