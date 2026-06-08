/**
 * T46 [RED] — GradingPeriodsController tests.
 * Tests written before controller exists (TDD RED).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  PeriodTemplateNameDuplicateError,
  PeriodTemplateNotFoundError,
  PeriodTemplateHasDatesError,
  PeriodDateInvalidRangeError,
  PeriodDateOutOfCycleRangeError,
  PeriodDateOverlapError,
  GradingPeriodTemplate,
  ok,
  err,
} from '@educandow/domain';

let GradingPeriodsController: any;

beforeAll(async () => {
  const mod = await import('../grading-periods.controller');
  GradingPeriodsController = mod.GradingPeriodsController;
});

// ── Helpers ───────────────────────────────────────────────────

function makeTemplate(
  overrides: Partial<{ id: string; name: string }> = {},
): GradingPeriodTemplate {
  const id = overrides.id ?? 'template-uuid-1';
  return GradingPeriodTemplate.reconstruct({
    id,
    name: overrides.name ?? 'Trimestral Primaria',
    level: 2,
    modality: 0,
    active: true,
    deletedAt: null,
    items: [
      { id: 'item-1', templateId: id, name: '1° Trimestre', sortOrder: 1 },
      { id: 'item-2', templateId: id, name: '2° Trimestre', sortOrder: 2 },
      { id: 'item-3', templateId: id, name: '3° Trimestre', sortOrder: 3 },
    ],
  });
}

function makeController(overrides: Record<string, unknown> = {}) {
  const ctrl = Object.create(GradingPeriodsController.prototype);
  ctrl.createTemplateUC = overrides.createTemplateUC ?? {
    execute: vi.fn().mockResolvedValue(ok(makeTemplate())),
  };
  ctrl.listTemplatesUC = overrides.listTemplatesUC ?? {
    execute: vi.fn().mockResolvedValue([makeTemplate()]),
  };
  ctrl.getTemplateUC = overrides.getTemplateUC ?? {
    execute: vi.fn().mockResolvedValue(ok(makeTemplate())),
  };
  ctrl.updateTemplateUC = overrides.updateTemplateUC ?? {
    execute: vi.fn().mockResolvedValue(ok(makeTemplate())),
  };
  ctrl.deleteTemplateUC = overrides.deleteTemplateUC ?? {
    execute: vi.fn().mockResolvedValue(ok(undefined)),
  };
  ctrl.upsertDatesUC = overrides.upsertDatesUC ?? {
    execute: vi.fn().mockResolvedValue(ok([])),
  };
  ctrl.listDatesUC = overrides.listDatesUC ?? {
    execute: vi.fn().mockResolvedValue([]),
  };
  return ctrl;
}

// ═════════════════════════════════════════════════════════════
// POST /grading/period-templates
// ═════════════════════════════════════════════════════════════

describe('GradingPeriodsController — create template', () => {
  it('POST 201 Created when template creation succeeds', async () => {
    const ctrl = makeController();
    const body = {
      name: 'Trimestral Primaria',
      level: 2,
      modality: 0,
      items: [
        { name: '1° Trimestre', sortOrder: 1 },
        { name: '2° Trimestre', sortOrder: 2 },
        { name: '3° Trimestre', sortOrder: 3 },
      ],
    };

    const result = await ctrl.create(body);
    expect(result.data).toBeDefined();
    expect(result.data.name).toBe('Trimestral Primaria');
    expect(result.data.items).toHaveLength(3);
  });

  it('throws PeriodTemplateNameDuplicateError (409) on duplicate name', async () => {
    const ctrl = makeController({
      createTemplateUC: {
        execute: vi.fn().mockResolvedValue(
          err(new PeriodTemplateNameDuplicateError(2, 0, 'Trimestral Primaria')),
        ),
      },
    });

    await expect(ctrl.create({
      name: 'Trimestral Primaria',
      level: 2,
      modality: 0,
      items: [{ name: '1° Trimestre', sortOrder: 1 }],
    })).rejects.toBeInstanceOf(PeriodTemplateNameDuplicateError);
  });
});

// ═════════════════════════════════════════════════════════════
// GET /grading/period-templates
// ═════════════════════════════════════════════════════════════

describe('GradingPeriodsController — list templates', () => {
  it('GET 200 returns list of templates', async () => {
    const ctrl = makeController();
    const result = await ctrl.list();
    expect(result.data).toBeInstanceOf(Array);
    expect(result.data).toHaveLength(1);
  });

  it('GET 200 passes level/modality filters to use case', async () => {
    const ctrl = makeController();
    await ctrl.list('2', '0');
    expect(ctrl.listTemplatesUC.execute).toHaveBeenCalledWith({ level: 2, modality: 0 });
  });
});

// ═════════════════════════════════════════════════════════════
// GET /grading/period-templates/:id
// ═════════════════════════════════════════════════════════════

describe('GradingPeriodsController — get one template', () => {
  it('GET 200 returns template when found', async () => {
    const ctrl = makeController();
    const result = await ctrl.getOne('template-uuid-1');
    expect(result.data).toBeDefined();
  });

  it('throws PeriodTemplateNotFoundError (404) when not found', async () => {
    const ctrl = makeController({
      getTemplateUC: {
        execute: vi.fn().mockResolvedValue(err(new PeriodTemplateNotFoundError('nonexistent'))),
      },
    });

    await expect(ctrl.getOne('nonexistent')).rejects.toBeInstanceOf(PeriodTemplateNotFoundError);
  });
});

// ═════════════════════════════════════════════════════════════
// DELETE /grading/period-templates/:id
// ═════════════════════════════════════════════════════════════

describe('GradingPeriodsController — delete template', () => {
  it('DELETE 204 when template deleted successfully', async () => {
    const ctrl = makeController();
    const result = await ctrl.remove('template-uuid-1');
    expect(result).toBeUndefined();
  });

  it('throws PeriodTemplateHasDatesError (409) when template has dates', async () => {
    const ctrl = makeController({
      deleteTemplateUC: {
        execute: vi.fn().mockResolvedValue(
          err(new PeriodTemplateHasDatesError('template-uuid-1')),
        ),
      },
    });

    await expect(ctrl.remove('template-uuid-1')).rejects.toBeInstanceOf(PeriodTemplateHasDatesError);
  });
});

// ═════════════════════════════════════════════════════════════
// PUT /grading/period-templates/:id/dates
// ═════════════════════════════════════════════════════════════

describe('GradingPeriodsController — upsert dates', () => {
  it('PUT 200 when dates upserted successfully', async () => {
    const ctrl = makeController();
    const result = await ctrl.upsertDates('template-uuid-1', {
      cycleId: 'cycle-uuid-1',
      dates: [
        { itemId: 'item-1', startDate: new Date('2026-03-01'), endDate: new Date('2026-05-31') },
      ],
    });
    expect(result.data).toBeDefined();
  });

  it('throws PeriodDateInvalidRangeError (422) when startDate >= endDate', async () => {
    const ctrl = makeController({
      upsertDatesUC: {
        execute: vi.fn().mockResolvedValue(
          err(new PeriodDateInvalidRangeError(new Date('2026-05-01'), new Date('2026-03-01'))),
        ),
      },
    });

    await expect(ctrl.upsertDates('template-uuid-1', {
      cycleId: 'cycle-uuid-1',
      dates: [],
    })).rejects.toBeInstanceOf(PeriodDateInvalidRangeError);
  });

  it('throws PeriodDateOutOfCycleRangeError (422) when date is outside cycle range', async () => {
    const ctrl = makeController({
      upsertDatesUC: {
        execute: vi.fn().mockResolvedValue(
          err(new PeriodDateOutOfCycleRangeError(
            new Date('2026-01-01'),
            new Date('2026-03-01'),
            new Date('2026-12-15'),
          )),
        ),
      },
    });

    await expect(ctrl.upsertDates('template-uuid-1', {
      cycleId: 'cycle-uuid-1',
      dates: [],
    })).rejects.toBeInstanceOf(PeriodDateOutOfCycleRangeError);
  });

  it('throws PeriodDateOverlapError (422) on overlapping periods', async () => {
    const ctrl = makeController({
      upsertDatesUC: {
        execute: vi.fn().mockResolvedValue(
          err(new PeriodDateOverlapError('item-1', 'item-2')),
        ),
      },
    });

    await expect(ctrl.upsertDates('template-uuid-1', {
      cycleId: 'cycle-uuid-1',
      dates: [],
    })).rejects.toBeInstanceOf(PeriodDateOverlapError);
  });
});

// ═════════════════════════════════════════════════════════════
// GET /grading/period-templates/:id/dates
// ═════════════════════════════════════════════════════════════

describe('GradingPeriodsController — list dates', () => {
  it('GET 200 returns dates for template+cycle', async () => {
    const ctrl = makeController();
    const result = await ctrl.listDates('template-uuid-1', 'cycle-uuid-1');
    expect(result.data).toBeInstanceOf(Array);
  });
});
