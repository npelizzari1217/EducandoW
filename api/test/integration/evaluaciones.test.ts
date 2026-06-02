import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateEvaluacionUC,
  ListEvaluacionesUC,
  DeleteEvaluacionUC,
  CreateNotaUC,
  ListNotasUC,
  DeleteNotaUC,
  CreatePeriodoUC,
  ListPeriodosUC,
  DeletePeriodoUC,
  CreateNotaTrimestralUC,
  ListNotasTrimestralesUC,
  DeleteNotaTrimestralUC,
} from '../../src/application/pedagogy/use-cases/pedagogy.use-cases';
import type {
  EvaluacionRepository,
  NotaRepository,
  PeriodoEvaluacionRepository,
  NotaTrimestralRepository,
} from '@educandow/domain';

describe('Evaluation Use Cases — Integration', () => {
  // ── Evaluaciones ──────────────────────────────

  describe('CreateEvaluacionUC', () => {
    let useCase: CreateEvaluacionUC;
    let repo: EvaluacionRepository;

    beforeEach(() => {
      repo = { save: vi.fn(), findByAssignment: vi.fn(), findById: vi.fn(), delete: vi.fn() };
      useCase = new CreateEvaluacionUC(repo);
    });

    it('creates evaluacion with assignmentId, title, and date', async () => {
      const result = await useCase.execute({
        assignmentId: 'ass-1',
        title: 'Examen Parcial',
        evaluationDate: '2026-06-15T10:00:00Z',
        weight: 1,
      });

      expect(result.isOk()).toBe(true);
      expect(repo.save).toHaveBeenCalled();
      const saved = vi.mocked(repo.save).mock.calls[0][0];
      expect(saved.title).toBe('Examen Parcial');
    });

    it('defaults weight to 1', async () => {
      const result = await useCase.execute({
        assignmentId: 'ass-2',
        title: 'TP N°1',
        evaluationDate: '2026-07-01T08:00:00Z',
      });

      expect(result.isOk()).toBe(true);
      const saved = vi.mocked(repo.save).mock.calls[0][0];
      expect(saved.weight).toBe(1);
    });
  });

  describe('ListEvaluacionesUC', () => {
    let useCase: ListEvaluacionesUC;
    let repo: EvaluacionRepository;

    beforeEach(() => {
      repo = { save: vi.fn(), findByAssignment: vi.fn(), findById: vi.fn(), delete: vi.fn() };
      useCase = new ListEvaluacionesUC(repo);
    });

    it('returns evaluaciones for given assignment', async () => {
      vi.mocked(repo.findByAssignment).mockResolvedValue([]);

      const result = await useCase.execute('ass-1');
      expect(result).toEqual([]);
      expect(repo.findByAssignment).toHaveBeenCalledWith('ass-1');
    });
  });

  describe('DeleteEvaluacionUC', () => {
    let useCase: DeleteEvaluacionUC;
    let repo: EvaluacionRepository;

    beforeEach(() => {
      repo = { save: vi.fn(), findByAssignment: vi.fn(), findById: vi.fn(), delete: vi.fn() };
      useCase = new DeleteEvaluacionUC(repo);
    });

    it('deletes evaluacion by id', async () => {
      await useCase.execute('ev-1');
      expect(repo.delete).toHaveBeenCalledWith('ev-1');
    });
  });

  // ── Notas ────────────────────────────────────

  describe('CreateNotaUC', () => {
    let useCase: CreateNotaUC;
    let repo: NotaRepository;

    beforeEach(() => {
      repo = { save: vi.fn(), findByEvaluation: vi.fn(), findByStudent: vi.fn(), findById: vi.fn(), delete: vi.fn() };
      useCase = new CreateNotaUC(repo);
    });

    it('creates nota with numeric value', async () => {
      const result = await useCase.execute({
        evaluationId: 'ev-1',
        studentId: 's-alice',
        numericValue: 8,
      });

      expect(result.isOk()).toBe(true);
      expect(repo.save).toHaveBeenCalled();
    });

    it('creates nota with qualitative value', async () => {
      const result = await useCase.execute({
        evaluationId: 'ev-2',
        studentId: 's-bob',
        qualitativeValue: 'Excelente',
      });

      expect(result.isOk()).toBe(true);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('ListNotasUC', () => {
    let useCase: ListNotasUC;
    let repo: NotaRepository;

    beforeEach(() => {
      repo = { save: vi.fn(), findByEvaluation: vi.fn(), findByStudent: vi.fn(), findById: vi.fn(), delete: vi.fn() };
      useCase = new ListNotasUC(repo);
    });

    it('lists notas by evaluation', async () => {
      vi.mocked(repo.findByEvaluation).mockResolvedValue([]);
      const result = await useCase.executeByEvaluation('ev-1');
      expect(result).toEqual([]);
    });

    it('lists notas by student', async () => {
      vi.mocked(repo.findByStudent).mockResolvedValue([]);
      const result = await useCase.executeByStudent('s-alice');
      expect(result).toEqual([]);
    });
  });

  // ── Periodos ─────────────────────────────────

  describe('CreatePeriodoUC', () => {
    let useCase: CreatePeriodoUC;
    let repo: PeriodoEvaluacionRepository;

    beforeEach(() => {
      repo = { save: vi.fn(), findByAcademicYear: vi.fn(), findById: vi.fn(), delete: vi.fn() };
      useCase = new CreatePeriodoUC(repo);
    });

    it('creates evaluation period', async () => {
      const result = await useCase.execute({
        academicYear: '2026',
        name: 'Primer Trimestre',
        startDate: '2026-03-01T00:00:00Z',
        endDate: '2026-05-31T23:59:59Z',
      });

      expect(result.isOk()).toBe(true);
      expect(repo.save).toHaveBeenCalled();
      const saved = vi.mocked(repo.save).mock.calls[0][0];
      expect(saved.name).toBe('Primer Trimestre');
      expect(saved.academicYear).toBe('2026');
    });
  });

  describe('ListPeriodosUC', () => {
    let useCase: ListPeriodosUC;
    let repo: PeriodoEvaluacionRepository;

    beforeEach(() => {
      repo = { save: vi.fn(), findByAcademicYear: vi.fn(), findById: vi.fn(), delete: vi.fn() };
      useCase = new ListPeriodosUC(repo);
    });

    it('lists periodos by academic year', async () => {
      vi.mocked(repo.findByAcademicYear).mockResolvedValue([]);
      const result = await useCase.execute('2026');
      expect(result).toEqual([]);
    });
  });

  describe('DeletePeriodoUC', () => {
    let useCase: DeletePeriodoUC;
    let repo: PeriodoEvaluacionRepository;

    beforeEach(() => {
      repo = { save: vi.fn(), findByAcademicYear: vi.fn(), findById: vi.fn(), delete: vi.fn() };
      useCase = new DeletePeriodoUC(repo);
    });

    it('deletes periodo by id', async () => {
      await useCase.execute('p1');
      expect(repo.delete).toHaveBeenCalledWith('p1');
    });
  });

  // ── Notas Trimestrales ──────────────────────

  describe('CreateNotaTrimestralUC', () => {
    let useCase: CreateNotaTrimestralUC;
    let repo: NotaTrimestralRepository;

    beforeEach(() => {
      repo = { save: vi.fn(), findByStudentAndPeriod: vi.fn(), findById: vi.fn(), delete: vi.fn() };
      useCase = new CreateNotaTrimestralUC(repo);
    });

    it('creates consolidated grade for student+assignment+period', async () => {
      const result = await useCase.execute({
        studentId: 's-alice',
        assignmentId: 'ass-1',
        periodId: 'p1',
        finalGrade: 7.5,
      });

      expect(result.isOk()).toBe(true);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('ListNotasTrimestralesUC', () => {
    let useCase: ListNotasTrimestralesUC;
    let repo: NotaTrimestralRepository;

    beforeEach(() => {
      repo = { save: vi.fn(), findByStudentAndPeriod: vi.fn(), findById: vi.fn(), delete: vi.fn() };
      useCase = new ListNotasTrimestralesUC(repo);
    });

    it('lists consolidated grades by student and period', async () => {
      vi.mocked(repo.findByStudentAndPeriod).mockResolvedValue([]);
      const result = await useCase.execute('s-alice', 'p1');
      expect(result).toEqual([]);
    });
  });
});
