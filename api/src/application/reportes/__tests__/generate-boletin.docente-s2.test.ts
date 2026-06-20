import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateBoletinUseCase } from '../generate-boletin.use-case';
import { TenantContext } from '../../../infrastructure/auth/tenant.context';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
    getInstitutionId: vi.fn().mockReturnValue(null),
  },
}));

// ── T1: Shared mock factories ──────────────────────────────────────────────────

function makeTenantClient(overrides: Record<string, unknown> = {}) {
  return {
    materiaXCursoXCiclo:               { findMany: vi.fn().mockResolvedValue([]) },
    alumnosXMateriaXCursoXCiclo:       { findMany: vi.fn().mockResolvedValue([]) },
    alumnosXGrupoXCursoXMateriaXCiclo: { findMany: vi.fn().mockResolvedValue([]) },
    grupoXCursoXMateriaXCiclo:         { findMany: vi.fn().mockResolvedValue([]) },
    docenteXCiclo:                     { findMany: vi.fn().mockResolvedValue([]) },
    courseCycle:                       { findMany: vi.fn().mockResolvedValue([]) },
    // Guard mocks — present so tests can assert these legacy tables are NOT called
    subjectAssignment:                 { findMany: vi.fn().mockResolvedValue([]) },
    notaTrimestral:                    { findMany: vi.fn().mockResolvedValue([]) },
    studyPlanCourse:                   { findFirst: vi.fn().mockResolvedValue(null) },
    studyPlanSubject:                  { findMany: vi.fn().mockResolvedValue([]) },
    gradingPeriodTemplateItem:         { findMany: vi.fn().mockResolvedValue([]) },
    subject:                           { findMany: vi.fn().mockResolvedValue([]) },
    salaEnrollment:                    { findFirst: vi.fn().mockResolvedValue(null) },
    // Terciario path (decade 4) — needed so level=40 dispatch does not throw
    inscripcionMateria:                { findMany: vi.fn().mockResolvedValue([]) },
    actaExamenNota:                    { findMany: vi.fn().mockResolvedValue([]) },
    llamadoExamen:                     { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

function makeMasterClient(users: Array<{ id: string; firstName: string; lastName: string }> = []) {
  return {
    institution: { findUnique: vi.fn().mockResolvedValue(null) },
    user: {
      findMany: vi.fn().mockImplementation(({ where }: { where: { id: { in: string[] } } }) => {
        const ids = new Set(where.id.in);
        return Promise.resolve(users.filter((u) => ids.has(u.id)));
      }),
    },
  };
}

function makeLocalRepos() {
  return {
    sgpRepo: { findByCourseCycleAndSubject: vi.fn().mockResolvedValue([]) },
    pgRepo:  { findByStudentAndCourseCycle: vi.fn().mockResolvedValue([]) },
    fgRepo:  { findByStudentAndCourseCycle: vi.fn().mockResolvedValue([]) },
    cvRepo:  { findByCourseCycleAndStudyPlanSubject: vi.fn().mockResolvedValue([]) },
    mpRepo:  { findByStudentAndAcademicYear: vi.fn().mockResolvedValue([]) },
  };
}

/** Constructs UC with all repos — for buildMaterias* tests. */
function makeUCWithRepos(
  users: Array<{ id: string; firstName: string; lastName: string }> = [],
  repoOverrides: Partial<ReturnType<typeof makeLocalRepos>> = {},
) {
  const repos = { ...makeLocalRepos(), ...repoOverrides };
  const master = makeMasterClient(users);
  const prisma = { getMasterClient: vi.fn().mockReturnValue(master) };
  const uc = new GenerateBoletinUseCase(
    { generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')) } as never,
    { getPath: vi.fn().mockResolvedValue(null), save: vi.fn() } as never,
    prisma as never,
    repos.sgpRepo as never,
    repos.pgRepo as never,
    repos.fgRepo as never,
    repos.cvRepo as never,
    repos.mpRepo as never,
  );
  return { uc, repos, master };
}

// ── T4: buildMateriasPrimario SC-4 + buildMateriasSecundario SC-5 ──────────────
// These tests MUST FAIL before T5/T6 (teacher query removal).

describe('buildMateriasPrimario — SC-4 docente blank, no SubjectAssignment query', () => {
  const CC_UUID   = 'cc-prim';
  const SUBJECT_ID = 'subj-mat';

  let uc: GenerateBoletinUseCase;

  beforeEach(() => {
    ({ uc } = makeUCWithRepos());
  });

  it('SC-4: every docente is blank; subjectAssignment never called; resolver (materiaXCursoXCiclo) never called', async () => {
    const client = makeTenantClient({
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
    });

    const enrollment = { studentId: 'stu-p', level: 21, cycleId: 'cyc-p', academicYear: '2026' };
    const materias: Array<{ docente: string }> = await (uc as any).buildMateriasPrimario(client, enrollment);

    expect(materias.length).toBeGreaterThan(0);
    for (const m of materias) {
      expect(m.docente).toBe('');
    }
    expect(client.subjectAssignment.findMany).not.toHaveBeenCalled();
    expect(client.materiaXCursoXCiclo.findMany).not.toHaveBeenCalled();
  });
});

describe('buildMateriasSecundario — SC-5 docente blank, no SubjectAssignment query', () => {
  const CC_UUID   = 'cc-sec5';
  const SUBJECT_ID = 'subj-lengua';

  let uc: GenerateBoletinUseCase;

  beforeEach(() => {
    ({ uc } = makeUCWithRepos());
  });

  it('SC-5: every docente is blank; subjectAssignment never called; resolver (materiaXCursoXCiclo) never called', async () => {
    const client = makeTenantClient({
      courseCycle: {
        findMany: vi.fn().mockResolvedValue([
          { uuid: CC_UUID, courseId: 'section-s', level: 30, studyPlanId: 'sp-sec' },
        ]),
      },
      studyPlanCourse: { findFirst: vi.fn().mockResolvedValue({ id: 'spc-sec' }) },
      studyPlanSubject: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'sps-sec', subjectId: SUBJECT_ID, subject: { id: SUBJECT_ID, name: 'Lengua' } },
        ]),
      },
    });

    const enrollment = { studentId: 'stu-s', level: 30, cycleId: 'cyc-sec', academicYear: '2026' };
    const result = await (uc as any).buildMateriasSecundario(client, enrollment);

    expect(result.materias.length).toBeGreaterThan(0);
    for (const m of result.materias) {
      expect(m.docente).toBe('');
    }
    expect(client.subjectAssignment.findMany).not.toHaveBeenCalled();
    expect(client.materiaXCursoXCiclo.findMany).not.toHaveBeenCalled();
  });
});

