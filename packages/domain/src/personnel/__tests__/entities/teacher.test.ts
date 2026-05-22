import { describe, it, expect } from 'vitest';
import { Teacher } from '../../entities/teacher';
import { Dni } from '../../value-objects/dni';
import { Email } from '../../../shared/value-objects/email';

describe('Teacher', () => {
  const validProps = {
    firstName: 'Ana',
    lastName: 'García',
    dni: Dni.reconstruct('87654321'),
    email: Email.reconstruct('ana@test.com'),
    institutionId: 'inst-1',
  };

  it('creates a teacher with generated id', () => {
    const t = Teacher.create(validProps);
    expect(t.id.get()).toBeTruthy();
    expect(t.firstName).toBe('Ana');
    expect(t.fullName).toBe('García, Ana');
    expect(t.email.get()).toBe('ana@test.com');
  });

  it('reconstruct with optional title and phone', () => {
    const t = Teacher.reconstruct({ ...validProps, id: {} as any, phone: '555', title: 'Licenciada' });
    expect(t.phone).toBe('555');
    expect(t.title).toBe('Licenciada');
  });

  it('institutionId is accessible', () => {
    const t = Teacher.create(validProps);
    expect(t.institutionId).toBe('inst-1');
  });
});
