import { describe, it, expect, beforeAll } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe';

// Dynamic import allows the test to be written before the DTO exists (RED phase).
let PrintAttendanceTypesQuerySchema: any;

beforeAll(async () => {
  const mod = await import('../print-attendance-types.dto');
  PrintAttendanceTypesQuerySchema = mod.PrintAttendanceTypesQuerySchema;
});

describe('PrintAttendanceTypesQuerySchema — ZodValidationPipe (PR4, T25/T26)', () => {
  it('accepts an empty query (both level and active optional)', () => {
    const pipe = new ZodValidationPipe(PrintAttendanceTypesQuerySchema);
    expect(() => pipe.transform({})).not.toThrow();
  });

  it('accepts level=1|2|3|4 (query strings, coerced to number)', () => {
    const pipe = new ZodValidationPipe(PrintAttendanceTypesQuerySchema);
    for (const level of ['1', '2', '3', '4']) {
      const result = pipe.transform({ level }) as { level?: number };
      expect(result.level).toBe(Number(level));
    }
  });

  it('rejects level=5 (out of range) → 400', () => {
    const pipe = new ZodValidationPipe(PrintAttendanceTypesQuerySchema);
    expect(() => pipe.transform({ level: '5' })).toThrow(BadRequestException);
  });

  it('rejects level=9 (ADMINISTRACION, not valid for AttendanceType) → 400', () => {
    const pipe = new ZodValidationPipe(PrintAttendanceTypesQuerySchema);
    expect(() => pipe.transform({ level: '9' })).toThrow(BadRequestException);
  });

  it('rejects a non-numeric level → 400', () => {
    const pipe = new ZodValidationPipe(PrintAttendanceTypesQuerySchema);
    expect(() => pipe.transform({ level: 'abc' })).toThrow(BadRequestException);
  });

  it('accepts active=true and active=false (boolean-like query strings)', () => {
    const pipe = new ZodValidationPipe(PrintAttendanceTypesQuerySchema);
    expect((pipe.transform({ active: 'true' }) as { active?: boolean }).active).toBe(true);
    expect((pipe.transform({ active: 'false' }) as { active?: boolean }).active).toBe(false);
  });

  it('rejects an invalid active value → 400', () => {
    const pipe = new ZodValidationPipe(PrintAttendanceTypesQuerySchema);
    expect(() => pipe.transform({ active: 'yes' })).toThrow(BadRequestException);
  });

  it('accepts level and active combined', () => {
    const pipe = new ZodValidationPipe(PrintAttendanceTypesQuerySchema);
    const result = pipe.transform({ level: '3', active: 'false' }) as { level?: number; active?: boolean };
    expect(result).toEqual({ level: 3, active: false });
  });
});
