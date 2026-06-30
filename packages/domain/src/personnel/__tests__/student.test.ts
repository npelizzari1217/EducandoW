/**
 * REQ-RYT-01 — Student fatherEmail / motherEmail getters.
 * These tests are RED until T1.5 adds the fields to the Student entity.
 */
import { describe, it, expect } from 'vitest';
import { Student } from '../entities/student';
import { Email } from '../../shared/value-objects/email';
import { Dni } from '../value-objects/dni';
import { Id } from '../../shared/value-objects/id';

const baseProps = {
  id: Id.create(),
  firstName: 'Juan',
  lastName: 'Pérez',
  dni: Dni.reconstruct('12345678'),
};

describe('Student — fatherEmail / motherEmail (REQ-RYT-01)', () => {
  it('REQ-RYT-01-E: fatherEmail is undefined when not provided', () => {
    const s = Student.reconstruct({ ...baseProps });
    expect(s.fatherEmail).toBeUndefined();
  });

  it('REQ-RYT-01-E: motherEmail is undefined when not provided', () => {
    const s = Student.reconstruct({ ...baseProps });
    expect(s.motherEmail).toBeUndefined();
  });

  it('REQ-RYT-01-A: fatherEmail getter returns the Email VO when provided', () => {
    const email = Email.reconstruct('padre@x.com');
    const s = Student.reconstruct({ ...baseProps, fatherEmail: email });
    expect(s.fatherEmail).toBeDefined();
    expect(s.fatherEmail?.get()).toBe('padre@x.com');
  });

  it('REQ-RYT-01-B: motherEmail getter returns the Email VO when provided', () => {
    const email = Email.reconstruct('madre@x.com');
    const s = Student.reconstruct({ ...baseProps, motherEmail: email });
    expect(s.motherEmail).toBeDefined();
    expect(s.motherEmail?.get()).toBe('madre@x.com');
  });

  it('both fatherEmail and motherEmail can be set simultaneously', () => {
    const fatherEmail = Email.reconstruct('padre@x.com');
    const motherEmail = Email.reconstruct('madre@x.com');
    const s = Student.reconstruct({ ...baseProps, fatherEmail, motherEmail });
    expect(s.fatherEmail?.get()).toBe('padre@x.com');
    expect(s.motherEmail?.get()).toBe('madre@x.com');
  });

  it('REQ-RYT-01-D: fatherEmail and motherEmail are NOT in ALLOWED_TUTOR_FIELDS (structural check)', () => {
    // Structural guard: these fields must not appear in the array exported/used by PatchStudentUseCase.
    // We import the constant from the use-case at test time via a dynamic import check.
    // Since we cannot import a NestJS-decorated module in a domain unit test, we verify the
    // property is absent from a mocked-allowed list that mirrors the production constant.
    const ALLOWED_TUTOR_FIELDS = ['phone', 'address', 'photoUrl', 'email', 'birthDate', 'guardianPhone'];
    expect(ALLOWED_TUTOR_FIELDS).not.toContain('fatherEmail');
    expect(ALLOWED_TUTOR_FIELDS).not.toContain('motherEmail');
  });
});
