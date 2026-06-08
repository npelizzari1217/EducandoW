import { describe, it, expect, beforeAll } from 'vitest';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { BadRequestException } from '@nestjs/common';

// Dynamic imports allow tests to be written before the DTOs are created (RED phase).
let CreateAttendanceTypeSchema: any;
let UpdateAttendanceTypeSchema: any;

beforeAll(async () => {
  const createMod = await import('../dto/create-attendance-type.dto');
  CreateAttendanceTypeSchema = createMod.CreateAttendanceTypeSchema;

  const updateMod = await import('../dto/update-attendance-type.dto');
  UpdateAttendanceTypeSchema = updateMod.UpdateAttendanceTypeSchema;
});

const validCreate = {
  code: 'TAR',
  description: 'Tardanza',
  absenceValue: 0.5,
  level: 2,
  assignable: true,
};

describe('CreateAttendanceTypeSchema — ZodValidationPipe', () => {
  it('accepts valid payload', () => {
    const pipe = new ZodValidationPipe(CreateAttendanceTypeSchema);
    expect(() => pipe.transform(validCreate)).not.toThrow();
  });

  it('rejects code of 5+ chars → 400', () => {
    const pipe = new ZodValidationPipe(CreateAttendanceTypeSchema);
    expect(() => pipe.transform({ ...validCreate, code: 'ABCDE' })).toThrow(BadRequestException);
  });

  it('rejects absenceValue negative → 400', () => {
    const pipe = new ZodValidationPipe(CreateAttendanceTypeSchema);
    expect(() => pipe.transform({ ...validCreate, absenceValue: -1 })).toThrow(BadRequestException);
  });

  it('rejects level = 9 (ADMINISTRACION) → 400', () => {
    const pipe = new ZodValidationPipe(CreateAttendanceTypeSchema);
    expect(() => pipe.transform({ ...validCreate, level: 9 })).toThrow(BadRequestException);
  });

  it('rejects level = 5 (out of range) → 400', () => {
    const pipe = new ZodValidationPipe(CreateAttendanceTypeSchema);
    expect(() => pipe.transform({ ...validCreate, level: 5 })).toThrow(BadRequestException);
  });

  it('rejects level = 0 → 400', () => {
    const pipe = new ZodValidationPipe(CreateAttendanceTypeSchema);
    expect(() => pipe.transform({ ...validCreate, level: 0 })).toThrow(BadRequestException);
  });

  it('defaults active to true when not provided', () => {
    const pipe = new ZodValidationPipe(CreateAttendanceTypeSchema);
    const result = pipe.transform(validCreate) as { active: boolean };
    expect(result.active).toBe(true);
  });

  it('accepts active = false when provided', () => {
    const pipe = new ZodValidationPipe(CreateAttendanceTypeSchema);
    const result = pipe.transform({ ...validCreate, active: false }) as { active: boolean };
    expect(result.active).toBe(false);
  });

  it('rejects empty description', () => {
    const pipe = new ZodValidationPipe(CreateAttendanceTypeSchema);
    expect(() => pipe.transform({ ...validCreate, description: '' })).toThrow(BadRequestException);
  });
});

describe('UpdateAttendanceTypeSchema — invariants', () => {
  it('accepts valid partial update payload', () => {
    const pipe = new ZodValidationPipe(UpdateAttendanceTypeSchema);
    expect(() => pipe.transform({ description: 'Nueva desc', active: false })).not.toThrow();
  });

  it('ignores/strips code field in update payload', () => {
    const pipe = new ZodValidationPipe(UpdateAttendanceTypeSchema);
    // Schema strips unknown keys or rejects code — the parsed output must NOT include code
    const result = pipe.transform({ description: 'ok', code: 'ABC' } as object) as Record<string, unknown>;
    expect(result['code']).toBeUndefined();
  });

  it('ignores/strips level field in update payload', () => {
    const pipe = new ZodValidationPipe(UpdateAttendanceTypeSchema);
    const result = pipe.transform({ description: 'ok', level: 2 } as object) as Record<string, unknown>;
    expect(result['level']).toBeUndefined();
  });

  it('rejects absenceValue negative in update', () => {
    const pipe = new ZodValidationPipe(UpdateAttendanceTypeSchema);
    expect(() => pipe.transform({ absenceValue: -0.5 })).toThrow(BadRequestException);
  });

  it('accepts absenceValue = 0 in update', () => {
    const pipe = new ZodValidationPipe(UpdateAttendanceTypeSchema);
    expect(() => pipe.transform({ absenceValue: 0 })).not.toThrow();
  });
});
