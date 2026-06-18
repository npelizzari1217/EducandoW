import { describe, it, expect, vi } from 'vitest';
import {
  ActaExamen,
  Carrera,
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
  LlamadoExamenRepository,
  CarreraRepository,
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

function makeCarrera(llamadosVencimiento = 5): Carrera {
  return Carrera.reconstruct({
    id: Id.reconstruct('carrera-1'),
    name: 'Profesorado',
    titulo: 'Profesor',
    duracion: 4,
    active: true,
    llamadosVencimiento,
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

function mockLlamadoExamenRepo(
  llamadosCount = 0,
  overrides: Partial<LlamadoExamenRepository> = {},
): LlamadoExamenRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByAnioAcademico: vi.fn().mockResolvedValue([]),
    findOverlapping: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    countAfter: vi.fn().mockResolvedValue(llamadosCount),
    ...overrides,
  };
}

function mockCarreraRepo(
  carrera: Carrera | null = null,
  overrides: Partial<CarreraRepository> = {},
): CarreraRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    findByMateriaCarreraId: vi.fn().mockResolvedValue(carrera),
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
      mockLlamadoExamenRepo(),
      mockCarreraRepo(makeCarrera()),
    );

    const result = await uc.execute('nonexistent', {
      studentId: 'student-1',
      nota: 5,
      condicion: 'DESAPROBADO',
      intento: 1,
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
      mockLlamadoExamenRepo(),
      mockCarreraRepo(makeCarrera()),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 5,
      condicion: 'DESAPROBADO',
      intento: 1,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('NOT_FOUND');
  });

  it('returns Err(NOT_FOUND) when carreraRepo.findByMateriaCarreraId returns null (T-19)', async () => {
    const acta = makeActa();
    const inscripcion = makeInscripcion('REGULAR');
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({ findById: vi.fn().mockResolvedValue(acta) }),
      mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) }),
      mockNotaCursadaRepo({ findSlot: vi.fn().mockResolvedValue(makeTpSlot('APROBADO')) }),
      mockTxRunner(),
      mockLlamadoExamenRepo(),
      mockCarreraRepo(null),  // carrera not found
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 5,
      condicion: 'DESAPROBADO',
      intento: 1,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('NOT_FOUND');
  });

  // T27 — intento range validation (spec: MUST reject intento outside [1,3])
  it('returns Err(INVALID_INTENTO) when intento = 0', async () => {
    const acta = makeActa();
    const inscripcion = makeInscripcion('REGULAR');
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({ findById: vi.fn().mockResolvedValue(acta) }),
      mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) }),
      mockNotaCursadaRepo({ findSlot: vi.fn().mockResolvedValue(makeTpSlot('APROBADO')) }),
      mockTxRunner(),
      mockLlamadoExamenRepo(),
      mockCarreraRepo(makeCarrera()),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 5,
      condicion: 'DESAPROBADO',
      intento: 0,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('INVALID_INTENTO');
  });

  it('returns Err(INVALID_INTENTO) when intento = 4', async () => {
    const acta = makeActa();
    const inscripcion = makeInscripcion('REGULAR');
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({ findById: vi.fn().mockResolvedValue(acta) }),
      mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) }),
      mockNotaCursadaRepo({ findSlot: vi.fn().mockResolvedValue(makeTpSlot('APROBADO')) }),
      mockTxRunner(),
      mockLlamadoExamenRepo(),
      mockCarreraRepo(makeCarrera()),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 5,
      condicion: 'DESAPROBADO',
      intento: 4,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('INVALID_INTENTO');
  });

  it('returns Err(CURSADA_NO_CONFIRMADA) when estado = INSCRIPTO', async () => {
    const acta = makeActa();
    const inscripcion = makeInscripcion('INSCRIPTO');
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({ findById: vi.fn().mockResolvedValue(acta) }),
      mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) }),
      mockNotaCursadaRepo(),
      mockTxRunner(),
      mockLlamadoExamenRepo(),
      mockCarreraRepo(makeCarrera()),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 5,
      condicion: 'DESAPROBADO',
      intento: 1,
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
      mockLlamadoExamenRepo(),
      mockCarreraRepo(makeCarrera()),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 5,
      condicion: 'DESAPROBADO',
      intento: 1,
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
      mockLlamadoExamenRepo(),
      mockCarreraRepo(makeCarrera()),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 5,
      condicion: 'DESAPROBADO',
      intento: 1,
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
      mockLlamadoExamenRepo(0),  // 0 llamados → not expired
      mockCarreraRepo(makeCarrera()),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 5,
      condicion: 'DESAPROBADO',
      intento: 1,
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
      mockLlamadoExamenRepo(0),
      mockCarreraRepo(makeCarrera()),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 0,
      condicion: 'AUSENTE',
      intento: 1,
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
      mockLlamadoExamenRepo(0),
      mockCarreraRepo(makeCarrera()),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 4,
      condicion: 'DESAPROBADO',
      intento: 1,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('MAX_INTENTOS_ALCANZADO');
  });

  // ── Expiry path tests (T-19) ────────────────────────────────────────────────

  it('T-19 Scenario H: fechaRegularidad=T0, llamadosTranscurridos=3 >= llamadosVencimiento=3 → REGULARIDAD_VENCIDA', async () => {
    const acta = makeActa();
    const T0 = new Date('2026-01-01');
    const inscripcion = makeInscripcion('REGULAR', T0);
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({ findById: vi.fn().mockResolvedValue(acta) }),
      mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) }),
      mockNotaCursadaRepo({ findSlot: vi.fn().mockResolvedValue(makeTpSlot('APROBADO')) }),
      mockTxRunner(),
      mockLlamadoExamenRepo(3),    // countAfter returns 3
      mockCarreraRepo(makeCarrera(3)),  // llamadosVencimiento = 3
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 5,
      condicion: 'DESAPROBADO',
      intento: 1,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().code).toBe('REGULARIDAD_VENCIDA');
  });

  it('T-19 Scenario I: fechaRegularidad=T0, llamadosTranscurridos=2 < llamadosVencimiento=5 → Ok', async () => {
    const acta = makeActa();
    const T0 = new Date('2026-01-01');
    const inscripcion = makeInscripcion('REGULAR', T0);
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({
        findById: vi.fn().mockResolvedValue(acta),
        countIntentosFinal: vi.fn().mockResolvedValue(0),
      }),
      mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) }),
      mockNotaCursadaRepo({ findSlot: vi.fn().mockResolvedValue(makeTpSlot('APROBADO')) }),
      mockTxRunner(),
      mockLlamadoExamenRepo(2),    // countAfter returns 2
      mockCarreraRepo(makeCarrera(5)),  // llamadosVencimiento = 5
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 8,
      condicion: 'APROBADO',
      intento: 1,
    });

    expect(result.isOk()).toBe(true);
  });

  it('T-19 FR-7.3: fechaRegularidad=null → UC passes llamadosTranscurridos=0 to policy (never expired)', async () => {
    const acta = makeActa();
    const inscripcion = makeInscripcion('REGULAR'); // fechaRegularidad = undefined/null
    const llamadoRepo = mockLlamadoExamenRepo(99); // would be expired if checked
    const uc = new RegistrarNotaFinalUC(
      mockActaRepo({
        findById: vi.fn().mockResolvedValue(acta),
        countIntentosFinal: vi.fn().mockResolvedValue(0),
      }),
      mockInscRepo({ findByStudentAndMateria: vi.fn().mockResolvedValue(inscripcion) }),
      mockNotaCursadaRepo({ findSlot: vi.fn().mockResolvedValue(makeTpSlot('APROBADO')) }),
      mockTxRunner(),
      llamadoRepo,
      mockCarreraRepo(makeCarrera(5)),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 7,
      condicion: 'APROBADO',
      intento: 1,
    });

    // countAfter should NOT be called because fechaRegularidad is null
    expect(llamadoRepo.countAfter).not.toHaveBeenCalled();
    // Policy should succeed (not expired)
    expect(result.isOk()).toBe(true);
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
      mockLlamadoExamenRepo(0),
      mockCarreraRepo(makeCarrera()),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 3,
      condicion: 'DESAPROBADO',
      intento: 1,
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
      mockLlamadoExamenRepo(0),
      mockCarreraRepo(makeCarrera()),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 0,
      condicion: 'AUSENTE',
      intento: 2,
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
      mockLlamadoExamenRepo(0),
      mockCarreraRepo(makeCarrera()),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 2,
      condicion: 'DESAPROBADO',
      intento: 3,
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
      mockLlamadoExamenRepo(0),
      mockCarreraRepo(makeCarrera()),
    );

    const result = await uc.execute(acta.id.get(), {
      studentId: 'student-1',
      nota: 8,
      condicion: 'APROBADO',
      intento: 3,
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
