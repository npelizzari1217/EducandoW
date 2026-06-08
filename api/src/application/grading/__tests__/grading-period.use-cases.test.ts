/**
 * T39 [RED] — GradingPeriod use cases tests.
 * Uses fake in-memory repos. Written before implementations exist (TDD RED).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateGradingPeriodTemplateUseCase,
  DeleteGradingPeriodTemplateUseCase,
  GetGradingPeriodTemplateUseCase,
} from '../use-cases/grading-period-template.use-cases';
import {
  UpsertPeriodDatesUseCase,
  ListPeriodDatesUseCase,
} from '../use-cases/grading-period-date.use-cases';
import {
  GradingPeriodTemplate,
  PeriodTemplateNameDuplicateError,
  PeriodTemplateNotFoundError,
  PeriodSortOrderDuplicateError,
  PeriodTemplateHasDatesError,
  PeriodDateInvalidRangeError,
  PeriodDateOutOfCycleRangeError,
  PeriodDateOverlapError,
} from '@educandow/domain';

// ── Fake repos ────────────────────────────────────────────────

function makePeriodRepo() {
  return {
    findTemplateById: vi.fn(),
    listTemplates: vi.fn(),
    existsTemplateName: vi.fn(),
    saveTemplate: vi.fn(),
    countDatesForTemplate: vi.fn(),
    softDeleteTemplate: vi.fn(),
    listDates: vi.fn(),
    saveDates: vi.fn(),
    findDatesByCycle: vi.fn(),
  };
}

function makeCycleRepo() {
  return {
    findById: vi.fn(),
    findByUuid: vi.fn(),
    findByCode: vi.fn(),
    findActive: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    softDelete: vi.fn(),
  };
}

// ── Helpers ───────────────────────────────────────────────────

function makeTemplate(
  overrides: Partial<{ id: string; name: string; level: number; modality: number }> = {},
): GradingPeriodTemplate {
  const id = overrides.id ?? 'template-uuid-1';
  return GradingPeriodTemplate.reconstruct({
    id,
    name: overrides.name ?? 'Trimestral Primaria',
    level: overrides.level ?? 2,
    modality: overrides.modality ?? 0,
    active: true,
    deletedAt: null,
    items: [
      { id: 'item-1', templateId: id, name: '1° Trimestre', sortOrder: 1 },
      { id: 'item-2', templateId: id, name: '2° Trimestre', sortOrder: 2 },
      { id: 'item-3', templateId: id, name: '3° Trimestre', sortOrder: 3 },
    ],
  });
}

/** Minimal fake AcademicCycle with startDate/endDate used by date use cases */
function makeCycleLike(
  startDate = new Date('2026-03-01'),
  endDate = new Date('2026-12-15'),
) {
  return { uuid: 'cycle-uuid-1', startDate, endDate };
}

// ═════════════════════════════════════════════════════════════
// CreateGradingPeriodTemplateUseCase
// ═════════════════════════════════════════════════════════════

