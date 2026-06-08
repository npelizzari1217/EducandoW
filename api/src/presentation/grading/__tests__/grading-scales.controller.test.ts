/**
 * T19 [RED] — GradingScalesController tests.
 * Tests written before controller exists (TDD RED).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  ScaleNameDuplicateError,
  ScaleNotFoundError,
  ScaleHasActiveValuesError,
  ValueCodeDuplicateError,
  ValueNotFoundError,
  GradeScale,
  GradeScaleValue,
  ok,
  err,
} from '@educandow/domain';

let GradingScalesController: any;

beforeAll(async () => {
  const mod = await import('../grading-scales.controller');
  GradingScalesController = mod.GradingScalesController;
});

// ── Helpers ───────────────────────────────────────────────────

function makeScale(overrides: Partial<{ id: string; name: string; level: number }> = {}): GradeScale {
  return GradeScale.reconstruct({
    id: overrides.id ?? 'scale-uuid-1',
    name: overrides.name ?? 'Numérica 1-10',
    level: overrides.level ?? 2,
    modality: 0,
    active: true,
    deletedAt: null,
    values: [],
  });
}

function makeValue(overrides: Partial<{ id: string }> = {}): GradeScaleValue {
  return GradeScaleValue.reconstruct({
    id: overrides.id ?? 'value-uuid-1',
    scaleId: 'scale-uuid-1',
    code: '10',
    label: 'Diez',
    internalStatus: 'APROBADO',
    sortOrder: 0,
    active: true,
    deletedAt: null,
  });
}

function makeController(overrides: Record<string, unknown> = {}) {
  const ctrl = Object.create(GradingScalesController.prototype);
  const mockCreate = overrides.createUC ?? { execute: vi.fn().mockResolvedValue(ok(makeScale())) };
  const mockList = overrides.listUC ?? { execute: vi.fn().mockResolvedValue([makeScale()]) };
  const mockGet = overrides.getUC ?? { execute: vi.fn().mockResolvedValue(ok(makeScale())) };
  const mockUpdate = overrides.updateUC ?? { execute: vi.fn().mockResolvedValue(ok(makeScale())) };
  const mockDelete = overrides.deleteUC ?? { execute: vi.fn().mockResolvedValue(ok(undefined)) };
  const mockCreateValue = overrides.createValueUC ?? { execute: vi.fn().mockResolvedValue(ok(makeValue())) };
  const mockUpdateValue = overrides.updateValueUC ?? { execute: vi.fn().mockResolvedValue(ok(makeValue())) };
  const mockDeleteValue = overrides.deleteValueUC ?? { execute: vi.fn().mockResolvedValue(ok(undefined)) };

  Object.assign(ctrl, {
    createUC: mockCreate,
    listUC: mockList,
    getUC: mockGet,
    updateUC: mockUpdate,
    deleteUC: mockDelete,
    createValueUC: mockCreateValue,
    updateValueUC: mockUpdateValue,
    deleteValueUC: mockDeleteValue,
  });

  return ctrl;
}

// ═══════════════════════════════════════════════════════════
// POST /grading/scales — create scale
// ═══════════════════════════════════════════════════════════

describe('GradingScalesController.create', () => {
  it('returns { data: {...} } with 201 on success', async () => {
    const scale = makeScale({ id: 'new-scale-1' });
    const ctrl = makeController({
      createUC: { execute: vi.fn().mockResolvedValue(ok(scale)) },
    });

    const result = await ctrl.create({ name: 'Numérica', level: 2, modality: 0 });

    expect(result.data).toBeDefined();
    expect(result.data.id).toBe('new-scale-1');
  });

  it('throws ScaleNameDuplicateError → 409 on duplicate', async () => {
    const ctrl = makeController({
      createUC: {
        execute: vi.fn().mockResolvedValue(
          err(new ScaleNameDuplicateError(2, 0, 'Numérica')),
        ),
      },
    });

    await expect(
      ctrl.create({ name: 'Numérica', level: 2, modality: 0 }),
    ).rejects.toThrow(ScaleNameDuplicateError);
  });
});

// ═══════════════════════════════════════════════════════════
// GET /grading/scales — list
// ═══════════════════════════════════════════════════════════

describe('GradingScalesController.list', () => {
  it('returns { data: [...] } with 200', async () => {
    const scales = [makeScale({ id: 's1' }), makeScale({ id: 's2' })];
    const ctrl = makeController({
      listUC: { execute: vi.fn().mockResolvedValue(scales) },
    });

    const result = await ctrl.list(undefined, undefined);

    expect(result.data).toHaveLength(2);
  });

  it('passes level filter', async () => {
    const mockExecute = vi.fn().mockResolvedValue([]);
    const ctrl = makeController({ listUC: { execute: mockExecute } });

    await ctrl.list('2', undefined);

    expect(mockExecute.mock.calls[0][0]?.level).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════
// GET /grading/scales/:id — getOne
// ═══════════════════════════════════════════════════════════

describe('GradingScalesController.getOne', () => {
  it('returns { data: {...} } with 200 when found', async () => {
    const scale = makeScale({ id: 'found-1' });
    const ctrl = makeController({
      getUC: { execute: vi.fn().mockResolvedValue(ok(scale)) },
    });

    const result = await ctrl.getOne('found-1');
    expect(result.data.id).toBe('found-1');
  });

  it('throws ScaleNotFoundError → 404 when not found', async () => {
    const ctrl = makeController({
      getUC: {
        execute: vi.fn().mockResolvedValue(err(new ScaleNotFoundError('missing'))),
      },
    });

    await expect(ctrl.getOne('missing')).rejects.toThrow(ScaleNotFoundError);
  });
});

// ═══════════════════════════════════════════════════════════
// DELETE /grading/scales/:id — delete
// ═══════════════════════════════════════════════════════════

describe('GradingScalesController.remove', () => {
  it('returns undefined (204 no body) on success', async () => {
    const ctrl = makeController({
      deleteUC: { execute: vi.fn().mockResolvedValue(ok(undefined)) },
    });

    const result = await ctrl.remove('scale-uuid-1');
    expect(result).toBeUndefined();
  });

  it('throws ScaleHasActiveValuesError → 409 when scale has active values', async () => {
    const ctrl = makeController({
      deleteUC: {
        execute: vi.fn().mockResolvedValue(err(new ScaleHasActiveValuesError('scale-uuid-1'))),
      },
    });

    await expect(ctrl.remove('scale-uuid-1')).rejects.toThrow(ScaleHasActiveValuesError);
  });

  it('throws ScaleNotFoundError → 404 when not found', async () => {
    const ctrl = makeController({
      deleteUC: {
        execute: vi.fn().mockResolvedValue(err(new ScaleNotFoundError('missing'))),
      },
    });

    await expect(ctrl.remove('missing')).rejects.toThrow(ScaleNotFoundError);
  });
});

// ═══════════════════════════════════════════════════════════
// POST /grading/scales/:id/values — createValue
// ═══════════════════════════════════════════════════════════

describe('GradingScalesController.createValue', () => {
  it('returns { data: {...} } with 201 on success', async () => {
    const value = makeValue({ id: 'new-value-1' });
    const ctrl = makeController({
      createValueUC: { execute: vi.fn().mockResolvedValue(ok(value)) },
    });

    const result = await ctrl.createValue('scale-uuid-1', {
      code: '10', label: 'Diez', internalStatus: 'APROBADO', sortOrder: 0,
    });

    expect(result.data).toBeDefined();
    expect(result.data.id).toBe('new-value-1');
  });

  it('throws ValueCodeDuplicateError → 409 on duplicate code', async () => {
    const ctrl = makeController({
      createValueUC: {
        execute: vi.fn().mockResolvedValue(err(new ValueCodeDuplicateError('scale-uuid-1', '10'))),
      },
    });

    await expect(
      ctrl.createValue('scale-uuid-1', { code: '10', label: 'Diez', internalStatus: 'APROBADO', sortOrder: 0 }),
    ).rejects.toThrow(ValueCodeDuplicateError);
  });
});

// ═══════════════════════════════════════════════════════════
// DELETE /grading/scales/:id/values/:valueId — deleteValue
// ═══════════════════════════════════════════════════════════

describe('GradingScalesController.removeValue', () => {
  it('returns undefined (204 no body) on success', async () => {
    const ctrl = makeController({
      deleteValueUC: { execute: vi.fn().mockResolvedValue(ok(undefined)) },
    });

    const result = await ctrl.removeValue('scale-uuid-1', 'value-uuid-1');
    expect(result).toBeUndefined();
  });

  it('throws ValueNotFoundError → 404 when value does not exist', async () => {
    const ctrl = makeController({
      deleteValueUC: {
        execute: vi.fn().mockResolvedValue(err(new ValueNotFoundError('missing'))),
      },
    });

    await expect(ctrl.removeValue('scale-uuid-1', 'missing')).rejects.toThrow(ValueNotFoundError);
  });
});

// ═══════════════════════════════════════════════════════════
// toResponse helper
// ═══════════════════════════════════════════════════════════

describe('GradingScalesController — toResponse shape', () => {
  it('includes expected fields in scale response', async () => {
    const scale = makeScale({ id: 'resp-1', name: 'Numérica', level: 2 });
    const ctrl = makeController({
      getUC: { execute: vi.fn().mockResolvedValue(ok(scale)) },
    });

    const result = await ctrl.getOne('resp-1');
    expect(result.data).toMatchObject({
      id: 'resp-1',
      name: 'Numérica',
      level: 2,
      modality: 0,
      active: true,
    });
  });
});
