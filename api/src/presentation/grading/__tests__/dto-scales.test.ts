/**
 * T19 [RED] — DTO validation tests for grading scales.
 * Tests written before DTOs exist (TDD RED).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { BadRequestException } from '@nestjs/common';

let CreateGradeScaleSchema: any;
let UpdateGradeScaleSchema: any;
let CreateGradeScaleValueSchema: any;
let UpdateGradeScaleValueSchema: any;

beforeAll(async () => {
  const createScaleMod = await import('../dto/create-grade-scale.dto');
  CreateGradeScaleSchema = createScaleMod.CreateGradeScaleSchema;

  const updateScaleMod = await import('../dto/update-grade-scale.dto');
  UpdateGradeScaleSchema = updateScaleMod.UpdateGradeScaleSchema;

  const createValueMod = await import('../dto/create-grade-scale-value.dto');
  CreateGradeScaleValueSchema = createValueMod.CreateGradeScaleValueSchema;

  const updateValueMod = await import('../dto/update-grade-scale-value.dto');
  UpdateGradeScaleValueSchema = updateValueMod.UpdateGradeScaleValueSchema;
});

// ── CreateGradeScaleSchema ────────────────────────────────────

const validCreateScale = {
  name: 'Numérica 1-10',
  level: 2,
  modality: 0,
};

describe('CreateGradeScaleSchema', () => {
  it('accepts valid payload', () => {
    const pipe = new ZodValidationPipe(CreateGradeScaleSchema);
    expect(() => pipe.transform(validCreateScale)).not.toThrow();
  });

  it('rejects missing name → 400', () => {
    const pipe = new ZodValidationPipe(CreateGradeScaleSchema);
    expect(() => pipe.transform({ level: 2, modality: 0 })).toThrow(BadRequestException);
  });

  it('rejects empty name → 400', () => {
    const pipe = new ZodValidationPipe(CreateGradeScaleSchema);
    expect(() => pipe.transform({ ...validCreateScale, name: '' })).toThrow(BadRequestException);
  });

  it('rejects missing level → 400', () => {
    const pipe = new ZodValidationPipe(CreateGradeScaleSchema);
    expect(() => pipe.transform({ name: 'Test', modality: 0 })).toThrow(BadRequestException);
  });

  it('rejects level=5 (out of range) → 400', () => {
    const pipe = new ZodValidationPipe(CreateGradeScaleSchema);
    expect(() => pipe.transform({ ...validCreateScale, level: 5 })).toThrow(BadRequestException);
  });

  it('rejects level=0 → 400', () => {
    const pipe = new ZodValidationPipe(CreateGradeScaleSchema);
    expect(() => pipe.transform({ ...validCreateScale, level: 0 })).toThrow(BadRequestException);
  });

  it('defaults modality to 0 when not provided', () => {
    const pipe = new ZodValidationPipe(CreateGradeScaleSchema);
    const result = pipe.transform({ name: 'Test', level: 2 }) as { modality: number };
    expect(result.modality).toBe(0);
  });
});

// ── UpdateGradeScaleSchema ────────────────────────────────────

describe('UpdateGradeScaleSchema', () => {
  it('accepts valid partial payload', () => {
    const pipe = new ZodValidationPipe(UpdateGradeScaleSchema);
    expect(() => pipe.transform({ name: 'New name' })).not.toThrow();
  });

  it('accepts empty object (all optional)', () => {
    const pipe = new ZodValidationPipe(UpdateGradeScaleSchema);
    expect(() => pipe.transform({})).not.toThrow();
  });
});

// ── CreateGradeScaleValueSchema ───────────────────────────────

const validCreateValue = {
  code: '10',
  label: 'Diez',
  internalStatus: 'APROBADO',
  sortOrder: 0,
};

describe('CreateGradeScaleValueSchema', () => {
  it('accepts valid payload', () => {
    const pipe = new ZodValidationPipe(CreateGradeScaleValueSchema);
    expect(() => pipe.transform(validCreateValue)).not.toThrow();
  });

  it('rejects internalStatus outside enum → 400 (REQ-8 scenario 2.2)', () => {
    const pipe = new ZodValidationPipe(CreateGradeScaleValueSchema);
    expect(() =>
      pipe.transform({ ...validCreateValue, internalStatus: 'INVALID_STATUS' }),
    ).toThrow(BadRequestException);
  });

  it('rejects empty code → 400 (REQ-8 scenario 8.3)', () => {
    const pipe = new ZodValidationPipe(CreateGradeScaleValueSchema);
    expect(() => pipe.transform({ ...validCreateValue, code: '' })).toThrow(BadRequestException);
  });

  it('rejects missing code → 400', () => {
    const pipe = new ZodValidationPipe(CreateGradeScaleValueSchema);
    expect(() =>
      pipe.transform({ label: 'Diez', internalStatus: 'APROBADO', sortOrder: 0 }),
    ).toThrow(BadRequestException);
  });

  it('accepts all 4 valid internalStatus values', () => {
    const pipe = new ZodValidationPipe(CreateGradeScaleValueSchema);
    for (const status of ['APROBADO', 'NO_APROBADO', 'EN_PROCESO', 'LIBRE']) {
      expect(() =>
        pipe.transform({ ...validCreateValue, internalStatus: status }),
      ).not.toThrow();
    }
  });

  it('defaults sortOrder to 0 when not provided', () => {
    const pipe = new ZodValidationPipe(CreateGradeScaleValueSchema);
    const result = pipe.transform({ code: '10', label: 'Diez', internalStatus: 'APROBADO' }) as {
      sortOrder: number;
    };
    expect(result.sortOrder).toBe(0);
  });
});

// ── UpdateGradeScaleValueSchema ───────────────────────────────

describe('UpdateGradeScaleValueSchema', () => {
  it('accepts valid partial payload', () => {
    const pipe = new ZodValidationPipe(UpdateGradeScaleValueSchema);
    expect(() => pipe.transform({ label: 'Nueva etiqueta' })).not.toThrow();
  });

  it('rejects invalid internalStatus in update → 400', () => {
    const pipe = new ZodValidationPipe(UpdateGradeScaleValueSchema);
    expect(() =>
      pipe.transform({ internalStatus: 'WRONG_VALUE' }),
    ).toThrow(BadRequestException);
  });
});