// ── T7: Terciario + INV-1 guard ────────────────────────────────────────────────
// These tests MUST FAIL before T8 (legacy branch modification).

describe('legacy branch — Terciario (SC-6 partial)', () => {
  let uc: GenerateBoletinUseCase;

  beforeEach(() => {
    ({ uc } = makeUCWithRepos());
  });

  it('SC-6: Terciario docente blank; resolver not called; uses new inscripcionMateria path (not subjectAssignment)', async () => {
    // Terciario (decade 4) now dispatches to buildMateriasTerciario — it does NOT
    // call subjectAssignment or the legacy NotaTrimestral path.
    const insc = {
      materiaCarreraId: 'mc-ter-1',
      cuatrimestre: '1C',
      estado: 'REGULAR',
      notaCursada: null,
      notasCursada: [],
      materiaCarrera: {
        subject: { name: 'Análisis Matemático' },
        carrera: { name: 'Profesorado de Matemática' },
      },
    };
    const client = makeTenantClient({
      inscripcionMateria: { findMany: vi.fn().mockResolvedValue([insc]) },
    });

    const enrollment = { id: 'e-ter', studentId: 'stu-ter', level: 40, cycleId: null, academicYear: '2026' };
    const result = await (uc as any).buildMaterias(client, enrollment);

    // All Terciario docentes must be blank (Approach A: no docente lookup)
    for (const m of result.materias) {
      expect(m.docente).toBe('');
    }

    // Resolver must NOT be called for Terciario
    expect(client.materiaXCursoXCiclo.findMany).not.toHaveBeenCalled();

    // New path: inscripcionMateria WAS called; subjectAssignment was NOT
    expect(client.inscripcionMateria.findMany).toHaveBeenCalledTimes(1);
    expect(client.subjectAssignment.findMany).not.toHaveBeenCalled();
  });
});