describe('CreateGradingPeriodTemplateUseCase', () => {
  let repo: ReturnType<typeof makePeriodRepo>;
  let useCase: CreateGradingPeriodTemplateUseCase;

  beforeEach(() => {
    repo = makePeriodRepo();
    useCase = new CreateGradingPeriodTemplateUseCase(repo as any);
    repo.existsTemplateName.mockResolvedValue(false);
    repo.saveTemplate.mockResolvedValue(undefined);
  });

  it('creates a template with 3 items successfully', async () => {
    const result = await useCase.execute({
      name: 'Trimestral Primaria',
      level: 2,
      modality: 0,
      items: [
        { name: '1° Trimestre', sortOrder: 1 },
        { name: '2° Trimestre', sortOrder: 2 },
        { name: '3° Trimestre', sortOrder: 3 },
      ],
    });

    expect(result.isOk()).toBe(true);
    expect(repo.existsTemplateName).toHaveBeenCalledWith(2, 0, 'Trimestral Primaria');
    expect(repo.saveTemplate).toHaveBeenCalledTimes(1);
    const template = result.unwrap();
    expect(template.items).toHaveLength(3);
    expect(template.name).toBe('Trimestral Primaria');
  });

  it('returns PeriodTemplateNameDuplicateError when name is duplicated', async () => {
    repo.existsTemplateName.mockResolvedValue(true);

    const result = await useCase.execute({
      name: 'Trimestral Primaria',
      level: 2,
      modality: 0,
      items: [{ name: '1° Trimestre', sortOrder: 1 }],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(PeriodTemplateNameDuplicateError);
    expect(repo.saveTemplate).not.toHaveBeenCalled();
  });

  it('returns PeriodSortOrderDuplicateError when items have duplicate sortOrder', async () => {
    const result = await useCase.execute({
      name: 'Trimestral Primaria',
      level: 2,
      modality: 0,
      items: [
        { name: '1° Trimestre', sortOrder: 1 },
        { name: '2° Trimestre', sortOrder: 1 }, // duplicate sortOrder
      ],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(PeriodSortOrderDuplicateError);
    expect(repo.saveTemplate).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════
// GetGradingPeriodTemplateUseCase
// ═════════════════════════════════════════════════════════════

describe('GetGradingPeriodTemplateUseCase', () => {
  let repo: ReturnType<typeof makePeriodRepo>;
  let useCase: GetGradingPeriodTemplateUseCase;

  beforeEach(() => {
    repo = makePeriodRepo();
    useCase = new GetGradingPeriodTemplateUseCase(repo as any);
  });

  it('returns the template when found', async () => {
    const template = makeTemplate();
    repo.findTemplateById.mockResolvedValue(template);

    const result = await useCase.execute('template-uuid-1');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(template);
  });

  it('returns PeriodTemplateNotFoundError when not found', async () => {
    repo.findTemplateById.mockResolvedValue(null);

    const result = await useCase.execute('nonexistent');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(PeriodTemplateNotFoundError);
  });
});

// ═════════════════════════════════════════════════════════════
// DeleteGradingPeriodTemplateUseCase
// ═════════════════════════════════════════════════════════════

describe('DeleteGradingPeriodTemplateUseCase', () => {
  let repo: ReturnType<typeof makePeriodRepo>;
  let useCase: DeleteGradingPeriodTemplateUseCase;

  beforeEach(() => {
    repo = makePeriodRepo();
    useCase = new DeleteGradingPeriodTemplateUseCase(repo as any);
    repo.softDeleteTemplate.mockResolvedValue(undefined);
  });

  it('soft-deletes a template with no dates', async () => {
    const template = makeTemplate();
    repo.findTemplateById.mockResolvedValue(template);
    repo.countDatesForTemplate.mockResolvedValue(0);

    const result = await useCase.execute('template-uuid-1');

    expect(result.isOk()).toBe(true);
    expect(repo.softDeleteTemplate).toHaveBeenCalledWith('template-uuid-1');
  });

  it('returns PeriodTemplateHasDatesError when template has associated dates', async () => {
    const template = makeTemplate();
    repo.findTemplateById.mockResolvedValue(template);
    repo.countDatesForTemplate.mockResolvedValue(3);

    const result = await useCase.execute('template-uuid-1');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(PeriodTemplateHasDatesError);
    expect(repo.softDeleteTemplate).not.toHaveBeenCalled();
  });

  it('returns PeriodTemplateNotFoundError when template does not exist', async () => {
    repo.findTemplateById.mockResolvedValue(null);

    const result = await useCase.execute('nonexistent');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(PeriodTemplateNotFoundError);
  });
});

// ═════════════════════════════════════════════════════════════
// UpsertPeriodDatesUseCase
// ═════════════════════════════════════════════════════════════

describe('UpsertPeriodDatesUseCase', () => {
  let periodRepo: ReturnType<typeof makePeriodRepo>;
  let cycleRepo: ReturnType<typeof makeCycleRepo>;
  let useCase: UpsertPeriodDatesUseCase;

  const cycleStart = new Date('2026-03-01');
  const cycleEnd = new Date('2026-12-15');

  beforeEach(() => {
    periodRepo = makePeriodRepo();
    cycleRepo = makeCycleRepo();
    useCase = new UpsertPeriodDatesUseCase(periodRepo as any, cycleRepo as any);

    cycleRepo.findByUuid.mockResolvedValue(makeCycleLike(cycleStart, cycleEnd));
    periodRepo.findDatesByCycle.mockResolvedValue([]);
    periodRepo.saveDates.mockResolvedValue(undefined);
  });

  it('upserts dates successfully for valid input', async () => {
    const result = await useCase.execute('template-uuid-1', 'cycle-uuid-1', [
      { itemId: 'item-1', startDate: new Date('2026-03-01'), endDate: new Date('2026-05-31') },
      { itemId: 'item-2', startDate: new Date('2026-06-01'), endDate: new Date('2026-08-31') },
    ]);

    expect(result.isOk()).toBe(true);
    expect(periodRepo.saveDates).toHaveBeenCalledTimes(2);
  });

  it('returns PeriodDateInvalidRangeError when startDate >= endDate', async () => {
    const result = await useCase.execute('template-uuid-1', 'cycle-uuid-1', [
      { itemId: 'item-1', startDate: new Date('2026-05-01'), endDate: new Date('2026-04-01') },
    ]);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(PeriodDateInvalidRangeError);
    expect(periodRepo.saveDates).not.toHaveBeenCalled();
  });

  it('returns PeriodDateOutOfCycleRangeError when date is outside cycle range', async () => {
    // startDate is before cycle start
    const result = await useCase.execute('template-uuid-1', 'cycle-uuid-1', [
      { itemId: 'item-1', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31') },
    ]);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(PeriodDateOutOfCycleRangeError);
    expect(periodRepo.saveDates).not.toHaveBeenCalled();
  });

  it('returns PeriodDateOverlapError when dates overlap within the same cycle', async () => {
    const result = await useCase.execute('template-uuid-1', 'cycle-uuid-1', [
      { itemId: 'item-1', startDate: new Date('2026-03-01'), endDate: new Date('2026-06-30') },
      { itemId: 'item-2', startDate: new Date('2026-05-01'), endDate: new Date('2026-07-31') }, // overlaps item-1
    ]);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(PeriodDateOverlapError);
    expect(periodRepo.saveDates).not.toHaveBeenCalled();
  });

  it('allows gaps between periods (no min-coverage validation)', async () => {
    // Gap between May 31 and June 15
    const result = await useCase.execute('template-uuid-1', 'cycle-uuid-1', [
      { itemId: 'item-1', startDate: new Date('2026-03-01'), endDate: new Date('2026-05-31') },
      { itemId: 'item-2', startDate: new Date('2026-06-15'), endDate: new Date('2026-09-30') },
    ]);

    expect(result.isOk()).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════
// ListPeriodDatesUseCase
// ═════════════════════════════════════════════════════════════

describe('ListPeriodDatesUseCase', () => {
  let periodRepo: ReturnType<typeof makePeriodRepo>;
  let useCase: ListPeriodDatesUseCase;

  beforeEach(() => {
    periodRepo = makePeriodRepo();
    useCase = new ListPeriodDatesUseCase(periodRepo as any);
    periodRepo.listDates.mockResolvedValue([]);
  });

  it('delegates to repo.listDates with templateId and cycleId', async () => {
    await useCase.execute('template-uuid-1', 'cycle-uuid-1');
    expect(periodRepo.listDates).toHaveBeenCalledWith('template-uuid-1', 'cycle-uuid-1');
  });
});
