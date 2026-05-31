import { describe, it, expect, vi } from 'vitest';
import { NotFoundError } from '@educandow/domain';
import {
  CreateMesaExamenUseCase,
  InscribirAlumnoUseCase,
  GetMesaExamenUseCase,
} from '../use-cases/mesa-examen.use-cases';
import type { MesaExamenRepository } from '@educandow/domain';

function mockMesaRepo(overrides: Partial<MesaExamenRepository> = {}): MesaExamenRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    saveInscripcion: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Nivel Secundario — Use Cases', () => {
  // ── Spec Scenario: Create exam board ─────────────────────────

  describe('CreateMesaExamenUseCase', () => {
    it('creates a mesa de examen with valid input', async () => {
      const repo = mockMesaRepo();
      const uc = new CreateMesaExamenUseCase(repo);

      const result = await uc.execute({
        subjectId: 'subject-math',
        fecha: new Date('2026-12-15'),
        turno: 'DICIEMBRE',
        presidenteId: 'teacher-1',
      });

      expect(result.isOk()).toBe(true);
      const mesa = result.unwrap();
      expect(mesa.subjectId).toBe('subject-math');
      expect(mesa.turno.get()).toBe('DICIEMBRE');
      expect(repo.save).toHaveBeenCalledOnce();
    });

    it('returns ValidationError for invalid turno', async () => {
      const repo = mockMesaRepo();
      const uc = new CreateMesaExamenUseCase(repo);

      const result = await uc.execute({
        subjectId: 's-1',
        fecha: new Date(),
        turno: 'MARZO',
        presidenteId: 't-1',
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('Turno inválido');
    });
  });

  // ── Spec Scenario: Inscribir alumno en mesa ──────────────────

  describe('InscribirAlumnoUseCase', () => {
    it('inscribes a student in a mesa', async () => {
      const fakeMesa = { inscripciones: [] };
      const repo = mockMesaRepo({ findById: vi.fn().mockResolvedValue(fakeMesa) });
      const uc = new InscribirAlumnoUseCase(repo);

      const result = await uc.execute('mesa-1', { studentId: 'student-1' });

      expect(result.isOk()).toBe(true);
      expect(repo.saveInscripcion).toHaveBeenCalledWith('mesa-1', 'student-1');
    });

    it('returns ValidationError for duplicate inscription', async () => {
      const fakeMesa = {
        inscripciones: [{ studentId: 'student-1' }],
      };
      const repo = mockMesaRepo({ findById: vi.fn().mockResolvedValue(fakeMesa) });
      const uc = new InscribirAlumnoUseCase(repo);

      const result = await uc.execute('mesa-1', { studentId: 'student-1' });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('ya está inscripto');
    });

    it('returns NotFoundError when mesa does not exist', async () => {
      const repo = mockMesaRepo();
      const uc = new InscribirAlumnoUseCase(repo);

      const result = await uc.execute('nonexistent', { studentId: 's-1' });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
    });
  });

  describe('GetMesaExamenUseCase', () => {
    it('returns NotFoundError when mesa not found', async () => {
      const repo = mockMesaRepo();
      const uc = new GetMesaExamenUseCase(repo);

      const result = await uc.execute('nonexistent');
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
    });
  });
});
