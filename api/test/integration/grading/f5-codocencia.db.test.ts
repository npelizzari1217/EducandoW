/**
 * F5-T5 — Co-docencia: a second co-teacher's grade overwrites the first → 1 record.
 *
 * SubjectPeriodGrade is keyed @@unique([studentId, courseCycleId, subjectId, periodOrdinal])
 * — the teacher is NOT part of the key. So when two co-teachers grade the same student
 * for the same subject+period, the upsert collapses to a single row (last write wins).
 *
 * Tasks labels this "Unit", but the behavior is a DB uniqueness constraint, so it can
 * only be proven against a real database via the production saveMany() upsert path.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { SubjectPeriodGrade } from '@educandow/domain';
import { PrismaSubjectPeriodGradeRepository } from '../../../src/infrastructure/persistence/prisma/repositories/prisma-subject-period-grade.repository';
import { tenantI1Client, runInTenant, resetAll, disconnectAll } from '../setup/clients';
import { seedCourseCycle, createSubject, createStudent } from '../setup/factories';

const repo = new PrismaSubjectPeriodGradeRepository();

function buildGrade(args: {
  id: string;
  studentId: string;
  courseCycleId: string;
  subjectId: string;
  gradeCode: string;
}): SubjectPeriodGrade {
  return SubjectPeriodGrade.reconstruct({
    id: args.id,
    studentId: args.studentId,
    courseCycleId: args.courseCycleId,
    subjectId: args.subjectId,
    periodOrdinal: 1,
    gradeScaleValueId: null,
    gradeCode: args.gradeCode,
    internalStatus: null,
    pa: false,
    ppi: false,
    pp: false,
  });
}

describe('F5-T5 — co-docencia grade overwrite', () => {
  beforeEach(async () => {
    await resetAll();
  });

  afterAll(async () => {
    await disconnectAll();
  });

  it('D2 overwriting D1 for the same student+subject+period yields a single record', async () => {
    const i1 = tenantI1Client();
    const { courseCycle } = await seedCourseCycle(i1);
    const subject = await createSubject(i1);
    const student = await createStudent(i1);

    const key = {
      studentId: student.id,
      courseCycleId: courseCycle.uuid,
      subjectId: subject.id,
    };

    // D1 grades the student.
    await runInTenant(i1, () =>
      repo.saveMany([buildGrade({ id: 'grade-d1', gradeCode: 'A', ...key })]),
    );

    // D2 (co-teacher) grades the SAME student/subject/period with a different value.
    await runInTenant(i1, () =>
      repo.saveMany([buildGrade({ id: 'grade-d2', gradeCode: 'B', ...key })]),
    );

    const rows = await runInTenant(i1, () =>
      repo.findByCourseCycleAndSubject(courseCycle.uuid, subject.id),
    );

    // Exactly one record survives, holding D2's value (last write wins).
    expect(rows).toHaveLength(1);
    expect(rows[0].studentId).toBe(student.id);
    expect(rows[0].gradeCode).toBe('B');
  });
});
