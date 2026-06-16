/**
 * DC-S1 / DC-S2 — assigning a teacher creates the DocenteXCiclo on demand.
 *
 * DC-S1: assigning a User to a CursoXCiclo (as preceptor) creates DocenteXCiclo.
 * DC-S2: assigning a User as teacher of a group creates DocenteXCiclo.
 *
 * Both exercise the real production use-cases against a real tenant DB, asserting
 * the (userId, cycleId) record is created and referenced by the new assignment.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { RolCurso } from '@educandow/domain';
import { PrismaDocenteXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-docente-x-ciclo.repository';
import { PrismaAsignacionCursoXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-asignacion-curso-x-ciclo.repository';
import { PrismaMateriaXCursoXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-materia-x-curso-x-ciclo.repository';
import { PrismaGrupoRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-grupo.repository';
import { DocenteXCicloService } from '../../../src/application/docente-ciclo/docente-x-ciclo.service';
import { AssignDocenteToCursoUseCase } from '../../../src/application/asignacion-curso/assign-docente-to-curso.use-case';
import { CreateGrupoUseCase } from '../../../src/application/materia-grupo-ciclo/create-grupo.use-case';
import { PrismaService } from '../../../src/infrastructure/persistence/prisma/prisma.service';
import { tenantI1Client, runInTenant, resetAll, disconnectAll } from '../setup/clients';
import { seedCourseCycle, createSubject, createMateriaXCursoXCiclo } from '../setup/factories';

const docenteRepo = new PrismaDocenteXCicloRepository();

describe('DC-S1/DC-S2 — assignment creates DocenteXCiclo', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  it('DC-S1: assigning a user to a CursoXCiclo as preceptor creates the DocenteXCiclo', async () => {
    const i1 = tenantI1Client();
    const userId = 'user-dc-s1';

    const { cycle, courseCycle } = await seedCourseCycle(i1);

    // Precondition: no DocenteXCiclo yet for (userId, cycle).
    const before = await runInTenant(i1, () =>
      docenteRepo.findByUserAndCycle(userId, cycle.uuid),
    );
    expect(before).toBeNull();

    const uc = new AssignDocenteToCursoUseCase(
      new PrismaAsignacionCursoXCicloRepository(),
      new DocenteXCicloService(new PrismaDocenteXCicloRepository()),
    );

    const asignacion = await runInTenant(i1, () =>
      uc.execute({
        courseCycleId: courseCycle.uuid,
        courseCycleUuid: courseCycle.uuid,
        cycleId: cycle.uuid,
        userId,
        rol: RolCurso.PRECEPTOR,
      }),
    );

    const after = await runInTenant(i1, () =>
      docenteRepo.findByUserAndCycle(userId, cycle.uuid),
    );
    expect(after).not.toBeNull();
    expect(after!.userId).toBe(userId);
    expect(after!.cycleId).toBe(cycle.uuid);
    // The assignment references the freshly created DocenteXCiclo.
    expect(asignacion.docenteXCicloId).toBe(after!.id);
  });

  it('DC-S2: assigning a user as teacher of a group creates the DocenteXCiclo', async () => {
    const i1 = tenantI1Client();
    const userId = 'user-dc-s2';

    const { cycle, courseCycle } = await seedCourseCycle(i1);
    const subject = await createSubject(i1);
    const materia = await createMateriaXCursoXCiclo(i1, {
      courseCycleId: courseCycle.uuid,
      subjectId: subject.id,
    });

    const before = await runInTenant(i1, () =>
      docenteRepo.findByUserAndCycle(userId, cycle.uuid),
    );
    expect(before).toBeNull();

    const uc = new CreateGrupoUseCase(
      new PrismaMateriaXCursoXCicloRepository(),
      new PrismaGrupoRepository(),
      new DocenteXCicloService(new PrismaDocenteXCicloRepository()),
      new PrismaService(),
    );

    const grupo = await runInTenant(i1, () =>
      uc.execute({ materiaXCursoXCicloId: materia.id, userId, cycleId: cycle.uuid, name: 'G1' }),
    );

    const after = await runInTenant(i1, () =>
      docenteRepo.findByUserAndCycle(userId, cycle.uuid),
    );
    expect(after).not.toBeNull();
    expect(after!.userId).toBe(userId);
    expect(grupo.docenteXCicloId).toBe(after!.id);
  });
});