describe('INV-1 — no Teacher-table read in any branch (SC-6 full guard)', () => {
  it('no subjectAssignment call in any level has teacher in include or select', async () => {
    const { uc } = makeUCWithRepos();

    for (const level of [10, 20, 30, 40]) {
      const client = makeTenantClient({
        courseCycle: {
          findMany: vi.fn().mockResolvedValue([{
            uuid: `cc-inv-${level}`, courseId: `section-${level}`, level, studyPlanId: `sp-${level}`,
          }]),
        },
        subjectAssignment: { findMany: vi.fn().mockResolvedValue([]) },
        periodoEvaluacion: { findMany: vi.fn().mockResolvedValue([]) },
        notaTrimestral:    { findMany: vi.fn().mockResolvedValue([]) },
        // Inicial resolver exits early when materiaXCursoXCiclo is empty
        materiaXCursoXCiclo: { findMany: vi.fn().mockResolvedValue([]) },
        // Primario/Secundario need studyPlanCourse to return null for fast exit
        studyPlanCourse: { findFirst: vi.fn().mockResolvedValue(null) },
      });

      const enrollment = {
        id: `e-${level}`, studentId: 'stu-inv', level, cycleId: `cyc-${level}`, academicYear: '2026',
      };
      await (uc as any).buildMaterias(client, enrollment);

      const calls = (client.subjectAssignment.findMany as ReturnType<typeof vi.fn>).mock.calls;
      for (const [args] of calls) {
        if (args?.include) {
          expect(args.include, `level ${level}: include must not have 'teacher'`).not.toHaveProperty('teacher');
        }
        if (args?.select) {
          expect(args.select, `level ${level}: select must not have 'teacher'`).not.toHaveProperty('teacher');
        }
      }
    }
  });
});

// ── T9: Legacy branch — subjects + notas regression (INV-2) ───────────────────
// These tests are written after T8 but placed here for file organisation.
// They MUST PASS after T8.

describe('legacy branch — subjects + notas regression (INV-2)', () => {
  it('Inicial (level 10): routes to buildMateriasInicial — materias:[], informesInicial:[] when no informeRepo injected', async () => {
    // This test confirms the Inicial dispatch arm (buildMateriasInicial) is active and
    // does NOT fall through to the legacy NotaTrimestral path.
    // The old assertion (materias has Lengua with notas) was testing the pre-fix buggy behavior.
    const { uc } = makeUCWithRepos(); // no informeRepo (9th arg) → buildMateriasInicial returns empty
    const notaTrimestralFindMany = vi.fn().mockResolvedValue([]);
    const client = makeTenantClient({
      courseCycle: {
        findMany: vi.fn().mockResolvedValue([{
          uuid: 'cc-ini-reg', courseId: 'section-ini', level: 10,
        }]),
      },
      notaTrimestral: { findMany: notaTrimestralFindMany },
      // salaEnrollment NOT needed: informeRepo absent → buildMateriasInicial returns early
    });

    const enrollment = { id: 'e-ini-reg', studentId: 'stu-ini-reg', level: 10, cycleId: 'cyc-ini-reg', academicYear: '2026' };
    const result = await (uc as any).buildMaterias(client, enrollment);

    // Inicial now uses buildMateriasInicial — legacy NotaTrimestral path is NOT called
    expect(notaTrimestralFindMany).not.toHaveBeenCalled();
    expect(result.informesInicial).toEqual([]);
    expect(result.materias).toEqual([]);
  });

  it('Terciario: uses new buildMateriasTerciario path — subject name, slots, condicion, docente blank', async () => {
    // Terciario (decade 4) dispatches to buildMateriasTerciario, NOT the legacy
    // NotaTrimestral path. The new path returns slotsCursada/condicionCursada/intentosFinales.
    const { uc } = makeUCWithRepos();
    const insc = {
      materiaCarreraId: 'mc-analisis',
      cuatrimestre: '1C',
      estado: 'REGULAR',
      notaCursada: 7.5,
      notasCursada: [
        { slot: 'PARCIAL_1', nota: 7 },
        { slot: 'PARCIAL_2', nota: 8 },
      ],
      materiaCarrera: {
        subject: { name: 'Análisis Matemático' },
        carrera: { name: 'Profesorado de Matemática' },
      },
    };
    const client = makeTenantClient({
      inscripcionMateria: { findMany: vi.fn().mockResolvedValue([insc]) },
    });

    const enrollment = { id: 'e-ter-reg', studentId: 'stu-ter-reg', level: 40, cycleId: null, academicYear: '2026' };
    const result = await (uc as any).buildMaterias(client, enrollment);

    expect(result.materias).toHaveLength(1);
    const m = result.materias[0];
    expect(m.nombre).toBe('Análisis Matemático');
    // New fields populated by buildMateriasTerciario
    expect(m.slotsCursada).toHaveLength(5);
    expect(m.condicionCursada).toBe('Regular');
    expect(m.notaCursadaConfirmada).toBe(7.5);
    expect(m.intentosFinales).toEqual([]);
    expect(m.docente).toBe('');
    // notaTrimestral (legacy) NOT called
    expect(client.notaTrimestral.findMany).not.toHaveBeenCalled();
  });
});

