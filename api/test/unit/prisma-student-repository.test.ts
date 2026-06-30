/**
 * Unit tests for PrismaStudentRepository.
 * Mocks TenantContext so no real DB is needed.
 *
 * Covers Round7-Fix1 (Security): findByGuardianUserId must exclude deactivated
 * guardian links. ListStudentsUseCase (TUTOR branch) reads through THIS method,
 * so a deactivated guardian must not see linked students via GET /students.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantContext } from '../../src/infrastructure/auth/tenant.context';
import { PrismaStudentRepository } from '../../src/infrastructure/persistence/prisma/repositories/prisma-student.repository';

const mockFindMany = vi.fn();
const mockPrismaClient = {
  student: {
    findMany: mockFindMany,
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
  },
};

describe('PrismaStudentRepository — Round7-Fix1 (deactivation revokes list access)', () => {
  let repo: PrismaStudentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(TenantContext, 'getClient').mockReturnValue(mockPrismaClient as unknown as ReturnType<typeof TenantContext.getClient>);
    vi.spyOn(TenantContext, 'getInstitutionId').mockReturnValue('inst-1');
    repo = new PrismaStudentRepository();
  });

  /**
   * RED (before fix): where.guardians.some omits active filter → deactivated guardian
   * links still match → deactivated guardian sees the student.
   * GREEN (after fix): some clause includes { active: true } so only active links match.
   */
  it('findByGuardianUserId filters guardian links by active:true', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await repo.findByGuardianUserId('u-parent-123');

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.guardians.some).toMatchObject({ userId: 'u-parent-123', active: true });
  });
});
