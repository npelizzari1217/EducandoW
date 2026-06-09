/**
 * PR4-T11 [RED] — ListTeacherCourseCyclesUseCase tests.
 * Specs: TIA-R2, TIA-R3, TIA-R5, TIA-R6, TIA-R7, TIA-R9, ES-R4, ES-R5, ES-R6, AD-6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListTeacherCourseCyclesUseCase } from './list-teacher-course-cycles.use-case';
import { Teacher, Id, Dni, Email, CourseCycle, CourseName, PassingGrade, Level } from '@educandow/domain';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTeacher(id = 'teacher-uuid-1', userId = 'user-abc'): Teacher {
  return Teacher.reconstruct({
    id: Id.reconstruct(id),
    firstName: 'Juan',
    lastName: 'García',
    dni: Dni.reconstruct('12345678'),
    email: Email.reconstruct('juan@school.edu'),
    userId,
    institutionId: Id.reconstruct('inst-1'),
    active: true,
  });
}

function makeCC(uuid: string, level: number, courseId: string): CourseCycle {
  return CourseCycle.reconstruct({
    id: Id.reconstruct(`id-${uuid}`),
    uuid,
    courseId,
    studyPlanId: 'sp-1',
    cycleId: 'cycle-1',
    courseName: CourseName.reconstruct('3° A'),
    level: Level.reconstruct(level as any),
    active: true,
    passingGrade: PassingGrade.reconstruct(7),
    promotionText: null,
    firstBimonth: null,
    secondBimonth: null,
    thirdBimonth: null,
    fourthBimonth: null,
    activeGradingPeriod: null,
    createdAt: new Date(),
    lastModifiedAt: new Date(),
    deletedAt: null,
  });
}

function makeAssignment(teacherId: string, courseSectionId: string, subjectId = 'subj-1') {
  return { id: { get: () => `assign-${Math.random()}` }, subjectId, teacherId, courseSectionId };
}

function makeRepos(overrides: Record<string, unknown> = {}) {
  return {
    teacherRepo: {
      findByUserId: vi.fn().mockResolvedValue(null),
      ...((overrides.teacherRepo as Record<string, unknown>) ?? {}),
    },
    subjectAssignmentRepo: {
      findByTeacher: vi.fn().mockResolvedValue([]),
      ...((overrides.subjectAssignmentRepo as Record<string, unknown>) ?? {}),
    },
    courseCycleRepo: {
      findByHomeroomTeacher: vi.fn().mockResolvedValue([]),
      findByCourseSectionIds: vi.fn().mockResolvedValue([]),
      ...((overrides.courseCycleRepo as Record<string, unknown>) ?? {}),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ListTeacherCourseCyclesUseCase — subject mode
// ═══════════════════════════════════════════════════════════════════════════════

describe('ListTeacherCourseCyclesUseCase — mode=subject', () => {
  let useCase: ListTeacherCourseCyclesUseCase;
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    repos = makeRepos();
    useCase = new ListTeacherCourseCyclesUseCase(
      repos.teacherRepo as any,
      repos.subjectAssignmentRepo as any,
      repos.courseCycleRepo as any,
    );
  });

  it('TIA-R2: unlinked userId → empty array (200, no error)', async () => {
    repos.teacherRepo.findByUserId.mockResolvedValue(null);

    const result = await useCase.execute({ userId: 'user-xyz', mode: 'subject' });

    expect(result).toEqual([]);
  });

  it('TIA-R6: teacher with no assignments → empty array', async () => {
    repos.teacherRepo.findByUserId.mockResolvedValue(makeTeacher());
    repos.subjectAssignmentRepo.findByTeacher.mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    expect(result).toEqual([]);
    expect(repos.courseCycleRepo.findByCourseSectionIds).not.toHaveBeenCalled();
  });

  it('TIA-R3: returns CCs where teacher has SubjectAssignment', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    repos.subjectAssignmentRepo.findByTeacher.mockResolvedValue([
      makeAssignment(teacher.id.get(), 'cs-uuid-A'),
    ]);
    const primarioCC = makeCC('cc-A', 20, 'cs-uuid-A');  // level 20 = PRIMARIO
    repos.courseCycleRepo.findByCourseSectionIds.mockResolvedValue([primarioCC]);

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    expect(result).toHaveLength(1);
    expect(result[0].uuid).toBe('cc-A');
  });

  it('TIA-R9: non-Primario CCs are excluded (Secundario level=30)', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    repos.subjectAssignmentRepo.findByTeacher.mockResolvedValue([
      makeAssignment(teacher.id.get(), 'cs-primario'),
      makeAssignment(teacher.id.get(), 'cs-secundario'),
    ]);
    const primarioCC = makeCC('cc-primario', 20, 'cs-primario');
    const secundarioCC = makeCC('cc-secundario', 30, 'cs-secundario');
    repos.courseCycleRepo.findByCourseSectionIds.mockResolvedValue([primarioCC, secundarioCC]);

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    expect(result).toHaveLength(1);
    expect(result[0].uuid).toBe('cc-primario');
  });

  it('deduplicates courseSectionIds before calling repo (same section, multiple subjects)', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    // Two assignments to the SAME section (different subjects)
    repos.subjectAssignmentRepo.findByTeacher.mockResolvedValue([
      makeAssignment(teacher.id.get(), 'cs-A', 'subj-math'),
      makeAssignment(teacher.id.get(), 'cs-A', 'subj-science'),
    ]);
    repos.courseCycleRepo.findByCourseSectionIds.mockResolvedValue([makeCC('cc-A', 20, 'cs-A')]);

    await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    const calledWith = repos.courseCycleRepo.findByCourseSectionIds.mock.calls[0][0] as string[];
    expect(calledWith).toHaveLength(1);  // deduplicated to 1 section
    expect(calledWith[0]).toBe('cs-A');
  });

  it('teacher isolation: teacher A cannot see CCs that only teacher B has assignments in', async () => {
    const teacherA = makeTeacher('teacher-A', 'user-A');
    repos.teacherRepo.findByUserId.mockResolvedValue(teacherA);
    // Only assignments for teacher A are returned by the repo
    repos.subjectAssignmentRepo.findByTeacher.mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'user-A', mode: 'subject' });

    expect(result).toEqual([]);
    expect(repos.subjectAssignmentRepo.findByTeacher).toHaveBeenCalledWith(teacherA.id.get());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ListTeacherCourseCyclesUseCase — homeroom mode
// ═══════════════════════════════════════════════════════════════════════════════

describe('ListTeacherCourseCyclesUseCase — mode=homeroom', () => {
  let useCase: ListTeacherCourseCyclesUseCase;
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    repos = makeRepos();
    useCase = new ListTeacherCourseCyclesUseCase(
      repos.teacherRepo as any,
      repos.subjectAssignmentRepo as any,
      repos.courseCycleRepo as any,
    );
  });

  it('TIA-R2: unlinked userId → empty array', async () => {
    repos.teacherRepo.findByUserId.mockResolvedValue(null);

    const result = await useCase.execute({ userId: 'user-xyz', mode: 'homeroom' });

    expect(result).toEqual([]);
  });

  it('TIA-R5: returns CCs where teacher is homeroomTeacherId', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    repos.courseCycleRepo.findByHomeroomTeacher.mockResolvedValue([
      makeCC('cc-homeroom', 20, 'cs-A'),
    ]);

    const result = await useCase.execute({ userId: 'user-abc', mode: 'homeroom' });

    expect(result).toHaveLength(1);
    expect(repos.courseCycleRepo.findByHomeroomTeacher).toHaveBeenCalledWith(teacher.id.get());
  });

  it('TIA-R9: filters out non-Primario homeroom CCs', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    repos.courseCycleRepo.findByHomeroomTeacher.mockResolvedValue([
      makeCC('cc-primario', 20, 'cs-A'),
      makeCC('cc-terciario', 40, 'cs-B'),
    ]);

    const result = await useCase.execute({ userId: 'user-abc', mode: 'homeroom' });

    expect(result).toHaveLength(1);
    expect(result[0].uuid).toBe('cc-primario');
  });

  it('does NOT call SubjectAssignmentRepo in homeroom mode', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    repos.courseCycleRepo.findByHomeroomTeacher.mockResolvedValue([]);

    await useCase.execute({ userId: 'user-abc', mode: 'homeroom' });

    expect(repos.subjectAssignmentRepo.findByTeacher).not.toHaveBeenCalled();
  });
});
