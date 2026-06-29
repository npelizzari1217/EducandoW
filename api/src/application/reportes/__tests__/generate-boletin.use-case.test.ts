import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateBoletinUseCase, BoletinError } from '../generate-boletin.use-case';
import type { MesaExamenBoletin } from '../templates/boletin.template';
import { TenantContext } from '../../../infrastructure/auth/tenant.context';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
    getInstitutionId: vi.fn().mockReturnValue(null),
  },
}));

// ── HOTFIX-2: template path resolution ───────────────────────────────────────
// Regression guard: constructor must load all 4 HBS templates from the real
// src/ layout. In prod (dist/) the sentinel-based candidate search hits the
// 3rd candidate (../../../src/…) and finds the files; in dev (src/) it hits
// the 1st candidate immediately. Either way templates.size must equal 4.
// Main verification is the smoke E2E in prod, but this unit guard catches
// obvious path regressions during CI.

describe('GenerateBoletinUseCase — HOTFIX-2: template loading from real src layout', () => {
  function makeUc() {
    return new GenerateBoletinUseCase(
      { generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')) } as never,
      { getPath: vi.fn().mockResolvedValue(null), save: vi.fn(), delete: vi.fn() } as never,
      { getMasterClient: vi.fn().mockReturnValue({ institution: { findUnique: vi.fn().mockResolvedValue(null) } }) } as never,
    );
  }

  it('loads all 4 templates (INICIAL/PRIMARIO/SECUNDARIO/TERCIARIO) from the filesystem', () => {
    const uc = makeUc();
    // Access the private Map via bracket notation — acceptable in tests to verify
    // the constructor side-effect without exposing a public API.
    const templates: Map<string, unknown> = (uc as any).templates;
    expect(templates.size).toBe(4);
    expect(templates.has('INICIAL')).toBe(true);
    expect(templates.has('PRIMARIO')).toBe(true);
    expect(templates.has('SECUNDARIO')).toBe(true);
    expect(templates.has('TERCIARIO')).toBe(true);
  });

  it('does NOT throw BOLETIN_LEVEL_UNKNOWN for any of the 4 known base levels when template is present', () => {
    const uc = makeUc();
    const templates: Map<string, unknown> = (uc as any).templates;
    // Each known base level must have a template — the template lookup in execute()
    // uses this.templates.get(baseLevel), so an empty Map would produce the prod error.
    for (const level of [10, 20, 30, 40]) {
      const baseLevel = uc.getBaseLevel(level);
      expect(templates.has(baseLevel)).toBe(true);
    }
  });
});

// ── Minimal mocks ──────────────────────────────────────────────────────────────

function makePdfGenerator() {
  return { generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')) };
}

function makePdfStorage(cachedPath: string | null = null) {
  return {
    getPath: vi.fn().mockResolvedValue(cachedPath),
    save: vi.fn().mockResolvedValue('/uploads/boletines/test.pdf'),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function makePrisma() {
  return { getMasterClient: vi.fn().mockReturnValue({ institution: { findUnique: vi.fn().mockResolvedValue(null) } }) };
}

// ── getBaseLevel (S2 — unknown level must throw, not silently default) ─────────

describe('GenerateBoletinUseCase.getBaseLevel', () => {
  let uc: GenerateBoletinUseCase;

  beforeEach(() => {
    // We construct the UC but won't actually call execute()
    // so heavy mocks (PdfGenerator, PrismaService) can be minimal
    uc = new GenerateBoletinUseCase(
      makePdfGenerator() as never,
      makePdfStorage() as never,
      makePrisma() as never,
    );
  });

  it('returns INICIAL for level 10', () => {
    expect(uc.getBaseLevel(10)).toBe('INICIAL');
  });

  it('returns PRIMARIO for level 20', () => {
    expect(uc.getBaseLevel(20)).toBe('PRIMARIO');
  });

  it('returns SECUNDARIO for level 30', () => {
    expect(uc.getBaseLevel(30)).toBe('SECUNDARIO');
  });

  it('returns TERCIARIO for level 40', () => {
    expect(uc.getBaseLevel(40)).toBe('TERCIARIO');
  });

  it('returns the base level for a sub-code (e.g. 21 → PRIMARIO)', () => {
    expect(uc.getBaseLevel(21)).toBe('PRIMARIO');
  });

  it('throws BOLETIN_LEVEL_UNKNOWN for an unknown level (e.g. 50)', () => {
    expect(() => uc.getBaseLevel(50)).toThrowError(
      expect.objectContaining({ code: 'BOLETIN_LEVEL_UNKNOWN', httpStatus: 422 }),
    );
  });

  it('throws BOLETIN_LEVEL_UNKNOWN for level 0', () => {
    expect(() => uc.getBaseLevel(0)).toThrowError(
      expect.objectContaining({ code: 'BOLETIN_LEVEL_UNKNOWN' }),
    );
  });

  // ── HOTFIX: base-encoded levels (1-4) — prod bug where enrollments have level=4 not level=40
  it('[HOTFIX] returns INICIAL for base-encoded level 1', () => {
    expect(uc.getBaseLevel(1)).toBe('INICIAL');
  });

  it('[HOTFIX] returns PRIMARIO for base-encoded level 2', () => {
    expect(uc.getBaseLevel(2)).toBe('PRIMARIO');
  });

  it('[HOTFIX] returns SECUNDARIO for base-encoded level 3', () => {
    expect(uc.getBaseLevel(3)).toBe('SECUNDARIO');
  });

  it('[HOTFIX] returns TERCIARIO for base-encoded level 4 (was throwing BOLETIN_LEVEL_UNKNOWN in prod)', () => {
    expect(uc.getBaseLevel(4)).toBe('TERCIARIO');
  });

  it('[HOTFIX] level=4 and level=40 both map to TERCIARIO (dual-encoding compatibility)', () => {
    expect(uc.getBaseLevel(4)).toBe('TERCIARIO');
    expect(uc.getBaseLevel(40)).toBe('TERCIARIO');
  });
});

// ── buildAsistencia (C2 — attendance aggregation, SDD-5 repoint) ──────────────
// T-2 RED: new signature = (client, studentId, courseCycleId, level).
// Reads asistenciaXAlumnoXCursoXCiclo + attendanceType catalog.
// Tests FAIL until T-3 rewrites the implementation.

describe('GenerateBoletinUseCase.buildAsistencia', () => {
  let uc: GenerateBoletinUseCase;

  beforeEach(() => {
    uc = new GenerateBoletinUseCase(
      makePdfGenerator() as never,
      makePdfStorage() as never,
      makePrisma() as never,
    );
  });

  // ── guard: null courseCycleId ───────────────────────────────────────────────

  it('returns undefined when courseCycleId is null', async () => {
    const mockClient = {
      asistenciaXAlumnoXCursoXCiclo: { findMany: vi.fn() },
      attendanceType: { findMany: vi.fn() },
    };
    const result = await uc.buildAsistencia(mockClient as never, 'student-1', null, 20);
    expect(result).toBeUndefined();
    expect(mockClient.asistenciaXAlumnoXCursoXCiclo.findMany).not.toHaveBeenCalled();
  });

  // ── guard: zero registers (legacy undefined behavior preserved) ─────────────

  it('returns undefined when no asistenciaXAlumnoXCursoXCiclo rows exist', async () => {
    const mockClient = {
      asistenciaXAlumnoXCursoXCiclo: { findMany: vi.fn().mockResolvedValue([]) },
      attendanceType: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const result = await uc.buildAsistencia(mockClient as never, 'student-1', 'cc-1', 20);
    expect(result).toBeUndefined();
  });

  // ── S-A: multi-month aggregation (numerical equivalence) ────────────────────
  // 3 months: days P,P,A / P,M / P → 4P + 1A + 1M = totalDias:6
  // porcentaje = (4/6*100).toFixed(1) = "66.7"

  it('S-A: aggregates 3 monthly rows → totalDias:6, diasPresente:4, inasistencias:1, mediasFaltas:1, porcentaje:"66.7"', async () => {
    const registers = [
      { days: { '1': 'P', '2': 'P', '3': 'A' } },
      { days: { '1': 'P', '2': 'M' } },
      { days: { '1': 'P' } },
    ];
    const types = [
      { code: 'P', isPresent: true,  absenceValue: 0 },
      { code: 'A', isPresent: false, absenceValue: 1 },
      { code: 'M', isPresent: false, absenceValue: 0.5 },
    ];
    const mockClient = {
      asistenciaXAlumnoXCursoXCiclo: { findMany: vi.fn().mockResolvedValue(registers) },
      attendanceType: { findMany: vi.fn().mockResolvedValue(types) },
    };
    const result = await uc.buildAsistencia(mockClient as never, 'student-1', 'cc-prim', 20);

    expect(result).not.toBeUndefined();
    expect(result!.totalDias).toBe(6);
    expect(result!.diasPresente).toBe(4);
    expect(result!.inasistencias).toBe(1);
    expect(result!.mediasFaltas).toBe(1);
    expect(result!.porcentaje).toBe('66.7');
  });

  // ── 100% present ────────────────────────────────────────────────────────────

  it('100% present: diasPresente === totalDias, porcentaje === "100.0"', async () => {
    const registers = [{ days: { '1': 'P', '2': 'P' } }];
    const types = [{ code: 'P', isPresent: true, absenceValue: 0 }];
    const mockClient = {
      asistenciaXAlumnoXCursoXCiclo: { findMany: vi.fn().mockResolvedValue(registers) },
      attendanceType: { findMany: vi.fn().mockResolvedValue(types) },
    };
    const result = await uc.buildAsistencia(mockClient as never, 'student-1', 'cc-1', 20);
    expect(result!.diasPresente).toBe(2);
    expect(result!.totalDias).toBe(2);
    expect(result!.porcentaje).toBe('100.0');
    expect(result!.inasistencias).toBe(0);
  });

  // ── S-C: per-level resolution (Primario vs Secundario) ──────────────────────
  // Same code "T" resolves differently per level — no cross-level contamination.

  it('S-C: same code "T" — Primario (present) vs Secundario (absence) → different summaries', async () => {
    const registers = [{ days: { '1': 'T' } }];

    const clientPrimario = {
      asistenciaXAlumnoXCursoXCiclo: { findMany: vi.fn().mockResolvedValue(registers) },
      attendanceType: { findMany: vi.fn().mockResolvedValue([{ code: 'T', isPresent: true,  absenceValue: 0 }]) },
    };
    const resultPrimario = await uc.buildAsistencia(clientPrimario as never, 'stu-p', 'cc-p', 20);

    const clientSecundario = {
      asistenciaXAlumnoXCursoXCiclo: { findMany: vi.fn().mockResolvedValue(registers) },
      attendanceType: { findMany: vi.fn().mockResolvedValue([{ code: 'T', isPresent: false, absenceValue: 1 }]) },
    };
    const resultSecundario = await uc.buildAsistencia(clientSecundario as never, 'stu-s', 'cc-s', 30);

    expect(resultPrimario!.diasPresente).toBe(1);
    expect(resultPrimario!.inasistencias).toBe(0);
    expect(resultSecundario!.diasPresente).toBe(0);
    expect(resultSecundario!.inasistencias).toBe(1);
  });

  // ── 1.5 absenceValue: counted in totalDias only (ADR-5) ────────────────────

  it('absenceValue 1.5: counted in totalDias, NOT in inasistencias nor mediasFaltas', async () => {
    const registers = [{ days: { '1': 'X' } }];
    const types = [{ code: 'X', isPresent: false, absenceValue: 1.5 }];
    const mockClient = {
      asistenciaXAlumnoXCursoXCiclo: { findMany: vi.fn().mockResolvedValue(registers) },
      attendanceType: { findMany: vi.fn().mockResolvedValue(types) },
    };
    const result = await uc.buildAsistencia(mockClient as never, 'student-1', 'cc-1', 20);
    expect(result!.totalDias).toBe(1);
    expect(result!.diasPresente).toBe(0);
    expect(result!.inasistencias).toBe(0);
    expect(result!.mediasFaltas).toBe(0);
    expect(result!.porcentaje).toBe('0.0');
  });

  // ── unknown code: counted in totalDias only ─────────────────────────────────

  it('unknown code not in catalog: counted in totalDias, not classified', async () => {
    const registers = [{ days: { '1': 'ZZUNK' } }];
    const mockClient = {
      asistenciaXAlumnoXCursoXCiclo: { findMany: vi.fn().mockResolvedValue(registers) },
      attendanceType: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const result = await uc.buildAsistencia(mockClient as never, 'student-1', 'cc-1', 20);
    expect(result!.totalDias).toBe(1);
    expect(result!.diasPresente).toBe(0);
    expect(result!.inasistencias).toBe(0);
    expect(result!.mediasFaltas).toBe(0);
  });

  // ── S-J: GENERAL-only — per-materia table never queried ─────────────────────

  it('S-J: only asistenciaXAlumnoXCursoXCiclo is queried; per-materia table never called', async () => {
    const registers = [{ days: { '1': 'P' } }];
    const types = [{ code: 'P', isPresent: true, absenceValue: 0 }];
    const perMateria = { findMany: vi.fn().mockResolvedValue([]) };
    const mockClient = {
      asistenciaXAlumnoXCursoXCiclo: { findMany: vi.fn().mockResolvedValue(registers) },
      attendanceType: { findMany: vi.fn().mockResolvedValue(types) },
      asistenciaXMateriaXAlumnoXCursoXCiclo: perMateria,
    };
    await uc.buildAsistencia(mockClient as never, 'student-1', 'cc-1', 20);
    expect(perMateria.findMany).not.toHaveBeenCalled();
  });

  // ── correct query filters ────────────────────────────────────────────────────

  it('queries asistenciaXAlumnoXCursoXCiclo with { courseCycleId, studentId }', async () => {
    const findManyRegisters = vi.fn().mockResolvedValue([]);
    const mockClient = {
      asistenciaXAlumnoXCursoXCiclo: { findMany: findManyRegisters },
      attendanceType: { findMany: vi.fn().mockResolvedValue([]) },
    };
    await uc.buildAsistencia(mockClient as never, 'stu-abc', 'cc-xyz', 30);
    expect(findManyRegisters).toHaveBeenCalledWith({
      where: { courseCycleId: 'cc-xyz', studentId: 'stu-abc' },
    });
  });

  // ── Per-level regression (INICIAL / PRIMARIO / SECUNDARIO / TERCIARIO) ───────

  it('per-level INICIAL (10): catalog queried with level=10, summary correct', async () => {
    const registers = [{ days: { '1': 'PI' } }];
    const types = [{ code: 'PI', isPresent: true, absenceValue: 0 }];
    const findManyTypes = vi.fn().mockResolvedValue(types);
    const mockClient = {
      asistenciaXAlumnoXCursoXCiclo: { findMany: vi.fn().mockResolvedValue(registers) },
      attendanceType: { findMany: findManyTypes },
    };
    const result = await uc.buildAsistencia(mockClient as never, 'stu-ini', 'cc-ini', 10);
    expect(findManyTypes).toHaveBeenCalledWith({ where: { level: 10 } });
    expect(result!.totalDias).toBe(1);
    expect(result!.diasPresente).toBe(1);
    expect(result!.porcentaje).toBe('100.0');
  });

  it('per-level PRIMARIO (20): catalog queried with level=20, 1P+1A → 50%', async () => {
    const registers = [{ days: { '1': 'P', '2': 'A' } }];
    const types = [
      { code: 'P', isPresent: true,  absenceValue: 0 },
      { code: 'A', isPresent: false, absenceValue: 1 },
    ];
    const findManyTypes = vi.fn().mockResolvedValue(types);
    const mockClient = {
      asistenciaXAlumnoXCursoXCiclo: { findMany: vi.fn().mockResolvedValue(registers) },
      attendanceType: { findMany: findManyTypes },
    };
    const result = await uc.buildAsistencia(mockClient as never, 'stu-prim', 'cc-prim', 20);
    expect(findManyTypes).toHaveBeenCalledWith({ where: { level: 20 } });
    expect(result!.totalDias).toBe(2);
    expect(result!.diasPresente).toBe(1);
    expect(result!.inasistencias).toBe(1);
    expect(result!.porcentaje).toBe('50.0');
  });

  it('per-level SECUNDARIO (30): catalog queried with level=30, 1P+1M → 50%', async () => {
    const registers = [{ days: { '1': 'PS', '2': 'MS' } }];
    const types = [
      { code: 'PS', isPresent: true,  absenceValue: 0 },
      { code: 'MS', isPresent: false, absenceValue: 0.5 },
    ];
    const findManyTypes = vi.fn().mockResolvedValue(types);
    const mockClient = {
      asistenciaXAlumnoXCursoXCiclo: { findMany: vi.fn().mockResolvedValue(registers) },
      attendanceType: { findMany: findManyTypes },
    };
    const result = await uc.buildAsistencia(mockClient as never, 'stu-sec', 'cc-sec', 30);
    expect(findManyTypes).toHaveBeenCalledWith({ where: { level: 30 } });
    expect(result!.totalDias).toBe(2);
    expect(result!.diasPresente).toBe(1);
    expect(result!.mediasFaltas).toBe(1);
    expect(result!.porcentaje).toBe('50.0');
  });

  it('per-level TERCIARIO (40): catalog queried with level=40, 1P+1A+1M → 33.3%', async () => {
    const registers = [{ days: { '1': 'PT', '2': 'AT', '3': 'MT' } }];
    const types = [
      { code: 'PT', isPresent: true,  absenceValue: 0 },
      { code: 'AT', isPresent: false, absenceValue: 1 },
      { code: 'MT', isPresent: false, absenceValue: 0.5 },
    ];
    const findManyTypes = vi.fn().mockResolvedValue(types);
    const mockClient = {
      asistenciaXAlumnoXCursoXCiclo: { findMany: vi.fn().mockResolvedValue(registers) },
      attendanceType: { findMany: findManyTypes },
    };
    const result = await uc.buildAsistencia(mockClient as never, 'stu-ter', 'cc-ter', 40);
    expect(findManyTypes).toHaveBeenCalledWith({ where: { level: 40 } });
    expect(result!.totalDias).toBe(3);
    expect(result!.diasPresente).toBe(1);
    expect(result!.inasistencias).toBe(1);
    expect(result!.mediasFaltas).toBe(1);
    expect(result!.porcentaje).toBe('33.3');
  });
});

// ── T12/T13: execute() repointed to AlumnosXCursoXCiclo (adapter block) ──────
// RED until T13 rewrites execute(); GREEN after T13.

describe('GenerateBoletinUseCase.execute — repointed to AlumnosXCursoXCiclo', () => {
  function makeAxccClient(opts: {
    axcc?: object | null;
    cc?: object | null;
    student?: object | null;
  } = {}) {
    const axcc = opts.axcc !== undefined ? opts.axcc : {
      id: 'axcc-1',
      courseCycleId: 'cc-uuid-1',
      studentId: 'stu-1',
      printable: true,
    };
    const cc = opts.cc !== undefined ? opts.cc : {
      uuid: 'cc-uuid-1',
      level: 20,
      cycleId: 'academic-cycle-uuid-1',
      course: { grade: '2°', division: 'A', academicYear: '2025' },
    };
    const student = opts.student !== undefined ? opts.student : {
      id: 'stu-1', firstName: 'Juan', lastName: 'Pérez', dni: '12345678',
    };
    return {
      alumnosXCursoXCiclo: { findUnique: vi.fn().mockResolvedValue(axcc) },
      courseCycle: { findUnique: vi.fn().mockResolvedValue(cc) },
      student: { findUnique: vi.fn().mockResolvedValue(student) },
      attendance: { findMany: vi.fn().mockResolvedValue([]) },
    };
  }

  function makeUcForExecute(cachedPath: string | null = null) {
    return new GenerateBoletinUseCase(
      { generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')) } as never,
      {
        getPath: vi.fn().mockResolvedValue(cachedPath),
        save: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      } as never,
      { getMasterClient: vi.fn().mockReturnValue({ institution: { findUnique: vi.fn().mockResolvedValue(null) } }) } as never,
    );
  }

  beforeEach(() => {
    vi.mocked(TenantContext.getClient).mockReset();
    vi.mocked(TenantContext.getInstitutionId).mockReturnValue(null);
  });

  it('T12-A: throws AXCC_NOT_FOUND (404) when AlumnosXCursoXCiclo row does not exist', async () => {
    const client = makeAxccClient({ axcc: null });
    vi.mocked(TenantContext.getClient).mockReturnValue(client as any);

    const uc = makeUcForExecute();
    await expect(uc.execute('axcc-missing')).rejects.toThrowError(
      expect.objectContaining({ code: 'AXCC_NOT_FOUND', httpStatus: 404 }),
    );
  });

  it('T12-B: throws STUDENT_NOT_PRINTABLE (422) when axcc.printable is false', async () => {
    const client = makeAxccClient({ axcc: { id: 'axcc-1', courseCycleId: 'cc-1', studentId: 'stu-1', printable: false } });
    vi.mocked(TenantContext.getClient).mockReturnValue(client as any);

    const uc = makeUcForExecute();
    await expect(uc.execute('axcc-1')).rejects.toThrowError(
      expect.objectContaining({ code: 'STUDENT_NOT_PRINTABLE', httpStatus: 422 }),
    );
  });

  it('T12-C: throws COURSE_CYCLE_NOT_FOUND when CourseCycle cannot be resolved from axcc.courseCycleId', async () => {
    // Verifies that execute() fetches courseCycle (not enrollment), so it can gate on cc being found
    const axcc = { id: 'axcc-1', courseCycleId: 'cc-missing', studentId: 'stu-1', printable: true };
    const client = {
      alumnosXCursoXCiclo: { findUnique: vi.fn().mockResolvedValue(axcc) },
      courseCycle: { findUnique: vi.fn().mockResolvedValue(null) }, // cc not found
      student: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    vi.mocked(TenantContext.getClient).mockReturnValue(client as any);

    const uc = makeUcForExecute(null);
    await expect(uc.execute('axcc-1')).rejects.toThrowError(
      expect.objectContaining({ code: 'COURSE_CYCLE_NOT_FOUND', httpStatus: 404 }),
    );
    expect(client.alumnosXCursoXCiclo.findUnique).toHaveBeenCalled();
    expect(client.courseCycle.findUnique).toHaveBeenCalled();
  });

  it('T12-D: cache key is axcc.id (not enrollmentId); storage.getPath called with axcc.id', async () => {
    // Build a minimal full-path mock (Inicial level = simplest: no Primario repos needed)
    const axcc = { id: 'axcc-cache-key', courseCycleId: 'cc-1', studentId: 'stu-1', printable: true };
    const cc = {
      uuid: 'cc-1', level: 10 /* Inicial */, cycleId: 'cyc-1',
      course: { grade: null, division: null, academicYear: '2026' },
    };
    const student = { id: 'stu-1', firstName: 'Juan', lastName: 'García', dni: '11111111' };
    const client = {
      alumnosXCursoXCiclo: { findUnique: vi.fn().mockResolvedValue(axcc) },
      courseCycle: {
        findUnique: vi.fn().mockResolvedValue(cc),
        findMany: vi.fn().mockResolvedValue([]),
      },
      student: { findUnique: vi.fn().mockResolvedValue(student) },
      salaEnrollment: { findFirst: vi.fn().mockResolvedValue(null) },
      // SDD-5 repoint: buildAsistencia now reads these two models (not attendance)
      asistenciaXAlumnoXCursoXCiclo: { findMany: vi.fn().mockResolvedValue([]) },
      attendanceType: { findMany: vi.fn().mockResolvedValue([]) },
    };
    vi.mocked(TenantContext.getClient).mockReturnValue(client as any);

    const storage = {
      getPath: vi.fn().mockResolvedValue(null), // cache miss → generate
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const uc = new GenerateBoletinUseCase(
      { generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')) } as never,
      storage as never,
      { getMasterClient: vi.fn().mockReturnValue({ institution: { findUnique: vi.fn().mockResolvedValue(null) } }) } as never,
    );

    await uc.execute('axcc-cache-key');

    // Cache get MUST use axcc.id
    expect(storage.getPath).toHaveBeenCalledWith('axcc-cache-key');
    // Cache save MUST use axcc.id
    expect(storage.save).toHaveBeenCalledWith('axcc-cache-key', expect.any(Buffer));
  });
});

// ── Cache-first logic (C3 — if file exists, return it without regenerating) ───

describe('GenerateBoletinUseCase — cache-first', () => {
  it('pdfStorage.getPath returns the cached path when a PDF exists', async () => {
    const storage = makePdfStorage('/some/path.pdf');
    const cachedPath = await storage.getPath('enrollment-123');
    expect(cachedPath).toBe('/some/path.pdf');
  });

  it('pdfStorage.getPath returns null when no PDF is cached', async () => {
    const storage = makePdfStorage(null);
    const cachedPath = await storage.getPath('enrollment-123');
    expect(cachedPath).toBeNull();
  });
});

// ── BoletinError shape ────────────────────────────────────────────────────────

describe('BoletinError', () => {
  it('stores code and httpStatus', () => {
    const e = new BoletinError('test message', 'TEST_CODE', 404);
    expect(e.message).toBe('test message');
    expect(e.code).toBe('TEST_CODE');
    expect(e.httpStatus).toBe(404);
    expect(e.name).toBe('BoletinError');
  });

  it('defaults httpStatus to 422', () => {
    const e = new BoletinError('msg', 'CODE');
    expect(e.httpStatus).toBe(422);
  });
});

// ── buildMesasExamen (W2 — exam board results for SECUNDARIO) ─────────────────

describe('GenerateBoletinUseCase.buildMesasExamen', () => {
  let uc: GenerateBoletinUseCase;

  beforeEach(() => {
    uc = new GenerateBoletinUseCase(
      makePdfGenerator() as never,
      makePdfStorage() as never,
      makePrisma() as never,
    );
  });

  it('returns empty array when student has no inscripciones', async () => {
    const mockClient = {
      mesaExamenInscripcion: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const result = await uc.buildMesasExamen(mockClient as never, 'student-1');
    expect(result).toEqual([]);
  });

  it('maps inscripciones to MesaExamenBoletin shape', async () => {
    const mockRows = [
      {
        notaFinal: 8,
        condicionFinal: 'APROBADO',
        mesa: {
          fecha: new Date('2025-12-15'),
          turno: 'DICIEMBRE',
          subject: { name: 'Matemática' },
        },
      },
      {
        notaFinal: null,
        condicionFinal: 'AUSENTE',
        mesa: {
          fecha: new Date('2026-02-20'),
          turno: 'FEBRERO',
          subject: { name: 'Historia' },
        },
      },
    ];
    const mockClient = {
      mesaExamenInscripcion: {
        findMany: vi.fn().mockResolvedValue(mockRows),
      },
    };

    const result: MesaExamenBoletin[] = await uc.buildMesasExamen(mockClient as never, 'student-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      materia: 'Matemática',
      turno: 'DICIEMBRE',
      fecha: '15/12/2025',
      nota: '8',
      condicion: 'APROBADO',
      aprobada: true,
    });
    expect(result[1]).toEqual({
      materia: 'Historia',
      turno: 'FEBRERO',
      fecha: '20/02/2026',
      nota: '—',
      condicion: 'AUSENTE',
      aprobada: false,
    });
  });

  it('queries with correct filters (studentId, active mesa)', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const mockClient = { mesaExamenInscripcion: { findMany } };
    await uc.buildMesasExamen(mockClient as never, 'stu-abc');
    expect(findMany).toHaveBeenCalledWith({
      where: { studentId: 'stu-abc', mesa: { active: true } },
      include: { mesa: { include: { subject: true } } },
      orderBy: { mesa: { fecha: 'asc' } },
    });
  });

  it('formats nota as "—" when notaFinal is null', async () => {
    const mockRows = [
      {
        notaFinal: null,
        condicionFinal: 'AUSENTE',
        mesa: {
          fecha: new Date('2025-12-01'),
          turno: 'DICIEMBRE',
          subject: { name: 'Física' },
        },
      },
    ];
    const mockClient = { mesaExamenInscripcion: { findMany: vi.fn().mockResolvedValue(mockRows) } };
    const result = await uc.buildMesasExamen(mockClient as never, 'student-x');
    expect(result[0].nota).toBe('—');
  });
});

// ── PR7-T1: Regression — non-Primario level uses NotaTrimestral path ──────────
// Safety net: proves the existing path is byte-for-byte unchanged after PR7.
// Stays GREEN throughout; must never regress.

function makeRepos() {
  const sgpRepo = {
    findByCourseCycleAndSubject: vi.fn().mockResolvedValue([]),
    ensureSnapshot: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
  };
  const pgRepo = {
    findByCourseCycleAndSubject: vi.fn().mockResolvedValue([]),
    findByStudentAndCourseCycle: vi.fn().mockResolvedValue([]),
    saveMany: vi.fn().mockResolvedValue(undefined),
  };
  const fgRepo = {
    findByCourseCycleAndSubject: vi.fn().mockResolvedValue([]),
    findByStudentAndCourseCycle: vi.fn().mockResolvedValue([]),
    saveMany: vi.fn().mockResolvedValue(undefined),
  };
  const cvRepo = {
    findById: vi.fn().mockResolvedValue(null),
    findByStudentAndStudyPlanSubject: vi.fn().mockResolvedValue([]),
    findByCourseCycleAndStudyPlanSubject: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    bulkCreate: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  return { sgpRepo, pgRepo, fgRepo, cvRepo };
}

describe('GenerateBoletinUseCase.buildMaterias — PR7-T1 regression: non-Primario path', () => {
  let uc: GenerateBoletinUseCase;
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    repos = makeRepos();
    uc = new GenerateBoletinUseCase(
      makePdfGenerator() as never,
      makePdfStorage() as never,
      makePrisma() as never,
      repos.sgpRepo as never,
      repos.pgRepo as never,
      repos.fgRepo as never,
      repos.cvRepo as never,
    );
  });

  // PR6-T2 update: After PR6, Secundario (level=30) routes to buildMateriasSecundario.
  // This test is RED until PR6-T4 implements the new dispatch.
  it('Secundario (level=30): routes to buildMateriasSecundario (NOT legacy notaTrimestral)', async () => {
    const notaTrimestralFindMany = vi.fn().mockResolvedValue([]);
    const studyPlanCourseFind = vi.fn().mockResolvedValue(null); // no subjects → fast exit
    const mockClient = {
      courseCycle: {
        findMany: vi.fn().mockResolvedValue([{
          uuid: 'cc-sec',
          courseId: 'section-sec',
          level: 30,
          studyPlanId: 'sp-sec',
        }]),
      },
      studyPlanCourse: { findFirst: studyPlanCourseFind },
      notaTrimestral: { findMany: notaTrimestralFindMany },
    };

    const enrollment = { id: 'e-sec', studentId: 'stu-sec', level: 30, cycleId: 'cyc-1', academicYear: '2026' };
    const result = await (uc as any).buildMaterias(mockClient, enrollment);

    // After PR6: legacy NotaTrimestral path NOT called for level=30
    expect(notaTrimestralFindMany).not.toHaveBeenCalled();

    // buildMateriasSecundario path IS used (resolveSubjectsForCC calls studyPlanCourse.findFirst)
    expect(studyPlanCourseFind).toHaveBeenCalled();

    // After PR6-T4: buildMaterias returns { materias, previas? } — new shape
    expect(Array.isArray(result.materias)).toBe(true);
    expect(result.previas).toEqual([]);
  });

  it('INICIAL (level=10): does NOT call Primario repos', async () => {
    const mockClient = {
      courseCycle: {
        findMany: vi.fn().mockResolvedValue([{ uuid: 'cc-ini', courseId: 'sec-ini', level: 10 }]),
      },
      materiaXCursoXCiclo: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const enrollment = { id: 'e-ini', studentId: 'stu-ini', level: 10, cycleId: 'cyc-ini', academicYear: '2026' };
    await (uc as any).buildMaterias(mockClient, enrollment);

    expect(repos.pgRepo.findByStudentAndCourseCycle).not.toHaveBeenCalled();
    expect(repos.fgRepo.findByStudentAndCourseCycle).not.toHaveBeenCalled();
  });
});

// ── PR7-T2: buildMateriasPrimario — Primario-specific data reads ──────────────

describe('GenerateBoletinUseCase.buildMateriasPrimario — PR7-T2', () => {
  const STUDENT_ID = 'stu-primario';
  const CC_UUID = 'cc-primario';
  const SUBJECT_ID = 'subj-mat';

  function makeFullMockClient(overrides?: Partial<Record<string, unknown>>) {
    return {
      courseCycle: {
        findMany: vi.fn().mockResolvedValue([
          { uuid: CC_UUID, courseId: 'section-p', level: 21, studyPlanId: 'sp-1' },
        ]),
      },
      studyPlanCourse: {
        findFirst: vi.fn().mockResolvedValue({ id: 'spc-1' }),
      },
      studyPlanSubject: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'sps-1', subjectId: SUBJECT_ID, subject: { id: SUBJECT_ID, name: 'Matemática' } },
        ]),
      },
      // W2: gradingPeriodTemplateItem lookup for periodItemId → sortOrder alignment
      gradingPeriodTemplateItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      ...overrides,
    };
  }

  let uc: GenerateBoletinUseCase;
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    repos = makeRepos();
    uc = new GenerateBoletinUseCase(
      makePdfGenerator() as never,
      makePdfStorage() as never,
      makePrisma() as never,
      repos.sgpRepo as never,
      repos.pgRepo as never,
      repos.fgRepo as never,
      repos.cvRepo as never,
    );
  });

  it('reads SubjectGradingPeriod for dynamic period columns', async () => {
    repos.sgpRepo.findByCourseCycleAndSubject.mockResolvedValue([
      { periodOrdinal: 1, periodName: '1° Trimestre', courseCycleId: CC_UUID, subjectId: SUBJECT_ID },
      { periodOrdinal: 2, periodName: '2° Trimestre', courseCycleId: CC_UUID, subjectId: SUBJECT_ID },
    ]);

    const enrollment = { studentId: STUDENT_ID, level: 21, cycleId: 'cyc-p', academicYear: '2026' };
    const result = await (uc as any).buildMateriasPrimario(makeFullMockClient(), enrollment);

    expect(repos.sgpRepo.findByCourseCycleAndSubject).toHaveBeenCalledWith(CC_UUID, SUBJECT_ID);
    expect(result[0].periodGrades).toHaveLength(2);
    expect(result[0].periodGrades[0].periodName).toBe('1° Trimestre');
    expect(result[0].periodGrades[1].periodName).toBe('2° Trimestre');
  });

  it('reads SubjectPeriodGrade for period grades + pa/ppi/pp (absent → blank string)', async () => {
    repos.sgpRepo.findByCourseCycleAndSubject.mockResolvedValue([
      { periodOrdinal: 1, periodName: '1° Trim', courseCycleId: CC_UUID, subjectId: SUBJECT_ID },
      { periodOrdinal: 2, periodName: '2° Trim', courseCycleId: CC_UUID, subjectId: SUBJECT_ID },
    ]);
    repos.pgRepo.findByStudentAndCourseCycle.mockResolvedValue([
      {
        subjectId: SUBJECT_ID, periodOrdinal: 1, gradeCode: 'A',
        gradeScaleValueId: 'gsv-1', internalStatus: null, pa: true, ppi: false, pp: false,
      },
      // period 2 is absent → gradeCode should be blank
    ]);

    const enrollment = { studentId: STUDENT_ID, level: 21, cycleId: 'cyc-p', academicYear: '2026' };
    const result = await (uc as any).buildMateriasPrimario(makeFullMockClient(), enrollment);

    expect(repos.pgRepo.findByStudentAndCourseCycle).toHaveBeenCalledWith(STUDENT_ID, CC_UUID);
    expect(result[0].periodGrades[0].gradeCode).toBe('A');
    expect(result[0].periodGrades[1].gradeCode).toBe('');   // absent → blank, not error
  });

  it('reads SubjectFinalGrade — 4 instances, absent row → blank not error', async () => {
    repos.fgRepo.findByStudentAndCourseCycle.mockResolvedValue([
      { subjectId: SUBJECT_ID, type: 'FINAL',      gradeCode: 'A+',  passed: true },
      // DICIEMBRE and MARZO absent
      { subjectId: SUBJECT_ID, type: 'DEFINITIVA',  gradeCode: 'A+',  passed: true },
    ]);

    const enrollment = { studentId: STUDENT_ID, level: 21, cycleId: 'cyc-p', academicYear: '2026' };
    const result = await (uc as any).buildMateriasPrimario(makeFullMockClient(), enrollment);

    expect(repos.fgRepo.findByStudentAndCourseCycle).toHaveBeenCalledWith(STUDENT_ID, CC_UUID);
    const finals = result[0].finalGrades as Array<{ type: string; gradeCode: string }>;
    expect(finals).toHaveLength(4);
    expect(finals.find((f) => f.type === 'FINAL')?.gradeCode).toBe('A+');
    expect(finals.find((f) => f.type === 'DICIEMBRE')?.gradeCode).toBe('');   // absent → blank
    expect(finals.find((f) => f.type === 'MARZO')?.gradeCode).toBe('');      // absent → blank
    expect(finals.find((f) => f.type === 'DEFINITIVA')?.gradeCode).toBe('A+');
  });

  it('filters CompetencyPeriodValuation to imprimible=true; excludes other students', async () => {
    repos.cvRepo.findByCourseCycleAndStudyPlanSubject.mockResolvedValue([
      {
        valuationId: 'val-1', studentId: STUDENT_ID, competencyId: 'comp-1',
        competencyName: 'Lee y comprende',
        periodValuations: [
          { periodItemId: 'pi-1', imprimible: true,  gradeCode: 'MB', modificable: true, gradeScaleValueId: 'gsv-1', internalStatus: null },
          { periodItemId: 'pi-2', imprimible: false, gradeCode: 'B',  modificable: true, gradeScaleValueId: 'gsv-2', internalStatus: null },
        ],
      },
      {
        valuationId: 'val-2', studentId: STUDENT_ID, competencyId: 'comp-2',
        competencyName: 'No imprimible',
        periodValuations: [
          { periodItemId: 'pi-1', imprimible: false, gradeCode: 'B', modificable: true, gradeScaleValueId: null, internalStatus: null },
        ],
      },
      {
        // Different student — must be excluded
        valuationId: 'val-3', studentId: 'other-student', competencyId: 'comp-1',
        competencyName: 'Lee y comprende',
        periodValuations: [
          { periodItemId: 'pi-1', imprimible: true, gradeCode: 'MB', modificable: true, gradeScaleValueId: 'gsv-1', internalStatus: null },
        ],
      },
    ]);

    const enrollment = { studentId: STUDENT_ID, level: 21, cycleId: 'cyc-p', academicYear: '2026' };
    const result = await (uc as any).buildMateriasPrimario(makeFullMockClient(), enrollment);

    expect(repos.cvRepo.findByCourseCycleAndStudyPlanSubject).toHaveBeenCalledWith(CC_UUID, 'sps-1');
    const comps = result[0].competencies as Array<{ competencyName: string }>;
    // Only comp-1 for STUDENT_ID has imprimible=true; comp-2 has none; other-student is excluded
    expect(comps).toHaveLength(1);
    expect(comps[0].competencyName).toBe('Lee y comprende');
  });

  it('OR-aggregates pa/ppi/pp flags across reported periods per subject', async () => {
    repos.pgRepo.findByStudentAndCourseCycle.mockResolvedValue([
      { subjectId: SUBJECT_ID, periodOrdinal: 1, gradeCode: 'A', pa: true,  ppi: false, pp: false },
      { subjectId: SUBJECT_ID, periodOrdinal: 2, gradeCode: 'B', pa: false, ppi: true,  pp: false },
      { subjectId: SUBJECT_ID, periodOrdinal: 3, gradeCode: 'C', pa: false, ppi: false, pp: true  },
    ]);

    const enrollment = { studentId: STUDENT_ID, level: 21, cycleId: 'cyc-p', academicYear: '2026' };
    const result = await (uc as any).buildMateriasPrimario(makeFullMockClient(), enrollment);

    // OR of: (true,false,false) | (false,true,false) | (false,false,true) → all true
    expect(result[0].flags).toEqual({ pa: true, ppi: true, pp: true });
  });

  it('returns empty array when no Primario courseCycles found', async () => {
    const clientNoCCs = {
      ...makeFullMockClient(),
      courseCycle: {
        findMany: vi.fn().mockResolvedValue([
          { uuid: 'cc-sec', courseId: 'section-sec', level: 30, studyPlanId: 'sp-sec' },
        ]),
      },
    };
    const enrollment = { studentId: STUDENT_ID, level: 21, cycleId: 'cyc-p', academicYear: '2026' };
    const result = await (uc as any).buildMateriasPrimario(clientNoCCs, enrollment);
    expect(result).toEqual([]);
  });
});

// ── W2: buildMateriasPrimario — per-period competency columns ─────────────────
// BP-R5 follow-up: competencies render one grade per imprimible period column,
// not collapsed to the first imprimible period.

describe('GenerateBoletinUseCase.buildMateriasPrimario — W2: per-period competency grades', () => {
  const STUDENT_ID = 'stu-primario';
  const CC_UUID    = 'cc-primario';
  const SUBJECT_ID = 'subj-mat';

  /** Mock client with gradingPeriodTemplateItem for periodItemId → sortOrder resolution. */
  function makeW2Client(periodItems: Array<{ id: string; sortOrder: number }> = []) {
    return {
      courseCycle: {
        findMany: vi.fn().mockResolvedValue([
          { uuid: CC_UUID, courseId: 'section-p', level: 21, studyPlanId: 'sp-1' },
        ]),
      },
      studyPlanCourse: { findFirst: vi.fn().mockResolvedValue({ id: 'spc-1' }) },
      studyPlanSubject: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'sps-1', subjectId: SUBJECT_ID, subject: { id: SUBJECT_ID, name: 'Matemática' } },
        ]),
      },
      gradingPeriodTemplateItem: {
        findMany: vi.fn().mockResolvedValue(periodItems),
      },
    };
  }

  let uc: GenerateBoletinUseCase;
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    repos = makeRepos();
    uc = new GenerateBoletinUseCase(
      makePdfGenerator() as never,
      makePdfStorage() as never,
      makePrisma() as never,
      repos.sgpRepo as never,
      repos.pgRepo as never,
      repos.fgRepo as never,
      repos.cvRepo as never,
    );
  });

  it('W2-T1 [RED→GREEN]: competency imprimible in periods 1+3 → periodGrades array, period-2 blank', async () => {
    repos.sgpRepo.findByCourseCycleAndSubject.mockResolvedValue([
      { periodOrdinal: 1, periodName: '1°Bim', courseCycleId: CC_UUID, subjectId: SUBJECT_ID },
      { periodOrdinal: 2, periodName: '2°Bim', courseCycleId: CC_UUID, subjectId: SUBJECT_ID },
      { periodOrdinal: 3, periodName: '3°Bim', courseCycleId: CC_UUID, subjectId: SUBJECT_ID },
    ]);
    repos.cvRepo.findByCourseCycleAndStudyPlanSubject.mockResolvedValue([
      {
        valuationId: 'val-1', studentId: STUDENT_ID, competencyId: 'comp-1',
        competencyName: 'Resolución de problemas',
        periodValuations: [
          { periodItemId: 'pi-1', imprimible: true,  gradeCode: 'B',  modificable: true, gradeScaleValueId: null, internalStatus: null },
          { periodItemId: 'pi-2', imprimible: false, gradeCode: 'MB', modificable: true, gradeScaleValueId: null, internalStatus: null },
          { periodItemId: 'pi-3', imprimible: true,  gradeCode: 'MB', modificable: true, gradeScaleValueId: null, internalStatus: null },
        ],
      },
    ]);

    const enrollment = { studentId: STUDENT_ID, level: 21, cycleId: 'cyc-p', academicYear: '2026' };
    const result = await (uc as any).buildMateriasPrimario(
      makeW2Client([{ id: 'pi-1', sortOrder: 1 }, { id: 'pi-2', sortOrder: 2 }, { id: 'pi-3', sortOrder: 3 }]),
      enrollment,
    );

    const comps = result[0].competencies as Array<{ competencyName: string; periodGrades: Array<{ gradeCode: string }> }>;
    expect(comps).toHaveLength(1);
    expect(comps[0].competencyName).toBe('Resolución de problemas');
    expect(comps[0].periodGrades).toHaveLength(3);
    expect(comps[0].periodGrades[0].gradeCode).toBe('B');   // period 1: imprimible=true
    expect(comps[0].periodGrades[1].gradeCode).toBe('');    // period 2: imprimible=false → blank
    expect(comps[0].periodGrades[2].gradeCode).toBe('MB'); // period 3: imprimible=true
  });

  it('W2-T2: competency not imprimible in any period → excluded (BP-R5 unchanged)', async () => {
    repos.sgpRepo.findByCourseCycleAndSubject.mockResolvedValue([
      { periodOrdinal: 1, periodName: '1°Bim', courseCycleId: CC_UUID, subjectId: SUBJECT_ID },
    ]);
    repos.cvRepo.findByCourseCycleAndStudyPlanSubject.mockResolvedValue([
      {
        valuationId: 'val-2', studentId: STUDENT_ID, competencyId: 'comp-2',
        competencyName: 'Comunicación oral',
        periodValuations: [
          { periodItemId: 'pi-1', imprimible: false, gradeCode: 'B', modificable: true, gradeScaleValueId: null, internalStatus: null },
        ],
      },
    ]);

    const enrollment = { studentId: STUDENT_ID, level: 21, cycleId: 'cyc-p', academicYear: '2026' };
    const result = await (uc as any).buildMateriasPrimario(
      makeW2Client([{ id: 'pi-1', sortOrder: 1 }]),
      enrollment,
    );

    expect(result[0].competencies).toHaveLength(0);
  });
});

