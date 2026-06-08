/**
 * T2.5.1 — CRUD use cases tests (RED → GREEN).
 * All tests use a mock AttendanceTypeRepository.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateAttendanceTypeUseCase,
  UpdateAttendanceTypeUseCase,
  DeleteAttendanceTypeUseCase,
  ListAttendanceTypesUseCase,
  GetAttendanceTypeUseCase,
} from '../use-cases/attendance-type.use-cases';
import {
  AttendanceType,
  AttendanceTypeCode,
  AttendanceTypeCodeDuplicateError,
  AttendanceTypeNotFoundError,
  SystemAttendanceTypeError,
} from '@educandow/domain';

// ── Mock repo ────────────────────────────────────────────────

function makeRepo() {
  return {
    findById: vi.fn(),
    findByLevelCode: vi.fn(),
    list: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    existsByLevelCode: vi.fn(),
  };
}

// ── Helpers ──────────────────────────────────────────────────

function makeEntity(overrides: {
  id?: string;
  code?: string;
  level?: number;
  isSystem?: boolean;
  active?: boolean;
  description?: string;
  absenceValue?: number;
  assignable?: boolean;
} = {}): AttendanceType {
  return AttendanceType.reconstruct({
    id: overrides.id ?? 'at-uuid-1',
    code: AttendanceTypeCode.reconstruct(overrides.code ?? 'P'),
    description: overrides.description ?? 'Presente',
    absenceValue: overrides.absenceValue ?? 0,
    level: overrides.level ?? 2,
    assignable: overrides.assignable ?? true,
    isSystem: overrides.isSystem ?? false,
    active: overrides.active ?? true,
  });
}

// ─────────────────────────────────────────────────────────────
// CreateAttendanceTypeUseCase
// ─────────────────────────────────────────────────────────────

describe('CreateAttendanceTypeUseCase', () => {
  let repo: ReturnType<typeof makeRepo>;
  let useCase: CreateAttendanceTypeUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new CreateAttendanceTypeUseCase(repo as any);
    repo.existsByLevelCode.mockResolvedValue(false);
    repo.save.mockResolvedValue(undefined);
  });

  it('creates an AttendanceType successfully with valid data', async () => {
    const result = await useCase.execute({
      code: 'T',
      description: 'Tardanza',
      absenceValue: 0.5,
      level: 2,
      assignable: true,
    });

    expect(result.isOk()).toBe(true);
    expect(repo.existsByLevelCode).toHaveBeenCalledWith(2, 'T');
    expect(repo.save).toHaveBeenCalledTimes(1);
    const entity = result.unwrap();
    expect(entity.code.get()).toBe('T');
    expect(entity.isSystem).toBe(false);
  });

  it('returns AttendanceTypeCodeDuplicateError when (level, code) already exists', async () => {
    repo.existsByLevelCode.mockResolvedValue(true);

    const result = await useCase.execute({
      code: 'P',
      description: 'Otro Presente',
      absenceValue: 0,
      level: 2,
      assignable: true,
    });

    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error).toBeInstanceOf(AttendanceTypeCodeDuplicateError);
    expect(error.code).toBe('ATTENDANCE_TYPE_CODE_DUPLICATE');
    expect(repo.save).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// UpdateAttendanceTypeUseCase
// ─────────────────────────────────────────────────────────────

describe('UpdateAttendanceTypeUseCase', () => {
  let repo: ReturnType<typeof makeRepo>;
  let useCase: UpdateAttendanceTypeUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new UpdateAttendanceTypeUseCase(repo as any);
    repo.save.mockResolvedValue(undefined);
  });

  it('updates description, absenceValue, active, assignable on a non-system type', async () => {
    const entity = makeEntity({ isSystem: false, description: 'Tardanza', absenceValue: 0.5 });
    repo.findById.mockResolvedValue(entity);

    const result = await useCase.execute('at-uuid-1', {
      description: 'Tardanza leve',
      absenceValue: 0.25,
    });

    expect(result.isOk()).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
    const updated = result.unwrap();
    expect(updated.description).toBe('Tardanza leve');
    expect(updated.absenceValue).toBe(0.25);
  });

  it('returns SystemAttendanceTypeError when isSystem is true', async () => {
    const entity = makeEntity({ isSystem: true, code: 'P' });
    repo.findById.mockResolvedValue(entity);

    const result = await useCase.execute('at-uuid-1', { description: 'Hacked' });

    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error).toBeInstanceOf(SystemAttendanceTypeError);
    expect(error.code).toBe('ATTENDANCE_TYPE_SYSTEM_PROTECTED');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('returns AttendanceTypeNotFoundError when entity does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    const result = await useCase.execute('nonexistent', { description: 'Nope' });

    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error).toBeInstanceOf(AttendanceTypeNotFoundError);
    expect(error.code).toBe('ATTENDANCE_TYPE_NOT_FOUND');
  });
});

// ─────────────────────────────────────────────────────────────
// DeleteAttendanceTypeUseCase
// ─────────────────────────────────────────────────────────────

describe('DeleteAttendanceTypeUseCase', () => {
  let repo: ReturnType<typeof makeRepo>;
  let useCase: DeleteAttendanceTypeUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new DeleteAttendanceTypeUseCase(repo as any);
    repo.delete.mockResolvedValue(undefined);
  });

  it('deletes a non-system AttendanceType successfully', async () => {
    const entity = makeEntity({ isSystem: false });
    repo.findById.mockResolvedValue(entity);

    const result = await useCase.execute('at-uuid-1');

    expect(result.isOk()).toBe(true);
    expect(repo.delete).toHaveBeenCalledWith('at-uuid-1');
  });

  it('returns SystemAttendanceTypeError when isSystem is true', async () => {
    const entity = makeEntity({ isSystem: true, code: 'DOM' });
    repo.findById.mockResolvedValue(entity);

    const result = await useCase.execute('at-uuid-1');

    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error).toBeInstanceOf(SystemAttendanceTypeError);
    expect(error.code).toBe('ATTENDANCE_TYPE_SYSTEM_PROTECTED');
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('returns AttendanceTypeNotFoundError when entity does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    const result = await useCase.execute('nonexistent');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(AttendanceTypeNotFoundError);
  });
});

// ─────────────────────────────────────────────────────────────
// ListAttendanceTypesUseCase
// ─────────────────────────────────────────────────────────────

describe('ListAttendanceTypesUseCase', () => {
  let repo: ReturnType<typeof makeRepo>;
  let useCase: ListAttendanceTypesUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new ListAttendanceTypesUseCase(repo as any);
  });

  it('delegates to repo.list without filters when called without args', async () => {
    repo.list.mockResolvedValue([]);
    await useCase.execute();
    expect(repo.list).toHaveBeenCalledWith(undefined);
  });

  it('delegates to repo.list with level filter', async () => {
    repo.list.mockResolvedValue([]);
    await useCase.execute({ level: 2 });
    expect(repo.list).toHaveBeenCalledWith({ level: 2 });
  });

  it('returns the array from the repo', async () => {
    const entities = [makeEntity({ level: 2 }), makeEntity({ level: 3, code: 'X' })];
    repo.list.mockResolvedValue(entities);
    const result = await useCase.execute();
    expect(result).toBe(entities);
  });
});

// ─────────────────────────────────────────────────────────────
// GetAttendanceTypeUseCase
// ─────────────────────────────────────────────────────────────

describe('GetAttendanceTypeUseCase', () => {
  let repo: ReturnType<typeof makeRepo>;
  let useCase: GetAttendanceTypeUseCase;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new GetAttendanceTypeUseCase(repo as any);
  });

  it('returns the entity when found', async () => {
    const entity = makeEntity();
    repo.findById.mockResolvedValue(entity);

    const result = await useCase.execute('at-uuid-1');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(entity);
  });

  it('returns AttendanceTypeNotFoundError when not found', async () => {
    repo.findById.mockResolvedValue(null);

    const result = await useCase.execute('nonexistent');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(AttendanceTypeNotFoundError);
  });
});
