/**
 * ListTeacherCourseCyclesUseCase tests — model NUEVO (DocenteXCiclo + grupos).
 *
 * Subject mode: resolves CCs via DocenteXCiclo → GrupoXCursoXMateriaXCiclo → MateriaXCursoXCiclo.courseCycleId.
 * Homeroom mode: unchanged — still uses Teacher.homeroomTeacherId.
 *
 * New model scenarios:
 *   - Docente con grupo (modelo nuevo) → ve su CC.
 *   - Docente sin DocenteXCiclo → no la ve.
 *   - Docente con DocenteXCiclo pero sin grupos → no la ve.
 *   - Gestión (ROOT/ADMIN/SECRETARIO/DIRECTOR) not tested here — they use ListCourseCyclesUseCase (scope).
 *
 * Homeroom mode tests keep the old Teacher model (homeroomTeacherId on CC is still Teacher.id).
 *
 * Specs: TIA-R2 (new), TIA-R3 (new), TIA-R5, TIA-R9, ESS-R1/R2 (new), AD-6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListTeacherCourseCyclesUseCase } from './list-teacher-course-cycles.use-case';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import { Teacher, Id, Dni, Email, CourseCycle, CourseName, PassingGrade, Level, DocenteXCiclo, GrupoXCursoXMateriaXCiclo } from '@educandow/domain';

vi.mock('../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTeacher(id = 'teacher-uuid-1', userId = 'user-abc'): Teacher {
  return Teacher.reconstruct({
    id: Id.reconstruct(id),
    firstName: 'Juan',
    lastName: 'García',
    dni: Dni.reconstruct('12345678'),
    email: Email.reconstruct('juan@school.edu'),
    userId,
    institutionId: Id.reconstruct('inst-1'),
    active: true,
  });
}

function makeDocente(id = 'dxc-1', userId = 'user-abc', cycleId = 'cycle-1'): DocenteXCiclo {
  return DocenteXCiclo.reconstruct({
    id,
    userId,
    cycleId,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeGrupo(id = 'grupo-1', docenteXCicloId = 'dxc-1', materiaXCursoXCicloId = 'materia-1'): GrupoXCursoXMateriaXCiclo {
  return GrupoXCursoXMateriaXCiclo.reconstruct({
    id,
    docenteXCicloId,
    materiaXCursoXCicloId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeCC(uuid: string, level: number, courseId: string): CourseCycle {
  return CourseCycle.reconstruct({
    id: Id.reconstruct(`id-${uuid}`),
    uuid,
    courseId,
    studyPlanId: 'sp-1',
    cycleId: 'cycle-1',
    courseName: CourseName.reconstruct('3° A'),
    level: Level.reconstruct(level as any),
    active: true,
    passingGrade: PassingGrade.reconstruct(7),
    promotionText: null,
    firstBimonth: null,
    secondBimonth: null,
    thirdBimonth: null,
    fourthBimonth: null,
    activeGradingPeriod: null,
    createdAt: new Date(),
    lastModifiedAt: new Date(),
    deletedAt: null,
  });
}

function makeMockClient(materias: { id: string; courseCycleId: string }[] = []) {
  return {
    materiaXCursoXCiclo: {
      findMany: vi.fn().mockResolvedValue(materias),
    },
  };
}

function makeRepos(overrides: Partial<{
  docenteRepo: Record<string, unknown>;
  grupoRepo: Record<string, unknown>;
  teacherRepo: Record<string, unknown>;
  courseCycleRepo: Record<string, unknown>;
}> = {}) {
  return {
    teacherRepo: {
      findByUserId: vi.fn().mockResolvedValue(null),
      ...(overrides.teacherRepo ?? {}),
    },
    docenteRepo: {
      findByUserId: vi.fn().mockResolvedValue([]),
      findByUserAndCycle: vi.fn().mockResolvedValue(null),
      ...(overrides.docenteRepo ?? {}),
    },
    grupoRepo: {
      findByDocente: vi.fn().mockResolvedValue([]),
      ...(overrides.grupoRepo ?? {}),
    },
    courseCycleRepo: {
      findByHomeroomTeacher: vi.fn().mockResolvedValue([]),
      findByUuids: vi.fn().mockResolvedValue([]),
      findGradingContextsByUuids: vi.fn().mockResolvedValue(new Map()),
      ...(overrides.courseCycleRepo ?? {}),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ListTeacherCourseCyclesUseCase — mode=subject (modelo nuevo)
// ═══════════════════════════════════════════════════════════════════════════════

describe('ListTeacherCourseCyclesUseCase — mode=subject (modelo nuevo DocenteXCiclo)', () => {
  let repos: ReturnType<typeof makeRepos>;
  let useCase: ListTeacherCourseCyclesUseCase;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repos = makeRepos();
    useCase = new ListTeacherCourseCyclesUseCase(
      repos.teacherRepo as any,
      repos.docenteRepo as any,
      repos.grupoRepo as any,
      repos.courseCycleRepo as any,
    );
  });

  it('TIA-R2: userId sin DocenteXCiclo → empty array (200, no error)', async () => {
    repos.docenteRepo.findByUserId = vi.fn().mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'user-xyz', mode: 'subject' });

    expect(result).toEqual([]);
    expect(repos.grupoRepo.findByDocente).not.toHaveBeenCalled();
  });

  it('TIA-R6: docente con DocenteXCiclo pero sin grupos → empty array', async () => {
    repos.docenteRepo.findByUserId = vi.fn().mockResolvedValue([makeDocente()]);
    repos.grupoRepo.findByDocente = vi.fn().mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    expect(result).toEqual([]);
    expect(repos.courseCycleRepo.findByUuids).not.toHaveBeenCalled();
  });

  it('TIA-R3 (nuevo modelo): docente con grupo → ve su CC', async () => {
    const dxc = makeDocente('dxc-1', 'user-abc');
    const grupo = makeGrupo('grupo-1', 'dxc-1', 'materia-uuid-1');
    const cc = makeCC('cc-A', 20, 'cs-A');

    repos.docenteRepo.findByUserId = vi.fn().mockResolvedValue([dxc]);
    repos.grupoRepo.findByDocente = vi.fn().mockResolvedValue([grupo]);
    mockClient.materiaXCursoXCiclo.findMany.mockResolvedValue([{ id: 'materia-uuid-1', courseCycleId: 'cc-A' }]);
    repos.courseCycleRepo.findByUuids = vi.fn().mockResolvedValue([cc]);
    repos.courseCycleRepo.findGradingContextsByUuids = vi.fn().mockResolvedValue(new Map([['cc-A', { level: 20, modality: 0 }]]));

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    expect(result).toHaveLength(1);
    expect(result[0].cycle.uuid).toBe('cc-A');
  });

  it('W3: retorna { cycle, modality } con modality del StudyPlan (cc nivel 22 → modality 2)', async () => {
    const dxc = makeDocente('dxc-1', 'user-abc');
    const grupo = makeGrupo('grupo-1', 'dxc-1', 'materia-B');
    const cc = makeCC('cc-B', 22, 'cs-B');

    repos.docenteRepo.findByUserId = vi.fn().mockResolvedValue([dxc]);
    repos.grupoRepo.findByDocente = vi.fn().mockResolvedValue([grupo]);
    mockClient.materiaXCursoXCiclo.findMany.mockResolvedValue([{ id: 'materia-B', courseCycleId: 'cc-B' }]);
    repos.courseCycleRepo.findByUuids = vi.fn().mockResolvedValue([cc]);
    repos.courseCycleRepo.findGradingContextsByUuids = vi.fn().mockResolvedValue(
      new Map([['cc-B', { level: 22, modality: 2 }]]),
    );

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ modality: 2 });
    expect(result[0].cycle.uuid).toBe('cc-B');
  });

  it('W3-DIVERGE: modality del StudyPlan cuando difiere de cc.level.modalityCode', async () => {
    const dxc = makeDocente('dxc-1', 'user-abc');
    const grupo = makeGrupo('grupo-1', 'dxc-1', 'materia-C');
    const cc = makeCC('cc-diverge', 20, 'cs-C'); // level 20 → modalityCode = 0

    repos.docenteRepo.findByUserId = vi.fn().mockResolvedValue([dxc]);
    repos.grupoRepo.findByDocente = vi.fn().mockResolvedValue([grupo]);
    mockClient.materiaXCursoXCiclo.findMany.mockResolvedValue([{ id: 'materia-C', courseCycleId: 'cc-diverge' }]);
    repos.courseCycleRepo.findByUuids = vi.fn().mockResolvedValue([cc]);
    repos.courseCycleRepo.findGradingContextsByUuids = vi.fn().mockResolvedValue(
      new Map([['cc-diverge', { level: 20, modality: 1 }]]), // StudyPlan dice modality=1
    );

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    expect(result).toHaveLength(1);
    // DEBE ser 1 (StudyPlan.modality), NO 0 (cc.level.modalityCode)
    expect(result[0].modality).toBe(1);
  });

  it('ESS-R1/D3: Secundario (level=30) INCLUIDO junto a Primario (level=20)', async () => {
    const dxc = makeDocente('dxc-1', 'user-abc');
    repos.docenteRepo.findByUserId = vi.fn().mockResolvedValue([dxc]);
    repos.grupoRepo.findByDocente = vi.fn().mockResolvedValue([
      makeGrupo('g1', 'dxc-1', 'mat-primario'),
      makeGrupo('g2', 'dxc-1', 'mat-secundario'),
    ]);
    mockClient.materiaXCursoXCiclo.findMany.mockResolvedValue([
      { id: 'mat-primario',   courseCycleId: 'cc-primario' },
      { id: 'mat-secundario', courseCycleId: 'cc-secundario' },
    ]);
    const primarioCC   = makeCC('cc-primario',   20, 'cs-primario');
    const secundarioCC = makeCC('cc-secundario', 30, 'cs-secundario');
    repos.courseCycleRepo.findByUuids = vi.fn().mockResolvedValue([primarioCC, secundarioCC]);
    repos.courseCycleRepo.findGradingContextsByUuids = vi.fn().mockResolvedValue(
      new Map([
        ['cc-primario',   { level: 20, modality: 0 }],
        ['cc-secundario', { level: 30, modality: 0 }],
      ]),
    );

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    expect(result).toHaveLength(2);
    const uuids = result.map((r) => r.cycle.uuid);
    expect(uuids).toContain('cc-primario');
    expect(uuids).toContain('cc-secundario');
  });

  it('ESS-R2: Terciario (level=40) e Inicial (level=10) EXCLUIDOS del subject mode', async () => {
    const dxc = makeDocente('dxc-1', 'user-abc');
    repos.docenteRepo.findByUserId = vi.fn().mockResolvedValue([dxc]);
    repos.grupoRepo.findByDocente = vi.fn().mockResolvedValue([
      makeGrupo('g1', 'dxc-1', 'mat-10'),
      makeGrupo('g2', 'dxc-1', 'mat-20'),
      makeGrupo('g3', 'dxc-1', 'mat-30'),
      makeGrupo('g4', 'dxc-1', 'mat-40'),
    ]);
    mockClient.materiaXCursoXCiclo.findMany.mockResolvedValue([
      { id: 'mat-10', courseCycleId: 'cc-10' },
      { id: 'mat-20', courseCycleId: 'cc-20' },
      { id: 'mat-30', courseCycleId: 'cc-30' },
      { id: 'mat-40', courseCycleId: 'cc-40' },
    ]);
    repos.courseCycleRepo.findByUuids = vi.fn().mockResolvedValue([
      makeCC('cc-10', 10, 'cs-10'),
      makeCC('cc-20', 20, 'cs-20'),
      makeCC('cc-30', 30, 'cs-30'),
      makeCC('cc-40', 40, 'cs-40'),
    ]);
    repos.courseCycleRepo.findGradingContextsByUuids = vi.fn().mockResolvedValue(
      new Map([
        ['cc-20', { level: 20, modality: 0 }],
        ['cc-30', { level: 30, modality: 0 }],
      ]),
    );

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    const uuids = result.map((r) => r.cycle.uuid);
    expect(uuids).toContain('cc-20');   // Primario — IN
    expect(uuids).toContain('cc-30');   // Secundario — IN
    expect(uuids).not.toContain('cc-10'); // Inicial — OUT
    expect(uuids).not.toContain('cc-40'); // Terciario — OUT
    expect(result).toHaveLength(2);
  });

  it('deduplicates courseCycleIds cuando el mismo CC aparece en múltiples grupos', async () => {
    const dxc = makeDocente('dxc-1', 'user-abc');
    repos.docenteRepo.findByUserId = vi.fn().mockResolvedValue([dxc]);
    // Dos grupos distintos pero que apuntan al MISMO CC
    repos.grupoRepo.findByDocente = vi.fn().mockResolvedValue([
      makeGrupo('g1', 'dxc-1', 'mat-math'),
      makeGrupo('g2', 'dxc-1', 'mat-science'),
    ]);
    mockClient.materiaXCursoXCiclo.findMany.mockResolvedValue([
      { id: 'mat-math',    courseCycleId: 'cc-A' },
      { id: 'mat-science', courseCycleId: 'cc-A' }, // mismo CC
    ]);
    repos.courseCycleRepo.findByUuids = vi.fn().mockResolvedValue([makeCC('cc-A', 20, 'cs-A')]);
    repos.courseCycleRepo.findGradingContextsByUuids = vi.fn().mockResolvedValue(
      new Map([['cc-A', { level: 20, modality: 0 }]]),
    );

    await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    const calledWith = (repos.courseCycleRepo.findByUuids as ReturnType<typeof vi.fn>).mock.calls[0][0] as string[];
    expect(calledWith).toHaveLength(1); // deduplicado a 1 CC
    expect(calledWith[0]).toBe('cc-A');
  });

  it('teacher isolation: docenteRepo se llama con el userId correcto', async () => {
    repos.docenteRepo.findByUserId = vi.fn().mockResolvedValue([]);

    await useCase.execute({ userId: 'user-XYZ', mode: 'subject' });

    expect(repos.docenteRepo.findByUserId).toHaveBeenCalledWith('user-XYZ');
  });

  it('docente con múltiples DocenteXCiclo (varios ciclos) → grupos de TODOS los ciclos', async () => {
    const dxc1 = makeDocente('dxc-1', 'user-abc', 'cycle-2024');
    const dxc2 = makeDocente('dxc-2', 'user-abc', 'cycle-2025');
    repos.docenteRepo.findByUserId = vi.fn().mockResolvedValue([dxc1, dxc2]);
    (repos.grupoRepo.findByDocente as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([makeGrupo('g1', 'dxc-1', 'mat-2024')])
      .mockResolvedValueOnce([makeGrupo('g2', 'dxc-2', 'mat-2025')]);
    mockClient.materiaXCursoXCiclo.findMany.mockResolvedValue([
      { id: 'mat-2024', courseCycleId: 'cc-2024' },
      { id: 'mat-2025', courseCycleId: 'cc-2025' },
    ]);
    repos.courseCycleRepo.findByUuids = vi.fn().mockResolvedValue([
      makeCC('cc-2024', 20, 'cs-2024'),
      makeCC('cc-2025', 20, 'cs-2025'),
    ]);
    repos.courseCycleRepo.findGradingContextsByUuids = vi.fn().mockResolvedValue(
      new Map([
        ['cc-2024', { level: 20, modality: 0 }],
        ['cc-2025', { level: 20, modality: 0 }],
      ]),
    );

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    expect(result).toHaveLength(2);
    // grupoRepo.findByDocente should be called for each dxc
    expect(repos.grupoRepo.findByDocente).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ListTeacherCourseCyclesUseCase — homeroom mode (Teacher model, unchanged)
// ═══════════════════════════════════════════════════════════════════════════════

describe('ListTeacherCourseCyclesUseCase — mode=homeroom (Teacher model, sin cambios)', () => {
  let repos: ReturnType<typeof makeRepos>;
  let useCase: ListTeacherCourseCyclesUseCase;

  beforeEach(() => {
    vi.mocked(TenantContext.getClient).mockReturnValue(makeMockClient() as any);
    repos = makeRepos();
    useCase = new ListTeacherCourseCyclesUseCase(
      repos.teacherRepo as any,
      repos.docenteRepo as any,
      repos.grupoRepo as any,
      repos.courseCycleRepo as any,
    );
  });

  it('TIA-R2: userId sin Teacher record → empty array', async () => {
    repos.teacherRepo.findByUserId = vi.fn().mockResolvedValue(null);

    const result = await useCase.execute({ userId: 'user-xyz', mode: 'homeroom' });

    expect(result).toEqual([]);
  });

  it('TIA-R5: teacher con homeroomTeacherId → ve sus CCs', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId = vi.fn().mockResolvedValue(teacher);
    repos.courseCycleRepo.findByHomeroomTeacher = vi.fn().mockResolvedValue([
      makeCC('cc-homeroom', 20, 'cs-A'),
    ]);
    repos.courseCycleRepo.findGradingContextsByUuids = vi.fn().mockResolvedValue(
      new Map([['cc-homeroom', { level: 20, modality: 0 }]]),
    );

    const result = await useCase.execute({ userId: 'user-abc', mode: 'homeroom' });

    expect(result).toHaveLength(1);
    expect(result[0].cycle.uuid).toBe('cc-homeroom');
    expect(repos.courseCycleRepo.findByHomeroomTeacher).toHaveBeenCalledWith(teacher.id.get());
  });

  it('TIA-R9: filtra non-Primario homeroom CCs', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId = vi.fn().mockResolvedValue(teacher);
    repos.courseCycleRepo.findByHomeroomTeacher = vi.fn().mockResolvedValue([
      makeCC('cc-primario',  20, 'cs-A'),
      makeCC('cc-terciario', 40, 'cs-B'),
    ]);
    repos.courseCycleRepo.findGradingContextsByUuids = vi.fn().mockResolvedValue(
      new Map([['cc-primario', { level: 20, modality: 0 }]]),
    );

    const result = await useCase.execute({ userId: 'user-abc', mode: 'homeroom' });

    expect(result).toHaveLength(1);
    expect(result[0].cycle.uuid).toBe('cc-primario');
  });

  it('homeroom mode NO llama a docenteRepo ni grupoRepo', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId = vi.fn().mockResolvedValue(teacher);
    repos.courseCycleRepo.findByHomeroomTeacher = vi.fn().mockResolvedValue([]);

    await useCase.execute({ userId: 'user-abc', mode: 'homeroom' });

    expect(repos.docenteRepo.findByUserId).not.toHaveBeenCalled();
    expect(repos.grupoRepo.findByDocente).not.toHaveBeenCalled();
  });
});
