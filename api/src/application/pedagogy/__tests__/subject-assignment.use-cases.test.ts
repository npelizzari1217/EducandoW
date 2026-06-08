import { describe, it, expect, vi } from 'vitest';
import { CreateSubjectAssignmentUC } from '../use-cases/pedagogy.use-cases';
import { AutoCreateCompetencyValuationsUC } from '../use-cases/competency.use-cases';
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

// ── CreateSubjectAssignmentUC — AutoCreate isolation ──────

describe('CreateSubjectAssignmentUC — AutoCreate isolation (Spec 2 Req 3 Scenario 2)', () => {
  it('still returns ok when AutoCreate throws (fire-and-forget)', async () => {
    const repo = makeSubjectAssignmentRepo();
    const autoCreate = {
      executeForSubjectAssignment: vi.fn().mockRejectedValue(new Error('DB connection failed')),
    } as unknown as AutoCreateCompetencyValuationsUC;

    const uc = new CreateSubjectAssignmentUC(repo, autoCreate);
    const result = await uc.execute({
      subjectId: 'subj-1',
      teacherId: 'teacher-1',
      courseSectionId: 'section-1',
    });

    expect(result.isOk()).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(autoCreate.executeForSubjectAssignment).toHaveBeenCalledWith('subj-1', 'section-1');
  });

  it('still returns ok when AutoCreate returns a rejected promise', async () => {
    const repo = makeSubjectAssignmentRepo();
    const autoCreate = {
      executeForSubjectAssignment: vi.fn().mockReturnValue(Promise.reject(new Error('AutoCreate failed silently'))),
    } as unknown as AutoCreateCompetencyValuationsUC;

    const uc = new CreateSubjectAssignmentUC(repo, autoCreate);
    const result = await uc.execute({
      subjectId: 'subj-2',
      teacherId: 'teacher-1',
      courseSectionId: 'section-2',
    });

    expect(result.isOk()).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});
