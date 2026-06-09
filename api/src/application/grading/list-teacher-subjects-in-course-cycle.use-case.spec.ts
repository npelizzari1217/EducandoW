/**
 * PR4-T13 [RED] — ListTeacherSubjectsInCourseCycleUseCase tests.
 * Specs: TIA-R4, TIA-R7, TIA-R8
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListTeacherSubjectsInCourseCycleUseCase } from './list-teacher-subjects-in-course-cycle.use-case';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import { Teacher, Id, Dni, Email } from '@educandow/domain';

vi.mock('../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTeacher(id = 'teacher-uuid-1', userId = 'user-abc'): Teacher {
  return Teacher.reconstruct({
    id: Id.reconstruct(id),
    firstName: 'Ana',
    lastName: 'Martínez',
    dni: Dni.reconstruct('87654321'),
    email: Email.reconstruct('ana@school.edu'),
    userId,
    institutionId: Id.reconstruct('inst-1'),
    active: true,
  });
}

function makeAssignment(subjectId: string, courseSectionId: string) {
  return { id: { get: () => `assign-${subjectId}` }, subjectId, teacherId: 'teacher-uuid-1', courseSectionId };
}

function makeMockClient(subjects: { id: string; name: string }[] = []) {
  return {
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue({ uuid: 'cc-uuid-1', courseId: 'cs-A', studyPlanId: 'sp-1' }),
    },
    subject: {
      findMany: vi.fn().mockResolvedValue(subjects),
    },
  };
}

function makeRepos(teacher: Teacher | null = makeTeacher()) {
  return {
    teacherRepo: {
      findByUserId: vi.fn().mockResolvedValue(teacher),
    },
    assignmentRepo: {
      findByTeacher: vi.fn().mockResolvedValue([]),
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
    repos = makeRepos();
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    useCase = new ListTeacherSubjectsInCourseCycleUseCase(
      repos.teacherRepo as any,
      repos.assignmentRepo as any,
    );
  });

  it('TIA-R2: unlinked userId → empty array', async () => {
    repos.teacherRepo.findByUserId.mockResolvedValue(null);

    const result = await useCase.execute({ userId: 'no-teacher', courseCycleId: 'cc-uuid-1' });

    expect(result).toEqual([]);
  });

  it('TIA-R4: returns only subjects assigned to teacher in the given CC', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    // Teacher has two assignments: Math (courseSectionId = cs-A) and Science (different cs)
    repos.assignmentRepo.findByTeacher.mockResolvedValue([
      makeAssignment('subj-math', 'cs-A'),
      makeAssignment('subj-science', 'cs-B'),  // different section — filtered out
    ]);
    mockClient.courseCycle.findUnique.mockResolvedValue({ uuid: 'cc-uuid-1', courseId: 'cs-A' });
    mockClient.subject.findMany.mockResolvedValue([
      { id: 'subj-math', name: 'Matemática' },
    ]);

    const result = await useCase.execute({ userId: 'user-abc', courseCycleId: 'cc-uuid-1' });

    expect(result).toHaveLength(1);
    expect(result[0].subjectId).toBe('subj-math');
    expect(result[0].subjectName).toBe('Matemática');
  });

  it('returns empty when teacher has no assignments in this CC', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    repos.assignmentRepo.findByTeacher.mockResolvedValue([
      makeAssignment('subj-history', 'cs-B'),  // assignment in a DIFFERENT section
    ]);
    mockClient.courseCycle.findUnique.mockResolvedValue({ uuid: 'cc-uuid-1', courseId: 'cs-A' });

    const result = await useCase.execute({ userId: 'user-abc', courseCycleId: 'cc-uuid-1' });

    expect(result).toEqual([]);
  });

  it('returns empty when CC not found in tenant (cross-tenant isolation)', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    mockClient.courseCycle.findUnique.mockResolvedValue(null);  // CC not found

    const result = await useCase.execute({ userId: 'user-abc', courseCycleId: 'cc-other-tenant' });

    expect(result).toEqual([]);
  });

  it('teacher isolation: passes teacher.id.get() to assignment repo, not userId', async () => {
    const teacher = makeTeacher('teacher-uuid-99', 'user-abc');
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    repos.assignmentRepo.findByTeacher.mockResolvedValue([]);

    await useCase.execute({ userId: 'user-abc', courseCycleId: 'cc-uuid-1' });

    expect(repos.assignmentRepo.findByTeacher).toHaveBeenCalledWith('teacher-uuid-99');
  });
});
