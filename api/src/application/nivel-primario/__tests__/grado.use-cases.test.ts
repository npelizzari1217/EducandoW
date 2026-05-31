import { describe, it, expect, vi } from 'vitest';
import { CreateGradoUseCase, GetGradoUseCase } from '../use-cases/grado.use-cases';
import type { GradoRepository } from '@educandow/domain';

function mockGradoRepo(overrides: Partial<GradoRepository> = {}): GradoRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('Nivel Primario — Use Cases', () => {
  // ── Spec Scenario: Create grado ──────────────────────────────

  describe('CreateGradoUseCase', () => {
    it('creates a grado with valid input', async () => {
      const repo = mockGradoRepo();
      const uc = new CreateGradoUseCase(repo);

      const result = await uc.execute({
        grade: 3,
        division: 'A',
        academicYear: '2026',
      });

      expect(result.isOk()).toBe(true);
      const grado = result.unwrap();
      expect(grado.grade.value).toBe(3);
      expect(grado.division.value).toBe('A');
      expect(repo.save).toHaveBeenCalledOnce();
    });

    // ── Spec Scenario: Duplicate = same VOs detected ───────────

    it('rejects grado with grade 7 as validation error', async () => {
      const repo = mockGradoRepo();
      const uc = new CreateGradoUseCase(repo);

      const result = await uc.execute({
        grade: 7,
        division: 'A',
        academicYear: '2026',
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('Grado inválido');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects grado with invalid division D', async () => {
      const repo = mockGradoRepo();
      const uc = new CreateGradoUseCase(repo);

      const result = await uc.execute({
        grade: 3,
        division: 'D',
        academicYear: '2026',
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('División inválida');
    });
  });

  describe('GetGradoUseCase', () => {
    it('returns null when grado not found', async () => {
      const repo = mockGradoRepo();
      const uc = new GetGradoUseCase(repo);

      const result = await uc.execute('nonexistent');
      expect(result).toBeNull();
    });

    it('returns grado when found', async () => {
      const fakeGrado = { grade: { value: 5 }, division: { value: 'B' } };
      const repo = mockGradoRepo({ findById: vi.fn().mockResolvedValue(fakeGrado) });
      const uc = new GetGradoUseCase(repo);

      const result = await uc.execute('grado-5b');
      expect(result).toBe(fakeGrado);
    });
  });
});
