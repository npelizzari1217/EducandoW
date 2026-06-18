import { describe, it, expect, vi } from 'vitest';
import {
  NotaCursadaTerciario,
  SlotCursadaTerciario,
  CondicionCursada,
  EstadoInscripcion,
  InscripcionMateria,
  Id,
} from '@educandow/domain';
import type {
  NotaCursadaTerciarioRepository,
  InscripcionRepository,
} from '@educandow/domain';
import {
  CreateNotaCursadaSlotUC,
  UpdateNotaCursadaSlotUC,
  ListNotaCursadaSlotsUC,
  ConfirmarNotaCursadaUC,
} from '../use-cases/nota-cursada-terciario.use-cases';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeNota(slot: string, condicion: string): NotaCursadaTerciario {
  return NotaCursadaTerciario.create({
    inscripcionMateriaId: 'insc-1',
    slot: SlotCursadaTerciario.create(slot),
    condicion: CondicionCursada.create(condicion),
  });
}

function makeInscripcion(estado: string): InscripcionMateria {
  return InscripcionMateria.reconstruct({
    id: Id.reconstruct('insc-1'),
    studentId: 'student-1',
    materiaCarreraId: 'materia-1',
    cuatrimestre: '1C',
    anioAcademico: '2026',
    estado: EstadoInscripcion.create(estado),
  });
}

