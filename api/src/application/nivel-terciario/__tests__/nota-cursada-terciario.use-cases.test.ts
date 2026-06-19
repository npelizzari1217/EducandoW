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
  TerciarioAuthorizerPort,
} from '@educandow/domain';
import {
  CreateNotaCursadaSlotUC,
  UpdateNotaCursadaSlotUC,
  ListNotaCursadaSlotsUC,
  ConfirmarNotaCursadaUC,
  ListInscripcionesDocenteUC,
} from '../use-cases/nota-cursada-terciario.use-cases';

// ── Factories ─────────────────────────────────────────────────────────────────

const TEACHER_USER = { userId: 'user-1', roles: ['TEACHER'] };

function mockAuthz(canWrite = true, allowedStudentIds: string[] | 'all' | null = 'all'): TerciarioAuthorizerPort {
  return {
    canWriteGrades: vi.fn().mockResolvedValue(canWrite),
    getAllowedStudentIds: vi.fn().mockResolvedValue(allowedStudentIds),
  };
}

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
    listByMateria: vi.fn().mockResolvedValue([]),
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
    const uc = new CreateNotaCursadaSlotUC(repo, mockAuthz(true));

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'insc-1', {
      slot: 'PARCIAL_1',
      condicion: 'APROBADO',
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBeInstanceOf(NotaCursadaTerciario);
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('returns Err(FORBIDDEN) when not assigned (SPEC-5.B)', async () => {
    const repo = mockNotaCursadaRepo();
    const uc = new CreateNotaCursadaSlotUC(repo, mockAuthz(false));

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'insc-1', {
      slot: 'PARCIAL_1',
      condicion: 'APROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('FORBIDDEN');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('Secretaría bypass: canWriteGrades=true → slot created (SPEC-5.E)', async () => {
    const repo = mockNotaCursadaRepo();
    const uc = new CreateNotaCursadaSlotUC(repo, mockAuthz(true));

    const result = await uc.execute('admin-1', ['SECRETARIO'], 'insc-1', {
      slot: 'PARCIAL_1',
      condicion: 'APROBADO',
    });

    expect(result.isOk()).toBe(true);
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('returns Err(SLOT_ALREADY_EXISTS) for duplicate slot', async () => {
    const existingNota = makeNota('PARCIAL_1', 'APROBADO');
    const repo = mockNotaCursadaRepo({
      findByInscripcion: vi.fn().mockResolvedValue([existingNota]),
    });
    const uc = new CreateNotaCursadaSlotUC(repo, mockAuthz(true));

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'insc-1', {
      slot: 'PARCIAL_1',
      condicion: 'DESAPROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('SLOT_ALREADY_EXISTS');
  });

  it('returns Err(PREREQUISITE_SLOT_MISSING) for recuperatorio without parcial base', async () => {
    const repo = mockNotaCursadaRepo();
    const uc = new CreateNotaCursadaSlotUC(repo, mockAuthz(true));

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'insc-1', {
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
    const uc = new CreateNotaCursadaSlotUC(repo, mockAuthz(true));

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'insc-1', {
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
    const uc = new CreateNotaCursadaSlotUC(repo, mockAuthz(true));

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'insc-1', {
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
    const uc = new CreateNotaCursadaSlotUC(repo, mockAuthz(true));

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'insc-1', {
      slot: 'RECUPERATORIO_PARCIAL_2',
      condicion: 'APROBADO',
    });

    expect(result.isOk()).toBe(true);
  });
});

// ── UpdateNotaCursadaSlotUC ───────────────────────────────────────────────────

describe('UpdateNotaCursadaSlotUC', () => {
  it('returns Ok(updated entity) when slot exists and assigned (SPEC-5.C)', async () => {
    const existingNota = makeNota('PARCIAL_1', 'DESAPROBADO');
    const repo = mockNotaCursadaRepo({
      findSlot: vi.fn().mockResolvedValue(existingNota),
    });
    const uc = new UpdateNotaCursadaSlotUC(repo, mockAuthz(true));

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'insc-1', 'PARCIAL_1', {
      nota: 8,
      condicion: 'APROBADO',
    });

    expect(result.isOk()).toBe(true);
    expect(repo.update).toHaveBeenCalledOnce();
  });

  it('returns Err(FORBIDDEN) when not assigned (SPEC-5.D)', async () => {
    const repo = mockNotaCursadaRepo();
    const uc = new UpdateNotaCursadaSlotUC(repo, mockAuthz(false));

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'insc-1', 'PARCIAL_1', {
      nota: 8,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('FORBIDDEN');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns Err(NotFoundError) when slot not found', async () => {
    const repo = mockNotaCursadaRepo({
      findSlot: vi.fn().mockResolvedValue(null),
    });
    const uc = new UpdateNotaCursadaSlotUC(repo, mockAuthz(true));

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'insc-1', 'PARCIAL_1', {
      nota: 8,
      condicion: 'APROBADO',
    });

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
  it('Assigned, condicion=REGULAR → ok (SPEC-6.A)', async () => {
    const inscripcion = makeInscripcion('CURSANDO');
    const inscRepo = mockInscRepo({
      findById: vi.fn().mockResolvedValue(inscripcion),
    });
    const uc = new ConfirmarNotaCursadaUC(inscRepo, mockAuthz(true));

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'insc-1', { condicion: 'REGULAR', notaCursada: 7 });

    expect(result.isOk()).toBe(true);
    expect(inscRepo.save).toHaveBeenCalledOnce();
  });

  it('Assigned, condicion=LIBRE → ok (SPEC-6.B)', async () => {
    const inscripcion = makeInscripcion('CURSANDO');
    const inscRepo = mockInscRepo({ findById: vi.fn().mockResolvedValue(inscripcion) });
    const uc = new ConfirmarNotaCursadaUC(inscRepo, mockAuthz(true));

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'insc-1', { condicion: 'LIBRE' });
    expect(result.isOk()).toBe(true);
  });

  it('Assigned, condicion=PROMOCIONAL → ok (SPEC-6.C)', async () => {
    const inscripcion = makeInscripcion('CURSANDO');
    const inscRepo = mockInscRepo({ findById: vi.fn().mockResolvedValue(inscripcion) });
    const uc = new ConfirmarNotaCursadaUC(inscRepo, mockAuthz(true));

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'insc-1', { condicion: 'PROMOCIONAL', notaCursada: 9 });
    expect(result.isOk()).toBe(true);
  });

  it('Non-assigned → Err(FORBIDDEN) (SPEC-6.D)', async () => {
    const inscRepo = mockInscRepo();
    const uc = new ConfirmarNotaCursadaUC(inscRepo, mockAuthz(false));

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'insc-1', { condicion: 'REGULAR' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('FORBIDDEN');
    expect(inscRepo.save).not.toHaveBeenCalled();
  });

  it('Secretaría bypass → ok (SPEC-6.E)', async () => {
    const inscripcion = makeInscripcion('CURSANDO');
    const inscRepo = mockInscRepo({ findById: vi.fn().mockResolvedValue(inscripcion) });
    const uc = new ConfirmarNotaCursadaUC(inscRepo, mockAuthz(true));

    const result = await uc.execute('admin-1', ['SECRETARIO'], 'insc-1', { condicion: 'REGULAR' });
    expect(result.isOk()).toBe(true);
  });

  it('returns Err(CONDICION_INVALIDA) when condicion = APROBADO', async () => {
    const inscRepo = mockInscRepo();
    const uc = new ConfirmarNotaCursadaUC(inscRepo, mockAuthz(true));

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'insc-1', { condicion: 'APROBADO', notaCursada: 8 });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('CONDICION_INVALIDA');
  });
});

// ── ListInscripcionesDocenteUC ────────────────────────────────────────────────

describe('ListInscripcionesDocenteUC', () => {
  const insc1 = makeInscripcion('CURSANDO');
  const insc2 = InscripcionMateria.reconstruct({
    id: Id.reconstruct('insc-2'),
    studentId: 's2',
    materiaCarreraId: 'materia-1',
    cuatrimestre: '1C',
    anioAcademico: '2026',
    estado: EstadoInscripcion.create('CURSANDO'),
  });

  it('getAllowedStudentIds="all" → returns full list (SPEC-7.C)', async () => {
    const inscRepo = mockInscRepo({ listByMateria: vi.fn().mockResolvedValue([insc1, insc2]) });
    const authz = mockAuthz(true, 'all');
    const uc = new ListInscripcionesDocenteUC(authz, inscRepo);

    const result = await uc.execute('admin-1', ['SECRETARIO'], 'materia-1', '2026');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(2);
  });

  it('getAllowedStudentIds=["s1"] → filters list to matching studentIds (SPEC-7.A)', async () => {
    const inscRepo = mockInscRepo({ listByMateria: vi.fn().mockResolvedValue([insc1, insc2]) });
    const authz = mockAuthz(true, ['student-1']);
    const uc = new ListInscripcionesDocenteUC(authz, inscRepo);

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'materia-1', '2026');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(1);
    expect(result.unwrap()[0].studentId).toBe('student-1');
  });

  it('getAllowedStudentIds=null → returns Err(FORBIDDEN) (SPEC-7.B)', async () => {
    const inscRepo = mockInscRepo();
    const authz = mockAuthz(true, null);
    const uc = new ListInscripcionesDocenteUC(authz, inscRepo);

    const result = await uc.execute(TEACHER_USER.userId, TEACHER_USER.roles, 'materia-1', '2026');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('FORBIDDEN');
  });
});
