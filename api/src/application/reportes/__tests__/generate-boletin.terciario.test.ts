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
function makeTerciarioClient(opts: { inscripciones?: any[]; finales?: any[] } = {}) {
  return {
    inscripcionMateria: { findMany: vi.fn().mockResolvedValue(opts.inscripciones ?? []) },
    actaExamenNota: { findMany: vi.fn().mockResolvedValue(opts.finales ?? []) },
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
  carrera?: { name: string } | null;
} = {}) {
  return {
    materiaCarreraId: opts.materiaCarreraId ?? 'mc-1',
    cuatrimestre: opts.cuatrimestre ?? '1C',
    estado: opts.estado ?? 'REGULAR',
    notaCursada: opts.notaCursada ?? null,
    notasCursada: opts.notasCursada ?? [],
    materiaCarrera: {
      subject: { name: opts.subjectName ?? 'Matemática' },
      carrera: opts.carrera !== undefined ? opts.carrera : { name: 'Profesorado de Lengua' },
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

// ── Legacy path regression — ensure the NotaTrimestral path still works ────────
// These tests cover the legacy branch that was previously exercised by the old
// Terciario tests. Now that Terciario dispatches to buildMateriasTerciario, the
// legacy path is still reachable for levels that fall through all other conditions
// (e.g. level=20 or level=30 WITHOUT repos injected).

describe('legacy NotaTrimestral path — fallback (no repos, level 20)', () => {
  it('uses courseCycle/subjectAssignment/notaTrimestral for level=20 without repos', async () => {
    // Without repos, Primario condition (level/10===2 && repos) is false → falls to legacy path
    const uc = makeTerciarioUseCase(); // no repos
    const notaTrimestralFindMany = vi.fn().mockResolvedValue([
      { assignmentId: 'sa-1', periodId: 'p-1', finalGrade: 7, studentId: 'stu-prim', active: true },
    ]);
    const mockClient = {
      inscripcionMateria: { findMany: vi.fn().mockResolvedValue([]) },
      actaExamenNota: { findMany: vi.fn().mockResolvedValue([]) },
      salaEnrollment: { findFirst: vi.fn().mockResolvedValue(null) },
      courseCycle: {
        findMany: vi.fn().mockResolvedValue([{
          uuid: 'cc-prim', courseId: 'section-prim', level: 20,
        }]),
      },
      subjectAssignment: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'sa-1', subjectId: 'subj-1',
          subject: { name: 'Matemática' },
        }]),
      },
      periodoEvaluacion: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p-1', name: '1° Cuatrimestre', startDate: new Date('2026-03-01') },
        ]),
      },
      notaTrimestral: { findMany: notaTrimestralFindMany },
      materiaXCursoXCiclo: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const enrollment = { id: 'e-prim', studentId: 'stu-prim', level: 20, cycleId: 'cyc-prim', academicYear: '2026', grade: null };

    const result = await (uc as any).buildMaterias(mockClient, enrollment);

    // Legacy path was called (notaTrimestral)
    expect(notaTrimestralFindMany).toHaveBeenCalled();
    expect(result.materias).toHaveLength(1);
    expect(result.materias[0].nombre).toBe('Matemática');
    expect(result.materias[0].notas).toHaveLength(1);
    // New Terciario-path models were NOT called
    expect(mockClient.inscripcionMateria.findMany).not.toHaveBeenCalled();
  });

  it('returns empty materias when cycleId is null (legacy path early return)', async () => {
    const uc = makeTerciarioUseCase();
    const mockClient = {
      inscripcionMateria: { findMany: vi.fn().mockResolvedValue([]) },
      actaExamenNota: { findMany: vi.fn().mockResolvedValue([]) },
      salaEnrollment: { findFirst: vi.fn().mockResolvedValue(null) },
      courseCycle: { findMany: vi.fn().mockResolvedValue([]) },
      notaTrimestral: { findMany: vi.fn().mockResolvedValue([]) },
    };
    // level=20 without repos + cycleId=null → `if (!enrollment.cycleId) return { materias: [] }`
    const enrollment = { id: 'e-leg', studentId: 'stu-leg', level: 20, cycleId: null as string | null, academicYear: '2026', grade: null };

    const result = await (uc as any).buildMaterias(mockClient, enrollment);

    expect(result.materias).toEqual([]);
    expect(mockClient.courseCycle.findMany).not.toHaveBeenCalled();
  });

  it('returns empty materias when courseCycles is empty (legacy path early return)', async () => {
    const uc = makeTerciarioUseCase();
    const mockClient = {
      inscripcionMateria: { findMany: vi.fn().mockResolvedValue([]) },
      actaExamenNota: { findMany: vi.fn().mockResolvedValue([]) },
      salaEnrollment: { findFirst: vi.fn().mockResolvedValue(null) },
      courseCycle: { findMany: vi.fn().mockResolvedValue([]) }, // empty → early return
      notaTrimestral: { findMany: vi.fn().mockResolvedValue([]) },
    };
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
