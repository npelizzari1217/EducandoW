import { describe, it, expect, vi } from 'vitest';
import { ValidationError, NotFoundError } from '@educandow/domain';
import { CreateSalaUseCase, GetSalaUseCase, DeleteSalaUseCase } from '../use-cases/sala.use-cases';
import type { SalaRepository } from '@educandow/domain';

function mockSalaRepo(overrides: Partial<SalaRepository> = {}): SalaRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    softDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Nivel Inicial — Use Cases', () => {
  // ── Spec Scenario: Create sala with valid data ───────────────

  describe('CreateSalaUseCase', () => {
    it('creates a sala with valid input', async () => {
      const repo = mockSalaRepo();
      const uc = new CreateSalaUseCase(repo);

      const result = await uc.execute({
        name: 'Sala Azul',
        ageGroup: 4,
        turno: 'MAÑANA',
        capacity: 25,
        academicYear: '2026',
      });

      expect(result.isOk()).toBe(true);
      const sala = result.unwrap();
      expect(sala.name).toBe('Sala Azul');
      expect(sala.ageGroup.get()).toBe(4);
      expect(sala.turno.get()).toBe('MAÑANA');
      expect(sala.capacity).toBe(25);
      expect(repo.save).toHaveBeenCalledOnce();
    });

    // ── Spec Scenario: Invalid age group rejected ──────────────

    it('returns ValidationError for invalid age group 6', async () => {
      const repo = mockSalaRepo();
      const uc = new CreateSalaUseCase(repo);

      const result = await uc.execute({
        name: 'Sala Roja',
        ageGroup: 6,
        turno: 'MAÑANA',
        capacity: 20,
        academicYear: '2026',
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
      expect(result.unwrapErr().message).toContain('AgeGroup');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('returns ValidationError for capacity 0', async () => {
      const repo = mockSalaRepo();
      const uc = new CreateSalaUseCase(repo);

      const result = await uc.execute({
        name: 'Sala Test',
        ageGroup: 3,
        turno: 'MAÑANA',
        capacity: 0,
        academicYear: '2026',
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('capacity');
    });
  });

  describe('GetSalaUseCase', () => {
    it('returns NotFoundError when sala does not exist', async () => {
      const repo = mockSalaRepo({ findById: vi.fn().mockResolvedValue(null) });
      const uc = new GetSalaUseCase(repo);

      const result = await uc.execute('nonexistent');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
      expect(result.unwrapErr().message).toContain('not found');
    });
  });

  describe('DeleteSalaUseCase', () => {
    it('soft deletes an existing sala', async () => {
      const fakeSala = { id: { get: () => 'sala-1' }, softDelete: vi.fn() };
      const repo = mockSalaRepo({ findById: vi.fn().mockResolvedValue(fakeSala) });
      const uc = new DeleteSalaUseCase(repo);

      const result = await uc.execute('sala-1');
      expect(result.isOk()).toBe(true);
      expect(repo.softDelete).toHaveBeenCalledWith('sala-1');
    });

    it('returns NotFoundError for nonexistent sala', async () => {
      const repo = mockSalaRepo({ findById: vi.fn().mockResolvedValue(null) });
      const uc = new DeleteSalaUseCase(repo);

      const result = await uc.execute('nonexistent');
      expect(result.isErr()).toBe(true);
    });
  });
});
