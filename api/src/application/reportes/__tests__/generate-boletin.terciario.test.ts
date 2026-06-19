import { describe, it, expect, vi } from 'vitest';
import { GenerateBoletinUseCase } from '../generate-boletin.use-case';

// ── Shared mock factories ─────────────────────────────────────────────────────

function makePdfGenerator() {
  return { generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')) };
}

function makePdfStorage() {
  return {
    getPath: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue('/uploads/boletines/test.pdf'),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function makePrisma() {
  return {
    getMasterClient: vi.fn().mockReturnValue({
      institution: { findUnique: vi.fn().mockResolvedValue(null) },
    }),
  };
}

/**
 * Mock tenant client for Terciario tests.
 * Also exposes legacy models so no-regression dispatch tests can assert they are NOT called.
 */
function makeTerciarioClient(opts: { inscripciones?: any[]; finales?: any[]; llamados?: any[] } = {}) {
  return {
    inscripcionMateria: { findMany: vi.fn().mockResolvedValue(opts.inscripciones ?? []) },
    actaExamenNota: { findMany: vi.fn().mockResolvedValue(opts.finales ?? []) },
    llamadoExamen: { findMany: vi.fn().mockResolvedValue(opts.llamados ?? []) },
    // legacy models — present so level-10 no-regression tests can assert NOT called
    notaTrimestral: { findMany: vi.fn().mockResolvedValue([]) },
    courseCycle: { findMany: vi.fn().mockResolvedValue([]) },
    attendance: { findMany: vi.fn().mockResolvedValue([]) },
    salaEnrollment: { findFirst: vi.fn().mockResolvedValue(null) },
  };
}

/**
 * Plain shaped object matching the Prisma include result for InscripcionMateria.
 * { materiaCarreraId, cuatrimestre, estado, notaCursada, notasCursada, materiaCarrera }
 */
function makeInscripcion(opts: {
  materiaCarreraId?: string;
  cuatrimestre?: string;
  estado?: string;
  notaCursada?: number | null;
  notasCursada?: Array<{ slot: string; nota: number | null }>;
  subjectName?: string;
  carrera?: { name: string; llamadosVencimiento?: number } | null;
  fechaRegularidad?: Date | null;
} = {}) {
  const carreraBase = opts.carrera !== undefined
    ? opts.carrera
    : { name: 'Profesorado de Lengua' };
  const carreraObj = carreraBase === null
    ? null
    : { name: carreraBase.name, llamadosVencimiento: carreraBase.llamadosVencimiento ?? 5 };

  return {
    materiaCarreraId: opts.materiaCarreraId ?? 'mc-1',
    cuatrimestre: opts.cuatrimestre ?? '1C',
    estado: opts.estado ?? 'REGULAR',
    notaCursada: opts.notaCursada ?? null,
    notasCursada: opts.notasCursada ?? [],
    fechaRegularidad: opts.fechaRegularidad !== undefined ? opts.fechaRegularidad : null,
    materiaCarrera: {
      subject: { name: opts.subjectName ?? 'Matemática' },
      carrera: carreraObj,
    },
  };
}

/**
 * Plain shaped object matching the Prisma include result for ActaExamenNota.
 * { intento, nota, condicion, acta: { materiaCarreraId, fecha } }
 */
function makeFinal(opts: {
  materiaCarreraId?: string;
  intento?: number;
  nota?: number;
  condicion?: string;
  fecha?: Date;
} = {}) {
  return {
    intento: opts.intento ?? 1,
    nota: opts.nota ?? 6,
    condicion: opts.condicion ?? 'APROBADO',
    acta: {
      materiaCarreraId: opts.materiaCarreraId ?? 'mc-1',
      fecha: opts.fecha ?? new Date('2024-12-01'),
    },
  };
}

function makeTerciarioUseCase() {
  return new GenerateBoletinUseCase(
    makePdfGenerator() as never,
    makePdfStorage() as never,
    makePrisma() as never,
    // no optional repos — Terciario path (Approach A) uses none
  );
}

function makeTerciarioEnrollment(opts: { grade?: string | null } = {}) {
  return {
    id: 'e-terc-1',
    studentId: 'stu-terc',
    level: 40,
    cycleId: null as string | null,
    academicYear: '2026',
    grade: opts.grade !== undefined ? opts.grade : 'Tecnicatura en Informática',
  };
}

// ── 1. Dispatch ───────────────────────────────────────────────────────────────

describe('dispatch — level 40', () => {
  it('Scenario 1.1 — calls inscripcionMateria.findMany and returns non-empty materias', async () => {
    const insc = makeInscripcion({ estado: 'REGULAR' });
    const mockClient = makeTerciarioClient({ inscripciones: [insc] });
    const uc = makeTerciarioUseCase();
    const enrollment = makeTerciarioEnrollment();

    const result = await (uc as any).buildMaterias(mockClient, enrollment);

    expect(mockClient.inscripcionMateria.findMany).toHaveBeenCalled();
    expect(result.materias.length).toBeGreaterThan(0);
  });
});

describe('dispatch — level 10 no-regression', () => {
  it('Scenario 1.2 — inscripcionMateria.findMany NOT called for level 10', async () => {
    const mockClient = makeTerciarioClient();
    const uc = makeTerciarioUseCase();
    const enrollment = { id: 'e-ini', studentId: 'stu-ini', level: 10, cycleId: null, academicYear: '2026', grade: null };

    await (uc as any).buildMaterias(mockClient, enrollment);

    expect(mockClient.inscripcionMateria.findMany).not.toHaveBeenCalled();
  });
});

// ── 2. Inclusion rules ────────────────────────────────────────────────────────

describe('inclusion — CURSANDO included', () => {
  it('Scenario 2.1 — materia with estado=CURSANDO appears in result', async () => {
    const insc = makeInscripcion({ estado: 'CURSANDO', subjectName: 'Lengua' });
    const mockClient = makeTerciarioClient({ inscripciones: [insc] });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMaterias(mockClient, makeTerciarioEnrollment());

    expect(result.materias.some((m: any) => m.nombre === 'Lengua')).toBe(true);
  });
});

describe('inclusion — REGULAR included', () => {
  it('Scenario 2.2 — materia with estado=REGULAR appears in result', async () => {
    const insc = makeInscripcion({ estado: 'REGULAR', subjectName: 'Historia' });
    const mockClient = makeTerciarioClient({ inscripciones: [insc] });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMaterias(mockClient, makeTerciarioEnrollment());

    expect(result.materias.some((m: any) => m.nombre === 'Historia')).toBe(true);
  });
});

describe('inclusion — LIBRE excluded', () => {
  it('Scenario 2.3 — where.estado.in does NOT contain LIBRE', async () => {
    const mockClient = makeTerciarioClient({ inscripciones: [] });
    const uc = makeTerciarioUseCase();

    await (uc as any).buildMaterias(mockClient, makeTerciarioEnrollment());

    const callArgs = mockClient.inscripcionMateria.findMany.mock.calls[0][0];
    expect(callArgs.where.estado.in).not.toContain('LIBRE');
  });
});

describe('inclusion — other anioAcademico excluded', () => {
  it('Scenario 2.4 — where.anioAcademico matches enrollment.academicYear', async () => {
    const mockClient = makeTerciarioClient({ inscripciones: [] });
    const uc = makeTerciarioUseCase();
    const enrollment = makeTerciarioEnrollment();

    await (uc as any).buildMaterias(mockClient, enrollment);

    const callArgs = mockClient.inscripcionMateria.findMany.mock.calls[0][0];
    expect(callArgs.where.anioAcademico).toBe(enrollment.academicYear);
  });
});

// ── 3. Slot mapping ───────────────────────────────────────────────────────────

describe('slots — one nota, four null', () => {
  it('Scenario 3.1 — slotsCursada length 5; PARCIAL_1 nota=7; others null', async () => {
    const insc = makeInscripcion({
      estado: 'CURSANDO',
      notasCursada: [{ slot: 'PARCIAL_1', nota: 7 }],
    });
    const mockClient = makeTerciarioClient({ inscripciones: [insc] });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMaterias(mockClient, makeTerciarioEnrollment());
    const slots = result.materias[0].slotsCursada;

    expect(slots).toHaveLength(5);
    expect(slots.find((s: any) => s.slot === 'PARCIAL_1').nota).toBe(7);
    expect(slots.filter((s: any) => s.nota === null)).toHaveLength(4);
  });
});

describe('slots — all five notas', () => {
  it('Scenario 3.2 — slotsCursada length 5; all slots have numeric nota', async () => {
    const insc = makeInscripcion({
      estado: 'REGULAR',
      notasCursada: [
        { slot: 'PARCIAL_1', nota: 6 },
        { slot: 'PARCIAL_2', nota: 7 },
        { slot: 'RECUPERATORIO_PARCIAL_1', nota: 5 },
        { slot: 'RECUPERATORIO_PARCIAL_2', nota: 8 },
        { slot: 'TP', nota: 9 },
      ],
    });
    const mockClient = makeTerciarioClient({ inscripciones: [insc] });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMaterias(mockClient, makeTerciarioEnrollment());
    const slots = result.materias[0].slotsCursada;

    expect(slots).toHaveLength(5);
    expect(slots.every((s: any) => s.nota !== null)).toBe(true);
  });
});

describe('slots — zero notas', () => {
  it('Scenario 3.3 — slotsCursada length 5; all nota null', async () => {
    const insc = makeInscripcion({ estado: 'INSCRIPTO', notasCursada: [] });
    const mockClient = makeTerciarioClient({ inscripciones: [insc] });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMaterias(mockClient, makeTerciarioEnrollment());
    const slots = result.materias[0].slotsCursada;

    expect(slots).toHaveLength(5);
    expect(slots.every((s: any) => s.nota === null)).toBe(true);
  });
});

// Verify canonical slot order
describe('slots — canonical order', () => {
  it('slotsCursada follows PARCIAL_1, PARCIAL_2, RECUPERATORIO_PARCIAL_1, RECUPERATORIO_PARCIAL_2, TP', async () => {
    const insc = makeInscripcion({ estado: 'REGULAR', notasCursada: [] });
    const mockClient = makeTerciarioClient({ inscripciones: [insc] });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMaterias(mockClient, makeTerciarioEnrollment());
    const slotNames = result.materias[0].slotsCursada.map((s: any) => s.slot);

    expect(slotNames).toEqual([
      'PARCIAL_1',
      'PARCIAL_2',
      'RECUPERATORIO_PARCIAL_1',
      'RECUPERATORIO_PARCIAL_2',
      'TP',
    ]);
  });
});

// ── 4. Condición cursada & notaCursadaConfirmada ──────────────────────────────

describe('condicionCursada — REGULAR maps "Regular"', () => {
  it('Scenario 4.1 — condicionCursada === "Regular"', async () => {
    const insc = makeInscripcion({ estado: 'REGULAR' });
    const mockClient = makeTerciarioClient({ inscripciones: [insc] });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMaterias(mockClient, makeTerciarioEnrollment());

    expect(result.materias[0].condicionCursada).toBe('Regular');
  });
});

describe('notaCursadaConfirmada — null for CURSANDO without nota', () => {
  it('Scenario 4.2 — notaCursadaConfirmada === null when notaCursada is null', async () => {
    const insc = makeInscripcion({ estado: 'CURSANDO', notaCursada: null });
    const mockClient = makeTerciarioClient({ inscripciones: [insc] });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMaterias(mockClient, makeTerciarioEnrollment());

    expect(result.materias[0].notaCursadaConfirmada).toBeNull();
  });
});

// ── 5. Finales (intentosFinales) ──────────────────────────────────────────────

describe('finales — three across years, chronological', () => {
  it('Scenario 5.1 — intentosFinales length 3, ordered by fecha asc', async () => {
    const insc = makeInscripcion({ estado: 'REGULAR', materiaCarreraId: 'mc-1' });
    // Passed out of chronological order — implementation must sort
    const finales = [
      makeFinal({ materiaCarreraId: 'mc-1', fecha: new Date('2026-03-01'), intento: 3, nota: 7, condicion: 'APROBADO' }),
      makeFinal({ materiaCarreraId: 'mc-1', fecha: new Date('2024-12-01'), intento: 1, nota: 4, condicion: 'DESAPROBADO' }),
      makeFinal({ materiaCarreraId: 'mc-1', fecha: new Date('2025-07-01'), intento: 2, nota: 5, condicion: 'DESAPROBADO' }),
    ];
    const mockClient = makeTerciarioClient({ inscripciones: [insc], finales });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMaterias(mockClient, makeTerciarioEnrollment());
    const intentos = result.materias[0].intentosFinales;

    expect(intentos).toHaveLength(3);
    // Chronological order: 2024-12-01 → 2025-07-01 → 2026-03-01
    expect(intentos[0].condicion).toBe('Desaprobado');
    expect(intentos[1].condicion).toBe('Desaprobado');
    expect(intentos[2].condicion).toBe('Aprobado');
  });
});

describe('finales — no records → empty array', () => {
  it('Scenario 5.2 — intentosFinales equals []', async () => {
    const insc = makeInscripcion({ estado: 'REGULAR', materiaCarreraId: 'mc-2' });
    const mockClient = makeTerciarioClient({ inscripciones: [insc], finales: [] });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMaterias(mockClient, makeTerciarioEnrollment());

    expect(result.materias[0].intentosFinales).toEqual([]);
  });
});

describe('finales — LIBRE never surfaced', () => {
  it('Scenario 5.3 — actaExamenNota.findMany not called with LIBRE materiaCarreraId', async () => {
    // Only non-LIBRE inscripciones are returned from Q1 (LIBRE filtered at DB level).
    // With no eligible inscripciones, actaExamenNota.findMany must NOT be called at all.
    const mockClient = makeTerciarioClient({ inscripciones: [], finales: [] });
    const uc = makeTerciarioUseCase();

    await (uc as any).buildMaterias(mockClient, makeTerciarioEnrollment());

    // When materiaCarreraIds.length === 0, Q2 is skipped entirely (design § 2)
    expect(mockClient.actaExamenNota.findMany).not.toHaveBeenCalled();
  });
});

// ── 6. Carrera header ─────────────────────────────────────────────────────────

describe('carreraName — from Carrera.name', () => {
  it('Scenario 6.1 — carreraName === "Profesorado de Lengua"', async () => {
    const insc = makeInscripcion({ carrera: { name: 'Profesorado de Lengua' } });
    const mockClient = makeTerciarioClient({ inscripciones: [insc] });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMaterias(mockClient, makeTerciarioEnrollment());

    expect(result.carreraName).toBe('Profesorado de Lengua');
  });
});

describe('carreraName — fallback to enrollment.grade', () => {
  it('Scenario 6.2 — carreraName === enrollment.grade when Carrera.name is absent', async () => {
    const insc = makeInscripcion({ carrera: { name: '' } }); // empty name triggers fallback
    const mockClient = makeTerciarioClient({ inscripciones: [insc] });
    const uc = makeTerciarioUseCase();
    const enrollment = makeTerciarioEnrollment({ grade: 'Tecnicatura en Informática' });

    const result = await (uc as any).buildMaterias(mockClient, enrollment);

    expect(result.carreraName).toBe('Tecnicatura en Informática');
  });
});

describe('carreraName — both absent → null', () => {
  it('Scenario 6.3 — carreraName === null; no crash', async () => {
    const insc = makeInscripcion({ carrera: null }); // null carrera
    const mockClient = makeTerciarioClient({ inscripciones: [insc] });
    const uc = makeTerciarioUseCase();
    const enrollment = makeTerciarioEnrollment({ grade: null });

    const result = await (uc as any).buildMaterias(mockClient, enrollment);

    expect(result.carreraName).toBeNull();
  });
});

// ── 7. Cuatrimestre grouping ──────────────────────────────────────────────────

describe('grouping — 1C + 2C both present', () => {
  it('Scenario 7.1 — cuatrimestresTerciario has 2 groups; 1C first, 2C second', async () => {
    const insc1C = makeInscripcion({ cuatrimestre: '1C', subjectName: 'Matemática', materiaCarreraId: 'mc-1' });
    const insc2C = makeInscripcion({ cuatrimestre: '2C', subjectName: 'Historia', materiaCarreraId: 'mc-2' });
    const mockClient = makeTerciarioClient({ inscripciones: [insc1C, insc2C] });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMaterias(mockClient, makeTerciarioEnrollment());
    const grupos = result.cuatrimestresTerciario;

    expect(grupos).toHaveLength(2);
    expect(grupos[0].cuatrimestre).toBe('1C');
    expect(grupos[1].cuatrimestre).toBe('2C');
    expect(grupos[0].materias[0].nombre).toBe('Matemática');
    expect(grupos[1].materias[0].nombre).toBe('Historia');
  });
});

describe('grouping — missing cuatrimestre not lost', () => {
  it('Scenario 7.2 — materia with undefined cuatrimestre appears in ANUAL/other group', async () => {
    const inscAnual = makeInscripcion({ cuatrimestre: 'ANUAL', subjectName: 'Práctica Docente' });
    const mockClient = makeTerciarioClient({ inscripciones: [inscAnual] });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMaterias(mockClient, makeTerciarioEnrollment());
    const allMaterias = result.cuatrimestresTerciario.flatMap((g: any) => g.materias);

    expect(allMaterias.some((m: any) => m.nombre === 'Práctica Docente')).toBe(true);
  });
});

// ── Fallback path — unrecognized level or missing repo injection → empty materias ──
// After PR-a2, there is no legacy NotaTrimestral path. Levels without matching repos
// or unrecognized decade return { materias: [] } immediately.

describe('fallback path — empty materias (no repos, level 20)', () => {
  it('returns empty materias when cycleId is null (no repos → fallback immediately)', async () => {
    const uc = makeTerciarioUseCase();
    const mockClient = {
      inscripcionMateria: { findMany: vi.fn().mockResolvedValue([]) },
      actaExamenNota: { findMany: vi.fn().mockResolvedValue([]) },
      salaEnrollment: { findFirst: vi.fn().mockResolvedValue(null) },
      courseCycle: { findMany: vi.fn().mockResolvedValue([]) },
      notaTrimestral: { findMany: vi.fn().mockResolvedValue([]) },
    };
    // level=20 without repos → no Primario branch match → return { materias: [] } immediately
    const enrollment = { id: 'e-leg', studentId: 'stu-leg', level: 20, cycleId: null as string | null, academicYear: '2026', grade: null };

    const result = await (uc as any).buildMaterias(mockClient, enrollment);

    expect(result.materias).toEqual([]);
    expect(mockClient.courseCycle.findMany).not.toHaveBeenCalled();
  });

  it('returns empty materias for unmatched level with cycleId (no repos → fallback immediately)', async () => {
    const uc = makeTerciarioUseCase();
    const mockClient = {
      inscripcionMateria: { findMany: vi.fn().mockResolvedValue([]) },
      actaExamenNota: { findMany: vi.fn().mockResolvedValue([]) },
      salaEnrollment: { findFirst: vi.fn().mockResolvedValue(null) },
      courseCycle: { findMany: vi.fn().mockResolvedValue([]) },
      notaTrimestral: { findMany: vi.fn().mockResolvedValue([]) },
    };
    // level=20 without repos → no Primario branch match → return { materias: [] } immediately
    const enrollment = { id: 'e-leg2', studentId: 'stu-leg2', level: 20, cycleId: 'cyc-1', academicYear: '2026', grade: null };

    const result = await (uc as any).buildMaterias(mockClient, enrollment);

    expect(result.materias).toEqual([]);
    expect(mockClient.notaTrimestral.findMany).not.toHaveBeenCalled();
  });
});

// ── 8. No N+1 ─────────────────────────────────────────────────────────────────

describe('no N+1 — 10 materias, 2 queries', () => {
  it('Scenario 8.1 — inscripcionMateria.findMany called once; actaExamenNota.findMany called once', async () => {
    const inscripciones = Array.from({ length: 10 }, (_, i) =>
      makeInscripcion({ materiaCarreraId: `mc-${i}`, subjectName: `Materia ${i}`, estado: 'REGULAR' }),
    );
    const mockClient = makeTerciarioClient({ inscripciones, finales: [] });
    const uc = makeTerciarioUseCase();

    await (uc as any).buildMaterias(mockClient, makeTerciarioEnrollment());

    expect(mockClient.inscripcionMateria.findMany).toHaveBeenCalledTimes(1);
    expect(mockClient.actaExamenNota.findMany).toHaveBeenCalledTimes(1);
  });
});

// ── 9. Expiry filter (T-21 / FR-8.1–FR-8.5) ──────────────────────────────────

describe('expiry filter — Scenario J: expired REGULAR excluded', () => {
  it('REGULAR materia with 5 llamados after T0 and llamadosVencimiento=5 → excluded from output (FR-8.1)', async () => {
    const T0 = new Date('2026-01-01');
    const insc = makeInscripcion({
      estado: 'REGULAR',
      fechaRegularidad: T0,
      carrera: { name: 'Profesorado', llamadosVencimiento: 5 },
      subjectName: 'Matemática',
    });
    // 5 llamados with fechaInicio > T0
    const llamados = Array.from({ length: 5 }, (_, i) => ({
      fechaInicio: new Date(`2026-0${i + 2}-01`),
      active: true,
      deletedAt: null,
    }));
    const mockClient = makeTerciarioClient({ inscripciones: [insc], finales: [], llamados });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMateriasTerciario(mockClient, makeTerciarioEnrollment());

    // Materia should be excluded (count 5 >= 5)
    expect(result.materias.some((m: any) => m.nombre === 'Matemática')).toBe(false);
    expect(result.cuatrimestresTerciario.flatMap((g: any) => g.materias)).toHaveLength(0);
  });
});

describe('expiry filter — Scenario K: non-expired REGULAR included', () => {
  it('REGULAR materia with 3 llamados after T0 and llamadosVencimiento=5 → included (FR-8.1, 3<5)', async () => {
    const T0 = new Date('2026-01-01');
    const insc = makeInscripcion({
      estado: 'REGULAR',
      fechaRegularidad: T0,
      carrera: { name: 'Profesorado', llamadosVencimiento: 5 },
      subjectName: 'Historia',
    });
    // Only 3 llamados with fechaInicio > T0
    const llamados = [
      { fechaInicio: new Date('2026-02-01'), active: true, deletedAt: null },
      { fechaInicio: new Date('2026-03-01'), active: true, deletedAt: null },
      { fechaInicio: new Date('2026-04-01'), active: true, deletedAt: null },
    ];
    const mockClient = makeTerciarioClient({ inscripciones: [insc], finales: [], llamados });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMateriasTerciario(mockClient, makeTerciarioEnrollment());

    // Materia should be included (count 3 < 5)
    expect(result.materias.some((m: any) => m.nombre === 'Historia')).toBe(true);
  });
});

describe('expiry filter — Scenario L: null fechaRegularidad always included (FR-4.3)', () => {
  it('REGULAR materia with fechaRegularidad=null and 10 llamados → included (backfill safe)', async () => {
    const insc = makeInscripcion({
      estado: 'REGULAR',
      fechaRegularidad: null,  // null → never expired
      carrera: { name: 'Profesorado', llamadosVencimiento: 5 },
      subjectName: 'Lengua',
    });
    // 10 llamados — would expire if fechaRegularidad were set
    const llamados = Array.from({ length: 10 }, (_, i) => ({
      fechaInicio: new Date(`2026-0${(i % 9) + 1}-01`),
      active: true,
      deletedAt: null,
    }));
    const mockClient = makeTerciarioClient({ inscripciones: [insc], finales: [], llamados });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMateriasTerciario(mockClient, makeTerciarioEnrollment());

    // Materia should be included (fechaRegularidad is null → not expired)
    expect(result.materias.some((m: any) => m.nombre === 'Lengua')).toBe(true);
  });
});

describe('expiry filter — INSCRIPTO/APROBADO materias unaffected by filter', () => {
  it('non-REGULAR materias are never filtered by expiry regardless of llamados', async () => {
    const T0 = new Date('2026-01-01');
    const inscripciones = [
      makeInscripcion({ estado: 'INSCRIPTO', fechaRegularidad: T0, subjectName: 'Inglés', materiaCarreraId: 'mc-1' }),
      makeInscripcion({ estado: 'APROBADO', fechaRegularidad: T0, subjectName: 'Física', materiaCarreraId: 'mc-2' }),
    ];
    // Many llamados — would expire REGULAR, but not INSCRIPTO/APROBADO
    const llamados = Array.from({ length: 10 }, (_, i) => ({
      fechaInicio: new Date(`2026-0${(i % 9) + 1}-15`),
      active: true,
      deletedAt: null,
    }));
    const mockClient = makeTerciarioClient({ inscripciones, finales: [], llamados });
    const uc = makeTerciarioUseCase();

    const result = await (uc as any).buildMateriasTerciario(mockClient, makeTerciarioEnrollment());

    expect(result.materias.some((m: any) => m.nombre === 'Inglés')).toBe(true);
    expect(result.materias.some((m: any) => m.nombre === 'Física')).toBe(true);
  });
});

describe('expiry filter — llamadoExamen.findMany called exactly once (ADR-2 no N+1)', () => {
  it('Q3 bulk query called once for the year, regardless of inscripcion count', async () => {
    const inscripciones = Array.from({ length: 5 }, (_, i) =>
      makeInscripcion({ estado: 'REGULAR', materiaCarreraId: `mc-${i}`, subjectName: `M${i}` }),
    );
    const mockClient = makeTerciarioClient({ inscripciones, finales: [], llamados: [] });
    const uc = makeTerciarioUseCase();

    await (uc as any).buildMateriasTerciario(mockClient, makeTerciarioEnrollment());

    expect(mockClient.llamadoExamen.findMany).toHaveBeenCalledTimes(1);
  });
});
