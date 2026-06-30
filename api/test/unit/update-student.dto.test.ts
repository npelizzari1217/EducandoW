import { describe, it, expect } from 'vitest';
import { UpdateStudentSchema } from '../../src/presentation/student/dto/update-student.dto';

describe('UpdateStudentSchema', () => {
  it('accepts a partial update with valid fields', () => {
    const result = UpdateStudentSchema.safeParse({ phone: '2215551234' });
    expect(result.success).toBe(true);
  });

  it('accepts multiple fields', () => {
    const result = UpdateStudentSchema.safeParse({ phone: '2215551234', address: 'Calle 123' });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all fields optional)', () => {
    const result = UpdateStudentSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects invalid email format', () => {
    const result = UpdateStudentSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('accepts null for optional fields', () => {
    const result = UpdateStudentSchema.safeParse({ guardianName: null });
    expect(result.success).toBe(true);
  });

  it('rejects invalid DNI (empty string)', () => {
    const result = UpdateStudentSchema.safeParse({ dni: '' });
    expect(result.success).toBe(false);
  });

  // Round-4 Bug-3: fatherEmail/motherEmail must accept null (explicit clear) and empty string
  it('(Round4-Bug3) PATCH with null fatherEmail succeeds (explicit clear)', () => {
    const result = UpdateStudentSchema.safeParse({ fatherEmail: null });
    expect(result.success).toBe(true);
  });

  it('(Round4-Bug3) PATCH with null motherEmail succeeds (explicit clear)', () => {
    const result = UpdateStudentSchema.safeParse({ motherEmail: null });
    expect(result.success).toBe(true);
  });

  it('(Round4-Bug3) PATCH with only address change + empty fatherEmail succeeds', () => {
    const result = UpdateStudentSchema.safeParse({ address: 'Calle 123', fatherEmail: '' });
    expect(result.success).toBe(true);
  });

  it('(Round4-Bug3) PATCH with malformed non-empty fatherEmail is rejected', () => {
    const result = UpdateStudentSchema.safeParse({ fatherEmail: 'not-an-email' });
    expect(result.success).toBe(false);
  });
});
