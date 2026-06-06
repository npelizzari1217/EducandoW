import { describe, it, expect, vi } from 'vitest';
import { NotFoundError } from '@educandow/domain';
import { CreateInscripcionUC, UpdateInscripcionEstadoUC } from '../use-cases/inscripcion-materia.use-cases';
import type { InscripcionRepository } from '@educandow/domain';

function mockInscRepo(overrides: Partial<InscripcionRepository> = {}): InscripcionRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findByStudent: vi.fn().mockResolvedValue([]),
    findByMateriaCarrera: vi.fn().mockResolvedValue([]),
    findByStudentAndMateria: vi.fn().mockResolvedValue(null),
    findCorrelativas: vi.fn().mockResolvedValue([]),
    findAprobadas: vi.fn().mockResolvedValue([]),
    findRegulares: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Nivel Terciario — Use Cases', () => {
  // ── Spec Scenario: Enroll with prerequisites met ─────────────

  describe('CreateInscripcionUC', () => {
    it('enrolls a student when correlativas are met', async () => {
      const repo = mockInscRepo({
        findCorrelativas: vi.fn().mockResolvedValue([
          { id: 'corr-1', materiaId: 'm2', correlativaId: 'm1', tipo: 'FINAL' },
        ]),
        findAprobadas: vi.fn().mockResolvedValue(['m1']),
        findRegulares: vi.fn().mockResolvedValue(['m1']),
      });
      const uc = new CreateInscripcionUC(repo);

      const result = await uc.execute({
        studentId: 'student-1',
        materiaCarreraId: 'materia-analisis2',
        cuatrimestre: '1C',
        anioAcademico: '2026',
      });

      expect(result.isOk()).toBe(true);
      const insc = result.unwrap();
      expect(insc.studentId).toBe('student-1');
      expect(repo.save).toHaveBeenCalledOnce();
    });

    // ── Spec Scenario: Enroll with unmet prerequisites rejected ─

    it('rejects enrollment when FINAL correlativa not approved', async () => {
      const repo = mockInscRepo({
        findCorrelativas: vi.fn().mockResolvedValue([
          { id: 'corr-1', materiaId: 'm2', correlativaId: 'm1', tipo: 'FINAL' },
        ]),
        findAprobadas: vi.fn().mockResolvedValue([]),    // NOTHING approved
        findRegulares: vi.fn().mockResolvedValue([]),
      });
      const uc = new CreateInscripcionUC(repo);

      const result = await uc.execute({
        studentId: 'student-1',
        materiaCarreraId: 'materia-analisis2',
        cuatrimestre: '1C',
        anioAcademico: '2026',
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('Correlativa FINAL no cumplida');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('enrolls directly when no correlativas required', async () => {
      const repo = mockInscRepo({
        findCorrelativas: vi.fn().mockResolvedValue([]),
      });
      const uc = new CreateInscripcionUC(repo);

      const result = await uc.execute({
        studentId: 'student-1',
        materiaCarreraId: 'materia-intro',
        cuatrimestre: '1C',
        anioAcademico: '2026',
      });

      expect(result.isOk()).toBe(true);
      expect(repo.save).toHaveBeenCalledOnce();
    });
  });

  describe('UpdateInscripcionEstadoUC', () => {
    it('returns NotFoundError when inscripcion does not exist', async () => {
      const repo = mockInscRepo();
      const uc = new UpdateInscripcionEstadoUC(repo);

      const result = await uc.execute('nonexistent', { estado: 'APROBADO' });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
    });

    it('returns ValidationError for invalid estado', async () => {
      const repo = mockInscRepo({
        findById: vi.fn().mockResolvedValue({
          updateEstado: vi.fn(),
          updateNotas: vi.fn(),
        }),
      });
      const uc = new UpdateInscripcionEstadoUC(repo);

      const result = await uc.execute('insc-1', { estado: 'INVALIDO' });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('inválido');
    });
  });
});
