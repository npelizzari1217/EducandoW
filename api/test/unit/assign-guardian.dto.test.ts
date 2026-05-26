import { describe, it, expect } from 'vitest';
import { AssignGuardianSchema } from '../../src/presentation/student/dto/assign-guardian.dto';

describe('AssignGuardianSchema', () => {
  it('accepts valid guardian assignment', () => {
    const result = AssignGuardianSchema.safeParse({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      relationship: 'mother',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing userId', () => {
    const result = AssignGuardianSchema.safeParse({ relationship: 'father' });
    expect(result.success).toBe(false);
  });

  it('rejects missing relationship', () => {
    const result = AssignGuardianSchema.safeParse({
      userId: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid relationship value', () => {
    const result = AssignGuardianSchema.safeParse({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      relationship: 'uncle',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID format', () => {
    const result = AssignGuardianSchema.safeParse({
      userId: 'not-a-uuid',
      relationship: 'mother',
    });
    expect(result.success).toBe(false);
  });
});
