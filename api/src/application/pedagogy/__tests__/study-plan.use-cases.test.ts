import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateStudyPlanUC, UpdateStudyPlanUC } from '../use-cases/pedagogy.use-cases';
import {
  StudyPlan,
  Id,
  EducationalLevelCode,
  EducationalModalityCode,
  ValidationError,
} from '@educandow/domain';
import type { StudyPlanProps } from '@educandow/domain';

const EXISTING_ID = 'plan-abc-123';

function makeExistingPlan(overrides?: Partial<StudyPlanProps>): StudyPlan {
  return StudyPlan.reconstruct({
    id: Id.reconstruct(EXISTING_ID),
    name: 'Plan Primario',
    level: EducationalLevelCode.PRIMARIO,
    modality: EducationalModalityCode.COMUN,
    academicYear: '2026',
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
  cascadeChildrenLevel: vi.fn(),
};

describe('UpdateStudyPlanUC', () => {
  let uc: UpdateStudyPlanUC;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.save.mockResolvedValue(undefined);
    mockRepo.cascadeChildrenLevel.mockResolvedValue(undefined);
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
    expect(mockRepo.cascadeChildrenLevel).not.toHaveBeenCalled();
  });

  it('updates level and modality, saves entity, and calls cascade with separate values', async () => {
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
    expect(mockRepo.save).toHaveBeenCalledOnce();
    expect(mockRepo.cascadeChildrenLevel).toHaveBeenCalledOnce();
    expect(mockRepo.cascadeChildrenLevel).toHaveBeenCalledWith(
      EXISTING_ID,
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
    expect(mockRepo.cascadeChildrenLevel).not.toHaveBeenCalled();
  });

  it('does not call cascade when level and modality are omitted', async () => {
    const existing = makeExistingPlan();
    mockRepo.findById.mockResolvedValue(existing);

    const result = await uc.execute(EXISTING_ID, { academicYear: '2027' });

    expect(result.isOk()).toBe(true);
    expect(mockRepo.cascadeChildrenLevel).not.toHaveBeenCalled();
  });

  it('calls cascade when only level changes (modality defaults to existing)', async () => {
    const existing = makeExistingPlan(); // level=2, modality=0
    mockRepo.findById.mockResolvedValue(existing);

    const result = await uc.execute(EXISTING_ID, { level: EducationalLevelCode.SECUNDARIO });

    expect(result.isOk()).toBe(true);
    expect(mockRepo.cascadeChildrenLevel).toHaveBeenCalledWith(
      EXISTING_ID,
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
    expect(mockRepo.cascadeChildrenLevel).not.toHaveBeenCalled();
  });

  it('returns validation error for invalid level', async () => {
    const existing = makeExistingPlan();
    mockRepo.findById.mockResolvedValue(existing);

    const result = await uc.execute(EXISTING_ID, { level: 5 }); // 5 is not a valid EducationalLevelCode

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockRepo.cascadeChildrenLevel).not.toHaveBeenCalled();
  });

  it('returns validation error for invalid nivel/modalidad combo (level=9, modality=2 → composite 92)', async () => {
    const existing = makeExistingPlan();
    mockRepo.findById.mockResolvedValue(existing);

    const result = await uc.execute(EXISTING_ID, { level: 9, modality: 2 });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockRepo.cascadeChildrenLevel).not.toHaveBeenCalled();
  });

  it('succeeds and cascades for valid nivel/modalidad combo with modality (level=2, modality=1)', async () => {
    const existing = makeExistingPlan(); // level=2 (PRIMARIO), modality=0 (COMUN)
    mockRepo.findById.mockResolvedValue(existing);

    const result = await uc.execute(EXISTING_ID, {
      level: EducationalLevelCode.PRIMARIO,    // 2
      modality: EducationalModalityCode.TALLERES, // 1 → composite 21 valid
    });

    expect(result.isOk()).toBe(true);
    const updated = result.unwrap();
    expect(updated!.level).toBe(EducationalLevelCode.PRIMARIO);
    expect(updated!.modality).toBe(EducationalModalityCode.TALLERES);
    expect(mockRepo.save).toHaveBeenCalledOnce();
    expect(mockRepo.cascadeChildrenLevel).toHaveBeenCalledWith(
      EXISTING_ID,
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
      academicYear: '2026',
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
      academicYear: '2026',
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
      academicYear: '2026',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
