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
});
