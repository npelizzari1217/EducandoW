/**
 * ListTeacherSubjectsInCourseCycleUseCase tests — model NUEVO (DocenteXCiclo + grupos).
 *
 * Reemplaza Teacher+SubjectAssignment por DocenteXCiclo+GrupoRepository.
 * Path: userId+cycleId → DocenteXCiclo → GrupoXCursoXMateriaXCiclo → MateriaXCursoXCiclo.subjectId.
 *
 * Scenarios:
 *   - Docente con grupo en CC → ve sus materias (con subjectId + studyPlanSubjectId).
 *   - Docente sin DocenteXCiclo → empty.
 *   - Docente con DocenteXCiclo pero sin grupos en la CC → empty.
 *   - CC not found → empty (cross-tenant isolation).
 *
 * Specs: TIA-R4, TIA-R7
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListTeacherSubjectsInCourseCycleUseCase } from './list-teacher-subjects-in-course-cycle.use-case';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import { DocenteXCiclo, GrupoXCursoXMateriaXCiclo } from '@educandow/domain';

vi.mock('../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function makeGrupo(id: string, docenteXCicloId: string, materiaXCursoXCicloId: string): GrupoXCursoXMateriaXCiclo {
  return GrupoXCursoXMateriaXCiclo.reconstruct({
    id,
    docenteXCicloId,
    materiaXCursoXCicloId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/** CC con cycleId='cycle-1' para poder resolver DocenteXCiclo */
function makeMockClient(overrides: {
  cc?: Record<string, unknown> | null;
  materias?: { id: string; subjectId: string }[];
  subjects?: { id: string; name: string }[];
  studyPlanCourse?: { id: string } | null;
  studyPlanSubjects?: { id: string; subjectId: string }[];
} = {}) {
  return {
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue(
        overrides.cc ?? { uuid: 'cc-uuid-1', courseId: 'cs-A', cycleId: 'cycle-1', studyPlanId: 'sp-1' },
      ),
    },
    materiaXCursoXCiclo: {
      findMany: vi.fn().mockResolvedValue(overrides.materias ?? []),
    },
    subject: {
      findMany: vi.fn().mockResolvedValue(
        overrides.subjects ?? [],
      ),
    },
    studyPlanCourse: {
      findFirst: vi.fn().mockResolvedValue(
        overrides.studyPlanCourse !== undefined ? overrides.studyPlanCourse : { id: 'spc-1' },
      ),
    },
    studyPlanSubject: {
      findMany: vi.fn().mockResolvedValue(overrides.studyPlanSubjects ?? []),
    },
  };
}

