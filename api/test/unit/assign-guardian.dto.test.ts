import { describe, it, expect } from 'vitest';
import { AssignGuardianSchema } from '../../src/presentation/student/dto/assign-guardian.dto';

describe('AssignGuardianSchema', () => {
  // Portal path: userId + relationship
  it('accepts portal path — userId (UUID) with relationship', () => {
    const result = AssignGuardianSchema.safeParse({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      relationship: 'mother',
    });
    expect(result.success).toBe(true);
  });

  // Study-tutor path: no userId (REQ-RYT-05)
  it('accepts study-tutor path — no userId, has fullName and mobile', () => {
    const result = AssignGuardianSchema.safeParse({
      fullName: 'Ana García',
      mobile: '+5492215551234',
      relationship: 'abuela',
    });
    expect(result.success).toBe(true);
  });

  // userId is now optional — omitting it is valid (study-tutor path)
  it('accepts missing userId (study-tutor path)', () => {
    const result = AssignGuardianSchema.safeParse({ relationship: 'father' });
    expect(result.success).toBe(true);
  });

  // relationship is now REQUIRED at DTO level (user decision: remove default 'tutor')
  it('rejects missing relationship', () => {
    const result = AssignGuardianSchema.safeParse({
      userId: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(false);
  });

  // relationship is now free text (not enum-constrained) — any ≤15 char string is fine
  it('accepts free-text relationship like "abuela"', () => {
    const result = AssignGuardianSchema.safeParse({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      relationship: 'abuela',
    });
    expect(result.success).toBe(true);
  });

  // relationship > 15 chars → rejected
  it('rejects relationship longer than 15 characters', () => {
    const result = AssignGuardianSchema.safeParse({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      relationship: 'a'.repeat(16),
    });
    expect(result.success).toBe(false);
  });

  // userId present but not UUID → rejected
  it('rejects invalid UUID format for userId', () => {
    const result = AssignGuardianSchema.safeParse({
      userId: 'not-a-uuid',
      relationship: 'mother',
    });
    expect(result.success).toBe(false);
  });

  // isFinancialResponsible defaults to false
  it('defaults isFinancialResponsible and isAuthorizedToPickUp to false', () => {
    const result = AssignGuardianSchema.safeParse({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      relationship: 'father',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isFinancialResponsible).toBe(false);
      expect(result.data.isAuthorizedToPickUp).toBe(false);
    }
  });
});
