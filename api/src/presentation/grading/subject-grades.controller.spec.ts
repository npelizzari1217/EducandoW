/**
 * PR4-T16 — SubjectGradesController tests (read-side + write-side PR4b).
 * Write-side tests added in PR4b: PUT /grading/subject-grades, PUT /grading/subject-final-grades.
 * Specs: SPG-R8, SFG-R10, TIA-R8, ES-R7, SPG-R3, SFG-R5
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { ok, err, NotFoundError, ValidationError } from '@educandow/domain';

let SubjectGradesController: any;

beforeAll(async () => {
  const mod = await import('./subject-grades.controller');
  SubjectGradesController = mod.SubjectGradesController;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSubjectResult(studentCount = 1) {
  return {
    courseCycleId: 'cc-uuid-1',
    subjectId: 'subj-uuid-1',
    periods: [{ periodOrdinal: 1, periodName: '1° Trimestre' }],
    students: Array.from({ length: studentCount }, (_, i) => ({
      studentId: `student-${i + 1}`,
      firstName: 'Juan',
      lastName: 'García',
      periodGrades: [{ periodOrdinal: 1, gradeScaleValueId: null, gradeCode: null, internalStatus: null, pa: false, ppi: false, pp: false }],
      finalGrades: [
        { type: 'FINAL', gradeScaleValueId: null, gradeCode: null, internalStatus: null, passed: null },
        { type: 'DICIEMBRE', gradeScaleValueId: null, gradeCode: null, internalStatus: null, passed: null },
        { type: 'MARZO', gradeScaleValueId: null, gradeCode: null, internalStatus: null, passed: null },
        { type: 'DEFINITIVA', gradeScaleValueId: null, gradeCode: null, internalStatus: null, passed: null },
      ],
      competencyValuations: [],
    })),
  };
}

function makeStudentResult() {
  return {
    courseCycleId: 'cc-uuid-1',
    studentId: 'student-1',
    subjects: [
      {
        subjectId: 'subj-1',
        subjectName: 'Matemática',
        periods: [{ periodOrdinal: 1, periodName: '1° Trimestre' }],
        periodGrades: [{ periodOrdinal: 1, gradeScaleValueId: null, gradeCode: null, internalStatus: null, pa: false, ppi: false, pp: false }],
        finalGrades: [
          { type: 'FINAL', gradeScaleValueId: null, gradeCode: null, internalStatus: null, passed: null },
          { type: 'DICIEMBRE', gradeScaleValueId: null, gradeCode: null, internalStatus: null, passed: null },
          { type: 'MARZO', gradeScaleValueId: null, gradeCode: null, internalStatus: null, passed: null },
          { type: 'DEFINITIVA', gradeScaleValueId: null, gradeCode: null, internalStatus: null, passed: null },
        ],
        competencyValuations: [],
      },
    ],
  };
}

function makeController(overrides: Record<string, unknown> = {}) {
  const ctrl = Object.create(SubjectGradesController.prototype);
  ctrl.getBySubjectUC = overrides.getBySubjectUC ?? {
    execute: vi.fn().mockResolvedValue(makeSubjectResult()),
  };
  ctrl.getByStudentUC = overrides.getByStudentUC ?? {
    execute: vi.fn().mockResolvedValue(makeStudentResult()),
  };
  ctrl.upsertPeriodGradesUC = overrides.upsertPeriodGradesUC ?? {
    execute: vi.fn().mockResolvedValue(ok(undefined)),
  };
  ctrl.upsertFinalGradesUC = overrides.upsertFinalGradesUC ?? {
    execute: vi.fn().mockResolvedValue(ok(undefined)),
  };
  return ctrl;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /grading/subject-grades (por materia)
// ═══════════════════════════════════════════════════════════════════════════════

describe('SubjectGradesController — GET by-subject', () => {
  it('TIA-R8: returns { data } wrapper with result', async () => {
    const ctrl = makeController();
    const user = { userId: 'u-teacher', roles: ['TEACHER'] };

    const response = await ctrl.getBySubject(user, { courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1' });

    expect(response).toHaveProperty('data');
    expect(response.data.courseCycleId).toBe('cc-uuid-1');
  });

  it('calls getBySubjectUC with courseCycleId, subjectId and JWT userId', async () => {
    const executeMock = vi.fn().mockResolvedValue(makeSubjectResult());
    const ctrl = makeController({ getBySubjectUC: { execute: executeMock } });
    const user = { userId: 'u-teacher', roles: ['TEACHER'] };

    await ctrl.getBySubject(user, { courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1' });

    expect(executeMock).toHaveBeenCalledWith({
      courseCycleId: 'cc-uuid-1',
      subjectId: 'subj-uuid-1',
      userId: 'u-teacher',
      userRoles: ['TEACHER'],
    });
  });

  it('validation pipe: missing courseCycleId throws 400', async () => {
    const { ZodValidationPipe } = await import('../shared/pipes/zod-validation.pipe');
    const { SubjectGradesBySubjectQuerySchema } = await import('./dto/subject-grades.dto');
    const pipe = new ZodValidationPipe(SubjectGradesBySubjectQuerySchema);

    expect(() => pipe.transform({ subjectId: 'subj-1' }, {} as any)).toThrow();
  });

  it('validation pipe: missing subjectId throws 400', async () => {
    const { ZodValidationPipe } = await import('../shared/pipes/zod-validation.pipe');
    const { SubjectGradesBySubjectQuerySchema } = await import('./dto/subject-grades.dto');
    const pipe = new ZodValidationPipe(SubjectGradesBySubjectQuerySchema);

    expect(() => pipe.transform({ courseCycleId: 'cc-1' }, {} as any)).toThrow();
  });

  it('returns empty students array in data when no students (no error)', async () => {
    const emptyResult = { ...makeSubjectResult(), students: [] };
    const ctrl = makeController({ getBySubjectUC: { execute: vi.fn().mockResolvedValue(emptyResult) } });
    const user = { userId: 'u-teacher', roles: ['TEACHER'] };

    const response = await ctrl.getBySubject(user, { courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1' });

    expect(response.data.students).toEqual([]);
  });

  // ── AUTHZ-C1: by-subject forbidden ─────────────────────────────────────────
  it('AUTHZ-C1: returns 403 when use case signals forbidden (by-subject)', async () => {
    const ctrl = makeController({
      getBySubjectUC: { execute: vi.fn().mockResolvedValue({ forbidden: true }) },
    });
    const user = { userId: 'u-teacher', roles: ['TEACHER'] };

    await expect(ctrl.getBySubject(user, { courseCycleId: 'cc-1', subjectId: 'subj-1' })).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /grading/subject-grades/by-student (por curso)
// ═══════════════════════════════════════════════════════════════════════════════

describe('SubjectGradesController — GET by-student', () => {
  it('TIA-R8: returns { data } wrapper with result', async () => {
    const ctrl = makeController();
    const user = { userId: 'u-teacher', roles: ['TEACHER'] };

    const response = await ctrl.getByStudent(user, { courseCycleId: 'cc-uuid-1', studentId: 'student-1' });

    expect(response).toHaveProperty('data');
    expect(response.data.studentId).toBe('student-1');
  });

  it('calls getByStudentUC with courseCycleId, studentId and JWT userId', async () => {
    const executeMock = vi.fn().mockResolvedValue(makeStudentResult());
    const ctrl = makeController({ getByStudentUC: { execute: executeMock } });
    const user = { userId: 'u-teacher', roles: ['TEACHER'] };

    await ctrl.getByStudent(user, { courseCycleId: 'cc-uuid-1', studentId: 'student-1' });

    expect(executeMock).toHaveBeenCalledWith({
      courseCycleId: 'cc-uuid-1',
      studentId: 'student-1',
      userId: 'u-teacher',
      userRoles: ['TEACHER'],
    });
  });

  it('validation pipe: missing studentId throws 400', async () => {
    const { ZodValidationPipe } = await import('../shared/pipes/zod-validation.pipe');
    const { SubjectGradesByStudentQuerySchema } = await import('./dto/subject-grades.dto');
    const pipe = new ZodValidationPipe(SubjectGradesByStudentQuerySchema);

    expect(() => pipe.transform({ courseCycleId: 'cc-1' }, {} as any)).toThrow();
  });

  it('returns empty subjects array in data when CC not found (no error)', async () => {
    const emptyResult = { courseCycleId: 'cc-uuid-1', studentId: 'student-1', subjects: [] };
    const ctrl = makeController({ getByStudentUC: { execute: vi.fn().mockResolvedValue(emptyResult) } });
    const user = { userId: 'u-teacher', roles: ['TEACHER'] };

    const response = await ctrl.getByStudent(user, { courseCycleId: 'cc-uuid-1', studentId: 'student-1' });

    expect(response.data.subjects).toEqual([]);
  });

  // ── AUTHZ-C1: by-student forbidden ─────────────────────────────────────────
  it('AUTHZ-C1: returns 403 when use case signals forbidden (by-student)', async () => {
    const ctrl = makeController({
      getByStudentUC: { execute: vi.fn().mockResolvedValue({ forbidden: true }) },
    });
    const user = { userId: 'u-teacher', roles: ['TEACHER'] };

    await expect(ctrl.getByStudent(user, { courseCycleId: 'cc-1', studentId: 'stud-1' })).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /grading/subject-grades (upsert period grades + flags)
// ═══════════════════════════════════════════════════════════════════════════════

describe('SubjectGradesController — PUT period grades', () => {
  it('SPG-R3: successful upsert returns { data: null } (200)', async () => {
    const ctrl = makeController({
      upsertPeriodGradesUC: { execute: vi.fn().mockResolvedValue(ok(undefined)) },
    });

    const response = await ctrl.upsertPeriodGrades({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-1',
        subjectId: 'subj-1',
        periodOrdinal: 1,
      }],
    });

    expect(response).toEqual({ data: null });
  });

  it('validation pipe: empty items array throws 400', async () => {
    const { ZodValidationPipe } = await import('../shared/pipes/zod-validation.pipe');
    const { UpsertSubjectPeriodGradesSchema } = await import('./dto/subject-grades.dto');
    const pipe = new ZodValidationPipe(UpsertSubjectPeriodGradesSchema);

    expect(() => pipe.transform({ items: [] }, {} as any)).toThrow();
  });

  it('validation pipe: missing studentId in item throws 400', async () => {
    const { ZodValidationPipe } = await import('../shared/pipes/zod-validation.pipe');
    const { UpsertSubjectPeriodGradesSchema } = await import('./dto/subject-grades.dto');
    const pipe = new ZodValidationPipe(UpsertSubjectPeriodGradesSchema);

    expect(() =>
      pipe.transform(
        { items: [{ courseCycleId: 'cc-1', subjectId: 'subj-1', periodOrdinal: 1 }] },
        {} as any,
      ),
    ).toThrow();
  });

  it('SPG-R5: NotFoundError from use case maps to NotFoundException (404)', async () => {
    const ctrl = makeController({
      upsertPeriodGradesUC: {
        execute: vi.fn().mockResolvedValue(err(new NotFoundError('CourseCycle', 'cc-1'))),
      },
    });

    await expect(
      ctrl.upsertPeriodGrades({ items: [{ studentId: 's-1', courseCycleId: 'cc-1', subjectId: 'subj-1', periodOrdinal: 1 }] }),
    ).rejects.toThrow();
  });

  it('SPG-R5: ValidationError from use case maps to BadRequestException (400)', async () => {
    const ctrl = makeController({
      upsertPeriodGradesUC: {
        execute: vi.fn().mockResolvedValue(err(new ValidationError('invalid gradeScaleValueId'))),
      },
    });

    await expect(
      ctrl.upsertPeriodGrades({ items: [{ studentId: 's-1', courseCycleId: 'cc-1', subjectId: 'subj-1', periodOrdinal: 1 }] }),
    ).rejects.toThrow();
  });

  it('calls upsertPeriodGradesUC.execute with the body items', async () => {
    const executeMock = vi.fn().mockResolvedValue(ok(undefined));
    const ctrl = makeController({ upsertPeriodGradesUC: { execute: executeMock } });
    const body = {
      items: [{ studentId: 'student-1', courseCycleId: 'cc-1', subjectId: 'subj-1', periodOrdinal: 2, pa: true }],
    };

    await ctrl.upsertPeriodGrades(body);

    expect(executeMock).toHaveBeenCalledWith(body);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /grading/subject-final-grades (upsert final grades)
// ═══════════════════════════════════════════════════════════════════════════════

describe('SubjectGradesController — PUT final grades', () => {
  it('SFG-R5: successful upsert returns { data: null } (200)', async () => {
    const ctrl = makeController({
      upsertFinalGradesUC: { execute: vi.fn().mockResolvedValue(ok(undefined)) },
    });

    const response = await ctrl.upsertFinalGrades({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-1',
        subjectId: 'subj-1',
        type: 'FINAL',
      }],
    });

    expect(response).toEqual({ data: null });
  });

  it('validation pipe: empty items array throws 400', async () => {
    const { ZodValidationPipe } = await import('../shared/pipes/zod-validation.pipe');
    const { UpsertSubjectFinalGradesSchema } = await import('./dto/subject-grades.dto');
    const pipe = new ZodValidationPipe(UpsertSubjectFinalGradesSchema);

    expect(() => pipe.transform({ items: [] }, {} as any)).toThrow();
  });

  it('validation pipe: invalid type value throws 400', async () => {
    const { ZodValidationPipe } = await import('../shared/pipes/zod-validation.pipe');
    const { UpsertSubjectFinalGradesSchema } = await import('./dto/subject-grades.dto');
    const pipe = new ZodValidationPipe(UpsertSubjectFinalGradesSchema);

    expect(() =>
      pipe.transform(
        { items: [{ studentId: 's-1', courseCycleId: 'cc-1', subjectId: 'subj-1', type: 'INVALID_TYPE' }] },
        {} as any,
      ),
    ).toThrow();
  });

  it('AD-2: ValidationError (lifecycle block) from use case maps to 400', async () => {
    const ctrl = makeController({
      upsertFinalGradesUC: {
        execute: vi.fn().mockResolvedValue(err(new ValidationError('DICIEMBRE blocked: FINAL already passed'))),
      },
    });

    await expect(
      ctrl.upsertFinalGrades({ items: [{ studentId: 's-1', courseCycleId: 'cc-1', subjectId: 'subj-1', type: 'DICIEMBRE' }] }),
    ).rejects.toThrow();
  });

  it('NotFoundError from use case maps to NotFoundException (404)', async () => {
    const ctrl = makeController({
      upsertFinalGradesUC: {
        execute: vi.fn().mockResolvedValue(err(new NotFoundError('CourseCycle', 'cc-1'))),
      },
    });

    await expect(
      ctrl.upsertFinalGrades({ items: [{ studentId: 's-1', courseCycleId: 'cc-1', subjectId: 'subj-1', type: 'FINAL' }] }),
    ).rejects.toThrow();
  });

  it('calls upsertFinalGradesUC.execute with the body items', async () => {
    const executeMock = vi.fn().mockResolvedValue(ok(undefined));
    const ctrl = makeController({ upsertFinalGradesUC: { execute: executeMock } });
    const body = {
      items: [{ studentId: 'student-1', courseCycleId: 'cc-1', subjectId: 'subj-1', type: 'FINAL', passed: true }],
    };

    await ctrl.upsertFinalGrades(body);

    expect(executeMock).toHaveBeenCalledWith(body);
  });

  it('W1: validation pipe: gradeScaleValueId null rejected with 400 (clearing final grades not supported)', async () => {
    const { ZodValidationPipe } = await import('../shared/pipes/zod-validation.pipe');
    const { UpsertSubjectFinalGradesSchema } = await import('./dto/subject-grades.dto');
    const pipe = new ZodValidationPipe(UpsertSubjectFinalGradesSchema);

    expect(() =>
      pipe.transform(
        { items: [{ studentId: 's-1', courseCycleId: 'cc-1', subjectId: 'subj-1', type: 'FINAL', gradeScaleValueId: null }] },
        {} as any,
      ),
    ).toThrow();
  });
});
