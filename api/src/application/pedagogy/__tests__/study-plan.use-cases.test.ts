import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateStudyPlanUC, UpdateStudyPlanUC, DeleteStudyPlanUC, AddSubjectToPlanCourseUC } from '../use-cases/pedagogy.use-cases';
import {
  StudyPlan,
  Id,
  EducationalLevelCode,
  EducationalModalityCode,
  ValidationError,
  StudyPlanHasDependenciesError,
} from '@educandow/domain';
import type { StudyPlanProps } from '@educandow/domain';

const EXISTING_ID = 'plan-abc-123';

function makeExistingPlan(overrides?: Partial<StudyPlanProps>): StudyPlan {
  return StudyPlan.reconstruct({
    id: Id.reconstruct(EXISTING_ID),
    name: 'Plan Primario',
    level: EducationalLevelCode.PRIMARIO,
    modality: EducationalModalityCode.COMUN,
    active: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  });
}

const mockRepo = {
  findById: vi.fn(),
  findAll: vi.fn(),
  save: vi.fn(),
  softDelete: vi.fn(),
  addCourse: vi.fn(),
  removeCourse: vi.fn(),
  addSubject: vi.fn(),
  removeSubject: vi.fn(),
  findPlanCourseById: vi.fn(),
  findPlanCoursesByPlan: vi.fn(),
  saveWithLevelCascade: vi.fn(),
  getDependencies: vi.fn(),
};

const mockSubjectRepo = {
  findById: vi.fn(),
  findAll: vi.fn(),
  save: vi.fn(),
  softDelete: vi.fn(),
};

