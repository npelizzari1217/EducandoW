import { describe, it, expect, vi } from 'vitest';
import {
  InscripcionMateria,
  EstadoInscripcion,
  Id,
} from '@educandow/domain';
import type { InscripcionRepository } from '@educandow/domain';
import { ConfirmarNotaCursadaUC } from '../use-cases/nota-cursada-terciario.use-cases';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeInscripcion(estado: string, fechaRegularidad?: Date): InscripcionMateria {
  return InscripcionMateria.reconstruct({
    id: Id.reconstruct('insc-1'),
    studentId: 'student-1',
    materiaCarreraId: 'materia-1',
    cuatrimestre: '1C',
    anioAcademico: '2026',
    estado: EstadoInscripcion.create(estado),
    fechaRegularidad,
  });
}

function mockInscRepo(
  inscripcion: InscripcionMateria | null = null,
): InscripcionRepository {
  return {
    findById: vi.fn().mockResolvedValue(inscripcion),
    findByStudent: vi.fn().mockResolvedValue([]),
    findByMateriaCarrera: vi.fn().mockResolvedValue([]),
    findCorrelativas: vi.fn().mockResolvedValue([]),
    findAprobadas: vi.fn().mockResolvedValue([]),
    findRegulares: vi.fn().mockResolvedValue([]),
    findByStudentAndMateria: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ConfirmarNotaCursadaUC — fechaRegularidad behavior (FR-2.1–FR-2.4)', () => {
  it('Scenario A: condicion=REGULAR + fechaRegularidad null → setFechaRegularidad called with Date, inscripcion saved', async () => {
    const inscripcion = makeInscripcion('CURSANDO');
    const setFechaRegularidadSpy = vi.spyOn(inscripcion, 'setFechaRegularidad');
    const repo = mockInscRepo(inscripcion);
    const uc = new ConfirmarNotaCursadaUC(repo);

    const result = await uc.execute('insc-1', { condicion: 'REGULAR' });

    expect(result.isOk()).toBe(true);
    expect(setFechaRegularidadSpy).toHaveBeenCalledOnce();
    expect(setFechaRegularidadSpy).toHaveBeenCalledWith(expect.any(Date));
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('Scenario B: condicion=REGULAR + fechaRegularidad already set → setFechaRegularidad called but entity no-op keeps original', async () => {
    const originalDate = new Date('2026-01-15');
    const inscripcion = makeInscripcion('REGULAR', originalDate);
    const setFechaRegularidadSpy = vi.spyOn(inscripcion, 'setFechaRegularidad');
    const repo = mockInscRepo(inscripcion);
    const uc = new ConfirmarNotaCursadaUC(repo);

    const result = await uc.execute('insc-1', { condicion: 'REGULAR' });

    expect(result.isOk()).toBe(true);
    expect(setFechaRegularidadSpy).toHaveBeenCalledOnce();
    // Entity no-op: value should still be the original date
    expect(inscripcion.fechaRegularidad).toEqual(originalDate);
  });

  it('Scenario C: condicion=LIBRE → fechaRegularidad remains null, setFechaRegularidad NOT called (FR-2.3)', async () => {
    const inscripcion = makeInscripcion('CURSANDO');
    const setFechaRegularidadSpy = vi.spyOn(inscripcion, 'setFechaRegularidad');
    const repo = mockInscRepo(inscripcion);
    const uc = new ConfirmarNotaCursadaUC(repo);

    const result = await uc.execute('insc-1', { condicion: 'LIBRE' });

    expect(result.isOk()).toBe(true);
    expect(setFechaRegularidadSpy).not.toHaveBeenCalled();
    expect(inscripcion.fechaRegularidad).toBeUndefined();
  });

  it('condicion=PROMOCIONAL → fechaRegularidad remains null, setFechaRegularidad NOT called (FR-2.3)', async () => {
    const inscripcion = makeInscripcion('CURSANDO');
    const setFechaRegularidadSpy = vi.spyOn(inscripcion, 'setFechaRegularidad');
    const repo = mockInscRepo(inscripcion);
    const uc = new ConfirmarNotaCursadaUC(repo);

    const result = await uc.execute('insc-1', { condicion: 'PROMOCIONAL' });

    expect(result.isOk()).toBe(true);
    expect(setFechaRegularidadSpy).not.toHaveBeenCalled();
    expect(inscripcion.fechaRegularidad).toBeUndefined();
  });
});
