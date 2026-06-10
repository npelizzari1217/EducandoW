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
      // Default: empty map — tests that need grading-context override this
      findGradingContextsByUuids: vi.fn().mockResolvedValue(new Map()),
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
    expect(result[0].cycle.uuid).toBe('cc-A');
  });

  it('W3: returns { cycle, modality } shape — modality from StudyPlan grading context (level 22 cc → StudyPlan modality 2)', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    repos.subjectAssignmentRepo.findByTeacher.mockResolvedValue([
      makeAssignment(teacher.id.get(), 'cs-uuid-B'),
    ]);
    // level 22 = Bilingüismo Primario; StudyPlan also returns modality 2
    const cc = makeCC('cc-B', 22, 'cs-uuid-B');
    repos.courseCycleRepo.findByCourseSectionIds.mockResolvedValue([cc]);
    repos.courseCycleRepo.findGradingContextsByUuids.mockResolvedValue(
      new Map([['cc-B', { level: 22, modality: 2 }]]),
    );

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    expect(result).toHaveLength(1);
    // Each item is { cycle: CourseCycle, modality: number }
    expect(result[0]).toMatchObject({ modality: 2 });
    expect((result[0] as any).cycle?.uuid).toBe('cc-B');
  });

  it('W3-DIVERGE: modality from StudyPlan (authoritative) when it differs from cc.level.modalityCode', async () => {
    // This is THE divergence test. cc.level = 20 → level.modalityCode = 0.
    // But the StudyPlan for this CC says modality = 1.
    // With the old cc.level.modalityCode implementation this returns 0 → RED.
    // After re-pointing to findGradingContextsByUuids (StudyPlan) it returns 1 → GREEN.
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    repos.subjectAssignmentRepo.findByTeacher.mockResolvedValue([
      makeAssignment(teacher.id.get(), 'cs-uuid-C'),
    ]);
    const cc = makeCC('cc-diverge', 20, 'cs-uuid-C'); // level 20 → modalityCode = 0
    repos.courseCycleRepo.findByCourseSectionIds.mockResolvedValue([cc]);
    // StudyPlan says modality = 1 (diverged from CourseCycle.level composite)
    repos.courseCycleRepo.findGradingContextsByUuids.mockResolvedValue(
      new Map([['cc-diverge', { level: 20, modality: 1 }]]),
    );

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    expect(result).toHaveLength(1);
    // MUST be 1 (StudyPlan.modality), NOT 0 (cc.level.modalityCode)
    expect(result[0].modality).toBe(1);
  });

  it('ESS-R1/D3: Secundario (level=30) is INCLUDED in subject mode alongside Primario (level=20)', async () => {
    // Updated in PR4-T12: subject mode now includes Primario (decade=2) + Secundario (decade=3).
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    repos.subjectAssignmentRepo.findByTeacher.mockResolvedValue([
      makeAssignment(teacher.id.get(), 'cs-primario'),
      makeAssignment(teacher.id.get(), 'cs-secundario'),
    ]);
    const primarioCC = makeCC('cc-primario', 20, 'cs-primario');
    const secundarioCC = makeCC('cc-secundario', 30, 'cs-secundario');
    repos.courseCycleRepo.findByCourseSectionIds.mockResolvedValue([primarioCC, secundarioCC]);
    repos.courseCycleRepo.findGradingContextsByUuids.mockResolvedValue(
      new Map([
        ['cc-primario',   { level: 20, modality: 0 }],
        ['cc-secundario', { level: 30, modality: 0 }],
      ]),
    );

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    expect(result).toHaveLength(2);
    const uuids = result.map((r) => r.cycle.uuid);
    expect(uuids).toContain('cc-primario');
    expect(uuids).toContain('cc-secundario');
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
// ListTeacherCourseCyclesUseCase — Secundario inclusion (PR4-T11)
// ═══════════════════════════════════════════════════════════════════════════════

describe('ListTeacherCourseCyclesUseCase — Secundario inclusion', () => {
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

  it('ESS-R1: mode=subject returns BOTH Primario (level 20) and Secundario (level 30) CCs', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    repos.subjectAssignmentRepo.findByTeacher.mockResolvedValue([
      makeAssignment(teacher.id.get(), 'cs-primario'),
      makeAssignment(teacher.id.get(), 'cs-secundario'),
    ]);
    const primarioCC = makeCC('cc-primario', 20, 'cs-primario');
    const secundarioCC = makeCC('cc-secundario', 30, 'cs-secundario');
    repos.courseCycleRepo.findByCourseSectionIds.mockResolvedValue([primarioCC, secundarioCC]);
    repos.courseCycleRepo.findGradingContextsByUuids.mockResolvedValue(
      new Map([
        ['cc-primario', { level: 20, modality: 0 }],
        ['cc-secundario', { level: 30, modality: 0 }],
      ]),
    );

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    // BOTH Primario AND Secundario must be returned
    expect(result).toHaveLength(2);
    const uuids = result.map((r) => r.cycle.uuid);
    expect(uuids).toContain('cc-primario');
    expect(uuids).toContain('cc-secundario');
  });

  it('ESS-R2: Terciario (level=40) is EXCLUDED from mode=subject results', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    repos.subjectAssignmentRepo.findByTeacher.mockResolvedValue([
      makeAssignment(teacher.id.get(), 'cs-primario'),
      makeAssignment(teacher.id.get(), 'cs-secundario'),
      makeAssignment(teacher.id.get(), 'cs-terciario'),
    ]);
    const primarioCC   = makeCC('cc-primario',   20, 'cs-primario');
    const secundarioCC = makeCC('cc-secundario', 30, 'cs-secundario');
    const terciarioCC  = makeCC('cc-terciario',  40, 'cs-terciario');
    repos.courseCycleRepo.findByCourseSectionIds.mockResolvedValue([
      primarioCC, secundarioCC, terciarioCC,
    ]);
    repos.courseCycleRepo.findGradingContextsByUuids.mockResolvedValue(
      new Map([
        ['cc-primario',   { level: 20, modality: 0 }],
        ['cc-secundario', { level: 30, modality: 0 }],
      ]),
    );

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    const uuids = result.map((r) => r.cycle.uuid);
    expect(uuids).not.toContain('cc-terciario');
    expect(uuids).toContain('cc-primario');
    expect(uuids).toContain('cc-secundario');
  });

  it('ESS-R2: Inicial (level=10) is EXCLUDED from mode=subject results', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    repos.subjectAssignmentRepo.findByTeacher.mockResolvedValue([
      makeAssignment(teacher.id.get(), 'cs-primario'),
      makeAssignment(teacher.id.get(), 'cs-inicial'),
    ]);
    const primarioCC = makeCC('cc-primario', 20, 'cs-primario');
    const inicialCC  = makeCC('cc-inicial',  10, 'cs-inicial');
    repos.courseCycleRepo.findByCourseSectionIds.mockResolvedValue([primarioCC, inicialCC]);
    repos.courseCycleRepo.findGradingContextsByUuids.mockResolvedValue(
      new Map([['cc-primario', { level: 20, modality: 0 }]]),
    );

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    const uuids = result.map((r) => r.cycle.uuid);
    expect(uuids).not.toContain('cc-inicial');
    expect(uuids).toContain('cc-primario');
  });

  it('Primario behavior unchanged: a Primario-only teacher still sees only their Primario CCs', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    repos.subjectAssignmentRepo.findByTeacher.mockResolvedValue([
      makeAssignment(teacher.id.get(), 'cs-primario'),
    ]);
    const primarioCC = makeCC('cc-primario', 20, 'cs-primario');
    repos.courseCycleRepo.findByCourseSectionIds.mockResolvedValue([primarioCC]);
    repos.courseCycleRepo.findGradingContextsByUuids.mockResolvedValue(
      new Map([['cc-primario', { level: 20, modality: 0 }]]),
    );

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    expect(result).toHaveLength(1);
    expect(result[0].cycle.uuid).toBe('cc-primario');
  });

  it('pins ONLY decade=2 (Primario) and decade=3 (Secundario): a "level > 0" predicate would include Terciario (40) and Inicial (10) — both MUST be excluded', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    repos.subjectAssignmentRepo.findByTeacher.mockResolvedValue([
      makeAssignment(teacher.id.get(), 'cs-10'),   // Inicial
      makeAssignment(teacher.id.get(), 'cs-20'),   // Primario
      makeAssignment(teacher.id.get(), 'cs-30'),   // Secundario
      makeAssignment(teacher.id.get(), 'cs-40'),   // Terciario
    ]);
    repos.courseCycleRepo.findByCourseSectionIds.mockResolvedValue([
      makeCC('cc-10', 10, 'cs-10'),
      makeCC('cc-20', 20, 'cs-20'),
      makeCC('cc-30', 30, 'cs-30'),
      makeCC('cc-40', 40, 'cs-40'),
    ]);
    repos.courseCycleRepo.findGradingContextsByUuids.mockResolvedValue(
      new Map([
        ['cc-20', { level: 20, modality: 0 }],
        ['cc-30', { level: 30, modality: 0 }],
      ]),
    );

    const result = await useCase.execute({ userId: 'user-abc', mode: 'subject' });

    const uuids = result.map((r) => r.cycle.uuid);
    // IN:
    expect(uuids).toContain('cc-20');  // Primario
    expect(uuids).toContain('cc-30');  // Secundario
    // OUT (CRITICAL — pins that the predicate is not too broad):
    expect(uuids).not.toContain('cc-10');  // Inicial (decade=1)
    expect(uuids).not.toContain('cc-40');  // Terciario (decade=4)
    expect(result).toHaveLength(2);
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
    expect(result[0].cycle.uuid).toBe('cc-homeroom');
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
    expect(result[0].cycle.uuid).toBe('cc-primario');
  });

  it('does NOT call SubjectAssignmentRepo in homeroom mode', async () => {
    const teacher = makeTeacher();
    repos.teacherRepo.findByUserId.mockResolvedValue(teacher);
    repos.courseCycleRepo.findByHomeroomTeacher.mockResolvedValue([]);

    await useCase.execute({ userId: 'user-abc', mode: 'homeroom' });

    expect(repos.subjectAssignmentRepo.findByTeacher).not.toHaveBeenCalled();
  });
});
