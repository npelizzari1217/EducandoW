import { describe, it, expect, vi } from 'vitest';
import { findEnrolledStudentsByCourseCycle } from '../enrolled-students.query';

// SDD-2 R5: enrolled-students must read from AlumnosXCursoXCiclo (authoritative),
// NOT from the legacy CourseSection→Enrollment heuristic join.
describe('findEnrolledStudentsByCourseCycle (SDD-2 R5 — AlumnosXCursoXCiclo authoritative)', () => {
  it('queries alumnosXCursoXCiclo.findMany with the given courseCycleId', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    const mockClient = {
      alumnosXCursoXCiclo: { findMany: mockFindMany },
    };

    await findEnrolledStudentsByCourseCycle(mockClient as any, 'cc-uuid-1');

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { courseCycleId: 'cc-uuid-1' },
      }),
    );
  });

  it('returns students mapped from alumnosXCursoXCiclo rows with student relation', async () => {
    const mockClient = {
      alumnosXCursoXCiclo: {
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

  it('returns [] when no alumnosXCursoXCiclo rows exist for the courseCycle', async () => {
    const mockClient = {
      alumnosXCursoXCiclo: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const result = await findEnrolledStudentsByCourseCycle(mockClient as any, 'cc-empty');
    expect(result).toEqual([]);
  });

  it('selects studentId + student firstName/lastName from the alumnosXCursoXCiclo relation', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    const mockClient = {
      alumnosXCursoXCiclo: { findMany: mockFindMany },
    };

    await findEnrolledStudentsByCourseCycle(mockClient as any, 'cc-uuid-1');

    const callArg = mockFindMany.mock.calls[0][0];
    expect(callArg.select).toMatchObject({
      studentId: true,
      student: { select: { firstName: true, lastName: true } },
    });
  });

  it('does NOT query courseCycle, courseSection, or enrollment tables (no heuristic join)', async () => {
    const mockCourseCycleFn = vi.fn();
    const mockCourseSectionFn = vi.fn();
    const mockEnrollmentFn = vi.fn();
    const mockClient = {
      alumnosXCursoXCiclo: { findMany: vi.fn().mockResolvedValue([]) },
      courseCycle: { findUnique: mockCourseCycleFn },
      courseSection: { findUnique: mockCourseSectionFn },
      enrollment: { findMany: mockEnrollmentFn },
    };

    await findEnrolledStudentsByCourseCycle(mockClient as any, 'cc-uuid-1');

    expect(mockCourseCycleFn).not.toHaveBeenCalled();
    expect(mockCourseSectionFn).not.toHaveBeenCalled();
    expect(mockEnrollmentFn).not.toHaveBeenCalled();
  });

  it('returns [] when courseCycleId does not match any alumnosXCursoXCiclo row', async () => {
    const mockClient = {
      alumnosXCursoXCiclo: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const result = await findEnrolledStudentsByCourseCycle(mockClient as any, 'cc-nonexistent');
    expect(result).toEqual([]);
  });
});
