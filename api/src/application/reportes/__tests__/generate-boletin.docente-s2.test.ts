import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateBoletinUseCase } from '../generate-boletin.use-case';

// ── T1: Shared mock factories ──────────────────────────────────────────────────

function makeTenantClient(overrides: Record<string, unknown> = {}) {
  return {
    materiaXCursoXCiclo:               { findMany: vi.fn().mockResolvedValue([]) },
    alumnosXMateriaXCursoXCiclo:       { findMany: vi.fn().mockResolvedValue([]) },
    alumnosXGrupoXCursoXMateriaXCiclo: { findMany: vi.fn().mockResolvedValue([]) },
    grupoXCursoXMateriaXCiclo:         { findMany: vi.fn().mockResolvedValue([]) },
    docenteXCiclo:                     { findMany: vi.fn().mockResolvedValue([]) },
    subjectAssignment:                 { findMany: vi.fn().mockResolvedValue([]) },
    courseCycle:                       { findMany: vi.fn().mockResolvedValue([]) },
    periodoEvaluacion:                 { findMany: vi.fn().mockResolvedValue([]) },
    notaTrimestral:                    { findMany: vi.fn().mockResolvedValue([]) },
    studyPlanCourse:                   { findFirst: vi.fn().mockResolvedValue(null) },
    studyPlanSubject:                  { findMany: vi.fn().mockResolvedValue([]) },
    gradingPeriodTemplateItem:         { findMany: vi.fn().mockResolvedValue([]) },
    subject:                           { findMany: vi.fn().mockResolvedValue([]) },
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

/** Constructs UC without repos — for resolver-only tests. */
function makeUC(users: Array<{ id: string; firstName: string; lastName: string }> = []) {
  const master = makeMasterClient(users);
  const prisma = { getMasterClient: vi.fn().mockReturnValue(master) };
  const uc = new GenerateBoletinUseCase(
    { generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')) } as never,
    { getPath: vi.fn().mockResolvedValue(null), save: vi.fn() } as never,
    prisma as never,
  );
  return { uc, master };
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

// ── T2: resolveDocentesForStudentCC — SC-1, SC-2a, SC-2b, SC-3 ────────────────
// These tests MUST FAIL before T3 (resolver implementation).

describe('resolveDocentesForStudentCC', () => {
  it('SC-1 single docente → "Apellido, Nombre"', async () => {
    const { uc } = makeUC([{ id: 'user-1', firstName: 'Ana', lastName: 'Gomez' }]);
    const client = makeTenantClient({
      materiaXCursoXCiclo:               { findMany: vi.fn().mockResolvedValue([{ id: 'mxcc-1', subjectId: 'subj-1' }]) },
      alumnosXMateriaXCursoXCiclo:       { findMany: vi.fn().mockResolvedValue([{ id: 'axm-1', materiaXCursoXCicloId: 'mxcc-1' }]) },
      alumnosXGrupoXCursoXMateriaXCiclo: { findMany: vi.fn().mockResolvedValue([{ grupoId: 'g-1', alumnosXMateriaXCursoXCicloId: 'axm-1' }]) },
      grupoXCursoXMateriaXCiclo:         { findMany: vi.fn().mockResolvedValue([{ id: 'g-1', docenteXCicloId: 'dxc-1' }]) },
      docenteXCiclo:                     { findMany: vi.fn().mockResolvedValue([{ id: 'dxc-1', userId: 'user-1' }]) },
    });

    const map: Map<string, string> = await (uc as any).resolveDocentesForStudentCC(client, 'stu-1', 'cc-1');

    expect(map.get('subj-1')).toBe('Gomez, Ana');
  });

  it('SC-2a co-docencia 2 distinct docentes → joined alphabetically by last name', async () => {
    const { uc } = makeUC([
      { id: 'user-1', firstName: 'Xavier', lastName: 'Alves' },
      { id: 'user-2', firstName: 'Bruno', lastName: 'Ferreira' },
    ]);
    const client = makeTenantClient({
      materiaXCursoXCiclo:               { findMany: vi.fn().mockResolvedValue([{ id: 'mxcc-1', subjectId: 'subj-1' }]) },
      alumnosXMateriaXCursoXCiclo:       { findMany: vi.fn().mockResolvedValue([{ id: 'axm-1', materiaXCursoXCicloId: 'mxcc-1' }]) },
      alumnosXGrupoXCursoXMateriaXCiclo: {
        findMany: vi.fn().mockResolvedValue([
          { grupoId: 'g-1', alumnosXMateriaXCursoXCicloId: 'axm-1' },
          { grupoId: 'g-2', alumnosXMateriaXCursoXCicloId: 'axm-1' },
        ]),
      },
      grupoXCursoXMateriaXCiclo: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'g-1', docenteXCicloId: 'dxc-1' },
          { id: 'g-2', docenteXCicloId: 'dxc-2' },
        ]),
      },
      docenteXCiclo: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'dxc-1', userId: 'user-1' },
          { id: 'dxc-2', userId: 'user-2' },
        ]),
      },
    });

    const map: Map<string, string> = await (uc as any).resolveDocentesForStudentCC(client, 'stu-1', 'cc-1');

    // Alphabetical: "Alves, Xavier" < "Ferreira, Bruno"
    expect(map.get('subj-1')).toBe('Alves, Xavier / Ferreira, Bruno');
  });

  it('SC-2b dedup — same docenteXCicloId in 2 grupos → single name (covers dropped @@unique)', async () => {
    const { uc } = makeUC([{ id: 'user-1', firstName: 'Ana', lastName: 'Gomez' }]);
    const client = makeTenantClient({
      materiaXCursoXCiclo:               { findMany: vi.fn().mockResolvedValue([{ id: 'mxcc-1', subjectId: 'subj-1' }]) },
      alumnosXMateriaXCursoXCiclo:       { findMany: vi.fn().mockResolvedValue([{ id: 'axm-1', materiaXCursoXCicloId: 'mxcc-1' }]) },
      alumnosXGrupoXCursoXMateriaXCiclo: {
        findMany: vi.fn().mockResolvedValue([
          { grupoId: 'g-1', alumnosXMateriaXCursoXCicloId: 'axm-1' },
          { grupoId: 'g-2', alumnosXMateriaXCursoXCicloId: 'axm-1' },
        ]),
      },
      grupoXCursoXMateriaXCiclo: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'g-1', docenteXCicloId: 'dxc-1' },
          { id: 'g-2', docenteXCicloId: 'dxc-1' }, // SAME docenteXCicloId
        ]),
      },
      docenteXCiclo: {
        findMany: vi.fn().mockResolvedValue([{ id: 'dxc-1', userId: 'user-1' }]),
      },
    });

    const map: Map<string, string> = await (uc as any).resolveDocentesForStudentCC(client, 'stu-1', 'cc-1');

    // dedup: single name, NOT "Gomez, Ana / Gomez, Ana"
    expect(map.get('subj-1')).toBe('Gomez, Ana');
    expect(map.get('subj-1')).not.toContain(' / ');
  });

  it('SC-3 zero results (empty MateriaXCursoXCiclo) → empty Map, no error thrown', async () => {
    const { uc } = makeUC([]);
    const client = makeTenantClient({
      materiaXCursoXCiclo: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const map: Map<string, string> = await (uc as any).resolveDocentesForStudentCC(client, 'stu-1', 'cc-1');

    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBe(0);
  });
});

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

  it('SC-6: Terciario docente blank; resolver not called; subjectAssignment called WITHOUT teacher include', async () => {
    const client = makeTenantClient({
      courseCycle: {
        findMany: vi.fn().mockResolvedValue([{
          uuid: 'cc-ter-t7', courseId: 'section-ter', level: 40,
        }]),
      },
      subjectAssignment: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'sa-ter-1', subjectId: 'subj-ter',
          subject: { name: 'Análisis Matemático' },
        }]),
      },
      periodoEvaluacion: {
        findMany: vi.fn().mockResolvedValue([{ id: 'p-1', name: '1° Cuatrimestre' }]),
      },
      notaTrimestral: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const enrollment = { id: 'e-ter', studentId: 'stu-ter', level: 40, cycleId: 'cyc-ter', academicYear: '2026' };
    const result = await (uc as any).buildMaterias(client, enrollment);

    // All Terciario docentes must be blank
    for (const m of result.materias) {
      expect(m.docente).toBe('');
    }

    // Resolver must NOT be called for Terciario
    expect(client.materiaXCursoXCiclo.findMany).not.toHaveBeenCalled();

    // subjectAssignment backbone is preserved (WAS called)
    expect(client.subjectAssignment.findMany).toHaveBeenCalledTimes(1);

    // The call must NOT have 'teacher' in include (INV-1 invariant)
    const [[callArgs]] = (client.subjectAssignment.findMany as ReturnType<typeof vi.fn>).mock.calls;
    expect(callArgs.include).not.toHaveProperty('teacher');
    expect(callArgs.include).toHaveProperty('subject', true);
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

  it('Terciario: subject + notas + promedio + valoracion + aprobado preserved; docente blank', async () => {
    const { uc } = makeUCWithRepos();
    const client = makeTenantClient({
      courseCycle: {
        findMany: vi.fn().mockResolvedValue([{
          uuid: 'cc-ter-reg', courseId: 'section-ter', level: 40,
        }]),
      },
      subjectAssignment: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'sa-ter-reg', subjectId: 'subj-analisis',
          subject: { name: 'Análisis Matemático' },
        }]),
      },
      periodoEvaluacion: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p-1', name: '1° Cuatrimestre', startDate: new Date('2026-03-01') },
          { id: 'p-2', name: '2° Cuatrimestre', startDate: new Date('2026-08-01') },
        ]),
      },
      notaTrimestral: {
        findMany: vi.fn().mockResolvedValue([
          { assignmentId: 'sa-ter-reg', periodId: 'p-1', finalGrade: 7, studentId: 'stu-ter-reg', active: true },
          { assignmentId: 'sa-ter-reg', periodId: 'p-2', finalGrade: 8, studentId: 'stu-ter-reg', active: true },
        ]),
      },
    });

    const enrollment = { id: 'e-ter-reg', studentId: 'stu-ter-reg', level: 40, cycleId: 'cyc-ter-reg', academicYear: '2026' };
    const result = await (uc as any).buildMaterias(client, enrollment);

    expect(result.materias).toHaveLength(1);
    const m = result.materias[0];
    expect(m.nombre).toBe('Análisis Matemático');
    expect(m.notas).toHaveLength(2);
    expect(m.notas[0].valor).toBe('7');
    expect(m.notas[1].valor).toBe('8');
    expect(m.promedio).toBe('7.50');
    expect(m.valoracion).toBe('Aprobado');
    expect(m.aprobado).toBe(true);
    expect(m.docente).toBe('');
  });
});
