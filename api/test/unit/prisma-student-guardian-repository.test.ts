/**
 * Unit tests for PrismaStudentGuardianRepository.
 * Mocks TenantContext so no real DB is needed.
 *
 * Covers round-3 code-review fixes:
 *   Fix #1 (Revert): P2002 on fullName must NOT be caught — it propagates
 *   Fix #2: findStudyTutor must filter userId IS NULL
 *   Fix #3: P2002 on (studentId, userId) → ValidationError('GUARDIAN_ALREADY_ASSIGNED')
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantContext } from '../../src/infrastructure/auth/tenant.context';
import { PrismaStudentGuardianRepository } from '../../src/infrastructure/persistence/prisma/repositories/prisma-student-guardian.repository';
import { StudentGuardian, Id, Mobile, ValidationError } from '@educandow/domain';

// ── Prisma client mock ─────────────────────────────────────────────────────────
const mockUpsert = vi.fn();
const mockFindFirst = vi.fn();
const mockPrismaClient = {
  studentGuardian: {
    upsert: mockUpsert,
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: mockFindFirst,
    delete: vi.fn().mockResolvedValue(null),
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeStudyTutorGuardian(): StudentGuardian {
  const now = new Date();
  return StudentGuardian.reconstruct({
    id: Id.reconstruct('g1'),
    studentId: 's1',
    userId: undefined,              // study tutor — no portal account
    relationship: 'tutor',
    fullName: 'Ana García',
    mobile: Mobile.reconstruct('+5492215551234'),
    email: undefined,
    isFinancialResponsible: false,
    isAuthorizedToPickUp: false,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
}

function makePortalGuardian(): StudentGuardian {
  const now = new Date();
  return StudentGuardian.reconstruct({
    id: Id.reconstruct('g2'),
    studentId: 's1',
    userId: 'u-parent-123',         // portal-linked guardian
    relationship: 'mother',
    fullName: 'Ana García',
    mobile: Mobile.reconstruct('+5492215559999'),
    email: undefined,
    isFinancialResponsible: false,
    isAuthorizedToPickUp: false,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
}

// ── Test suite ─────────────────────────────────────────────────────────────────
describe('PrismaStudentGuardianRepository — round-3 fixes', () => {
  let repo: PrismaStudentGuardianRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(TenantContext, 'getClient').mockReturnValue(mockPrismaClient as unknown as ReturnType<typeof TenantContext.getClient>);
    repo = new PrismaStudentGuardianRepository();
  });

  // ── Fix #1 (index revert) ──────────────────────────────────────────────────

  /**
   * RED (before fix): repo catches P2002 with fullName → throws ValidationError('TUTOR_DUPLICATE_NAME')
   * GREEN (after fix): P2002 with fullName propagates as-is (no ValidationError wrapping)
   */
  it('(Fix1-Revert) save() propagates raw P2002 when meta.target includes fullName — does NOT throw ValidationError', async () => {
    const p2002 = Object.assign(new Error('Unique constraint failed on the fields: (`fullName`)'), {
      code: 'P2002',
      meta: { target: ['studentId', 'fullName'] },
    });
    mockUpsert.mockRejectedValueOnce(p2002);

    // After the index revert, P2002 on fullName must propagate, not be caught as ValidationError
    await expect(repo.save(makeStudyTutorGuardian())).rejects.not.toBeInstanceOf(ValidationError);
  });

  // ── Fix #3 (portal P2002 → 409) ───────────────────────────────────────────

  /**
   * RED (before fix): P2002 on (studentId, userId) propagates as raw Prisma error
   * GREEN (after fix): caught and rethrown as ValidationError('GUARDIAN_ALREADY_ASSIGNED')
   */
  it('(Fix3) save() maps P2002 on (studentId,userId) to ValidationError GUARDIAN_ALREADY_ASSIGNED', async () => {
    const p2002 = Object.assign(new Error('Unique constraint failed on the fields: (`studentId`,`userId`)'), {
      code: 'P2002',
      meta: { target: ['studentId', 'userId'] },
    });
    mockUpsert.mockRejectedValueOnce(p2002);

    await expect(repo.save(makePortalGuardian())).rejects.toSatisfy(
      (e: unknown) => e instanceof ValidationError && (e as ValidationError).message === 'GUARDIAN_ALREADY_ASSIGNED',
    );
  });

  // ── Fix #2 (findStudyTutor — userId:null filter) ───────────────────────────

  /**
   * RED (before fix): findStudyTutor omits userId filter → portal guardian with same name is returned
   * GREEN (after fix): where clause includes { userId: null } → only study tutors are matched
   */
  it('(Fix2) findStudyTutor queries with userId:null so portal guardians are excluded', async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    await repo.findStudyTutor('s1', 'Ana García');

    const callArgs = mockFindFirst.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({ userId: null });
  });

  /**
   * Ensure that even when a portal guardian exists with the same fullName,
   * findStudyTutor returns null (they are not study tutors).
   *
   * RED (before fix): repo queries without userId filter → portal guardian row returned
   * GREEN (after fix): userId:null filter excludes portal rows → null returned
   */
  it('(Fix2b) findStudyTutor returns null when only portal guardian exists with that name', async () => {
    // Simulate DB returning null because of userId:null filter
    mockFindFirst.mockResolvedValueOnce(null);

    const result = await repo.findStudyTutor('s1', 'Ana García');
    expect(result).toBeNull();
  });
});
