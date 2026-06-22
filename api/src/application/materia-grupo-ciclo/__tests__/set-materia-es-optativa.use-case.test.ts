/**
 * SetMateriaEsOptativaUseCase — unit tests (TDD, T2.5)
 * Spec: MGC-R10, MGC-R11, MGC-S23, MGC-S24, MGC-S25 · Design: D3, D6
 */
import { describe, it, expect, vi } from 'vitest';
import { SetMateriaEsOptativaUseCase } from '../set-materia-es-optativa.use-case';
import type { MateriaXCursoXCicloRepository } from '@educandow/domain';
import { MateriaXCursoXCiclo, NotFoundError } from '@educandow/domain';

// ── helpers ────────────────────────────────────────────────────────────────────

function makeMateria(id = 'mxcc-1', esOptativa = false): MateriaXCursoXCiclo {
  return MateriaXCursoXCiclo.reconstruct({
    id,
    courseCycleId: 'cc-1',
    subjectId: 'sub-1',
    esOptativa,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeMateriaRepo(
  materia: MateriaXCursoXCiclo | null,
  updatedMateria?: MateriaXCursoXCiclo,
): MateriaXCursoXCicloRepository {
  return {
    findById: vi.fn().mockResolvedValue(materia),
    findByCourseCycleId: vi.fn().mockResolvedValue([]),
    upsertMany: vi.fn().mockResolvedValue(undefined),
    updateDescription: vi.fn(),
    setEsOptativa: vi.fn().mockResolvedValue(updatedMateria ?? materia),
  };
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('SetMateriaEsOptativaUseCase', () => {
  it('execute({ id, esOptativa: true }) delegates setEsOptativa(id, true) and returns entity', async () => {
    const materia = makeMateria('mxcc-1', false);
    const updated = makeMateria('mxcc-1', true);
    const materiaRepo = makeMateriaRepo(materia, updated);
    const uc = new SetMateriaEsOptativaUseCase(materiaRepo);

    const result = await uc.execute({ id: 'mxcc-1', esOptativa: true });

    expect(materiaRepo.findById).toHaveBeenCalledWith('mxcc-1');
    expect(materiaRepo.setEsOptativa).toHaveBeenCalledWith('mxcc-1', true);
    expect(result.esOptativa).toBe(true);
  });

  it('execute({ id, esOptativa: false }) delegates setEsOptativa(id, false)', async () => {
    const materia = makeMateria('mxcc-1', true);
    const updated = makeMateria('mxcc-1', false);
    const materiaRepo = makeMateriaRepo(materia, updated);
    const uc = new SetMateriaEsOptativaUseCase(materiaRepo);

    const result = await uc.execute({ id: 'mxcc-1', esOptativa: false });

    expect(materiaRepo.setEsOptativa).toHaveBeenCalledWith('mxcc-1', false);
    expect(result.esOptativa).toBe(false);
  });

  it('materia not found → throws NotFoundError', async () => {
    const materiaRepo = makeMateriaRepo(null);
    const uc = new SetMateriaEsOptativaUseCase(materiaRepo);

    await expect(uc.execute({ id: 'non-existent', esOptativa: true })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('does NOT interact with AlumnosXMateriaRepository (D6: no retroactive cleanup)', async () => {
    // This UC only injects MateriaXCursoXCicloRepository — constructor has 1 param.
    // Test confirms no second repo dependency exists.
    const materia = makeMateria('mxcc-1', false);
    const updated = makeMateria('mxcc-1', true);
    const materiaRepo = makeMateriaRepo(materia, updated);
    const uc = new SetMateriaEsOptativaUseCase(materiaRepo);

    // If the UC accidentally used a non-existent alumnosRepo, TypeScript would catch it.
    // At runtime, we verify it doesn't blow up and setEsOptativa is the only call.
    await uc.execute({ id: 'mxcc-1', esOptativa: true });

    expect(materiaRepo.setEsOptativa).toHaveBeenCalledTimes(1);
    // No other side-effects expected (repo has no other call expectations).
  });
});
