/**
 * TogglePrintableUseCase — unit tests (TDD, T01, SDD-2 PR-1)
 * Covers: Scenario D (single toggle), Scenario E (IDOR prevention)
 * REQ-TOG-1, REQ-TOG-6
 *
 * No real DB — repos are mocked via vi.fn().
 * Tests are RED until T05 implements the use-case.
 */
import { describe, it, expect, vi } from 'vitest';
import { TogglePrintableUseCase } from '../toggle-printable.use-case';
import type { AlumnosXCursoXCicloRepository } from '@educandow/domain';
import { AlumnosXCursoXCiclo, NotFoundError } from '@educandow/domain';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeEnrollment(
  id: string,
  courseCycleId: string,
  printable = false,
): AlumnosXCursoXCiclo {
  return AlumnosXCursoXCiclo.reconstruct({
    id,
    courseCycleId,
    studentId: 's-1',
    printable,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeAlumnosRepo(
  foundRow: AlumnosXCursoXCiclo | null,
  setPrintableResult?: AlumnosXCursoXCiclo,
): AlumnosXCursoXCicloRepository {
  return {
    findByCourseCycle: vi.fn().mockResolvedValue([]),
    findByCourseCycleEnriched: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(foundRow),
    addStudent: vi.fn(),
    isMember: vi.fn().mockResolvedValue(false),
    remove: vi.fn().mockResolvedValue(undefined),
    setPrintable: vi.fn().mockResolvedValue(setPrintableResult ?? foundRow),
    setPrintableBulk: vi.fn().mockResolvedValue(undefined),
  } as unknown as AlumnosXCursoXCicloRepository;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('TogglePrintableUseCase', () => {
  it('Scenario D: toggles printable=true for an existing row in the correct CC', async () => {
    const row = makeEnrollment('axcc-1', 'cc-1', false);
    const updatedRow = makeEnrollment('axcc-1', 'cc-1', true);
    const repo = makeAlumnosRepo(row, updatedRow);
    const uc = new TogglePrintableUseCase(repo);

    const result = await uc.execute({ courseCycleId: 'cc-1', id: 'axcc-1', value: true });

    expect(repo.findById).toHaveBeenCalledWith('axcc-1');
    expect(repo.setPrintable).toHaveBeenCalledWith('axcc-1', true);
    expect(result.printable).toBe(true);
  });

  it('Scenario D: toggles printable=false for an existing row in the correct CC', async () => {
    const row = makeEnrollment('axcc-1', 'cc-1', true);
    const updatedRow = makeEnrollment('axcc-1', 'cc-1', false);
    const repo = makeAlumnosRepo(row, updatedRow);
    const uc = new TogglePrintableUseCase(repo);

    const result = await uc.execute({ courseCycleId: 'cc-1', id: 'axcc-1', value: false });

    expect(repo.setPrintable).toHaveBeenCalledWith('axcc-1', false);
    expect(result.printable).toBe(false);
  });

  it('Scenario E (IDOR): throws NotFoundError when row belongs to a different CC', async () => {
    // Row R1 belongs to cc-1, caller claims cc-2
    const row = makeEnrollment('axcc-1', 'cc-1', false);
    const repo = makeAlumnosRepo(row);
    const uc = new TogglePrintableUseCase(repo);

    await expect(
      uc.execute({ courseCycleId: 'cc-2', id: 'axcc-1', value: true }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(repo.setPrintable).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when row does not exist', async () => {
    const repo = makeAlumnosRepo(null);
    const uc = new TogglePrintableUseCase(repo);

    await expect(
      uc.execute({ courseCycleId: 'cc-1', id: 'axcc-nonexistent', value: true }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(repo.setPrintable).not.toHaveBeenCalled();
  });
});
