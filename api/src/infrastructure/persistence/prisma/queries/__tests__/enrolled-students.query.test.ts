import { describe, it, expect, vi } from 'vitest';
import { findEnrolledStudentsByCourseCycle } from '../enrolled-students.query';

describe('findEnrolledStudentsByCourseCycle', () => {
  it('returns enrolled students with firstName and lastName when cycle exists', async () => {
    const mockClient = {
      courseCycle: {
        findUnique: vi.fn().mockResolvedValue({ courseId: 'section-1' }),
      },
      courseSection: {
        findUnique: vi.fn().mockResolvedValue({
          level: 20,
          grade: '3',
          division: 'A',
          academicYear: '2026',
        }),
      },
      enrollment: {
        findMany: vi.fn().mockResolvedValue([
          { studentId: 'stu-1', student: { firstName: 'Juan', lastName: 'Pérez' } },
          { studentId: 'stu-2', student: { firstName: 'Ana', lastName: 'López' } },
        ]),
      },
    };

    const result = await findEnrolledStudentsByCourseCycle(mockClient as any, 'cc-uuid-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ studentId: 'stu-1', firstName: 'Juan', lastName: 'Pérez' });
    expect(result[1]).toEqual({ studentId: 'stu-2', firstName: 'Ana', lastName: 'López' });
  });

  it('returns [] when courseCycle not found', async () => {
    const mockClient = {
      courseCycle: { findUnique: vi.fn().mockResolvedValue(null) },
    };

    const result = await findEnrolledStudentsByCourseCycle(mockClient as any, 'cc-nonexistent');
    expect(result).toEqual([]);
  });

  it('returns [] when courseSection not found', async () => {
    const mockClient = {
      courseCycle: { findUnique: vi.fn().mockResolvedValue({ courseId: 'section-missing' }) },
      courseSection: { findUnique: vi.fn().mockResolvedValue(null) },
    };

    const result = await findEnrolledStudentsByCourseCycle(mockClient as any, 'cc-uuid-1');
    expect(result).toEqual([]);
  });

  it('filters by status=ACTIVE and deletedAt=null', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    const mockClient = {
      courseCycle: { findUnique: vi.fn().mockResolvedValue({ courseId: 'section-1' }) },
      courseSection: {
        findUnique: vi.fn().mockResolvedValue({
          level: 20,
          grade: '1',
          division: 'A',
          academicYear: '2026',
        }),
      },
      enrollment: { findMany: mockFindMany },
    };

    await findEnrolledStudentsByCourseCycle(mockClient as any, 'cc-uuid-1');

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE', deletedAt: null }),
      }),
    );
  });

  it('returns [] when no active enrollments exist (SBC-3 precondition)', async () => {
    const mockClient = {
      courseCycle: { findUnique: vi.fn().mockResolvedValue({ courseId: 'section-1' }) },
      courseSection: {
        findUnique: vi.fn().mockResolvedValue({
          level: 20,
          grade: '1',
          division: 'A',
          academicYear: '2026',
        }),
      },
      enrollment: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const result = await findEnrolledStudentsByCourseCycle(mockClient as any, 'cc-empty');
    expect(result).toEqual([]);
  });

  it('selects studentId and student name fields (includes student relation)', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    const mockClient = {
      courseCycle: { findUnique: vi.fn().mockResolvedValue({ courseId: 'section-1' }) },
      courseSection: {
        findUnique: vi.fn().mockResolvedValue({
          level: 20,
          grade: '1',
          division: 'A',
          academicYear: '2026',
        }),
      },
      enrollment: { findMany: mockFindMany },
    };

    await findEnrolledStudentsByCourseCycle(mockClient as any, 'cc-uuid-1');

    const callArg = mockFindMany.mock.calls[0][0];
    expect(callArg.select).toMatchObject({
      studentId: true,
      student: { select: { firstName: true, lastName: true } },
    });
  });
});
