/**
 * T46 [RED] — DTO validation tests for grading period templates and dates.
 * Written before DTOs exist (TDD RED).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { BadRequestException } from '@nestjs/common';

let CreatePeriodTemplateSchema: any;
let UpdatePeriodTemplateSchema: any;
let UpsertPeriodDatesSchema: any;

beforeAll(async () => {
  const createMod = await import('../dto/create-period-template.dto');
  CreatePeriodTemplateSchema = createMod.CreatePeriodTemplateSchema;

  const updateMod = await import('../dto/update-period-template.dto');
  UpdatePeriodTemplateSchema = updateMod.UpdatePeriodTemplateSchema;

  const upsertMod = await import('../dto/upsert-period-dates.dto');
  UpsertPeriodDatesSchema = upsertMod.UpsertPeriodDatesSchema;
});

// ── CreatePeriodTemplateSchema ────────────────────────────────

const validCreateTemplate = {
  name: 'Trimestral Primaria',
  level: 2,
  modality: 0,
  items: [
    { name: '1° Trimestre', sortOrder: 1 },
    { name: '2° Trimestre', sortOrder: 2 },
    { name: '3° Trimestre', sortOrder: 3 },
  ],
};

describe('CreatePeriodTemplateSchema', () => {
  it('accepts valid payload with 3 items', () => {
    const pipe = new ZodValidationPipe(CreatePeriodTemplateSchema);
    expect(() => pipe.transform(validCreateTemplate)).not.toThrow();
  });

  it('rejects missing name → 400', () => {
    const pipe = new ZodValidationPipe(CreatePeriodTemplateSchema);
    const { name: _name, ...withoutName } = validCreateTemplate;
    expect(() => pipe.transform(withoutName)).toThrow(BadRequestException);
  });

  it('rejects empty name → 400', () => {
    const pipe = new ZodValidationPipe(CreatePeriodTemplateSchema);
    expect(() => pipe.transform({ ...validCreateTemplate, name: '' })).toThrow(BadRequestException);
  });

  it('rejects missing level → 400', () => {
    const pipe = new ZodValidationPipe(CreatePeriodTemplateSchema);
    const { level: _level, ...withoutLevel } = validCreateTemplate;
    expect(() => pipe.transform(withoutLevel)).toThrow(BadRequestException);
  });

  it('rejects level=5 → 400', () => {
    const pipe = new ZodValidationPipe(CreatePeriodTemplateSchema);
    expect(() => pipe.transform({ ...validCreateTemplate, level: 5 })).toThrow(BadRequestException);
  });

  it('rejects empty items array → 400 (REQ-4.3)', () => {
    const pipe = new ZodValidationPipe(CreatePeriodTemplateSchema);
    expect(() => pipe.transform({ ...validCreateTemplate, items: [] })).toThrow(BadRequestException);
  });

  it('rejects items with duplicate sortOrder → 400 (REQ-4.3)', () => {
    const pipe = new ZodValidationPipe(CreatePeriodTemplateSchema);
    expect(() =>
      pipe.transform({
        ...validCreateTemplate,
        items: [
          { name: '1° Trimestre', sortOrder: 1 },
          { name: '2° Trimestre', sortOrder: 1 }, // duplicate!
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects item with sortOrder=0 → 400 (sortOrder must be >= 1)', () => {
    const pipe = new ZodValidationPipe(CreatePeriodTemplateSchema);
    expect(() =>
      pipe.transform({
        ...validCreateTemplate,
        items: [{ name: '1° Trimestre', sortOrder: 0 }],
      }),
    ).toThrow(BadRequestException);
  });

  it('defaults modality to 0 when not provided', () => {
    const pipe = new ZodValidationPipe(CreatePeriodTemplateSchema);
    const { modality: _m, ...withoutModality } = validCreateTemplate;
    const result = pipe.transform(withoutModality) as { modality: number };
    expect(result.modality).toBe(0);
  });
});

// ── UpdatePeriodTemplateSchema ────────────────────────────────

describe('UpdatePeriodTemplateSchema', () => {
  it('accepts valid partial payload', () => {
    const pipe = new ZodValidationPipe(UpdatePeriodTemplateSchema);
    expect(() => pipe.transform({ name: 'New name' })).not.toThrow();
  });

  it('accepts empty object (all optional)', () => {
    const pipe = new ZodValidationPipe(UpdatePeriodTemplateSchema);
    expect(() => pipe.transform({})).not.toThrow();
  });
});

// ── UpsertPeriodDatesSchema ───────────────────────────────────

const validUpsertDates = {
  cycleId: '550e8400-e29b-41d4-a716-446655440000',
  dates: [
    {
      itemId: '550e8400-e29b-41d4-a716-446655440001',
      startDate: '2026-03-01',
      endDate: '2026-05-31',
    },
  ],
};

describe('UpsertPeriodDatesSchema', () => {
  it('accepts valid payload', () => {
    const pipe = new ZodValidationPipe(UpsertPeriodDatesSchema);
    expect(() => pipe.transform(validUpsertDates)).not.toThrow();
  });

  it('rejects non-uuid cycleId → 400', () => {
    const pipe = new ZodValidationPipe(UpsertPeriodDatesSchema);
    expect(() =>
      pipe.transform({ ...validUpsertDates, cycleId: 'not-a-uuid' }),
    ).toThrow(BadRequestException);
  });

  it('rejects dates entry with startDate after endDate → 400 (REQ-6.3)', () => {
    const pipe = new ZodValidationPipe(UpsertPeriodDatesSchema);
    expect(() =>
      pipe.transform({
        ...validUpsertDates,
        dates: [
          {
            itemId: '550e8400-e29b-41d4-a716-446655440001',
            startDate: '2026-06-01',
            endDate: '2026-03-01', // endDate before startDate!
          },
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects dates entry with startDate equal to endDate → 400 (must be strictly before)', () => {
    const pipe = new ZodValidationPipe(UpsertPeriodDatesSchema);
    expect(() =>
      pipe.transform({
        ...validUpsertDates,
        dates: [
          {
            itemId: '550e8400-e29b-41d4-a716-446655440001',
            startDate: '2026-03-01',
            endDate: '2026-03-01', // equal dates!
          },
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects missing cycleId → 400', () => {
    const pipe = new ZodValidationPipe(UpsertPeriodDatesSchema);
    const { cycleId: _c, ...withoutCycleId } = validUpsertDates;
    expect(() => pipe.transform(withoutCycleId)).toThrow(BadRequestException);
  });

  it('accepts empty dates array (partial load is permitted)', () => {
    const pipe = new ZodValidationPipe(UpsertPeriodDatesSchema);
    expect(() => pipe.transform({ ...validUpsertDates, dates: [] })).not.toThrow();
  });
});