describe('UpdateStudyPlanUC', () => {
  let uc: UpdateStudyPlanUC;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.save.mockResolvedValue(undefined);
    mockRepo.saveWithLevelCascade.mockResolvedValue(undefined);
    uc = new UpdateStudyPlanUC(mockRepo as any);
  });

  it('updates name, academicYear, active without touching cascade', async () => {
    const existing = makeExistingPlan();
    mockRepo.findById.mockResolvedValue(existing);

    const result = await uc.execute(EXISTING_ID, { name: 'Nuevo Nombre', active: false });

    expect(result.isOk()).toBe(true);
    const updated = result.unwrap();
    expect(updated!.name).toBe('Nuevo Nombre');
    expect(updated!.active).toBe(false);
    expect(mockRepo.save).toHaveBeenCalledOnce();
    expect(mockRepo.saveWithLevelCascade).not.toHaveBeenCalled();
  });

  it('updates level and modality: calls saveWithLevelCascade atomically (save NOT called)', async () => {
    const existing = makeExistingPlan(); // level=2 (PRIMARIO), modality=0 (COMUN)
    mockRepo.findById.mockResolvedValue(existing);

    const result = await uc.execute(EXISTING_ID, {
      level: EducationalLevelCode.SECUNDARIO,
      modality: EducationalModalityCode.TALLERES,
    });

    expect(result.isOk()).toBe(true);
    const updated = result.unwrap();
    expect(updated!.level).toBe(EducationalLevelCode.SECUNDARIO);
    expect(updated!.modality).toBe(EducationalModalityCode.TALLERES);
    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockRepo.saveWithLevelCascade).toHaveBeenCalledOnce();
    expect(mockRepo.saveWithLevelCascade).toHaveBeenCalledWith(
      updated,
      EducationalLevelCode.SECUNDARIO,
      EducationalModalityCode.TALLERES,
    );
  });

  it('does not call cascade when level and modality are identical to existing', async () => {
    const existing = makeExistingPlan(); // level=2, modality=0
    mockRepo.findById.mockResolvedValue(existing);

    const result = await uc.execute(EXISTING_ID, {
      level: EducationalLevelCode.PRIMARIO,
      modality: EducationalModalityCode.COMUN,
    });

    expect(result.isOk()).toBe(true);
    expect(mockRepo.save).toHaveBeenCalledOnce();
    expect(mockRepo.saveWithLevelCascade).not.toHaveBeenCalled();
  });

  it('does not call cascade when level and modality are omitted', async () => {
    const existing = makeExistingPlan();
    mockRepo.findById.mockResolvedValue(existing);

    const result = await uc.execute(EXISTING_ID, { name: 'Nombre 2027' });

    expect(result.isOk()).toBe(true);
    expect(mockRepo.saveWithLevelCascade).not.toHaveBeenCalled();
  });

  it('calls saveWithLevelCascade when only level changes (modality defaults to existing)', async () => {
    const existing = makeExistingPlan(); // level=2, modality=0
    mockRepo.findById.mockResolvedValue(existing);

    const result = await uc.execute(EXISTING_ID, { level: EducationalLevelCode.SECUNDARIO });

    expect(result.isOk()).toBe(true);
    const updated = result.unwrap();
    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockRepo.saveWithLevelCascade).toHaveBeenCalledWith(
      updated,
      EducationalLevelCode.SECUNDARIO,
      EducationalModalityCode.COMUN, // existing modality preserved
    );
  });

  it('returns ok(null) when plan not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await uc.execute('nonexistent-id', { level: 3 });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBeNull();
    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockRepo.saveWithLevelCascade).not.toHaveBeenCalled();
  });

  it('returns validation error for invalid level', async () => {
    const existing = makeExistingPlan();
    mockRepo.findById.mockResolvedValue(existing);

    const result = await uc.execute(EXISTING_ID, { level: 5 }); // 5 is not a valid EducationalLevelCode

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockRepo.saveWithLevelCascade).not.toHaveBeenCalled();
  });

  it('returns validation error for invalid nivel/modalidad combo (level=9, modality=2 → composite 92)', async () => {
    const existing = makeExistingPlan();
    mockRepo.findById.mockResolvedValue(existing);

    const result = await uc.execute(EXISTING_ID, { level: 9, modality: 2 });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockRepo.saveWithLevelCascade).not.toHaveBeenCalled();
  });

  it('succeeds and cascades atomically for valid nivel/modalidad combo with modality (level=2, modality=1)', async () => {
    const existing = makeExistingPlan(); // level=2 (PRIMARIO), modality=0 (COMUN)
    mockRepo.findById.mockResolvedValue(existing);

    const result = await uc.execute(EXISTING_ID, {
      level: EducationalLevelCode.PRIMARIO,       // 2
      modality: EducationalModalityCode.TALLERES, // 1 → composite 21 valid
    });

    expect(result.isOk()).toBe(true);
    const updated = result.unwrap();
    expect(updated!.level).toBe(EducationalLevelCode.PRIMARIO);
    expect(updated!.modality).toBe(EducationalModalityCode.TALLERES);
    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockRepo.saveWithLevelCascade).toHaveBeenCalledOnce();
    expect(mockRepo.saveWithLevelCascade).toHaveBeenCalledWith(
      updated,
      EducationalLevelCode.PRIMARIO,
      EducationalModalityCode.TALLERES,
    );
  });
});

// ── CreateStudyPlanUC ─────────────────────────────────────────

