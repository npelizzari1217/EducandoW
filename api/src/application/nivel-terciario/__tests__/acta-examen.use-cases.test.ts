import { describe, it, expect, vi } from 'vitest';
import { ActaExamen, NotFoundError, ValidationError } from '@educandow/domain';
import { RegistrarNotaUC } from '../use-cases/acta-examen.use-cases';
import type { ActaExamenRepository, InscripcionRepository } from '@educandow/domain';

// ── Factories ──────────────────────────────────────────────────────────────

function makeActa(materiaCarreraId = 'materia-1') {
  return ActaExamen.create({
    materiaCarreraId,
    fecha: new Date('2026-07-20'),
    presidenteId: 'teacher-1',
    vocales: ['teacher-2'],
  });
}

function mockActaRepo(overrides: Partial<ActaExamenRepository> = {}): ActaExamenRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByMateriaCarrera: vi.fn().mockResolvedValue([]),
    findAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    saveNota: vi.fn().mockResolvedValue(undefined),
    countIntentosFinal: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function mockInscRepo(overrides: Partial<InscripcionRepository> = {}): InscripcionRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByStudent: vi.fn().mockResolvedValue([]),
    findByMateriaCarrera: vi.fn().mockResolvedValue([]),
    findCorrelativas: vi.fn().mockResolvedValue([]),
    findAprobadas: vi.fn().mockResolvedValue([]),
    findRegulares: vi.fn().mockResolvedValue([]),
    findByStudentAndMateria: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Nivel Terciario — RegistrarNotaUC', () => {
  // ── Spec Scenario: Acta not found ─────────────────────────────────────

  it('returns NotFoundError when acta does not exist', async () => {
    const actaRepo = mockActaRepo({ findById: vi.fn().mockResolvedValue(null) });
    const inscRepo = mockInscRepo();
    const uc = new RegistrarNotaUC(actaRepo, inscRepo);

    const result = await uc.execute('nonexistent-acta', {
      studentId: 'student-1',
      nota: 8,
      condicion: 'APROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  // ── Spec Scenario: Invalid condicion ──────────────────────────────────

  it('returns ValidationError for invalid condicion', async () => {
    const acta = makeActa();
    const actaRepo = mockActaRepo({ findById: vi.fn().mockResolvedValue(acta) });
    const inscRepo = mockInscRepo();
    const uc = new RegistrarNotaUC(actaRepo, inscRepo);

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 8,
      condicion: 'INVALIDO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });

  // ── Spec Scenario: Reprobado does not change InscripcionMateria ────────

  it('records nota but does NOT update InscripcionMateria when condicion != APROBADO', async () => {
    const acta = makeActa('materia-analisis1');
    const actaRepo = mockActaRepo({ findById: vi.fn().mockResolvedValue(acta) });
    const inscRepo = mockInscRepo();
    const uc = new RegistrarNotaUC(actaRepo, inscRepo);

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 3,
      condicion: 'DESAPROBADO',
    });

    expect(result.isOk()).toBe(true);
    expect(actaRepo.saveNota).toHaveBeenCalledOnce();
    expect(inscRepo.findByStudentAndMateria).not.toHaveBeenCalled();
  });

  // ── Spec Scenario: APROBADO updates InscripcionMateria.estado ─────────

  it('updates InscripcionMateria.estado to APROBADO when condicion = APROBADO', async () => {
    const acta = makeActa('materia-analisis1');

    // Mock an existing InscripcionMateria domain object
    const mockInscripcion = {
      id: { get: () => 'insc-1' },
      studentId: 'student-1',
      materiaCarreraId: 'materia-analisis1',
      cuatrimestre: '1C',
      anioAcademico: '2026',
      estado: { get: () => 'CURSANDO' },
      updateEstado: vi.fn(),
      updateNotas: vi.fn(),
    };

    const actaRepo = mockActaRepo({ findById: vi.fn().mockResolvedValue(acta) });
    const inscRepo = mockInscRepo({
      findByStudentAndMateria: vi.fn().mockResolvedValue(mockInscripcion),
    });
    const uc = new RegistrarNotaUC(actaRepo, inscRepo);

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 8,
      condicion: 'APROBADO',
    });

    expect(result.isOk()).toBe(true);
    expect(actaRepo.saveNota).toHaveBeenCalledOnce();
    expect(inscRepo.findByStudentAndMateria).toHaveBeenCalledWith('student-1', 'materia-analisis1');
    expect(mockInscripcion.updateEstado).toHaveBeenCalledOnce();
    expect(inscRepo.save).toHaveBeenCalledOnce();
  });

  // ── Spec Scenario: No InscripcionMateria → 422 ────────────────────────

  it('returns ValidationError (422-equiv) when no InscripcionMateria exists for APROBADO', async () => {
    const acta = makeActa('materia-analisis1');
    const actaRepo = mockActaRepo({ findById: vi.fn().mockResolvedValue(acta) });
    const inscRepo = mockInscRepo({
      findByStudentAndMateria: vi.fn().mockResolvedValue(null),
    });
    const uc = new RegistrarNotaUC(actaRepo, inscRepo);

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 8,
      condicion: 'APROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(result.unwrapErr().message).toContain('Inscripción no encontrada');
  });
});
