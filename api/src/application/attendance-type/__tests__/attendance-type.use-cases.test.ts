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
  AttendanceTypeLevelOutOfScopeError,
  SystemAttendanceTypeError,
  AttendanceBehavior,
  AttendanceBehaviorValue,
} from '@educandow/domain';

// ── Current-user fixtures (PR2 — scope de nivel base) ──────────

/** ROOT: allLevels=true, sin restricción de nivel. Preserva el comportamiento previo a PR2. */
const rootUser = { roles: ['ROOT'] };

/** Docente con un solo nivel base (2), modalidad 0 → compositeLevel 20. */
const teacherLevel2 = { roles: ['TEACHER'], levels: [20] };

/** Docente con dos niveles base (2 y 3), colapsando modalidades. */
const teacherLevels2And3 = { roles: ['TEACHER'], levels: [20, 21, 30] };

/** Docente sin ningún nivel asignado. */
const teacherNoLevels = { roles: ['TEACHER'], levels: [] };

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
  behavior?: AttendanceBehaviorValue;
} = {}): AttendanceType {
  return AttendanceType.reconstruct({
    id: overrides.id ?? 'at-uuid-1',
    code: AttendanceTypeCode.reconstruct(overrides.code ?? 'P'),
    description: overrides.description ?? 'Presente',
    absenceValue: overrides.absenceValue ?? 0,
    level: overrides.level ?? 2,
    behavior: AttendanceBehavior.reconstruct(overrides.behavior ?? AttendanceBehaviorValue.NO_COMPUTA),
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
      behavior: AttendanceBehaviorValue.TARDE_JUSTIFICADA,
    }, rootUser);

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
      behavior: AttendanceBehaviorValue.NO_COMPUTA,
    }, rootUser);

    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error).toBeInstanceOf(AttendanceTypeCodeDuplicateError);
    expect(error.code).toBe('ATTENDANCE_TYPE_CODE_DUPLICATE');
    expect(repo.save).not.toHaveBeenCalled();
  });

  // T2.1 — Scenario P1-1: absenceValue stored independent of behavior
  it('stores absenceValue independent of the chosen behavior', async () => {
    const result = await useCase.execute({
      code: 'TI',
      description: 'Tarde Injustificada',
      absenceValue: 0.25,
      level: 2,
      behavior: AttendanceBehaviorValue.TARDE_INJUSTIFICADA,
    }, rootUser);

    expect(result.isOk()).toBe(true);
    const entity = result.unwrap();
    expect(entity.absenceValue).toBe(0.25);
    expect(entity.behavior.get()).toBe(AttendanceBehaviorValue.TARDE_INJUSTIFICADA);
  });

  // T2.1 — Scenario P1-2: out-of-range behavior rejected, no row created
  it('rejects an out-of-range behavior value and does not save', async () => {
    await expect(
      useCase.execute({
        code: 'BAD',
        description: 'Inválido',
        absenceValue: 0,
        level: 2,
        behavior: 'INVALID' as AttendanceBehaviorValue,
      }, rootUser),
    ).rejects.toThrow();
    expect(repo.save).not.toHaveBeenCalled();
  });

  // T2.1 — Scenario P1-11 (edge): one custom type per behavior value, no uniqueness conflict
  it('creates 7 distinct custom types, one per behavior value, without cross-validation conflict', async () => {
    const values = Object.values(AttendanceBehaviorValue);
    for (const [i, behavior] of values.entries()) {
      const result = await useCase.execute({
        code: `B${i}`,
        description: `Behavior ${behavior}`,
        absenceValue: 0.5,
        level: 2,
        behavior,
      }, rootUser);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().behavior.get()).toBe(behavior);
    }
    expect(repo.save).toHaveBeenCalledTimes(values.length);
  });

  // ── PR2 — T7 (RED): scope de nivel en creación (REQ-18 MODIFIED / Escenarios 3.3-3.5) ──

  it('creates when input.level belongs to the caller baseLevels (in-scope)', async () => {
    const result = await useCase.execute({
      code: 'Z',
      description: 'Zeta',
      absenceValue: 0,
      level: 2,
      behavior: AttendanceBehaviorValue.NO_COMPUTA,
    }, teacherLevel2);

    expect(result.isOk()).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('throws AttendanceTypeLevelOutOfScopeError when input.level is outside the caller baseLevels, repo.save is never called', async () => {
    await expect(
      useCase.execute({
        code: 'Z',
        description: 'Zeta',
        absenceValue: 0,
        level: 3,
        behavior: AttendanceBehaviorValue.NO_COMPUTA,
      }, teacherLevel2),
    ).rejects.toBeInstanceOf(AttendanceTypeLevelOutOfScopeError);
    expect(repo.existsByLevelCode).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('allows ROOT/ADMIN to create at any level, unrestricted', async () => {
    const result = await useCase.execute({
      code: 'Z',
      description: 'Zeta',
      absenceValue: 0,
      level: 4,
      behavior: AttendanceBehaviorValue.NO_COMPUTA,
    }, rootUser);

    expect(result.isOk()).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
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

  // T2.1 — Scenario P1-5: system type update attempt (incl. behavior) rejected, row unchanged
  it('rejects a behavior update attempt on a system type and leaves the row unchanged', async () => {
    const entity = makeEntity({
      isSystem: true,
      code: 'SAB',
      behavior: AttendanceBehaviorValue.NO_ELEGIBLE,
      description: 'Sábado',
      absenceValue: 0,
    });
    repo.findById.mockResolvedValue(entity);

    const result = await useCase.execute('at-uuid-1', {
      description: 'Hackeado',
      absenceValue: 1,
      behavior: AttendanceBehaviorValue.AUSENTE_INJUSTIFICADO,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(SystemAttendanceTypeError);
    expect(repo.save).not.toHaveBeenCalled();
    // Row unchanged — same entity reference returned by findById, untouched
    expect(entity.description).toBe('Sábado');
    expect(entity.absenceValue).toBe(0);
    expect(entity.behavior.get()).toBe(AttendanceBehaviorValue.NO_ELEGIBLE);
  });

  // T2.1 — Scenario P1-7: custom type behavior update succeeds
  it('updates behavior on a custom (non-system) type successfully', async () => {
    const entity = makeEntity({ isSystem: false, behavior: AttendanceBehaviorValue.AUSENTE_INJUSTIFICADO });
    repo.findById.mockResolvedValue(entity);

    const result = await useCase.execute('at-uuid-1', {
      behavior: AttendanceBehaviorValue.TARDE_JUSTIFICADA,
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().behavior.get()).toBe(AttendanceBehaviorValue.TARDE_JUSTIFICADA);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  // T2.1 — "behavior optional on input; omitted → keeps entity.behavior unchanged"
  it('keeps the existing behavior when omitted from the update input', async () => {
    const entity = makeEntity({ isSystem: false, behavior: AttendanceBehaviorValue.DIA_NO_HABIL });
    repo.findById.mockResolvedValue(entity);

    const result = await useCase.execute('at-uuid-1', { description: 'Solo descripción' });

    expect(result.isOk()).toBe(true);
    const updated = result.unwrap();
    expect(updated.description).toBe('Solo descripción');
    expect(updated.behavior.get()).toBe(AttendanceBehaviorValue.DIA_NO_HABIL);
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

  // T2.1 — Scenario P1-6: system type delete rejected, row remains active/unchanged
  it('leaves the system type row active and unchanged when delete is rejected', async () => {
    const entity = makeEntity({ isSystem: true, code: 'P', active: true, behavior: AttendanceBehaviorValue.NO_COMPUTA });
    repo.findById.mockResolvedValue(entity);

    const result = await useCase.execute('at-uuid-1');

    expect(result.isErr()).toBe(true);
    expect(repo.delete).not.toHaveBeenCalled();
    expect(entity.active).toBe(true);
    expect(entity.behavior.get()).toBe(AttendanceBehaviorValue.NO_COMPUTA);
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

  it('delegates to repo.list without filters when called without args (ROOT/ADMIN, allLevels)', async () => {
    repo.list.mockResolvedValue([]);
    await useCase.execute(undefined, rootUser);
    expect(repo.list).toHaveBeenCalledWith(undefined);
  });

  it('delegates to repo.list with level filter (ROOT/ADMIN, allLevels)', async () => {
    repo.list.mockResolvedValue([]);
    await useCase.execute({ level: 2 }, rootUser);
    expect(repo.list).toHaveBeenCalledWith({ level: 2 });
  });

  it('returns the array from the repo', async () => {
    const entities = [makeEntity({ level: 2 }), makeEntity({ level: 3, code: 'X' })];
    repo.list.mockResolvedValue(entities);
    const result = await useCase.execute(undefined, rootUser);
    expect(result).toBe(entities);
  });

  // ── PR2 — T5 (RED): scope de nivel en listado (REQ-17 MODIFIED / Escenarios 8.5-8.9) ──

  it('docente con 1 nivel base: repo.list se llama con allowedLevels=[base], sin ?level', async () => {
    repo.list.mockResolvedValue([]);
    await useCase.execute(undefined, teacherLevel2);
    expect(repo.list).toHaveBeenCalledWith({ allowedLevels: [2] });
  });

  it('docente con multi-nivel: allowedLevels = union de niveles base', async () => {
    repo.list.mockResolvedValue([]);
    await useCase.execute(undefined, teacherLevels2And3);
    expect(repo.list).toHaveBeenCalledWith({ allowedLevels: [2, 3] });
  });

  it('ROOT/ADMIN: repo.list se llama SIN allowedLevels (sin restricción)', async () => {
    repo.list.mockResolvedValue([]);
    await useCase.execute({ active: true }, rootUser);
    expect(repo.list).toHaveBeenCalledWith({ active: true });
  });

  it('filters.level explícito fuera de baseLevels: lanza AttendanceTypeLevelOutOfScopeError, repo.list nunca invocado', async () => {
    await expect(
      useCase.execute({ level: 3 }, teacherLevel2),
    ).rejects.toBeInstanceOf(AttendanceTypeLevelOutOfScopeError);
    expect(repo.list).not.toHaveBeenCalled();
  });

  it('filters.level explícito dentro de baseLevels: repo.list se llama con level + allowedLevels', async () => {
    repo.list.mockResolvedValue([]);
    await useCase.execute({ level: 3 }, teacherLevels2And3);
    expect(repo.list).toHaveBeenCalledWith({ level: 3, allowedLevels: [2, 3] });
  });

  it('0 niveles base (no-ROOT/no-ADMIN) sin ?level: repo.list se llama con allowedLevels=[] (200 con data:[], nunca 403 — Escenario 8.9/ADD-2.4)', async () => {
    repo.list.mockResolvedValue([]);
    const result = await useCase.execute(undefined, teacherNoLevels);
    expect(repo.list).toHaveBeenCalledWith({ allowedLevels: [] });
    expect(result).toEqual([]);
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
