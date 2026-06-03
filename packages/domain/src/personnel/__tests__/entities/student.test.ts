import { describe, it, expect } from 'vitest';
import { Student } from '../../entities/student';
import { Dni } from '../../value-objects/dni';
import { Id } from '../../../shared/value-objects/id';

describe('Student', () => {
  const institutionId = Id.reconstruct('inst-1');
  const validPropsWithInst = {
    firstName: 'Juan',
    lastName: 'Pérez',
    dni: Dni.reconstruct('12345678'),
    institutionId,
  };

  const validPropsWithoutInst = {
    firstName: 'Juan',
    lastName: 'Pérez',
    dni: Dni.reconstruct('12345678'),
  };

  it('creates a student with generated id and Id VO institutionId', () => {
    const s = Student.create(validPropsWithInst);
    expect(s.id.get()).toBeTruthy();
    expect(s.firstName).toBe('Juan');
    expect(s.lastName).toBe('Pérez');
    expect(s.dni.get()).toBe('12345678');
    expect(s.institutionId).toBeDefined();
    expect(s.institutionId!.get()).toBe('inst-1');
  });

  it('creates a student without institutionId', () => {
    const s = Student.create(validPropsWithoutInst);
    expect(s.id.get()).toBeTruthy();
    expect(s.firstName).toBe('Juan');
    expect(s.institutionId).toBeUndefined();
  });

  it('fullName returns lastname, firstname', () => {
    const s = Student.create(validPropsWithInst);
    expect(s.fullName).toBe('Pérez, Juan');
  });

  it('optional fields default to undefined', () => {
    const s = Student.create(validPropsWithInst);
    expect(s.email).toBeUndefined();
    expect(s.birthDate).toBeUndefined();
    expect(s.guardianName).toBeUndefined();
  });

  it('reconstruct preserves all fields with Id VO institutionId', () => {
    const birthDate = new Date('2015-03-15');
    const s = Student.reconstruct({
      ...validPropsWithInst,
      id: Id.create(),
      email: undefined,
      birthDate,
      guardianName: 'María Pérez',
      guardianPhone: '555-1234',
      institutionId: Id.reconstruct('inst-1'),
    });
    expect(s.guardianName).toBe('María Pérez');
    expect(s.birthDate).toEqual(birthDate);
    expect(s.institutionId).toBeDefined();
    expect(s.institutionId!.get()).toBe('inst-1');
  });

  // ── New fields: address, phone, photoUrl, userId ─────────────

  it('optional fields (address, phone, photoUrl, userId) default to undefined', () => {
    const s = Student.create(validPropsWithInst);
    expect(s.address).toBeUndefined();
    expect(s.phone).toBeUndefined();
    expect(s.photoUrl).toBeUndefined();
    expect(s.userId).toBeUndefined();
  });

  it('create and reconstruct accept address, phone, photoUrl, userId as optional', () => {
    const created = Student.create({
      ...validPropsWithInst,
      address: 'Calle 123',
      phone: '2215551234',
      photoUrl: 'https://example.com/photo.jpg',
      userId: 'user-abc',
    });

    expect(created.address).toBe('Calle 123');
    expect(created.phone).toBe('2215551234');
    expect(created.photoUrl).toBe('https://example.com/photo.jpg');
    expect(created.userId).toBe('user-abc');

    const reconstructed = Student.reconstruct({
      ...validPropsWithInst,
      id: Id.create(),
      address: 'Av. Siempre Viva 742',
      phone: '2215559999',
      photoUrl: 'https://example.com/photo2.jpg',
      userId: 'user-xyz',
      institutionId: Id.reconstruct('inst-1'),
    });

    expect(reconstructed.address).toBe('Av. Siempre Viva 742');
    expect(reconstructed.phone).toBe('2215559999');
    expect(reconstructed.photoUrl).toBe('https://example.com/photo2.jpg');
    expect(reconstructed.userId).toBe('user-xyz');
  });
});