function mockNotaCursadaRepo(
  overrides: Partial<NotaCursadaTerciarioRepository> = {},
): NotaCursadaTerciarioRepository {
  return {
    findByInscripcion: vi.fn().mockResolvedValue([]),
    findSlot: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
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

// ── CreateNotaCursadaSlotUC ───────────────────────────────────────────────────

describe('CreateNotaCursadaSlotUC', () => {
  it('creates slot and returns Ok(NotaCursadaTerciario)', async () => {
    const repo = mockNotaCursadaRepo();
    const uc = new CreateNotaCursadaSlotUC(repo);

    const result = await uc.execute('insc-1', {
      slot: 'PARCIAL_1',
      condicion: 'APROBADO',
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBeInstanceOf(NotaCursadaTerciario);
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('returns Err(SLOT_ALREADY_EXISTS) for duplicate slot', async () => {
    const existingNota = makeNota('PARCIAL_1', 'APROBADO');
    const repo = mockNotaCursadaRepo({
      findByInscripcion: vi.fn().mockResolvedValue([existingNota]),
    });
    const uc = new CreateNotaCursadaSlotUC(repo);

    const result = await uc.execute('insc-1', {
      slot: 'PARCIAL_1',
      condicion: 'DESAPROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('SLOT_ALREADY_EXISTS');
  });

  it('returns Err(PREREQUISITE_SLOT_MISSING) for recuperatorio without parcial base', async () => {
    const repo = mockNotaCursadaRepo();
    const uc = new CreateNotaCursadaSlotUC(repo);

    const result = await uc.execute('insc-1', {
      slot: 'RECUPERATORIO_PARCIAL_1',
      condicion: 'APROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('PREREQUISITE_SLOT_MISSING');
  });

  it('returns Err(PARCIAL_YA_APROBADO) when recuperatorio and parcial base is APROBADO', async () => {
    const parcial = makeNota('PARCIAL_1', 'APROBADO');
    const repo = mockNotaCursadaRepo({
      findByInscripcion: vi.fn().mockResolvedValue([parcial]),
    });
    const uc = new CreateNotaCursadaSlotUC(repo);

    const result = await uc.execute('insc-1', {
      slot: 'RECUPERATORIO_PARCIAL_1',
      condicion: 'APROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('PARCIAL_YA_APROBADO');
  });

  it('returns Ok when recuperatorio and parcial base is DESAPROBADO', async () => {
    const parcial = makeNota('PARCIAL_1', 'DESAPROBADO');
    const repo = mockNotaCursadaRepo({
      findByInscripcion: vi.fn().mockResolvedValue([parcial]),
    });
    const uc = new CreateNotaCursadaSlotUC(repo);

    const result = await uc.execute('insc-1', {
      slot: 'RECUPERATORIO_PARCIAL_1',
      condicion: 'APROBADO',
    });

    expect(result.isOk()).toBe(true);
  });

  it('returns Ok when recuperatorio and parcial base is AUSENTE', async () => {
    const parcial = makeNota('PARCIAL_2', 'AUSENTE');
    const repo = mockNotaCursadaRepo({
      findByInscripcion: vi.fn().mockResolvedValue([parcial]),
    });
    const uc = new CreateNotaCursadaSlotUC(repo);

    const result = await uc.execute('insc-1', {
      slot: 'RECUPERATORIO_PARCIAL_2',
      condicion: 'APROBADO',
    });

    expect(result.isOk()).toBe(true);
  });
});

// ── UpdateNotaCursadaSlotUC ───────────────────────────────────────────────────

describe('UpdateNotaCursadaSlotUC', () => {
  it('returns Ok(updated entity) when slot exists', async () => {
    const existingNota = makeNota('PARCIAL_1', 'DESAPROBADO');
    const repo = mockNotaCursadaRepo({
      findSlot: vi.fn().mockResolvedValue(existingNota),
    });
    const uc = new UpdateNotaCursadaSlotUC(repo);

    const result = await uc.execute('insc-1', 'PARCIAL_1', {
      nota: 8,
      condicion: 'APROBADO',
    });

    expect(result.isOk()).toBe(true);
    expect(repo.update).toHaveBeenCalledOnce();
  });

  it('returns Err(NotFoundError) when slot not found', async () => {
    const repo = mockNotaCursadaRepo({
      findSlot: vi.fn().mockResolvedValue(null),
    });
    const uc = new UpdateNotaCursadaSlotUC(repo);

    const result = await uc.execute('insc-1', 'PARCIAL_1', { nota: 8, condicion: 'APROBADO' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('NOT_FOUND');
  });
});

// ── ListNotaCursadaSlotsUC ────────────────────────────────────────────────────

describe('ListNotaCursadaSlotsUC', () => {
  it('returns array (may be empty)', async () => {
    const repo = mockNotaCursadaRepo();
    const uc = new ListNotaCursadaSlotsUC(repo);

    const result = await uc.execute('insc-1');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('returns all slots for the inscripcion', async () => {
    const slots = [makeNota('PARCIAL_1', 'APROBADO'), makeNota('TP', 'APROBADO')];
    const repo = mockNotaCursadaRepo({
      findByInscripcion: vi.fn().mockResolvedValue(slots),
    });
    const uc = new ListNotaCursadaSlotsUC(repo);

    const result = await uc.execute('insc-1');

    expect(result).toHaveLength(2);
  });
});

// ── ConfirmarNotaCursadaUC ────────────────────────────────────────────────────

describe('ConfirmarNotaCursadaUC', () => {
  it('returns Ok when condicion = REGULAR and updates estado', async () => {
    const inscripcion = makeInscripcion('CURSANDO');
    const notaRepo = mockNotaCursadaRepo();
    const inscRepo = mockInscRepo({
      findById: vi.fn().mockResolvedValue(inscripcion),
    });
    const uc = new ConfirmarNotaCursadaUC(notaRepo, inscRepo);

    const result = await uc.execute('insc-1', { condicion: 'REGULAR', notaCursada: 7 });

    expect(result.isOk()).toBe(true);
    expect(inscRepo.save).toHaveBeenCalledOnce();
  });

  it('returns Ok when condicion = PROMOCIONAL and updates estado [SUPUESTO]', async () => {
    const inscripcion = makeInscripcion('CURSANDO');
    const notaRepo = mockNotaCursadaRepo();
    const inscRepo = mockInscRepo({
      findById: vi.fn().mockResolvedValue(inscripcion),
    });
    const uc = new ConfirmarNotaCursadaUC(notaRepo, inscRepo);

    const result = await uc.execute('insc-1', { condicion: 'PROMOCIONAL', notaCursada: 9 });

    expect(result.isOk()).toBe(true);
  });

  it('returns Err(CONDICION_INVALIDA) when condicion = APROBADO', async () => {
    const notaRepo = mockNotaCursadaRepo();
    const inscRepo = mockInscRepo();
    const uc = new ConfirmarNotaCursadaUC(notaRepo, inscRepo);

    const result = await uc.execute('insc-1', { condicion: 'APROBADO', notaCursada: 8 });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('CONDICION_INVALIDA');
  });

  it('returns Ok when condicion = LIBRE (allowed for secretaria)', async () => {
    const inscripcion = makeInscripcion('CURSANDO');
    const notaRepo = mockNotaCursadaRepo();
    const inscRepo = mockInscRepo({
      findById: vi.fn().mockResolvedValue(inscripcion),
    });
    const uc = new ConfirmarNotaCursadaUC(notaRepo, inscRepo);

    const result = await uc.execute('insc-1', { condicion: 'LIBRE' });

    expect(result.isOk()).toBe(true);
  });
});
