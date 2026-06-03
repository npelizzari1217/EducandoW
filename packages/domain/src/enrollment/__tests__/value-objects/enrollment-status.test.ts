import { describe, it, expect } from 'vitest';
import { EnrollmentStatus } from '../../value-objects/enrollment-status';

describe('EnrollmentStatus', () => {
  // ── Valid statuses ──────────────────────────────────────

  it.each(['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED'] as const)(
    'create accepts valid status: %s',
    (status) => {
      const result = EnrollmentStatus.create(status);
      expect(result.isOk()).toBe(true);
      const vo = result.unwrap();
      expect(vo.value).toBe(status);
      expect(vo.toString()).toBe(status);
    },
  );

  it('create handles lowercase input', () => {
    const result = EnrollmentStatus.create('active');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().value).toBe('ACTIVE');
  });

  // ── Invalid statuses ────────────────────────────────────

  it('create rejects invalid status', () => {
    const result = EnrollmentStatus.create('PENDING');
    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error.message).toContain('Invalid enrollment status');
    expect(error.message).toContain('PENDING');
  });

  it('create rejects empty string', () => {
    const result = EnrollmentStatus.create('');
    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error.message).toContain('Invalid enrollment status');
  });

  it('create handles null/undefined gracefully', () => {
    const result = EnrollmentStatus.create(null as unknown as string);
    expect(result.isErr()).toBe(true);
  });

  // ── Reconstruct bypasses validation ─────────────────────

  it('reconstruct returns instance without Result wrapping', () => {
    const status = EnrollmentStatus.reconstruct('GRADUATED');
    expect(status).toBeInstanceOf(EnrollmentStatus);
    expect(status.value).toBe('GRADUATED');
  });

  // ── Equality ────────────────────────────────────────────

  it('equals returns true for same value', () => {
    const a = EnrollmentStatus.reconstruct('ACTIVE');
    const b = EnrollmentStatus.reconstruct('ACTIVE');
    expect(a.equals(b)).toBe(true);
    expect(b.equals(a)).toBe(true);
  });

  it('equals returns false for different values', () => {
    const a = EnrollmentStatus.reconstruct('ACTIVE');
    const b = EnrollmentStatus.reconstruct('GRADUATED');
    expect(a.equals(b)).toBe(false);
  });

  // ── fromCode convenience ────────────────────────────────

  it('fromCode returns matching status', () => {
    expect(EnrollmentStatus.fromCode('ACTIVE').value).toBe('ACTIVE');
    expect(EnrollmentStatus.fromCode('INACTIVE').value).toBe('INACTIVE');
    expect(EnrollmentStatus.fromCode('GRADUATED').value).toBe('GRADUATED');
    expect(EnrollmentStatus.fromCode('TRANSFERRED').value).toBe('TRANSFERRED');
  });
});
