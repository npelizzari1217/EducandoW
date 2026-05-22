import { describe, it, expect } from 'vitest';
import { Student } from '../../entities/student';
import { Dni } from '../../value-objects/dni';
import { Id } from '../../../shared/value-objects/id';

describe('Student', () => {
  const validProps = {
    firstName: 'Juan',
    lastName: 'Pérez',
    dni: Dni.reconstruct('12345678'),
    institutionId: 'inst-1',
  };

  it('creates a student with generated id', () => {
    const s = Student.create(validProps);
    expect(s.id.get()).toBeTruthy();
    expect(s.firstName).toBe('Juan');
    expect(s.lastName).toBe('Pérez');
    expect(s.dni.get()).toBe('12345678');
  });

  it('fullName returns lastname, firstname', () => {
    const s = Student.create(validProps);
    expect(s.fullName).toBe('Pérez, Juan');
  });

  it('optional fields default to undefined', () => {
    const s = Student.create(validProps);
    expect(s.email).toBeUndefined();
    expect(s.birthDate).toBeUndefined();
    expect(s.guardianName).toBeUndefined();
  });

  it('reconstruct preserves all fields', () => {
    const birthDate = new Date('2015-03-15');
    const s = Student.reconstruct({
      ...validProps,
      id: Id.create(),
      email: undefined,
      birthDate,
      guardianName: 'María Pérez',
      guardianPhone: '555-1234',
      institutionId: 'inst-1',
    });
    expect(s.guardianName).toBe('María Pérez');
    expect(s.birthDate).toEqual(birthDate);
    expect(s.institutionId).toBe('inst-1');
  });
});
