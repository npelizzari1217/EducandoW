/**
 * ListAlumnosMateriaUseCase — unit tests (TDD)
 * Mirrors list-alumnos-grupo.use-case pattern.
 */
import { describe, it, expect, vi } from 'vitest';
import { ListAlumnosMateriaUseCase } from '../list-alumnos-materia.use-case';
import type { AlumnosXMateriaRepository, AlumnoMateriaEnriched } from '@educandow/domain';

function makeRepo(result: AlumnoMateriaEnriched[] = []): AlumnosXMateriaRepository {
  return {
    findByMateria: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    addStudent: vi.fn(),
    isMember: vi.fn().mockResolvedValue(false),
    upsertMany: vi.fn().mockResolvedValue(undefined),
    findByMateriaEnriched: vi.fn().mockResolvedValue(result),
  };
}

describe('ListAlumnosMateriaUseCase', () => {
  it('delegates to repo.findByMateriaEnriched with the given materiaId', async () => {
    const repo = makeRepo();
    const uc = new ListAlumnosMateriaUseCase(repo);

    await uc.execute('materia-1');

    expect(repo.findByMateriaEnriched).toHaveBeenCalledWith('materia-1');
  });

  it('returns empty array when repo returns no alumnos', async () => {
    const repo = makeRepo([]);
    const uc = new ListAlumnosMateriaUseCase(repo);

    const result = await uc.execute('materia-1');

    expect(result).toEqual([]);
  });

  it('returns enriched alumnos from repo', async () => {
    const enriched: AlumnoMateriaEnriched[] = [
      { id: 'axm-1', studentId: 'stu-1', studentName: 'Ana García' },
      { id: 'axm-2', studentId: 'stu-2', studentName: 'Carlos López' },
    ];
    const repo = makeRepo(enriched);
    const uc = new ListAlumnosMateriaUseCase(repo);

    const result = await uc.execute('materia-1');

    expect(result).toEqual(enriched);
  });

  it('propagates error when repo throws (no tenant client)', async () => {
    const repo = makeRepo();
    (repo.findByMateriaEnriched as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('TenantContext: no tenant client available for this request'),
    );
    const uc = new ListAlumnosMateriaUseCase(repo);

    await expect(uc.execute('materia-1')).rejects.toThrow(
      'TenantContext: no tenant client available for this request',
    );
  });
});
