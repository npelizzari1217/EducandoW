import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaStudyPlanRepository } from '../prisma-study-plan.repository';
import { TenantContext } from '../../../../auth/tenant.context';

vi.mock('../../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── cascadeChildrenLevel ──────────────────────────────────────

describe('PrismaStudyPlanRepository — cascadeChildrenLevel', () => {
  beforeEach(() => {
    vi.mocked(TenantContext.getClient).mockReset();
  });

  it('updates CourseSections with separate level/modality and CourseCycles with composite (planId, level=3, modality=1 → 31)', async () => {
    const mockCourseSectionUpdateMany = vi.fn().mockResolvedValue({ count: 2 });
    const mockCourseCycleUpdateMany = vi.fn().mockResolvedValue({ count: 2 });
    const mockTransaction = vi
      .fn()
      .mockImplementation((arr: Promise<unknown>[]) => Promise.all(arr));

    vi.mocked(TenantContext.getClient).mockReturnValue({
      courseSection: { updateMany: mockCourseSectionUpdateMany },
      courseCycle: { updateMany: mockCourseCycleUpdateMany },
      $transaction: mockTransaction,
    } as any);

    const repo = new PrismaStudyPlanRepository();
    await repo.cascadeChildrenLevel('plan-1', 3, 1);

    // CourseSections must receive separate level and modality columns
    expect(mockCourseSectionUpdateMany).toHaveBeenCalledWith({
      where: { studyPlanCourses: { some: { studyPlanId: 'plan-1' } } },
      data: { level: 3, modality: 1 },
    });

    // CourseCycles must receive the composite code (3 * 10 + 1 = 31)
    expect(mockCourseCycleUpdateMany).toHaveBeenCalledWith({
      where: { studyPlanId: 'plan-1' },
      data: { level: 31 },
    });

    // Both operations must run inside a single $transaction call
    expect(mockTransaction).toHaveBeenCalledOnce();
    const transactionArg = mockTransaction.mock.calls[0][0];
    expect(Array.isArray(transactionArg)).toBe(true);
    expect(transactionArg).toHaveLength(2);
  });

  it('computes composite BEFORE any write (transaction receives two operations)', async () => {
    const callOrder: string[] = [];
    const mockCourseSectionUpdateMany = vi
      .fn()
      .mockImplementation(() => { callOrder.push('courseSection.updateMany'); return Promise.resolve({ count: 0 }); });
    const mockCourseCycleUpdateMany = vi
      .fn()
      .mockImplementation(() => { callOrder.push('courseCycle.updateMany'); return Promise.resolve({ count: 0 }); });
    const mockTransaction = vi
      .fn()
      .mockImplementation((arr: Promise<unknown>[]) => {
        callOrder.push('$transaction');
        return Promise.all(arr);
      });

    vi.mocked(TenantContext.getClient).mockReturnValue({
      courseSection: { updateMany: mockCourseSectionUpdateMany },
      courseCycle: { updateMany: mockCourseCycleUpdateMany },
      $transaction: mockTransaction,
    } as any);

    const repo = new PrismaStudyPlanRepository();
    await repo.cascadeChildrenLevel('plan-2', 2, 0);

    // updateMany calls happen synchronously when building the array literal,
    // before $transaction executes them — $transaction is called last
    expect(callOrder[callOrder.length - 1]).toBe('$transaction');
  });
});