// ── PR6-T1: Regression — Terciario unaffected after PR6 ──────────────────────
// Safety net: proves that adding the Secundario branch does NOT alter Terciario.
// These tests are RED until PR6-T4 changes buildMaterias to return { materias, previas? }.
// After PR6-T4 they become GREEN and remain GREEN as regression guards.

describe('GenerateBoletinUseCase.buildMaterias — PR6-T1 regression: Terciario', () => {
  let uc: GenerateBoletinUseCase;
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    repos = makeRepos();
    uc = new GenerateBoletinUseCase(
      makePdfGenerator() as never,
      makePdfStorage() as never,
      makePrisma() as never,
      repos.sgpRepo as never,
      repos.pgRepo as never,
      repos.fgRepo as never,
      repos.cvRepo as never,
    );
  });

  it('Terciario (level=40): new buildMateriasTerciario path used; Primario/Secundario repos NOT called', async () => {
    // Terciario dispatches to buildMateriasTerciario (decade 4 branch), NOT the legacy
    // NotaTrimestral path and NOT the Primario/Secundario repo branches.
    const inscripcionFindMany = vi.fn().mockResolvedValue([]);
    const notaTrimestralFindMany = vi.fn().mockResolvedValue([]);
    const mockClient = {
      inscripcionMateria: { findMany: inscripcionFindMany },
      actaExamenNota:     { findMany: vi.fn().mockResolvedValue([]) },
      llamadoExamen:      { findMany: vi.fn().mockResolvedValue([]) },
      notaTrimestral:     { findMany: notaTrimestralFindMany },
      courseCycle:        { findMany: vi.fn().mockResolvedValue([]) },
    };

    const enrollment = { id: 'e-ter', studentId: 'stu-ter', level: 40, cycleId: null, academicYear: '2026' };
    const result = await (uc as any).buildMaterias(mockClient, enrollment);

    // Primario/Secundario repos MUST NOT be called for Terciario
    expect(repos.pgRepo.findByStudentAndCourseCycle).not.toHaveBeenCalled();
    expect(repos.fgRepo.findByStudentAndCourseCycle).not.toHaveBeenCalled();
    expect(repos.sgpRepo.findByCourseCycleAndSubject).not.toHaveBeenCalled();
    expect(repos.cvRepo.findByCourseCycleAndStudyPlanSubject).not.toHaveBeenCalled();

    // New Terciario path: inscripcionMateria.findMany WAS called
    expect(inscripcionFindMany).toHaveBeenCalled();

    // Legacy NotaTrimestral path was NOT called
    expect(notaTrimestralFindMany).not.toHaveBeenCalled();

    // Result structure from buildMateriasTerciario
    expect(Array.isArray(result.materias)).toBe(true);
    expect(result.previas).toBeUndefined();
    // New fields (empty since no inscripciones)
    expect(result.carreraName).toBeNull();
    expect(Array.isArray(result.cuatrimestresTerciario)).toBe(true);
  });
});