function makeRepos(docenteOverrides: Partial<{
  findByUserAndCycle: ReturnType<typeof vi.fn>;
}> = {}, grupoOverrides: Partial<{
  findByDocente: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    docenteRepo: {
      findByUserAndCycle: docenteOverrides.findByUserAndCycle ?? vi.fn().mockResolvedValue(null),
    },
    grupoRepo: {
      findByDocente: grupoOverrides.findByDocente ?? vi.fn().mockResolvedValue([]),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ListTeacherSubjectsInCourseCycleUseCase
// ═══════════════════════════════════════════════════════════════════════════════

describe('ListTeacherSubjectsInCourseCycleUseCase', () => {
  let useCase: ListTeacherSubjectsInCourseCycleUseCase;
  let repos: ReturnType<typeof makeRepos>;
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repos = makeRepos();
    useCase = new ListTeacherSubjectsInCourseCycleUseCase(
      repos.docenteRepo as any,
      repos.grupoRepo as any,
    );
  });

  it('TIA-R2: userId sin DocenteXCiclo en el ciclo del CC → empty array', async () => {
    repos.docenteRepo.findByUserAndCycle = vi.fn().mockResolvedValue(null);

    const result = await useCase.execute({ userId: 'no-docente', courseCycleId: 'cc-uuid-1' });

    expect(result).toEqual([]);
    expect(repos.grupoRepo.findByDocente).not.toHaveBeenCalled();
  });

  it('TIA-R7: CC not found → empty array (cross-tenant isolation)', async () => {
    mockClient.courseCycle.findUnique = vi.fn().mockResolvedValue(null);
    repos.docenteRepo.findByUserAndCycle = vi.fn().mockResolvedValue(makeDocente());

    const result = await useCase.execute({ userId: 'user-abc', courseCycleId: 'cc-otro-tenant' });

    expect(result).toEqual([]);
  });

  it('TIA-R4: docente con grupo en CC → retorna las materias de esa CC', async () => {
    const dxc = makeDocente('dxc-1', 'user-abc', 'cycle-1');
    const grupo = makeGrupo('g1', 'dxc-1', 'mat-uuid-1');

    repos.docenteRepo.findByUserAndCycle = vi.fn().mockResolvedValue(dxc);
    repos.grupoRepo.findByDocente = vi.fn().mockResolvedValue([grupo]);

    mockClient.materiaXCursoXCiclo.findMany = vi.fn().mockResolvedValue([
      { id: 'mat-uuid-1', subjectId: 'subj-math' },
    ]);
    mockClient.subject.findMany = vi.fn().mockResolvedValue([
      { id: 'subj-math', name: 'Matemática' },
    ]);
    mockClient.studyPlanSubject.findMany = vi.fn().mockResolvedValue([
      { id: 'sps-math', subjectId: 'subj-math' },
    ]);

    const result = await useCase.execute({ userId: 'user-abc', courseCycleId: 'cc-uuid-1' });

    expect(result).toHaveLength(1);
    expect(result[0].subjectId).toBe('subj-math');
    expect(result[0].subjectName).toBe('Matemática');
  });

  it('retorna empty cuando docente tiene grupos pero NINGUNO pertenece a esta CC', async () => {
    const dxc = makeDocente('dxc-1', 'user-abc', 'cycle-1');
    const grupoOtraCC = makeGrupo('g1', 'dxc-1', 'mat-other-cc');

    repos.docenteRepo.findByUserAndCycle = vi.fn().mockResolvedValue(dxc);
    repos.grupoRepo.findByDocente = vi.fn().mockResolvedValue([grupoOtraCC]);
    // materiaXCursoXCiclo.findMany filtra por courseCycleId → retorna vacío
    mockClient.materiaXCursoXCiclo.findMany = vi.fn().mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'user-abc', courseCycleId: 'cc-uuid-1' });

    expect(result).toEqual([]);
  });

  it('TIA-R4b: incluye studyPlanSubjectId en cada entry', async () => {
    const dxc = makeDocente('dxc-1', 'user-abc', 'cycle-1');
    repos.docenteRepo.findByUserAndCycle = vi.fn().mockResolvedValue(dxc);
    repos.grupoRepo.findByDocente = vi.fn().mockResolvedValue([makeGrupo('g1', 'dxc-1', 'mat-1')]);
    mockClient.materiaXCursoXCiclo.findMany = vi.fn().mockResolvedValue([{ id: 'mat-1', subjectId: 'subj-math' }]);
    mockClient.subject.findMany = vi.fn().mockResolvedValue([{ id: 'subj-math', name: 'Matemática' }]);
    mockClient.studyPlanCourse.findFirst = vi.fn().mockResolvedValue({ id: 'spc-1' });
    mockClient.studyPlanSubject.findMany = vi.fn().mockResolvedValue([{ id: 'sps-42', subjectId: 'subj-math' }]);

    const result = await useCase.execute({ userId: 'user-abc', courseCycleId: 'cc-uuid-1' });

    expect(result[0].studyPlanSubjectId).toBe('sps-42');
  });

  it('studyPlanSubjectId es null cuando StudyPlanCourse lookup falla', async () => {
    const dxc = makeDocente();
    repos.docenteRepo.findByUserAndCycle = vi.fn().mockResolvedValue(dxc);
    repos.grupoRepo.findByDocente = vi.fn().mockResolvedValue([makeGrupo('g1', 'dxc-1', 'mat-art')]);
    mockClient.materiaXCursoXCiclo.findMany = vi.fn().mockResolvedValue([{ id: 'mat-art', subjectId: 'subj-art' }]);
    mockClient.subject.findMany = vi.fn().mockResolvedValue([{ id: 'subj-art', name: 'Arte' }]);
    mockClient.studyPlanCourse.findFirst = vi.fn().mockResolvedValue(null); // no StudyPlanCourse

    const result = await useCase.execute({ userId: 'user-abc', courseCycleId: 'cc-uuid-1' });

    expect(result[0].studyPlanSubjectId).toBeNull();
  });

  it('pasa el cycleId del CC a findByUserAndCycle (no el courseCycleId)', async () => {
    // El CC tiene cycleId='cycle-XYZ' — eso es lo que se pasa al docenteRepo
    mockClient.courseCycle.findUnique = vi.fn().mockResolvedValue({
      uuid: 'cc-uuid-1', courseId: 'cs-A', cycleId: 'cycle-XYZ', studyPlanId: 'sp-1',
    });

    await useCase.execute({ userId: 'user-abc', courseCycleId: 'cc-uuid-1' });

    expect(repos.docenteRepo.findByUserAndCycle).toHaveBeenCalledWith('user-abc', 'cycle-XYZ');
  });

  it('filtra materias por courseCycleId cuando docente tiene grupos en múltiples CCs', async () => {
    const dxc = makeDocente('dxc-1', 'user-abc', 'cycle-1');
    repos.docenteRepo.findByUserAndCycle = vi.fn().mockResolvedValue(dxc);
    repos.grupoRepo.findByDocente = vi.fn().mockResolvedValue([
      makeGrupo('g1', 'dxc-1', 'mat-en-esta-cc'),
      makeGrupo('g2', 'dxc-1', 'mat-en-otra-cc'),
    ]);
    // Prisma filtra por courseCycleId → solo devuelve la materia de ESTA CC
    mockClient.materiaXCursoXCiclo.findMany = vi.fn().mockResolvedValue([
      { id: 'mat-en-esta-cc', subjectId: 'subj-math' },
    ]);
    mockClient.subject.findMany = vi.fn().mockResolvedValue([{ id: 'subj-math', name: 'Matemática' }]);

    const result = await useCase.execute({ userId: 'user-abc', courseCycleId: 'cc-uuid-1' });

    expect(result).toHaveLength(1);
    expect(result[0].subjectId).toBe('subj-math');
    // materiaXCursoXCiclo.findMany debe filtrar por los ids de los grupos Y por courseCycleId
    expect(mockClient.materiaXCursoXCiclo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ courseCycleId: 'cc-uuid-1' }),
      }),
    );
  });
});
