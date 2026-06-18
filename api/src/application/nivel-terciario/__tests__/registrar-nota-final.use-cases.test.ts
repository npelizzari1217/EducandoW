import { describe, it, expect, vi } from 'vitest';
import {
  ActaExamen,
  NotaCursadaTerciario,
  InscripcionMateria,
  EstadoInscripcion,
  SlotCursadaTerciario,
  CondicionCursada,
  Id,
} from '@educandow/domain';
import type {
  ActaExamenRepository,
  InscripcionRepository,
  NotaCursadaTerciarioRepository,
} from '@educandow/domain';
import type { TenantTransactionRunner } from '../../../application/shared/ports/tenant-transaction-runner';
import { RegistrarNotaFinalUC, RegistrarPromocionalUC } from '../use-cases/acta-examen.use-cases';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeActa(materiaCarreraId = 'materia-1') {
  return ActaExamen.create({
    materiaCarreraId,
    fecha: new Date('2026-07-20'),
    presidenteId: 'teacher-1',
    vocales: ['teacher-2'],
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

function makeTpSlot(condicion: string): NotaCursadaTerciario {
  return NotaCursadaTerciario.create({
    inscripcionMateriaId: 'insc-1',
    slot: SlotCursadaTerciario.create('TP'),
    condicion: CondicionCursada.create(condicion),
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

function mockTxRunner(overrides: Partial<TenantTransactionRunner> = {}): TenantTransactionRunner {
  return {
    run: vi.fn().mockImplementation((work: () => Promise<unknown>) => work()),
    ...overrides,
  };
}

// ── RegistrarNotaFinalUC ─────────────────────────────────────────────────────

describe('RegistrarNotaFinalUC', () => {
  // ── Guard failures ──────────────────────────────────────────────────────────

  it('returns Err(NOT_FOUND) when acta does not exist', async () => {
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo(),
      mockInscRepo(),
      mockNotaCursadaRepo(),
      mockTxRunner(),
    );

    const result = await uc.execute('nonexistent', {
      studentId: 'student-1',
      nota: 5,
      condicion: 'DESAPROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('NOT_FOUND');
  });

  it('returns Err(NOT_FOUND) when inscripcion does not exist', async () => {
    const acta = makeActa();
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({ findById: vi.fn().mockResolvedValue(acta) }),
      mockInscRepo(),
      mockNotaCursadaRepo(),
      mockTxRunner(),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 5,
      condicion: 'DESAPROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('NOT_FOUND');
  });

  it('returns Err(CURSADA_NO_CONFIRMADA) when estado = INSCRIPTO', async () => {
    const acta = makeActa();
    const inscripcion = makeInscripcion('INSCRIPTO');
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({ findById: vi.fn().mockResolvedValue(acta) }),
      mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) }),
      mockNotaCursadaRepo(),
      mockTxRunner(),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 5,
      condicion: 'DESAPROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('CURSADA_NO_CONFIRMADA');
  });

  it('returns Err(CURSADA_NO_CONFIRMADA) when estado = CURSANDO', async () => {
    const acta = makeActa();
    const inscripcion = makeInscripcion('CURSANDO');
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({ findById: vi.fn().mockResolvedValue(acta) }),
      mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) }),
      mockNotaCursadaRepo(),
      mockTxRunner(),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 5,
      condicion: 'DESAPROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('CURSADA_NO_CONFIRMADA');
  });

  it('returns Err(ALUMNO_LIBRE_NO_PUEDE_RENDIR) when estado = LIBRE', async () => {
    const acta = makeActa();
    const inscripcion = makeInscripcion('LIBRE');
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({ findById: vi.fn().mockResolvedValue(acta) }),
      mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) }),
      mockNotaCursadaRepo(),
      mockTxRunner(),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 5,
      condicion: 'DESAPROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('ALUMNO_LIBRE_NO_PUEDE_RENDIR');
  });

  it('returns Err(TP_OBLIGATORIO_FALTANTE) when no TP slot', async () => {
    const acta = makeActa();
    const inscripcion = makeInscripcion('REGULAR');
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({ findById: vi.fn().mockResolvedValue(acta) }),
      mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) }),
      mockNotaCursadaRepo({ findSlot: vi.fn().mockResolvedValue(null) }),
      mockTxRunner(),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 5,
      condicion: 'DESAPROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('TP_OBLIGATORIO_FALTANTE');
  });

  it('returns Err(TP_OBLIGATORIO_FALTANTE) when TP slot condicion = AUSENTE', async () => {
    const acta = makeActa();
    const inscripcion = makeInscripcion('REGULAR');
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({ findById: vi.fn().mockResolvedValue(acta) }),
      mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) }),
      mockNotaCursadaRepo({ findSlot: vi.fn().mockResolvedValue(makeTpSlot('AUSENTE')) }),
      mockTxRunner(),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 0,
      condicion: 'AUSENTE',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('TP_OBLIGATORIO_FALTANTE');
  });

  it('returns Err(MAX_INTENTOS_ALCANZADO) when intentosPrevios = 3', async () => {
    const acta = makeActa();
    const inscripcion = makeInscripcion('REGULAR');
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({
        findById: vi.fn().mockResolvedValue(acta),
        countIntentosFinal: vi.fn().mockResolvedValue(3),
      }),
      mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) }),
      mockNotaCursadaRepo({ findSlot: vi.fn().mockResolvedValue(makeTpSlot('APROBADO')) }),
      mockTxRunner(),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 4,
      condicion: 'DESAPROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('MAX_INTENTOS_ALCANZADO');
  });

  // ── Success paths ───────────────────────────────────────────────────────────

  it('first attempt DESAPROBADO returns Ok({ libreTransicion: false })', async () => {
    const acta = makeActa();
    const inscripcion = makeInscripcion('REGULAR');
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({
        findById: vi.fn().mockResolvedValue(acta),
        countIntentosFinal: vi.fn().mockResolvedValue(0),
      }),
      mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) }),
      mockNotaCursadaRepo({ findSlot: vi.fn().mockResolvedValue(makeTpSlot('APROBADO')) }),
      mockTxRunner(),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 3,
      condicion: 'DESAPROBADO',
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().libreTransicion).toBe(false);
  });

  it('second attempt AUSENTE returns Ok({ libreTransicion: false })', async () => {
    const acta = makeActa();
    const inscripcion = makeInscripcion('REGULAR');
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({
        findById: vi.fn().mockResolvedValue(acta),
        countIntentosFinal: vi.fn().mockResolvedValue(1),
      }),
      mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) }),
      mockNotaCursadaRepo({ findSlot: vi.fn().mockResolvedValue(makeTpSlot('APROBADO')) }),
      mockTxRunner(),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 0,
      condicion: 'AUSENTE',
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().libreTransicion).toBe(false);
  });

  it('third attempt DESAPROBADO transitions to LIBRE', async () => {
    const acta = makeActa();
    const inscripcion = makeInscripcion('REGULAR');
    const txRunner = mockTxRunner();
    const inscRepo = mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) });

    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({
        findById: vi.fn().mockResolvedValue(acta),
        countIntentosFinal: vi.fn().mockResolvedValue(2),
      }),
      inscRepo,
      mockNotaCursadaRepo({ findSlot: vi.fn().mockResolvedValue(makeTpSlot('APROBADO')) }),
      txRunner,
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 2,
      condicion: 'DESAPROBADO',
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().libreTransicion).toBe(true);
    expect(txRunner.run).toHaveBeenCalledOnce();
    expect(inscRepo.save).toHaveBeenCalledOnce();
  });

  it('third attempt APROBADO does NOT trigger LIBRE', async () => {
    const acta = makeActa();
    const inscripcion = makeInscripcion('REGULAR');
    const inscRepo = mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) });

    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({
        findById: vi.fn().mockResolvedValue(acta),
        countIntentosFinal: vi.fn().mockResolvedValue(2),
      }),
      inscRepo,
      mockNotaCursadaRepo({ findSlot: vi.fn().mockResolvedValue(makeTpSlot('APROBADO')) }),
      mockTxRunner(),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 8,
      condicion: 'APROBADO',
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().libreTransicion).toBe(false);
    expect(inscRepo.save).not.toHaveBeenCalled();
  });
});

// ── RegistrarPromocionalUC ────────────────────────────────────────────────────

describe('RegistrarPromocionalUC', () => {
  it('returns Ok when estado = PROMOCIONAL, sets notaFinal and estado APROBADO [SUPUESTO]', async () => {
    const inscripcion = makeInscripcion('PROMOCIONAL');
    const inscRepo = mockInscRepo({
      findById: vi.fn().mockResolvedValue(inscripcion),
    });
    const uc = new RegistrarPromocionalUC(inscRepo);

    const result = await uc.execute('insc-1', { notaFinal: 9 });

    expect(result.isOk()).toBe(true);
    expect(inscRepo.save).toHaveBeenCalledOnce();
  });

  it('returns Err when estado != PROMOCIONAL [SUPUESTO]', async () => {
    const inscripcion = makeInscripcion('REGULAR');
    const inscRepo = mockInscRepo({
      findById: vi.fn().mockResolvedValue(inscripcion),
    });
    const uc = new RegistrarPromocionalUC(inscRepo);

    const result = await uc.execute('insc-1', { notaFinal: 9 });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('CURSADA_NO_CONFIRMADA');
  });
});
