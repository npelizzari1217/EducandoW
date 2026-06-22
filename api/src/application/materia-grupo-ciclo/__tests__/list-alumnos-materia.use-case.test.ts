/**
 * ListAlumnosMateriaUseCase — unit tests (TDD)
 * Mirrors list-alumnos-grupo.use-case pattern.
 *
 * Fase 3 additions:
 *   - Signature changed to { materiaXCursoXCicloId, unassigned? }
 *   - unassigned=true filters out already-assigned students server-side
 */
import { describe, it, expect, vi } from 'vitest';
import { ListAlumnosMateriaUseCase } from '../list-alumnos-materia.use-case';
import type {
  AlumnosXMateriaRepository,
  AlumnosXGrupoRepository,
  AlumnoMateriaEnriched,
} from '@educandow/domain';

function makeRepo(result: AlumnoMateriaEnriched[] = []): AlumnosXMateriaRepository {
  return {
    findByMateria: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    addStudent: vi.fn(),
    isMember: vi.fn().mockResolvedValue(false),
    upsertMany: vi.fn().mockResolvedValue(undefined),
    findByMateriaEnriched: vi.fn().mockResolvedValue(result),
    removeStudent: vi.fn().mockResolvedValue(undefined),
  };
}

function makeAlumnosGrupoRepo(assignedIds: string[] = []): AlumnosXGrupoRepository {
  return {
    findByGrupo: vi.fn().mockResolvedValue([]),
    findByGrupoEnriched: vi.fn().mockResolvedValue([]),
    findStudentIdsByGrupoIds: vi.fn().mockResolvedValue([]),
    addStudent: vi.fn(),
    isMember: vi.fn().mockResolvedValue(false),
    removeStudent: vi.fn().mockResolvedValue(undefined),
    upsertMany: vi.fn().mockResolvedValue(undefined),
    findAssignedAlumnosMateriaIds: vi.fn().mockResolvedValue(assignedIds),
  };
}

// ── Existing tests (updated to new object signature) ──────────────────────────

describe('ListAlumnosMateriaUseCase', () => {
  it('delegates to repo.findByMateriaEnriched with the given materiaId', async () => {
    const repo = makeRepo();
    const uc = new ListAlumnosMateriaUseCase(repo, makeAlumnosGrupoRepo());

    await uc.execute({ materiaXCursoXCicloId: 'materia-1' });

    expect(repo.findByMateriaEnriched).toHaveBeenCalledWith('materia-1');
  });

  it('returns empty array when repo returns no alumnos', async () => {
    const repo = makeRepo([]);
    const uc = new ListAlumnosMateriaUseCase(repo, makeAlumnosGrupoRepo());

    const result = await uc.execute({ materiaXCursoXCicloId: 'materia-1' });

    expect(result).toEqual([]);
  });

  it('returns enriched alumnos from repo', async () => {
    const enriched: AlumnoMateriaEnriched[] = [
      { id: 'axm-1', studentId: 'stu-1', studentName: 'Ana García' },
      { id: 'axm-2', studentId: 'stu-2', studentName: 'Carlos López' },
    ];
    const repo = makeRepo(enriched);
    const uc = new ListAlumnosMateriaUseCase(repo, makeAlumnosGrupoRepo());

    const result = await uc.execute({ materiaXCursoXCicloId: 'materia-1' });

    expect(result).toEqual(enriched);
  });

  it('propagates error when repo throws (no tenant client)', async () => {
    const repo = makeRepo();
    (repo.findByMateriaEnriched as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('TenantContext: no tenant client available for this request'),
    );
    const uc = new ListAlumnosMateriaUseCase(repo, makeAlumnosGrupoRepo());

    await expect(uc.execute({ materiaXCursoXCicloId: 'materia-1' })).rejects.toThrow(
      'TenantContext: no tenant client available for this request',
    );
  });

  // ── Fase 3: unassigned filter ───────────────────────────────────────────────

  it('returns full universe when unassigned is false (no filtering)', async () => {
    const enriched: AlumnoMateriaEnriched[] = [
      { id: 'axm-1', studentId: 's-1', studentName: 'Ana García' },
      { id: 'axm-2', studentId: 's-2', studentName: 'Carlos López' },
    ];
    const repo = makeRepo(enriched);
    const grupoRepo = makeAlumnosGrupoRepo(['axm-1']); // axm-1 assigned, but flag is false
    const uc = new ListAlumnosMateriaUseCase(repo, grupoRepo);

    const result = await uc.execute({ materiaXCursoXCicloId: 'materia-1', unassigned: false });

    expect(result).toEqual(enriched);
    expect(grupoRepo.findAssignedAlumnosMateriaIds).not.toHaveBeenCalled();
  });

  it('returns all alumnos when unassigned=true and none are assigned', async () => {
    const enriched: AlumnoMateriaEnriched[] = [
      { id: 'axm-1', studentId: 's-1', studentName: 'Ana García' },
      { id: 'axm-2', studentId: 's-2', studentName: 'Carlos López' },
    ];
    const repo = makeRepo(enriched);
    const grupoRepo = makeAlumnosGrupoRepo([]); // nobody assigned
    const uc = new ListAlumnosMateriaUseCase(repo, grupoRepo);

    const result = await uc.execute({ materiaXCursoXCicloId: 'materia-1', unassigned: true });

    expect(result).toEqual(enriched);
    expect(grupoRepo.findAssignedAlumnosMateriaIds).toHaveBeenCalledWith('materia-1');
  });

  it('excludes already-assigned alumnos when unassigned=true', async () => {
    const enriched: AlumnoMateriaEnriched[] = [
      { id: 'axm-1', studentId: 's-1', studentName: 'Ana García' },
      { id: 'axm-2', studentId: 's-2', studentName: 'Carlos López' },
    ];
    const repo = makeRepo(enriched);
    const grupoRepo = makeAlumnosGrupoRepo(['axm-1']); // axm-1 is assigned
    const uc = new ListAlumnosMateriaUseCase(repo, grupoRepo);

    const result = await uc.execute({ materiaXCursoXCicloId: 'materia-1', unassigned: true });

    expect(result).toEqual([{ id: 'axm-2', studentId: 's-2', studentName: 'Carlos López' }]);
  });

  it('preserves order from repo when filtering unassigned (middle element removed)', async () => {
    const enriched: AlumnoMateriaEnriched[] = [
      { id: 'axm-1', studentId: 's-1', studentName: 'Ana García' },
      { id: 'axm-2', studentId: 's-2', studentName: 'Carlos López' },
      { id: 'axm-3', studentId: 's-3', studentName: 'María Rodríguez' },
    ];
    const repo = makeRepo(enriched);
    const grupoRepo = makeAlumnosGrupoRepo(['axm-2']); // middle one assigned
    const uc = new ListAlumnosMateriaUseCase(repo, grupoRepo);

    const result = await uc.execute({ materiaXCursoXCicloId: 'materia-1', unassigned: true });

    expect(result).toEqual([
      { id: 'axm-1', studentId: 's-1', studentName: 'Ana García' },
      { id: 'axm-3', studentId: 's-3', studentName: 'María Rodríguez' },
    ]);
  });
});