// ── PR6-T2: buildMateriasSecundario ──────────────────────────────────────────
// These tests are RED until PR6-T4 implements buildMateriasSecundario.

function makeMpRepo(previas: unknown[] = []) {
  return {
    findByStudent: vi.fn().mockResolvedValue([]),
    findByStudentAndAcademicYear: vi.fn().mockResolvedValue(previas),
    saveMany: vi.fn().mockResolvedValue(undefined),
  };
}

describe('GenerateBoletinUseCase.buildMateriasSecundario — PR6-T2', () => {
  const STUDENT_ID  = 'stu-sec-t2';
  const CC_UUID     = 'cc-sec-t2';
  const SUBJECT_ID  = 'subj-lengua';
  const SUBJECT_ID2 = 'subj-historia';
  const SPS_ID      = 'sps-lengua';

  function makeSecClient(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      courseCycle: {
        findMany: vi.fn().mockResolvedValue([
          { uuid: CC_UUID, courseId: 'sec-sec', level: 30, studyPlanId: 'sp-sec' },
        ]),
      },
      studyPlanCourse: {
        findFirst: vi.fn().mockResolvedValue({ id: 'spc-sec' }),
      },
      studyPlanSubject: {
        findMany: vi.fn().mockResolvedValue([
          { id: SPS_ID, subjectId: SUBJECT_ID, subject: { id: SUBJECT_ID, name: 'Lengua' } },
        ]),
      },
      gradingPeriodTemplateItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      subject: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      ...overrides,
    };
  }

  let uc: GenerateBoletinUseCase;
  let repos: ReturnType<typeof makeRepos>;
  let mpRepo: ReturnType<typeof makeMpRepo>;

  beforeEach(() => {
    repos = makeRepos();
    mpRepo = makeMpRepo();
    uc = new GenerateBoletinUseCase(
      makePdfGenerator() as never,
      makePdfStorage() as never,
      makePrisma() as never,
      repos.sgpRepo as never,
      repos.pgRepo as never,
      repos.fgRepo as never,
      repos.cvRepo as never,
      mpRepo as never,
    );
  });

  it('reads SubjectGradingPeriod for dynamic period column names', async () => {
    repos.sgpRepo.findByCourseCycleAndSubject.mockResolvedValue([
      { periodOrdinal: 1, periodName: '1° Trimestre', courseCycleId: CC_UUID, subjectId: SUBJECT_ID },
      { periodOrdinal: 2, periodName: '2° Trimestre', courseCycleId: CC_UUID, subjectId: SUBJECT_ID },
      { periodOrdinal: 3, periodName: '3° Trimestre', courseCycleId: CC_UUID, subjectId: SUBJECT_ID },
    ]);

    const enrollment = { studentId: STUDENT_ID, level: 30, cycleId: 'cyc-sec', academicYear: '2026' };
    const result = await (uc as any).buildMateriasSecundario(makeSecClient(), enrollment);

    expect(repos.sgpRepo.findByCourseCycleAndSubject).toHaveBeenCalledWith(CC_UUID, SUBJECT_ID);
    expect(result.materias[0].periodGrades).toHaveLength(3);
    expect(result.materias[0].periodGrades[0].periodName).toBe('1° Trimestre');
    expect(result.materias[0].periodGrades[2].periodName).toBe('3° Trimestre');
  });

  // Regresión: el boletín mostraba materias de OTROS cursos del mismo ciclo lectivo
  // (mismas materias sin nota, "como de otro alumno"). La causa: la query de cursos
  // se acotaba por cycleId (todo el ciclo lectivo) en vez del courseCycle del alumno.
  it('solo incluye materias del CourseCycle del alumno (no de otros cursos del mismo ciclo)', async () => {
    const CC_MINE = 'cc-mine';
    const CC_OTHER = 'cc-other';
    const allCCs = [
      { uuid: CC_MINE, courseId: 'course-mine', level: 30, studyPlanId: 'sp-mine', cycleId: 'cyc-sec', active: true },
      { uuid: CC_OTHER, courseId: 'course-other', level: 30, studyPlanId: 'sp-other', cycleId: 'cyc-sec', active: true },
    ];
    // Mock que SIMULA la DB: respeta el where (uuid o cycleId).
    const findManyCC = vi.fn().mockImplementation(({ where }: any) =>
      Promise.resolve(
        allCCs.filter((cc) => {
          if (where?.uuid) return cc.uuid === where.uuid;
          if (where?.cycleId) return cc.cycleId === where.cycleId;
          return true;
        }),
      ),
    );
    const client = {
      courseCycle: { findMany: findManyCC },
      studyPlanCourse: {
        findFirst: vi.fn().mockImplementation(({ where }: any) =>
          Promise.resolve({ id: where.studyPlanId === 'sp-mine' ? 'spc-mine' : 'spc-other' }),
        ),
      },
      studyPlanSubject: {
        findMany: vi.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(
            where.studyPlanCourseId === 'spc-mine'
              ? [{ id: 'sps-mine', subjectId: 'subj-lengua', subject: { id: 'subj-lengua', name: 'Lengua' } }]
              : [{ id: 'sps-other', subjectId: 'subj-historia', subject: { id: 'subj-historia', name: 'Historia' } }],
          ),
        ),
      },
      gradingPeriodTemplateItem: { findMany: vi.fn().mockResolvedValue([]) },
      subject: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const enrollment = {
      studentId: STUDENT_ID,
      courseCycleId: CC_MINE,
      level: 30,
      cycleId: 'cyc-sec',
      academicYear: '2026',
    };
    const result = await (uc as any).buildMateriasSecundario(client, enrollment);

    const nombres = result.materias.map((m: any) => m.nombre);
    expect(nombres).toContain('Lengua');
    expect(nombres).not.toContain('Historia');
    expect(result.materias).toHaveLength(1);
    // La query se acota por el uuid del curso del alumno, NO por el ciclo lectivo entero.
    expect(findManyCC).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ uuid: CC_MINE }) }),
    );
  });

  it('reads SubjectPeriodGrade — absent period grade renders blank gradeCode', async () => {
    repos.sgpRepo.findByCourseCycleAndSubject.mockResolvedValue([
      { periodOrdinal: 1, periodName: '1° Trim', courseCycleId: CC_UUID, subjectId: SUBJECT_ID },
      { periodOrdinal: 2, periodName: '2° Trim', courseCycleId: CC_UUID, subjectId: SUBJECT_ID },
    ]);
    repos.pgRepo.findByStudentAndCourseCycle.mockResolvedValue([
      {
        subjectId: SUBJECT_ID, periodOrdinal: 1, gradeCode: '8',
        gradeScaleValueId: null, internalStatus: null, pa: false, ppi: false, pp: false,
      },
      // period 2 absent → gradeCode should be ''
    ]);

    const enrollment = { studentId: STUDENT_ID, level: 30, cycleId: 'cyc-sec', academicYear: '2026' };
    const result = await (uc as any).buildMateriasSecundario(makeSecClient(), enrollment);

    expect(repos.pgRepo.findByStudentAndCourseCycle).toHaveBeenCalledWith(STUDENT_ID, CC_UUID);
    expect(result.materias[0].periodGrades[0].gradeCode).toBe('8');
    expect(result.materias[0].periodGrades[1].gradeCode).toBe(''); // absent → blank
  });

  it('condicion from FINAL row (primary)', async () => {
    repos.fgRepo.findByStudentAndCourseCycle.mockResolvedValue([
      {
        subjectId: SUBJECT_ID, type: 'FINAL', gradeCode: '7', passed: true,
        condicion: 'REGULAR', // toString() → 'REGULAR'
      },
      {
        subjectId: SUBJECT_ID, type: 'DEFINITIVA', gradeCode: '7', passed: true,
        condicion: 'LIBRE', // fallback — should NOT be used when FINAL has condicion
      },
    ]);

    const enrollment = { studentId: STUDENT_ID, level: 30, cycleId: 'cyc-sec', academicYear: '2026' };
    const result = await (uc as any).buildMateriasSecundario(makeSecClient(), enrollment);

    // FINAL condicion takes precedence over DEFINITIVA
    expect(result.materias[0].condicion).toBe('REGULAR');
  });

  it('condicion from DEFINITIVA row when FINAL condicion is null (fallback)', async () => {
    repos.fgRepo.findByStudentAndCourseCycle.mockResolvedValue([
      {
        subjectId: SUBJECT_ID, type: 'FINAL', gradeCode: '5', passed: false,
        condicion: null, // no condicion on FINAL row
      },
      {
        subjectId: SUBJECT_ID, type: 'DEFINITIVA', gradeCode: '5', passed: false,
        condicion: 'PREVIA', // DEFINITIVA fallback
      },
    ]);

    const enrollment = { studentId: STUDENT_ID, level: 30, cycleId: 'cyc-sec', academicYear: '2026' };
    const result = await (uc as any).buildMateriasSecundario(makeSecClient(), enrollment);

    expect(result.materias[0].condicion).toBe('PREVIA');
  });

  it('absent FINAL+DEFINITIVA rows → condicion is null (no error)', async () => {
    repos.fgRepo.findByStudentAndCourseCycle.mockResolvedValue([
      {
        subjectId: SUBJECT_ID, type: 'DICIEMBRE', gradeCode: '4', passed: false, condicion: null,
      },
    ]);

    const enrollment = { studentId: STUDENT_ID, level: 30, cycleId: 'cyc-sec', academicYear: '2026' };
    const result = await (uc as any).buildMateriasSecundario(makeSecClient(), enrollment);

    expect(result.materias[0].condicion).toBeNull();
  });

  it('reads CompetencyPeriodValuation filtered to imprimible=true', async () => {
    repos.cvRepo.findByCourseCycleAndStudyPlanSubject.mockResolvedValue([
      {
        valuationId: 'val-1', studentId: STUDENT_ID, competencyId: 'comp-1',
        competencyName: 'Comprensión lectora',
        periodValuations: [
          { periodItemId: 'pi-1', imprimible: true,  gradeCode: 'EP', modificable: true, gradeScaleValueId: null, internalStatus: null },
          { periodItemId: 'pi-2', imprimible: false, gradeCode: 'NA', modificable: true, gradeScaleValueId: null, internalStatus: null },
        ],
      },
      {
        valuationId: 'val-2', studentId: STUDENT_ID, competencyId: 'comp-2',
        competencyName: 'No imprimible en ningún período',
        periodValuations: [
          { periodItemId: 'pi-1', imprimible: false, gradeCode: 'B', modificable: true, gradeScaleValueId: null, internalStatus: null },
        ],
      },
    ]);

    const enrollment = { studentId: STUDENT_ID, level: 30, cycleId: 'cyc-sec', academicYear: '2026' };
    const result = await (uc as any).buildMateriasSecundario(makeSecClient(), enrollment);

    expect(repos.cvRepo.findByCourseCycleAndStudyPlanSubject).toHaveBeenCalledWith(CC_UUID, SPS_ID);
    const comps = result.materias[0].competencies as Array<{ competencyName: string }>;
    // comp-1 has imprimible=true; comp-2 has none → only comp-1 included
    expect(comps).toHaveLength(1);
    expect(comps[0].competencyName).toBe('Comprensión lectora');
  });

  it('findByStudentAndAcademicYear called ONCE per enrollment (N+1 guard: not once per materia)', async () => {
    // Two subjects in the CC — findByStudentAndAcademicYear MUST still be called only once
    const twoSubjectClient = makeSecClient({
      studyPlanSubject: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'sps-1', subjectId: SUBJECT_ID,  subject: { id: SUBJECT_ID,  name: 'Lengua' } },
          { id: 'sps-2', subjectId: SUBJECT_ID2, subject: { id: SUBJECT_ID2, name: 'Historia' } },
        ]),
      },
    });

    const enrollment = { studentId: STUDENT_ID, level: 30, cycleId: 'cyc-sec', academicYear: '2026' };
    await (uc as any).buildMateriasSecundario(twoSubjectClient, enrollment);

    // N+1 guard: exactly ONE call regardless of how many materias/subjects
    expect(mpRepo.findByStudentAndAcademicYear).toHaveBeenCalledTimes(1);
    expect(mpRepo.findByStudentAndAcademicYear).toHaveBeenCalledWith(STUDENT_ID, '2026');
  });

  it('builds DatosBoletin.previas from MateriaPrevia entities', async () => {
    // Mock a previa entity with the relevant getters
    const previaEntity = {
      subjectId: SUBJECT_ID,
      originAcademicYear: '2025',
      condicion: 'PREVIA',   // toString() = 'PREVIA'
      status: 'PENDIENTE',   // toString() = 'PENDIENTE'
    };
    mpRepo = makeMpRepo([previaEntity]);
    uc = new GenerateBoletinUseCase(
      makePdfGenerator() as never,
      makePdfStorage() as never,
      makePrisma() as never,
      repos.sgpRepo as never,
      repos.pgRepo as never,
      repos.fgRepo as never,
      repos.cvRepo as never,
      mpRepo as never,
    );

    const clientWithSubjectLookup = makeSecClient({
      subject: {
        findMany: vi.fn().mockResolvedValue([
          { id: SUBJECT_ID, name: 'Lengua' },
        ]),
      },
    });

    const enrollment = { studentId: STUDENT_ID, level: 30, cycleId: 'cyc-sec', academicYear: '2026' };
    const result = await (uc as any).buildMateriasSecundario(clientWithSubjectLookup, enrollment);

    expect(result.previas).toHaveLength(1);
    expect(result.previas[0]).toMatchObject({
      subjectName: 'Lengua',
      originAcademicYear: '2025',
      condicion: 'PREVIA',
      status: 'PENDIENTE',
    });
  });

  it('returns empty previas array when no MateriaPrevia records exist', async () => {
    const enrollment = { studentId: STUDENT_ID, level: 30, cycleId: 'cyc-sec', academicYear: '2026' };
    const result = await (uc as any).buildMateriasSecundario(makeSecClient(), enrollment);

    expect(result.previas).toEqual([]);
  });
});
