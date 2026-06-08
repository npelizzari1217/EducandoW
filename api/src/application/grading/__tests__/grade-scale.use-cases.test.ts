/**
 * T13 [RED] — GradeScale use cases tests.
 * Uses fake in-memory repo. All tests written before implementation (TDD RED).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateGradeScaleUseCase,
  UpdateGradeScaleUseCase,
  DeleteGradeScaleUseCase,
  ListGradeScalesUseCase,
  GetGradeScaleUseCase,
} from '../use-cases/grade-scale.use-cases';
import {
  CreateGradeScaleValueUseCase,
  UpdateGradeScaleValueUseCase,
  DeleteGradeScaleValueUseCase,
} from '../use-cases/grade-scale-value.use-cases';
import {
  GradeScale,
  GradeScaleValue,
  ScaleNameDuplicateError,
  ScaleNotFoundError,
  ScaleHasActiveValuesError,
  ValueCodeDuplicateError,
  ValueNotFoundError,
} from '@educandow/domain';

// ── Fake in-memory repo ──────────────────────────────────────

function makeRepo() {
  return {
    findById: vi.fn(),
    list: vi.fn(),
    existsByName: vi.fn(),
    countActiveValues: vi.fn(),
    save: vi.fn(),
    softDelete: vi.fn(),
    findValueById: vi.fn(),
    saveValue: vi.fn(),
    softDeleteValue: vi.fn(),
    existsValueCode: vi.fn(),
  };
}

// ── Helpers ──────────────────────────────────────────────────

function makeScale(overrides: Partial<{ id: string; name: string; level: number; modality: number }> = {}): GradeScale {
  return GradeScale.reconstruct({
    id: overrides.id ?? 'scale-uuid-1',
    name: overrides.name ?? 'Numérica 1-10',
    level: overrides.level ?? 2,
    modality: overrides.modality ?? 0,
    active: true,
    deletedAt: null,
    values: [],
  });
}

function makeValue(overrides: Partial<{ id: string; scaleId: string; code: string }> = {}): GradeScaleValue {
  return GradeScaleValue.reconstruct({
    id: overrides.id ?? 'value-uuid-1',
    scaleId: overrides.scaleId ?? 'scale-uuid-1',
    code: overrides.code ?? '10',
    label: 'Diez',
    internalStatus: 'APROBADO',
    sortOrder: 0,
    active: true,
    deletedAt: null,
  });
}

// ═════════════════════════════════════════════════════════════
// CreateGradeScaleUseCase
// ═════════════════════════════════════════════════════════════

describe('CreateGradeScaleUseCase', () => {
  let repo: ReturnType<typeof makeRepo>;
  let useCase: CreateGradeScaleUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new CreateGradeScaleUseCase(repo as any);
    repo.existsByName.mockResolvedValue(false);
    repo.save.mockResolvedValue(undefined);
  });

  it('creates a GradeScale successfully', async () => {
    const result = await useCase.execute({ name: 'Cualitativa', level: 1, modality: 0 });

    expect(result.isOk()).toBe(true);
    expect(repo.existsByName).toHaveBeenCalledWith(1, 0, 'Cualitativa');
    expect(repo.save).toHaveBeenCalledTimes(1);
    const entity = result.unwrap();
    expect(entity.name).toBe('Cualitativa');
    expect(entity.level).toBe(1);
  });

  it('returns ScaleNameDuplicateError when name is duplicated for same level+modality', async () => {
    repo.existsByName.mockResolvedValue(true);

    const result = await useCase.execute({ name: 'Numérica 1-10', level: 2, modality: 0 });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ScaleNameDuplicateError);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════
// UpdateGradeScaleUseCase
// ═════════════════════════════════════════════════════════════

describe('UpdateGradeScaleUseCase', () => {
  let repo: ReturnType<typeof makeRepo>;
  let useCase: UpdateGradeScaleUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new UpdateGradeScaleUseCase(repo as any);
    repo.save.mockResolvedValue(undefined);
    repo.existsByName.mockResolvedValue(false);
  });

  it('updates name successfully', async () => {
    const scale = makeScale({ name: 'Original' });
    repo.findById.mockResolvedValue(scale);

    const result = await useCase.execute('scale-uuid-1', { name: 'Updated Name' });

    expect(result.isOk()).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(result.unwrap().name).toBe('Updated Name');
  });

  it('returns ScaleNotFoundError when scale does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    const result = await useCase.execute('nonexistent', { name: 'New Name' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ScaleNotFoundError);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════
// DeleteGradeScaleUseCase
// ═════════════════════════════════════════════════════════════

describe('DeleteGradeScaleUseCase', () => {
  let repo: ReturnType<typeof makeRepo>;
  let useCase: DeleteGradeScaleUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new DeleteGradeScaleUseCase(repo as any);
    repo.softDelete.mockResolvedValue(undefined);
  });

  it('soft-deletes a scale with no active values', async () => {
    const scale = makeScale();
    repo.findById.mockResolvedValue(scale);
    repo.countActiveValues.mockResolvedValue(0);

    const result = await useCase.execute('scale-uuid-1');

    expect(result.isOk()).toBe(true);
    expect(repo.softDelete).toHaveBeenCalledWith('scale-uuid-1');
  });

  it('returns ScaleHasActiveValuesError when scale has active values', async () => {
    const scale = makeScale();
    repo.findById.mockResolvedValue(scale);
    repo.countActiveValues.mockResolvedValue(3);

    const result = await useCase.execute('scale-uuid-1');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ScaleHasActiveValuesError);
    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  it('returns ScaleNotFoundError when scale does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    const result = await useCase.execute('nonexistent');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ScaleNotFoundError);
  });
});

// ═════════════════════════════════════════════════════════════
// ListGradeScalesUseCase
// ═════════════════════════════════════════════════════════════

describe('ListGradeScalesUseCase', () => {
  let repo: ReturnType<typeof makeRepo>;
  let useCase: ListGradeScalesUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new ListGradeScalesUseCase(repo as any);
  });

  it('delegates to repo.list without filters', async () => {
    repo.list.mockResolvedValue([]);
    await useCase.execute();
    expect(repo.list).toHaveBeenCalledWith(undefined);
  });

  it('delegates to repo.list with level+modality filters', async () => {
    repo.list.mockResolvedValue([]);
    await useCase.execute({ level: 2, modality: 0 });
    expect(repo.list).toHaveBeenCalledWith({ level: 2, modality: 0 });
  });
});

// ═════════════════════════════════════════════════════════════
// GetGradeScaleUseCase
// ═════════════════════════════════════════════════════════════

describe('GetGradeScaleUseCase', () => {
  let repo: ReturnType<typeof makeRepo>;
  let useCase: GetGradeScaleUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new GetGradeScaleUseCase(repo as any);
  });

  it('returns the entity when found', async () => {
    const scale = makeScale();
    repo.findById.mockResolvedValue(scale);

    const result = await useCase.execute('scale-uuid-1');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(scale);
  });

  it('returns ScaleNotFoundError when not found', async () => {
    repo.findById.mockResolvedValue(null);

    const result = await useCase.execute('nonexistent');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ScaleNotFoundError);
  });
});

// ═════════════════════════════════════════════════════════════
// CreateGradeScaleValueUseCase
// ═════════════════════════════════════════════════════════════

describe('CreateGradeScaleValueUseCase', () => {
  let repo: ReturnType<typeof makeRepo>;
  let useCase: CreateGradeScaleValueUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new CreateGradeScaleValueUseCase(repo as any);
    repo.existsValueCode.mockResolvedValue(false);
    repo.findById.mockResolvedValue(makeScale());
    repo.saveValue.mockResolvedValue(undefined);
  });

  it('creates a value successfully', async () => {
    const result = await useCase.execute({
      scaleId: 'scale-uuid-1',
      code: '10',
      label: 'Diez',
      internalStatus: 'APROBADO',
      sortOrder: 0,
    });

    expect(result.isOk()).toBe(true);
    expect(repo.existsValueCode).toHaveBeenCalledWith('scale-uuid-1', '10');
    expect(repo.saveValue).toHaveBeenCalledTimes(1);
  });

  it('returns ValueCodeDuplicateError when code is duplicated in the same scale', async () => {
    repo.existsValueCode.mockResolvedValue(true);

    const result = await useCase.execute({
      scaleId: 'scale-uuid-1',
      code: '10',
      label: 'Diez',
      internalStatus: 'APROBADO',
      sortOrder: 0,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValueCodeDuplicateError);
    expect(repo.saveValue).not.toHaveBeenCalled();
  });

  it('returns ScaleNotFoundError when scale does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    const result = await useCase.execute({
      scaleId: 'nonexistent',
      code: '10',
      label: 'Diez',
      internalStatus: 'APROBADO',
      sortOrder: 0,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ScaleNotFoundError);
  });
});

// ═════════════════════════════════════════════════════════════
// UpdateGradeScaleValueUseCase
// ═════════════════════════════════════════════════════════════

describe('UpdateGradeScaleValueUseCase', () => {
  let repo: ReturnType<typeof makeRepo>;
  let useCase: UpdateGradeScaleValueUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new UpdateGradeScaleValueUseCase(repo as any);
    repo.saveValue.mockResolvedValue(undefined);
    repo.existsValueCode.mockResolvedValue(false);
  });

  it('updates label successfully', async () => {
    const value = makeValue();
    repo.findValueById.mockResolvedValue(value);

    const result = await useCase.execute('value-uuid-1', { label: 'Nueva etiqueta' });

    expect(result.isOk()).toBe(true);
    expect(repo.saveValue).toHaveBeenCalledTimes(1);
  });

  it('returns ValueNotFoundError when value does not exist', async () => {
    repo.findValueById.mockResolvedValue(null);

    const result = await useCase.execute('nonexistent', { label: 'New' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValueNotFoundError);
  });
});

// ═════════════════════════════════════════════════════════════
// DeleteGradeScaleValueUseCase
// ═════════════════════════════════════════════════════════════

describe('DeleteGradeScaleValueUseCase', () => {
  let repo: ReturnType<typeof makeRepo>;
  let useCase: DeleteGradeScaleValueUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new DeleteGradeScaleValueUseCase(repo as any);
    repo.softDeleteValue.mockResolvedValue(undefined);
  });

  it('soft-deletes a value successfully', async () => {
    const value = makeValue();
    repo.findValueById.mockResolvedValue(value);

    const result = await useCase.execute('value-uuid-1');

    expect(result.isOk()).toBe(true);
    expect(repo.softDeleteValue).toHaveBeenCalledWith('value-uuid-1');
  });

  it('returns ValueNotFoundError when value does not exist', async () => {
    repo.findValueById.mockResolvedValue(null);

    const result = await useCase.execute('nonexistent');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValueNotFoundError);
  });
});
