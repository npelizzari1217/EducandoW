/**
 * AddStudentToGrupoUseCase — unit tests (TDD, Fase 3c)
 * Covers: F3-T3 (MGC-S9), F3-T4 (MGC-S11 rejection), F3-T5 (MGC-S10), F3-T6 (MGC-S12 co-docencia REMOVED)
 *
 * Fase 3 (Phase 3 enforcement):
 *   MGC-S12: co-docencia removed — student cannot be in two groups of the same materia.
 *   MGC-S13: student already in another group → AlumnoAlreadyInGrupoError (409).
 */
import { describe, it, expect, vi } from 'vitest';
import { AddStudentToGrupoUseCase } from '../add-student-to-grupo.use-case';
import type {
  GrupoRepository,
  AlumnosXGrupoRepository,
  AlumnosXMateriaRepository,
} from '@educandow/domain';
import {
  GrupoXCursoXMateriaXCiclo,
  MateriasXAlumnoXCursoXCiclo,
  AlumnosXGrupoXCursoXMateriaXCiclo,
  NotFoundError,
  AlumnoAlreadyInGrupoError,
  GrupoMateriaMismatchError,
} from '@educandow/domain';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeGrupo(id = 'grupo-1', materiaId = 'm-1'): GrupoXCursoXMateriaXCiclo {
  return GrupoXCursoXMateriaXCiclo.reconstruct({
    id,
    materiaXCursoXCicloId: materiaId,
    docenteXCicloId: 'dxc-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeAlumnosXMateria(id = 'axm-1', materiaId = 'm-1'): MateriasXAlumnoXCursoXCiclo {
  return MateriasXAlumnoXCursoXCiclo.reconstruct({
    id,
    materiaXCursoXCicloId: materiaId,
    studentId: 's-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeAlumnosXGrupo(grupoId = 'grupo-1', axmId = 'axm-1'): AlumnosXGrupoXCursoXMateriaXCiclo {
  return AlumnosXGrupoXCursoXMateriaXCiclo.reconstruct({
    id: 'axg-1',
    grupoId,
    alumnosXMateriaXCursoXCicloId: axmId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeGrupoRepo(grupo: GrupoXCursoXMateriaXCiclo | null): GrupoRepository {
  return {
    findById: vi.fn().mockResolvedValue(grupo),
    findByMateria: vi.fn().mockResolvedValue([]),
    findByDocente: vi.fn().mockResolvedValue([]),
    findGroupsForDocente: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(grupo),
    findAllGlobal: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

/**
 * makeAlumnosGrupoRepo — mock for AlumnosXGrupoRepository.
 * By default findAssignedAlumnosMateriaIds returns [] (nobody assigned).
 * Pass preAssigned to simulate an already-assigned student.
 */
function makeAlumnosGrupoRepo(preAssigned: string[] = []): AlumnosXGrupoRepository {
  return {
    findByGrupo: vi.fn().mockResolvedValue([]),
    findByGrupoEnriched: vi.fn().mockResolvedValue([]),
    findStudentIdsByGrupoIds: vi.fn().mockResolvedValue([]),
    addStudent: vi.fn().mockResolvedValue(makeAlumnosXGrupo()),
    isMember: vi.fn().mockResolvedValue(false),
    upsertMany: vi.fn().mockResolvedValue(undefined),
    removeStudent: vi.fn().mockResolvedValue(undefined),
    findAssignedAlumnosMateriaIds: vi.fn().mockResolvedValue(preAssigned),
  };
}

function makeAlumnosMateriaRepo(axm: MateriasXAlumnoXCursoXCiclo | null): AlumnosXMateriaRepository {
  return {
    findByMateria: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(axm),
    addStudent: vi.fn().mockResolvedValue(axm ?? makeAlumnosXMateria()),
    isMember: vi.fn().mockResolvedValue(false),
    upsertMany: vi.fn().mockResolvedValue(undefined),
    findByMateriaEnriched: vi.fn().mockResolvedValue([]),
    removeStudent: vi.fn().mockResolvedValue(undefined),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AddStudentToGrupoUseCase', () => {
  // F3-T3 / MGC-S9: student in subject universe → added to group successfully
  it('adds student from subject universe to group (MGC-S9)', async () => {
    const grupo = makeGrupo('grupo-1', 'm-1');
    const axm = makeAlumnosXMateria('axm-1', 'm-1'); // same materia
    const grupoRepo = makeGrupoRepo(grupo);
    const alumnosGrupoRepo = makeAlumnosGrupoRepo(); // nobody pre-assigned
    const alumnosMateriaRepo = makeAlumnosMateriaRepo(axm);
    const uc = new AddStudentToGrupoUseCase(grupoRepo, alumnosGrupoRepo, alumnosMateriaRepo);

    const r = await uc.execute({ grupoId: 'grupo-1', alumnosXMateriaXCursoXCicloId: 'axm-1' });

    expect(r.isOk()).toBe(true);
    expect(alumnosGrupoRepo.addStudent).toHaveBeenCalledWith('grupo-1', 'axm-1');
  });

  // F3-T4 / MGC-S11: student not in universe of this materia → rejected (MGC-R4, 422)
  it('rejects student whose AlumnosXMateria belongs to a different materia (MGC-S11)', async () => {
    const grupo = makeGrupo('grupo-1', 'm-1');
    const axm = makeAlumnosXMateria('axm-1', 'm-OTHER'); // different materia!
    const grupoRepo = makeGrupoRepo(grupo);
    const alumnosGrupoRepo = makeAlumnosGrupoRepo();
    const alumnosMateriaRepo = makeAlumnosMateriaRepo(axm);
    const uc = new AddStudentToGrupoUseCase(grupoRepo, alumnosGrupoRepo, alumnosMateriaRepo);

    const r = await uc.execute({ grupoId: 'grupo-1', alumnosXMateriaXCursoXCicloId: 'axm-1' });

    expect(r.isErr()).toBe(true);
    expect(r.unwrapErr()).toBeInstanceOf(GrupoMateriaMismatchError);
    expect(alumnosGrupoRepo.addStudent).not.toHaveBeenCalled();
  });

  // F3-T5 / MGC-S10: student from a different CC → their AlumnosXMateria has a different materiaId
  // which means different CC → the containment check covers this case too (MGC-R4, 422)
  it('rejects student from a different CC via containment check (MGC-S10)', async () => {
    const grupo = makeGrupo('grupo-1', 'm-1');
    // axm belongs to m-OTHER which is from a different CC
    const axm = makeAlumnosXMateria('axm-other-cc', 'm-OTHER-CC');
    const grupoRepo = makeGrupoRepo(grupo);
    const alumnosGrupoRepo = makeAlumnosGrupoRepo();
    const alumnosMateriaRepo = makeAlumnosMateriaRepo(axm);
    const uc = new AddStudentToGrupoUseCase(grupoRepo, alumnosGrupoRepo, alumnosMateriaRepo);

    const r = await uc.execute({ grupoId: 'grupo-1', alumnosXMateriaXCursoXCicloId: 'axm-other-cc' });

    expect(r.isErr()).toBe(true);
    expect(r.unwrapErr()).toBeInstanceOf(GrupoMateriaMismatchError);
    expect(alumnosGrupoRepo.addStudent).not.toHaveBeenCalled();
  });

  // F3-T6 / MGC-S12: co-docencia REMOVED — student cannot be in two groups of the same materia.
  // G1 succeeds; G2 fails because the student is already in G1.
  it('rejects student already in another group of same materia — co-docencia removed (MGC-S12)', async () => {
    const grupoG1 = makeGrupo('grupo-1', 'm-1');
    const grupoG2 = makeGrupo('grupo-2', 'm-1');
    const axm = makeAlumnosXMateria('axm-1', 'm-1');
    const alumnosMateriaRepo = makeAlumnosMateriaRepo(axm);

    // G1: nothing pre-assigned → succeeds
    const grupoRepoG1 = makeGrupoRepo(grupoG1);
    const alumnosGrupoRepoG1 = makeAlumnosGrupoRepo([]); // nobody assigned yet
    const ucG1 = new AddStudentToGrupoUseCase(grupoRepoG1, alumnosGrupoRepoG1, alumnosMateriaRepo);
    const rG1 = await ucG1.execute({ grupoId: 'grupo-1', alumnosXMateriaXCursoXCicloId: 'axm-1' });
    expect(rG1.isOk()).toBe(true);
    expect(alumnosGrupoRepoG1.addStudent).toHaveBeenCalledWith('grupo-1', 'axm-1');

    // G2: axm-1 already in G1 → rejected
    const grupoRepoG2 = makeGrupoRepo(grupoG2);
    const alumnosGrupoRepoG2 = makeAlumnosGrupoRepo(['axm-1']); // axm-1 pre-assigned (via G1)
    const ucG2 = new AddStudentToGrupoUseCase(grupoRepoG2, alumnosGrupoRepoG2, alumnosMateriaRepo);

    const rG2 = await ucG2.execute({ grupoId: 'grupo-2', alumnosXMateriaXCursoXCicloId: 'axm-1' });

    expect(rG2.isErr()).toBe(true);
    expect(rG2.unwrapErr()).toBeInstanceOf(AlumnoAlreadyInGrupoError);
    expect(alumnosGrupoRepoG2.addStudent).not.toHaveBeenCalled();
  });

  // MGC-S13: student already in another group of the same materia → 409
  it('returns err(AlumnoAlreadyInGrupoError) when student already in another grupo of same materia (MGC-S13)', async () => {
    const grupo = makeGrupo('grupo-2', 'm-1');
    const axm = makeAlumnosXMateria('axm-1', 'm-1');
    const grupoRepo = makeGrupoRepo(grupo);
    // Student is already in grupo-1 (another group of the same materia)
    const alumnosGrupoRepo = makeAlumnosGrupoRepo(['axm-1']);
    const alumnosMateriaRepo = makeAlumnosMateriaRepo(axm);
    const uc = new AddStudentToGrupoUseCase(grupoRepo, alumnosGrupoRepo, alumnosMateriaRepo);

    const r = await uc.execute({ grupoId: 'grupo-2', alumnosXMateriaXCursoXCicloId: 'axm-1' });

    expect(r.isErr()).toBe(true);
    expect(r.unwrapErr()).toBeInstanceOf(AlumnoAlreadyInGrupoError);
    expect(alumnosGrupoRepo.addStudent).not.toHaveBeenCalled();
  });

  it('returns err(NotFoundError) when grupo not found', async () => {
    const grupoRepo = makeGrupoRepo(null);
    const alumnosGrupoRepo = makeAlumnosGrupoRepo();
    const axm = makeAlumnosXMateria();
    const alumnosMateriaRepo = makeAlumnosMateriaRepo(axm);
    const uc = new AddStudentToGrupoUseCase(grupoRepo, alumnosGrupoRepo, alumnosMateriaRepo);

    const r = await uc.execute({ grupoId: 'non-existent', alumnosXMateriaXCursoXCicloId: 'axm-1' });

    expect(r.isErr()).toBe(true);
    expect(r.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  it('returns err(NotFoundError) when AlumnosXMateria not found', async () => {
    const grupo = makeGrupo();
    const grupoRepo = makeGrupoRepo(grupo);
    const alumnosGrupoRepo = makeAlumnosGrupoRepo();
    const alumnosMateriaRepo = makeAlumnosMateriaRepo(null);
    const uc = new AddStudentToGrupoUseCase(grupoRepo, alumnosGrupoRepo, alumnosMateriaRepo);

    const r = await uc.execute({ grupoId: 'grupo-1', alumnosXMateriaXCursoXCicloId: 'non-existent' });

    expect(r.isErr()).toBe(true);
    expect(r.unwrapErr()).toBeInstanceOf(NotFoundError);
  });
});