describe('CreateStudyPlanUC', () => {
  let uc: CreateStudyPlanUC;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.save.mockResolvedValue(undefined);
    uc = new CreateStudyPlanUC(mockRepo as any);
  });

  it('returns validation error for invalid nivel/modalidad combo (level=4, modality=1 → composite 41)', async () => {
    const result = await uc.execute({
      name: 'Plan Inválido',
      level: 4, // TERCIARIO — only COMUN (0) is valid
      modality: 1,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('creates plan successfully for valid combo (level=3, modality=1 → composite 31)', async () => {
    const result = await uc.execute({
      name: 'Talleres de Secundario',
      level: EducationalLevelCode.SECUNDARIO, // 3
      modality: EducationalModalityCode.TALLERES, // 1
    });

    expect(result.isOk()).toBe(true);
    const plan = result.unwrap();
    expect(plan.level).toBe(EducationalLevelCode.SECUNDARIO);
    expect(plan.modality).toBe(EducationalModalityCode.TALLERES);
    expect(mockRepo.save).toHaveBeenCalledOnce();
  });

  it('returns validation error for completely invalid level (level=5)', async () => {
    const result = await uc.execute({
      name: 'Plan X',
      level: 5,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});

// ── DeleteStudyPlanUC ─────────────────────────────────────────

describe('DeleteStudyPlanUC', () => {
  let uc: DeleteStudyPlanUC;

  beforeEach(() => {
    vi.clearAllMocks();
    uc = new DeleteStudyPlanUC(mockRepo as any);
  });

  it('returns err(StudyPlanHasDependenciesError) when plan has courses only', async () => {
    mockRepo.findById.mockResolvedValue(makeExistingPlan());
    mockRepo.getDependencies.mockResolvedValue({ courseCount: 2, courseCycleCount: 0 });

    const result = await uc.execute(EXISTING_ID);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(StudyPlanHasDependenciesError);
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });

  it('returns err(StudyPlanHasDependenciesError) when plan has active cycles only', async () => {
    mockRepo.findById.mockResolvedValue(makeExistingPlan());
    mockRepo.getDependencies.mockResolvedValue({ courseCount: 0, courseCycleCount: 1 });

    const result = await uc.execute(EXISTING_ID);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(StudyPlanHasDependenciesError);
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });

  it('returns err(StudyPlanHasDependenciesError) when plan has both courses and cycles', async () => {
    mockRepo.findById.mockResolvedValue(makeExistingPlan());
    mockRepo.getDependencies.mockResolvedValue({ courseCount: 1, courseCycleCount: 1 });

    const result = await uc.execute(EXISTING_ID);

    expect(result.isErr()).toBe(true);
    const e = result.unwrapErr() as StudyPlanHasDependenciesError;
    expect(e).toBeInstanceOf(StudyPlanHasDependenciesError);
    expect(e.courseCount).toBe(1);
    expect(e.courseCycleCount).toBe(1);
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });

  it('returns ok(void) and calls softDelete when no dependencies', async () => {
    mockRepo.findById.mockResolvedValue(makeExistingPlan());
    mockRepo.getDependencies.mockResolvedValue({ courseCount: 0, courseCycleCount: 0 });
    mockRepo.softDelete.mockResolvedValue(undefined);

    const result = await uc.execute(EXISTING_ID);

    expect(result.isOk()).toBe(true);
    expect(mockRepo.softDelete).toHaveBeenCalledOnce();
    expect(mockRepo.softDelete).toHaveBeenCalledWith(EXISTING_ID);
  });

  it('returns ok(void) when plan not found (idempotent) — getDependencies and softDelete NOT called', async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await uc.execute('nonexistent-id');

    expect(result.isOk()).toBe(true);
    expect(mockRepo.getDependencies).not.toHaveBeenCalled();
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });
});

// ── AddSubjectToPlanCourseUC — esOptativa forwarding (T06 RED → T07 GREEN) ──

describe('AddSubjectToPlanCourseUC — esOptativa forwarding', () => {
  let uc: AddSubjectToPlanCourseUC;

  beforeEach(() => {
    vi.clearAllMocks();
    // planCourse found
    mockRepo.findPlanCourseById.mockResolvedValue({ id: 'pc-1', studyPlanId: 'plan-1', courseSectionId: 'cs-1' });
    // subject found
    mockSubjectRepo.findById.mockResolvedValue({ id: 'subj-1', name: 'Math' });
    mockRepo.addSubject.mockResolvedValue(undefined);
    uc = new AddSubjectToPlanCourseUC(mockRepo as any, mockSubjectRepo as any);
  });

  it('Test A (MGC-S29): esOptativa:true is forwarded to planRepo.addSubject', async () => {
    await uc.execute('pc-1', 'subj-1', 3, true);

    expect(mockRepo.addSubject).toHaveBeenCalledWith('pc-1', 'subj-1', 3, true);
  });

  it('Test B (MGC-S37): esOptativa:false is forwarded to planRepo.addSubject', async () => {
    await uc.execute('pc-1', 'subj-1', 3, false);

    expect(mockRepo.addSubject).toHaveBeenCalledWith('pc-1', 'subj-1', 3, false);
  });

  it('Test C (D5): omitting esOptativa calls planRepo.addSubject with undefined as 4th arg', async () => {
    await uc.execute('pc-1', 'subj-1', 3);

    expect(mockRepo.addSubject).toHaveBeenCalledWith('pc-1', 'subj-1', 3, undefined);
  });
});
