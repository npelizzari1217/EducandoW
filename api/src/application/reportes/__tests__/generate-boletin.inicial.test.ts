import { describe, it, expect, vi } from 'vitest';
import { InformeEvolutivo, Periodo, Id } from '@educandow/domain';
import type { InformeRepository } from '@educandow/domain';
import { GenerateBoletinUseCase } from '../generate-boletin.use-case';
import { TenantContext } from '../../../infrastructure/auth/tenant.context';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
    getInstitutionId: vi.fn().mockReturnValue(null),
  },
}));

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

function makeInformeRepo(informes: InformeEvolutivo[] = []): InformeRepository {
  return {
    findAll: vi.fn().mockResolvedValue(informes),
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

/** Builds an InformeEvolutivo test double via reconstruct. */
function makeInforme(opts: {
  id?: string;
  studentId?: string;
  salaId?: string;
  periodo: '1T' | '2T' | '3T';
  observacionesGenerales?: string;
  areas?: Array<{ area: string; observacion: string; valoracion: string }>;
}): InformeEvolutivo {
  const id = opts.id ?? `informe-${opts.periodo}`;
  return InformeEvolutivo.reconstruct({
    id: Id.reconstruct(id),
    studentId: opts.studentId ?? 'stu-ini',
    salaId: opts.salaId ?? 'sala-1',
    periodo: Periodo.reconstruct(opts.periodo),
    fecha: new Date('2026-04-01'),
    observacionesGenerales: opts.observacionesGenerales,
    areas: (opts.areas ?? [{ area: 'COGNITIVA', observacion: 'Buena evolución', valoracion: 'LOGRADO' }]).map(
      (a, i) => ({ id: `area-${i}`, informeId: id, ...a }),
    ),
  });
}

/** Mock Prisma tenant client for Inicial (level 10-19). */
function makeInicialClient(opts: {
  salaEnrollment?: object | null;
  notaTrimestralFindMany?: ReturnType<typeof vi.fn>;
} = {}) {
  const salaEnrollmentResult = opts.salaEnrollment !== undefined
    ? opts.salaEnrollment
    : { salaId: 'sala-1', studentId: 'stu-ini', academicYear: '2026', active: true };

  return {
    salaEnrollment: {
      findFirst: vi.fn().mockResolvedValue(salaEnrollmentResult),
    },
    // Guard mock — present so tests can assert notaTrimestral is NOT called for Inicial
    notaTrimestral: {
      findMany: opts.notaTrimestralFindMany ?? vi.fn().mockResolvedValue([]),
    },
    // Other Prisma models not needed for Inicial path
    courseCycle: { findMany: vi.fn().mockResolvedValue([]) },
    materiaXCursoXCiclo: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

/** Mock Prisma tenant client for Primario (level 20). */
function makePrimarioClient() {
  return {
    courseCycle: { findMany: vi.fn().mockResolvedValue([]) },
    studyPlanCourse: { findFirst: vi.fn().mockResolvedValue(null) },
    salaEnrollment: { findFirst: vi.fn().mockResolvedValue(null) },
  };
}

// ── T3-1: Mapping — 2 informes, ordered 1T→2T (deliberately passed 2T first) ─

describe('buildMaterias (Inicial, level 10) — mapping + ordering', () => {
  it('maps 2 InformeEvolutivo (unordered 2T→1T) to informesInicial sorted [1T, 2T]', async () => {
    const informe2T = makeInforme({
      periodo: '2T',
      observacionesGenerales: 'Obs 2T',
      areas: [{ area: 'SOCIO_AFECTIVA', observacion: 'Empatía', valoracion: 'DESTACADO' }],
    });
    const informe1T = makeInforme({
      periodo: '1T',
      observacionesGenerales: 'Obs 1T',
      areas: [{ area: 'COGNITIVA', observacion: 'Reconocimiento', valoracion: 'LOGRADO' }],
    });

    const informeRepo = makeInformeRepo([informe2T, informe1T]); // deliberately 2T first
    const uc = new GenerateBoletinUseCase(
      makePdfGenerator() as never,
      makePdfStorage() as never,
      makePrisma() as never,
      undefined,  // sgpRepo
      undefined,  // pgRepo
      undefined,  // fgRepo
      undefined,  // cvRepo
      undefined,  // materiaPreviaRepo (known wiring gap — out of scope)
      informeRepo as never,
    );

    const mockClient = makeInicialClient();
    const enrollment = { id: 'e-ini', studentId: 'stu-ini', level: 10, cycleId: 'cyc-1', academicYear: '2026' };

    const result = await (uc as any).buildMaterias(mockClient, enrollment);

    // Ordered 1T → 2T
    expect(result.informesInicial).toHaveLength(2);
    expect(result.informesInicial[0].periodo).toBe('1T');
    expect(result.informesInicial[0].observacionesGenerales).toBe('Obs 1T');
    expect(result.informesInicial[0].areas).toHaveLength(1);
    expect(result.informesInicial[0].areas[0].nombre).toBe('COGNITIVA');
    expect(result.informesInicial[0].areas[0].observacion).toBe('Reconocimiento');
    expect(result.informesInicial[0].areas[0].valoracion).toBe('LOGRADO');

    expect(result.informesInicial[1].periodo).toBe('2T');
    expect(result.informesInicial[1].observacionesGenerales).toBe('Obs 2T');

    // fecha is present and formatted
    expect(result.informesInicial[0].fecha).toMatch(/\d{2}\/\d{2}\/\d{4}/);

    // InformeRepository.findAll WAS called with correct filters
    expect(informeRepo.findAll).toHaveBeenCalledWith({ studentId: 'stu-ini', salaId: 'sala-1' });

    // Legacy NotaTrimestral NOT called
    expect(mockClient.notaTrimestral.findMany).not.toHaveBeenCalled();
  });
});

// ── T3-2: Empty state — no SalaEnrollment ────────────────────────────────────

describe('buildMaterias (Inicial) — empty states', () => {
  it('returns informesInicial=[] when salaEnrollment.findFirst returns null', async () => {
    const informeRepo = makeInformeRepo();
    const uc = new GenerateBoletinUseCase(
      makePdfGenerator() as never,
      makePdfStorage() as never,
      makePrisma() as never,
      undefined, undefined, undefined, undefined, undefined,
      informeRepo as never,
    );

    const mockClient = makeInicialClient({ salaEnrollment: null });
    const enrollment = { id: 'e-ini', studentId: 'stu-ini', level: 10, cycleId: 'cyc-1', academicYear: '2026' };

    const result = await (uc as any).buildMaterias(mockClient, enrollment);

    expect(result.informesInicial).toEqual([]);
    // InformeRepository.findAll must NOT be called when no sala enrollment
    expect(informeRepo.findAll).not.toHaveBeenCalled();
  });

  // ── T3-3: Empty state — SalaEnrollment found but no informes ───────────────

  it('returns informesInicial=[] when findAll returns empty array', async () => {
    const informeRepo = makeInformeRepo([]); // returns empty
    const uc = new GenerateBoletinUseCase(
      makePdfGenerator() as never,
      makePdfStorage() as never,
      makePrisma() as never,
      undefined, undefined, undefined, undefined, undefined,
      informeRepo as never,
    );

    const mockClient = makeInicialClient();
    const enrollment = { id: 'e-ini', studentId: 'stu-ini', level: 10, cycleId: 'cyc-1', academicYear: '2026' };

    const result = await (uc as any).buildMaterias(mockClient, enrollment);

    expect(result.informesInicial).toEqual([]);
    expect(informeRepo.findAll).toHaveBeenCalledWith({ studentId: 'stu-ini', salaId: 'sala-1' });
  });

  // ── T3-4: Empty state — informeRepo not injected ──────────────────────────

  it('returns informesInicial=[] when informeRepo is not injected (no 9th arg)', async () => {
    const uc = new GenerateBoletinUseCase(
      makePdfGenerator() as never,
      makePdfStorage() as never,
      makePrisma() as never,
      // no optional repos at all
    );

    const mockClient = makeInicialClient();
    const enrollment = { id: 'e-ini', studentId: 'stu-ini', level: 10, cycleId: 'cyc-1', academicYear: '2026' };

    const result = await (uc as any).buildMaterias(mockClient, enrollment);

    expect(result.informesInicial).toEqual([]);
  });
});

// ── T3-5: Dispatch — level 15 routes to buildMateriasInicial, not legacy ─────

describe('buildMaterias (Inicial) — dispatch', () => {
  it('level 15 calls InformeRepository.findAll and does NOT call notaTrimestral.findMany', async () => {
    const informe = makeInforme({ periodo: '1T' });
    const informeRepo = makeInformeRepo([informe]);
    const uc = new GenerateBoletinUseCase(
      makePdfGenerator() as never,
      makePdfStorage() as never,
      makePrisma() as never,
      undefined, undefined, undefined, undefined, undefined,
      informeRepo as never,
    );

    const notaTrimestralFindMany = vi.fn().mockResolvedValue([]);
    const mockClient = makeInicialClient({ notaTrimestralFindMany });
    const enrollment = { id: 'e-ini', studentId: 'stu-ini', level: 15, cycleId: 'cyc-1', academicYear: '2026' };

    await (uc as any).buildMaterias(mockClient, enrollment);

    expect(informeRepo.findAll).toHaveBeenCalled();
    expect(notaTrimestralFindMany).not.toHaveBeenCalled();
  });
});

// ── T3-6: No-regression — level 20 (Primario) ────────────────────────────────

describe('buildMaterias (Primario, level 20) — no-regression', () => {
  it('does NOT call InformeRepository.findAll and informesInicial is undefined', async () => {
    const informeRepo = makeInformeRepo();
    const sgpRepo = { findByCourseCycleAndSubject: vi.fn().mockResolvedValue([]), ensureSnapshot: vi.fn(), save: vi.fn() };
    const pgRepo = { findByStudentAndCourseCycle: vi.fn().mockResolvedValue([]), findByCourseCycleAndSubject: vi.fn().mockResolvedValue([]), saveMany: vi.fn() };
    const fgRepo = { findByStudentAndCourseCycle: vi.fn().mockResolvedValue([]), findByCourseCycleAndSubject: vi.fn().mockResolvedValue([]), saveMany: vi.fn() };
    const cvRepo = { findByCourseCycleAndStudyPlanSubject: vi.fn().mockResolvedValue([]), findById: vi.fn(), findByStudentAndStudyPlanSubject: vi.fn(), save: vi.fn(), bulkCreate: vi.fn(), delete: vi.fn() };

    const uc = new GenerateBoletinUseCase(
      makePdfGenerator() as never,
      makePdfStorage() as never,
      makePrisma() as never,
      sgpRepo as never,
      pgRepo as never,
      fgRepo as never,
      cvRepo as never,
      undefined,
      informeRepo as never,
    );

    const mockClient = makePrimarioClient();
    const enrollment = { id: 'e-prim', studentId: 'stu-prim', level: 20, cycleId: 'cyc-1', academicYear: '2026' };

    const result = await (uc as any).buildMaterias(mockClient, enrollment);

    expect(informeRepo.findAll).not.toHaveBeenCalled();
    expect(result.informesInicial).toBeUndefined();
    expect(Array.isArray(result.materias)).toBe(true);
  });
});

// ── T12/T13: execute() dispatch via AlumnosXCursoXCiclo adapter (Inicial level) ─
// RED until T13 rewrites execute(); GREEN after T13.
// Verifies that execute(axccId) reads axcc (not enrollment) and dispatches to Inicial.

describe('execute() via AlumnosXCursoXCiclo adapter — Inicial (level=10)', () => {
  it('T12-INI: execute fetches alumnosXCursoXCiclo + courseCycle (not enrollment) for Inicial dispatch', async () => {
    const axcc = { id: 'axcc-ini', courseCycleId: 'cc-ini', studentId: 'stu-ini', printable: false };
    const client = {
      alumnosXCursoXCiclo: { findUnique: vi.fn().mockResolvedValue(axcc) },
      courseCycle: { findUnique: vi.fn().mockResolvedValue({ uuid: 'cc-ini', level: 10, cycleId: 'acyc-ini', course: { grade: null, division: null, academicYear: '2026' }, cycle: {} }) },
      student: { findUnique: vi.fn().mockResolvedValue(null) },
      attendance: { findMany: vi.fn().mockResolvedValue([]) },
    };
    vi.mocked(TenantContext.getClient).mockReturnValue(client as any);

    const uc = new GenerateBoletinUseCase(
      { generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')) } as never,
      { getPath: vi.fn().mockResolvedValue(null), save: vi.fn(), delete: vi.fn() } as never,
      { getMasterClient: vi.fn().mockReturnValue({ institution: { findUnique: vi.fn().mockResolvedValue(null) } }) } as never,
    );

    // printable=false → STUDENT_NOT_PRINTABLE
    // RED: execute() currently reads enrollment.findUnique (TypeError) instead of axcc
    await expect(uc.execute('axcc-ini')).rejects.toThrowError(
      expect.objectContaining({ code: 'STUDENT_NOT_PRINTABLE' }),
    );
    // After T13 GREEN: alumnosXCursoXCiclo.findUnique IS called; enrollment is NOT
    expect(client.alumnosXCursoXCiclo.findUnique).toHaveBeenCalled();
  });
});
