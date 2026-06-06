import { describe, it, expect, vi } from 'vitest';
import { ValidationError } from '@educandow/domain';
import type { CalificacionSecundarioRepository, PendingExamDetail } from '@educandow/domain';
import {
  ConsultarAlumnosExamenUseCase,
} from '../use-cases/calificacion-secundario.use-cases';

// ── Factories ──────────────────────────────────────────────────────────────

function makePendingExamDetail(overrides: Partial<PendingExamDetail> = {}): PendingExamDetail {
  return {
    id: 'cal-1',
    studentId: 'student-1',
    studentName: 'Juan Pérez',
    cursoId: 'curso-1',
    cursoName: '1° A',
    subjectId: 'subject-1',
    subjectName: 'Matemática',
    trimestre: '1T',
    nota: 4,
    condicion: 'PREVIA',
    notaDiciembre: null,
    notaFebrero: null,
    definitiva: null,
    ...overrides,
  };
}

function mockRepo(overrides: Partial<CalificacionSecundarioRepository> = {}): CalificacionSecundarioRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByCurso: vi.fn().mockResolvedValue([]),
    findByStudent: vi.fn().mockResolvedValue([]),
    findPendingExams: vi.fn().mockResolvedValue([]),
    findPendingExamsWithDetails: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── ConsultarAlumnosExamenUseCase ──────────────────────────────────────────

describe('ConsultarAlumnosExamenUseCase', () => {
  it('returns ValidationError for invalid turno', async () => {
    const repo = mockRepo();
    const uc = new ConsultarAlumnosExamenUseCase(repo);

    const result = await uc.execute({ turno: 'INVALIDO', academicYear: '2026' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });

  it('returns ValidationError when academicYear is empty', async () => {
    const repo = mockRepo();
    const uc = new ConsultarAlumnosExamenUseCase(repo);

    const result = await uc.execute({ turno: 'DICIEMBRE', academicYear: '' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });

  it('returns enriched PendingExamDetail list from repository', async () => {
    const detail = makePendingExamDetail({ studentName: 'Ana García', subjectName: 'Historia' });
    const repo = mockRepo({
      findPendingExamsWithDetails: vi.fn().mockResolvedValue([detail]),
    });
    const uc = new ConsultarAlumnosExamenUseCase(repo);

    const result = await uc.execute({ turno: 'FEBRERO', academicYear: '2026' });

    expect(result.isOk()).toBe(true);
    const list = result.unwrap();
    expect(list).toHaveLength(1);
    expect(list[0].studentName).toBe('Ana García');
    expect(list[0].subjectName).toBe('Historia');
    expect(list[0].cursoName).toBe('1° A');
  });

  it('calls findPendingExamsWithDetails with correct turno and academicYear', async () => {
    const repo = mockRepo({
      findPendingExamsWithDetails: vi.fn().mockResolvedValue([]),
    });
    const uc = new ConsultarAlumnosExamenUseCase(repo);

    await uc.execute({ turno: 'DICIEMBRE', academicYear: '2025' });

    expect(repo.findPendingExamsWithDetails).toHaveBeenCalledWith('DICIEMBRE', '2025');
  });

  it('returns empty list when no pending exams exist', async () => {
    const repo = mockRepo({
      findPendingExamsWithDetails: vi.fn().mockResolvedValue([]),
    });
    const uc = new ConsultarAlumnosExamenUseCase(repo);

    const result = await uc.execute({ turno: 'FEBRERO', academicYear: '2026' });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(0);
  });
});
