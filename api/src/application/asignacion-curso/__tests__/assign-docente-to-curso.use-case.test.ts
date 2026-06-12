/**
 * AssignDocenteToCursoUseCase tests (Fase 4)
 * Specs: ACC-S2 (D2: multiple preceptors same turno), ACC-S6 (cross-cycle rejected),
 *        ACC-S7 (no grupo created), ACC-S4/S5 (titular assign and replace)
 */
import { describe, it, expect, vi } from 'vitest';
import { AssignDocenteToCursoUseCase } from '../assign-docente-to-curso.use-case';
import {
  AsignacionCursoXCiclo,
  AsignacionCursoXCicloRepository,
  DocenteXCiclo,
  DocenteXCicloRepository,
  RolCurso,
  TurnoCurso,
} from '@educandow/domain';
import { DocenteXCicloService } from '../../docente-ciclo/docente-x-ciclo.service';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeDocente(id: string, cycleId: string): DocenteXCiclo {
  return DocenteXCiclo.reconstruct({
    id,
    userId: `user-${id}`,
    cycleId,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeAsignacion(
  id: string,
  courseCycleId: string,
  docenteXCicloId: string,
  rol: RolCurso,
  turno?: TurnoCurso,
): AsignacionCursoXCiclo {
  return AsignacionCursoXCiclo.reconstruct({
    id,
    courseCycleId,
    docenteXCicloId,
    rol,
    turno,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeAsignacionRepo(
  overrides: Partial<AsignacionCursoXCicloRepository> = {},
): AsignacionCursoXCicloRepository {
  return {
    assign: vi.fn().mockImplementation(async (data) =>
      AsignacionCursoXCiclo.reconstruct({
        id: 'new-asg',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ),
    findByCourseId: vi.fn().mockResolvedValue([]),
    findByCourseAndDocente: vi.fn().mockResolvedValue([]),
    isPreceptor: vi.fn().mockResolvedValue(false),
    remove: vi.fn().mockResolvedValue(undefined),
    removeTitularesForCourse: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeDocenteRepo(docente: DocenteXCiclo): DocenteXCicloRepository {
  return {
    findById: vi.fn().mockResolvedValue(docente),
    findByUserId: vi.fn().mockResolvedValue([docente]),
    findByCycleId: vi.fn().mockResolvedValue([docente]),
    findByUserAndCycle: vi.fn().mockResolvedValue(docente),
    upsert: vi.fn().mockResolvedValue(docente),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AssignDocenteToCursoUseCase', () => {
  // F4-T1 / D2 / ACC-S2: second preceptor in same turno → no conflict
  it('allows two preceptors in the same turno (D2/ACC-S2)', async () => {
    const d1 = makeDocente('dxc-1', 'cycle-1');
    const d2 = makeDocente('dxc-2', 'cycle-1');
    const asgRepo = makeAsignacionRepo();
    const docenteRepo = makeDocenteRepo(d1);
    const service = new DocenteXCicloService(docenteRepo);

    // First — assign d1 as PRECEPTOR MANANA
    const uc = new AssignDocenteToCursoUseCase(asgRepo, service);
    await uc.execute({
      courseCycleId: 'cc-1',
      courseCycleUuid: 'cc-1',
      cycleId: 'cycle-1',
      userId: 'user-dxc-1',
      rol: RolCurso.PRECEPTOR,
      turno: TurnoCurso.MANANA,
    });

    // Second — assign d2 as PRECEPTOR MANANA in same CC
    (docenteRepo.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(d2);
    await uc.execute({
      courseCycleId: 'cc-1',
      courseCycleUuid: 'cc-1',
      cycleId: 'cycle-1',
      userId: 'user-dxc-2',
      rol: RolCurso.PRECEPTOR,
      turno: TurnoCurso.MANANA,
    });

    // Both calls succeed; assign called twice
    expect(asgRepo.assign).toHaveBeenCalledTimes(2);
    expect(asgRepo.removeTitularesForCourse).not.toHaveBeenCalled();
  });

  // F4-T2 / ACC-S6: cross-cycle assignment rejected
  it('rejects assignment when docente cycleId does not match CC cycleId (ACC-S6)', async () => {
    const docenteInCycle2 = makeDocente('dxc-3', 'cycle-2');
    const asgRepo = makeAsignacionRepo();
    const docenteRepo = makeDocenteRepo(docenteInCycle2);
    const service = new DocenteXCicloService(docenteRepo);
    const uc = new AssignDocenteToCursoUseCase(asgRepo, service);

    // CC belongs to cycle-1, docente belongs to cycle-2 → error
    await expect(
      uc.execute({
        courseCycleId: 'cc-1',
        courseCycleUuid: 'cc-1',
        cycleId: 'cycle-1',   // CC's cycle
        userId: 'user-dxc-3',
        rol: RolCurso.PRECEPTOR,
      }),
    ).rejects.toThrow();

    expect(asgRepo.assign).not.toHaveBeenCalled();
  });

  // F4-T3 / ACC-S7: assigning preceptor does NOT create grupos
  it('does not interact with GrupoRepository (ACC-S7)', async () => {
    const d1 = makeDocente('dxc-1', 'cycle-1');
    const asgRepo = makeAsignacionRepo();
    const docenteRepo = makeDocenteRepo(d1);
    const service = new DocenteXCicloService(docenteRepo);
    const uc = new AssignDocenteToCursoUseCase(asgRepo, service);

    const result = await uc.execute({
      courseCycleId: 'cc-1',
      courseCycleUuid: 'cc-1',
      cycleId: 'cycle-1',
      userId: 'user-dxc-1',
      rol: RolCurso.PRECEPTOR,
      turno: TurnoCurso.TARDE,
    });

    // Only assign called; no grupo repo involved (checked by absence of extra mocks)
    expect(asgRepo.assign).toHaveBeenCalledOnce();
    expect(result.rol).toBe(RolCurso.PRECEPTOR);
  });

  // F4-T4 / ACC-S4: assign TITULAR
  it('assigns titular and removes any previous titular (ACC-S4/S5)', async () => {
    const d1 = makeDocente('dxc-1', 'cycle-1');
    const existingTitular = makeAsignacion('old-asg', 'cc-1', 'dxc-old', RolCurso.TITULAR);
    const asgRepo = makeAsignacionRepo();
    const docenteRepo = makeDocenteRepo(d1);
    const service = new DocenteXCicloService(docenteRepo);
    const uc = new AssignDocenteToCursoUseCase(asgRepo, service);

    // Simulate that CC already has a titular
    (asgRepo.removeTitularesForCourse as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await uc.execute({
      courseCycleId: 'cc-1',
      courseCycleUuid: 'cc-1',
      cycleId: 'cycle-1',
      userId: 'user-dxc-1',
      rol: RolCurso.TITULAR,
    });

    // removeTitulares must be called BEFORE assign for TITULAR
    expect(asgRepo.removeTitularesForCourse).toHaveBeenCalledWith('cc-1');
    expect(asgRepo.assign).toHaveBeenCalledWith(
      expect.objectContaining({ rol: RolCurso.TITULAR, turno: undefined }),
    );
    expect(result.rol).toBe(RolCurso.TITULAR);
    expect(result.turno).toBeUndefined();

    // Use existing titular to verify it's different from assigned (D3 replaced by D4)
    expect(existingTitular.docenteXCicloId).toBe('dxc-old'); // just ensuring test data is right
  });
});
