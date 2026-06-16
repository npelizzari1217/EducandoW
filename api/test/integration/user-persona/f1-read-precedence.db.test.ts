/**
 * F1-T6 (UP-S6) — User persona value wins over a stale Teacher value on read.
 *
 * GIVEN User u1 has title "Mg." (updated post-migration) and the linked Teacher
 *       still holds the legacy "Lic.",
 * WHEN a read path returns personnel data for u1,
 * THEN "Mg." (the User value) is returned — persona is sourced from User (DC-R2),
 *      never from Teacher.
 *
 * Exercises the real ListDocentesXCicloUseCase, which joins persona from the
 * master User and never reads Teacher.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { ListDocentesXCicloUseCase } from '../../../src/application/docente-ciclo/list-docentes-x-ciclo.use-case';
import { PrismaDocenteXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-docente-x-ciclo.repository';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma/prisma.service';
import { masterClient, tenantI1Client, runInTenant, resetAll, disconnectAll } from '../setup/clients';
import { createAcademicCycle, createTeacher, createDocenteXCiclo } from '../setup/factories';

describe('F1-T6 / UP-S6 — User persona wins over stale Teacher on read', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  it('read path returns the User title, not the stale Teacher title', async () => {
    const master = masterClient();
    const i1 = tenantI1Client();

    // User u1 with an updated persona title.
    const user = await master.user.create({
      data: { email: 'u1@test.local', passwordHash: 'x', name: 'u1', title: 'Mg.', firstName: 'Luis', lastName: 'Pérez' },
    });

    const cycle = await createAcademicCycle(i1);
    await createDocenteXCiclo(i1, { userId: user.id, cycleId: cycle.uuid });
    // Stale Teacher value that MUST be ignored on read.
    await createTeacher(i1, { userId: user.id, title: 'Lic.' });

    const uc = new ListDocentesXCicloUseCase(new PrismaDocenteXCicloRepository(), new PrismaService());
    const docentes = await runInTenant(i1, () => uc.execute(cycle.uuid));

    expect(docentes).toHaveLength(1);
    expect(docentes[0].userId).toBe(user.id);
    expect(docentes[0].title).toBe('Mg.'); // User value, not Teacher's "Lic."
  });
});