// ── T12/T13: execute() dispatch via AlumnosXCursoXCiclo adapter (Primario/Secundario) ──
// RED until T13 rewrites execute(); GREEN after T13.

describe('execute() via AlumnosXCursoXCiclo adapter — Primario/Secundario (levels 20/30)', () => {
  it('T12-PRI: execute fetches alumnosXCursoXCiclo + courseCycle for Primario dispatch', async () => {
    const axcc = { id: 'axcc-pri', courseCycleId: 'cc-pri', studentId: 'stu-pri', printable: false };
    const client = {
      alumnosXCursoXCiclo: { findUnique: vi.fn().mockResolvedValue(axcc) },
      courseCycle: { findUnique: vi.fn().mockResolvedValue({ uuid: 'cc-pri', level: 21, cycleId: 'acyc-pri', course: { grade: '3°', division: 'B', academicYear: '2026' } }) },
      student: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    vi.mocked(TenantContext.getClient).mockReturnValue(client as any);

    const uc = new GenerateBoletinUseCase(
      { generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')) } as never,
      { getPath: vi.fn().mockResolvedValue(null), save: vi.fn(), delete: vi.fn() } as never,
      { getMasterClient: vi.fn().mockReturnValue({ institution: { findUnique: vi.fn().mockResolvedValue(null) } }) } as never,
    );

    // printable=false → STUDENT_NOT_PRINTABLE (after T13); RED now because execute reads enrollment
    await expect(uc.execute('axcc-pri')).rejects.toThrowError(
      expect.objectContaining({ code: 'STUDENT_NOT_PRINTABLE' }),
    );
    expect(client.alumnosXCursoXCiclo.findUnique).toHaveBeenCalled();
  });

  it('T12-SEC: execute fetches alumnosXCursoXCiclo + courseCycle for Secundario dispatch', async () => {
    const axcc = { id: 'axcc-sec', courseCycleId: 'cc-sec', studentId: 'stu-sec', printable: false };
    const client = {
      alumnosXCursoXCiclo: { findUnique: vi.fn().mockResolvedValue(axcc) },
      courseCycle: { findUnique: vi.fn().mockResolvedValue({ uuid: 'cc-sec', level: 30, cycleId: 'acyc-sec', course: { grade: '4°', division: 'A', academicYear: '2026' } }) },
      student: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    vi.mocked(TenantContext.getClient).mockReturnValue(client as any);

    const uc = new GenerateBoletinUseCase(
      { generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')) } as never,
      { getPath: vi.fn().mockResolvedValue(null), save: vi.fn(), delete: vi.fn() } as never,
      { getMasterClient: vi.fn().mockReturnValue({ institution: { findUnique: vi.fn().mockResolvedValue(null) } }) } as never,
    );

    await expect(uc.execute('axcc-sec')).rejects.toThrowError(
      expect.objectContaining({ code: 'STUDENT_NOT_PRINTABLE' }),
    );
    expect(client.alumnosXCursoXCiclo.findUnique).toHaveBeenCalled();
  });
});
