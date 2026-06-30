/**
 * Fix 9 — toGuardianOutput must null-normalize optional fields.
 *
 * Before the fix: toGuardianOutput returns undefined for absent userId/fullName/mobile/email.
 * After the fix:  toGuardianOutput returns null for those fields, matching the HTTP response
 *                 shape that mapGuardian (now removed) previously produced.
 */
import { describe, it, expect } from 'vitest';
import { toGuardianOutput } from '../student.use-cases';
import { StudentGuardian, Id, Email, Mobile } from '@educandow/domain';

// ── helpers ────────────────────────────────────────────────────────────────────

function makeGuardian(overrides: Partial<{
  userId: string;
  fullName: string;
  email: Email;
  mobile: Mobile;
}> = {}): StudentGuardian {
  return StudentGuardian.reconstruct({
    id: Id.create('g-1'),
    studentId: 'student-1',
    relationship: 'Padre',
    isFinancialResponsible: true,
    isAuthorizedToPickUp: false,
    active: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
    ...overrides,
  });
}

// ── Fix 9 tests ────────────────────────────────────────────────────────────────

describe('toGuardianOutput — null-normalization (Fix 9)', () => {
  // RED before the fix: these return undefined, not null
  it('returns null (not undefined) for absent userId', () => {
    expect(toGuardianOutput(makeGuardian()).userId).toBeNull();
  });

  it('returns null (not undefined) for absent fullName', () => {
    expect(toGuardianOutput(makeGuardian()).fullName).toBeNull();
  });

  it('returns null (not undefined) for absent mobile', () => {
    expect(toGuardianOutput(makeGuardian()).mobile).toBeNull();
  });

  it('returns null (not undefined) for absent email', () => {
    expect(toGuardianOutput(makeGuardian()).email).toBeNull();
  });

  // HTTP response shape must stay byte-identical: all 10 fields present
  it('output has exactly 10 fields (HTTP shape unchanged)', () => {
    const output = toGuardianOutput(makeGuardian());
    const keys = Object.keys(output);
    expect(keys).toEqual(expect.arrayContaining([
      'id', 'userId', 'fullName', 'mobile', 'email',
      'relationship', 'isFinancialResponsible', 'isAuthorizedToPickUp',
      'active', 'updatedAt',
    ]));
    expect(keys).toHaveLength(10);
  });

  // Already GREEN — non-null values must still be preserved
  it('preserves non-null userId when present', () => {
    const g = makeGuardian({ userId: 'user-42' });
    expect(toGuardianOutput(g).userId).toBe('user-42');
  });

  it('preserves non-null email when present', () => {
    const email = Email.reconstruct('tutor@test.com');
    const g = makeGuardian({ email });
    expect(toGuardianOutput(g).email).toBe('tutor@test.com');
  });

  it('preserves non-null mobile when present', () => {
    const mobile = Mobile.reconstruct('+5491155550001');
    const g = makeGuardian({ mobile });
    expect(toGuardianOutput(g).mobile).toBe('+5491155550001');
  });

  it('preserves fullName when present', () => {
    const g = makeGuardian({ fullName: 'Ana García' });
    expect(toGuardianOutput(g).fullName).toBe('Ana García');
  });
});
