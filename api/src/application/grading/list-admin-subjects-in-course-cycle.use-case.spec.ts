/**
 * ListAdminSubjectsInCourseCycleUseCase tests
 *
 * Admin path: returns ALL subjects of a CC without teacher filter.
 * Spec: same TeacherSubjectEntry[] shape as the teacher path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListAdminSubjectsInCourseCycleUseCase } from './list-admin-subjects-in-course-cycle.use-case';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import { MateriaXCursoXCiclo } from '@educandow/domain';

vi.mock('../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

function makeMateria(id: string, subjectId: string, courseCycleId = 'cc-uuid-1'): MateriaXCursoXCiclo {
  return MateriaXCursoXCiclo.reconstruct({
    id,
    courseCycleId,
    subjectId,
    esOptativa: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeMockClient(overrides: {
  cc?: Record<string, unknown> | null;
  subjects?: { id: string; name: string }[];
  studyPlanCourse?: { id: string } | null;
  studyPlanSubjects?: { id: string; subjectId: string }[];
} = {}) {
  return {
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue(
        overrides.cc !== undefined ? overrides.cc : { studyPlanId: 'sp-1', courseId: 'cs-1' },
      ),
    },
    subject: {
      findMany: vi.fn().mockResolvedValue(overrides.subjects ?? []),
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

describe('ListAdminSubjectsInCourseCycleUseCase', () => {
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
  });

  it('returns empty array when CC has no materias', async () => {
    const materiaRepo = { findByCourseCycleId: vi.fn().mockResolvedValue([]) };
    const uc = new ListAdminSubjectsInCourseCycleUseCase(materiaRepo as any);

    const result = await uc.execute('cc-empty');

    expect(result).toEqual([]);
    expect(mockClient.subject.findMany).not.toHaveBeenCalled();
  });

  it('returns all subjects of a CC without teacher filter', async () => {
    const materias = [
      makeMateria('m-1', 'subj-math'),
      makeMateria('m-2', 'subj-art'),
    ];
    const materiaRepo = { findByCourseCycleId: vi.fn().mockResolvedValue(materias) };
    mockClient.subject.findMany = vi.fn().mockResolvedValue([
      { id: 'subj-math', name: 'Matemática' },
      { id: 'subj-art', name: 'Arte' },
    ]);

    const uc = new ListAdminSubjectsInCourseCycleUseCase(materiaRepo as any);
    const result = await uc.execute('cc-uuid-1');

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.subjectId)).toEqual(expect.arrayContaining(['subj-math', 'subj-art']));
    expect(result.find((r) => r.subjectId === 'subj-math')?.subjectName).toBe('Matemática');
  });

  it('includes studyPlanSubjectId when available', async () => {
    const materias = [makeMateria('m-1', 'subj-math')];
    const materiaRepo = { findByCourseCycleId: vi.fn().mockResolvedValue(materias) };
    mockClient.subject.findMany = vi.fn().mockResolvedValue([{ id: 'subj-math', name: 'Matemática' }]);
    mockClient.studyPlanSubject.findMany = vi.fn().mockResolvedValue([{ id: 'sps-42', subjectId: 'subj-math' }]);

    const uc = new ListAdminSubjectsInCourseCycleUseCase(materiaRepo as any);
    const result = await uc.execute('cc-uuid-1');

    expect(result[0].studyPlanSubjectId).toBe('sps-42');
  });

  it('studyPlanSubjectId is null when studyPlanCourse not found', async () => {
    const materias = [makeMateria('m-1', 'subj-art')];
    const materiaRepo = { findByCourseCycleId: vi.fn().mockResolvedValue(materias) };
    mockClient.subject.findMany = vi.fn().mockResolvedValue([{ id: 'subj-art', name: 'Arte' }]);
    mockClient.studyPlanCourse.findFirst = vi.fn().mockResolvedValue(null);

    const uc = new ListAdminSubjectsInCourseCycleUseCase(materiaRepo as any);
    const result = await uc.execute('cc-uuid-1');

    expect(result[0].studyPlanSubjectId).toBeNull();
  });

  it('returns empty array when TenantContext has no client', async () => {
    vi.mocked(TenantContext.getClient).mockReturnValue(null as any);
    const materias = [makeMateria('m-1', 'subj-math')];
    const materiaRepo = { findByCourseCycleId: vi.fn().mockResolvedValue(materias) };

    const uc = new ListAdminSubjectsInCourseCycleUseCase(materiaRepo as any);
    const result = await uc.execute('cc-uuid-1');

    expect(result).toEqual([]);
  });
});
