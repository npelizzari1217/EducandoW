import { describe, it, expect } from 'vitest';
import { Teacher } from '../../entities/teacher';
import { Dni } from '../../value-objects/dni';
import { Email } from '../../../shared/value-objects/email';
import { Id } from '../../../shared/value-objects/id';

describe('Teacher', () => {
  const institutionId = Id.reconstruct('inst-1');
  const validPropsWithInst = {
    firstName: 'Ana',
    lastName: 'García',
    dni: Dni.reconstruct('87654321'),
    email: Email.reconstruct('ana@test.com'),
    institutionId,
  };

  const validPropsWithoutInst = {
    firstName: 'Ana',
    lastName: 'García',
    dni: Dni.reconstruct('87654321'),
    email: Email.reconstruct('ana@test.com'),
  };

  it('creates a teacher with generated id and Id VO institutionId', () => {
    const t = Teacher.create(validPropsWithInst);
    expect(t.id.get()).toBeTruthy();
    expect(t.firstName).toBe('Ana');
    expect(t.fullName).toBe('García, Ana');
    expect(t.email.get()).toBe('ana@test.com');
    expect(t.institutionId).toBeDefined();
    expect(t.institutionId!.get()).toBe('inst-1');
  });

  it('creates a teacher without institutionId', () => {
    const t = Teacher.create(validPropsWithoutInst);
    expect(t.id.get()).toBeTruthy();
    expect(t.firstName).toBe('Ana');
    expect(t.institutionId).toBeUndefined();
  });

  it('reconstruct with optional title and phone', () => {
    const t = Teacher.reconstruct({
      ...validPropsWithInst,
      id: Id.create(),
      phone: '555',
      title: 'Licenciada',
      institutionId: Id.reconstruct('inst-1'),
    });
    expect(t.phone).toBe('555');
    expect(t.title).toBe('Licenciada');
    expect(t.institutionId!.get()).toBe('inst-1');
  });

  it('institutionId is accessible via VO get()', () => {
    const t = Teacher.create(validPropsWithInst);
    expect(t.institutionId).toBeDefined();
    expect(t.institutionId!.get()).toBe('inst-1');
  });
});
