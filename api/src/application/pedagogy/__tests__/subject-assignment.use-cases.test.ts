import { describe, it, expect, vi } from 'vitest';
import { CreateSubjectAssignmentUC } from '../use-cases/pedagogy.use-cases';
import type { SubjectAssignmentRepository } from '@educandow/domain';

// ── Mocks ─────────────────────────────────────────────────

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

function makeSubjectAssignmentRepo(): SubjectAssignmentRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    findByCourseSection: vi.fn().mockResolvedValue([]),
    findByTeacher: vi.fn().mockResolvedValue([]),
  } as unknown as SubjectAssignmentRepository;
}

// ── CreateSubjectAssignmentUC ──────────────────────────────
// Auto-create trigger was removed from SubjectAssignment (Design §3):
// CourseCycle instantiation is now the sole auto-create path.

describe('CreateSubjectAssignmentUC', () => {
  it('creates subject assignment and returns ok', async () => {
    const repo = makeSubjectAssignmentRepo();
    const uc = new CreateSubjectAssignmentUC(repo);
    const result = await uc.execute({
      subjectId: 'subj-1',
      teacherId: 'teacher-1',
      courseSectionId: 'section-1',
    });

    expect(result.isOk()).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('saves the assignment with the correct input fields', async () => {
    const repo = makeSubjectAssignmentRepo();
    const uc = new CreateSubjectAssignmentUC(repo);
    await uc.execute({
      subjectId: 'subj-2',
      teacherId: 'teacher-2',
      courseSectionId: 'section-2',
    });

    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = (repo.save as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(saved.subjectId).toBe('subj-2');
    expect(saved.teacherId).toBe('teacher-2');
    expect(saved.courseSectionId).toBe('section-2');
  });
});
