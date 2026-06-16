/**
 * ACC-S1 / ACC-S3 — preceptor assignments with turno (real DB).
 *
 * ACC-S1: assigning a preceptor with a turno persists it correctly.
 * ACC-S3: two preceptors with distinct turnos on the same CursoXCiclo both persist.
 *
 * Exercises AssignDocenteToCursoUseCase (which idempotently creates the DocenteXCiclo
 * and writes the AsignacionCursoXCiclo) against the real tenant DB.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { RolCurso, TurnoCurso } from '@educandow/domain';
import { PrismaAsignacionCursoXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-asignacion-curso-x-ciclo.repository';
import { PrismaDocenteXCicloRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-docente-x-ciclo.repository';
import { DocenteXCicloService } from '../../../src/application/docente-ciclo/docente-x-ciclo.service';
import { AssignDocenteToCursoUseCase } from '../../../src/application/asignacion-curso/assign-docente-to-curso.use-case';
import { tenantI1Client, runInTenant, resetAll, disconnectAll } from '../setup/clients';
import { seedCourseCycle } from '../setup/factories';

const asignacionRepo = new PrismaAsignacionCursoXCicloRepository();

function newUseCase() {
  return new AssignDocenteToCursoUseCase(
    new PrismaAsignacionCursoXCicloRepository(),
    new DocenteXCicloService(new PrismaDocenteXCicloRepository()),
  );
}

describe('ACC-S1/ACC-S3 — preceptor assignments with turno', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  it('ACC-S1: preceptor assigned with turno=MANANA persists with that turno', async () => {
    const i1 = tenantI1Client();
    const { cycle, courseCycle } = await seedCourseCycle(i1);
    const uc = newUseCase();

    const asignacion = await runInTenant(i1, () =>
      uc.execute({
        courseCycleId: courseCycle.uuid,
        courseCycleUuid: courseCycle.uuid,
        cycleId: cycle.uuid,
        userId: 'd1',
        rol: RolCurso.PRECEPTOR,
        turno: TurnoCurso.MANANA,
      }),
    );
    expect(asignacion.turno).toBe(TurnoCurso.MANANA);

    const persisted = await runInTenant(i1, () => asignacionRepo.findByCourseId(courseCycle.uuid));
    expect(persisted).toHaveLength(1);
    expect(persisted[0].rol).toBe(RolCurso.PRECEPTOR);
    expect(persisted[0].turno).toBe(TurnoCurso.MANANA);
  });

  it('ACC-S3: two preceptors with distinct turnos on the same CC both persist', async () => {
    const i1 = tenantI1Client();
    const { cycle, courseCycle } = await seedCourseCycle(i1);
    const uc = newUseCase();

    await runInTenant(i1, () =>
      uc.execute({
        courseCycleId: courseCycle.uuid,
        courseCycleUuid: courseCycle.uuid,
        cycleId: cycle.uuid,
        userId: 'd1',
        rol: RolCurso.PRECEPTOR,
        turno: TurnoCurso.MANANA,
      }),
    );
    await runInTenant(i1, () =>
      uc.execute({
        courseCycleId: courseCycle.uuid,
        courseCycleUuid: courseCycle.uuid,
        cycleId: cycle.uuid,
        userId: 'd2',
        rol: RolCurso.PRECEPTOR,
        turno: TurnoCurso.TARDE,
      }),
    );

    const persisted = await runInTenant(i1, () => asignacionRepo.findByCourseId(courseCycle.uuid));
    expect(persisted).toHaveLength(2);
    expect(persisted.every((a) => a.rol === RolCurso.PRECEPTOR)).toBe(true);
    expect(new Set(persisted.map((a) => a.turno))).toEqual(
      new Set([TurnoCurso.MANANA, TurnoCurso.TARDE]),
    );
  });
});
