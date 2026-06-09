/**
 * PR3-T1 [RED] — Teacher entity: userId field and linkUser method.
 * Specs: TIA-R1, TIA-R2, AD-6
 */
import { describe, it, expect } from 'vitest';
import { Teacher } from './teacher';
import { Dni } from '../value-objects/dni';
import { Email } from '../../shared/value-objects/email';
import { Id } from '../../shared/value-objects/id';

const validBase = {
  firstName: 'Carlos',
  lastName: 'Pérez',
  dni: Dni.reconstruct('12345678'),
  email: Email.reconstruct('carlos@test.com'),
};

describe('Teacher — userId', () => {
  it('userId is undefined by default on create()', () => {
    const t = Teacher.create(validBase);
    expect(t.userId).toBeUndefined();
  });

  it('userId is undefined by default on reconstruct() without userId', () => {
    const t = Teacher.reconstruct({ ...validBase, id: Id.create() });
    expect(t.userId).toBeUndefined();
  });

  it('reconstruct() with userId set returns the value', () => {
    const t = Teacher.reconstruct({ ...validBase, id: Id.create(), userId: 'user-abc' });
    expect(t.userId).toBe('user-abc');
  });

  it('linkUser() sets userId and getter returns the new value', () => {
    const t = Teacher.create(validBase);
    t.linkUser('user-xyz');
    expect(t.userId).toBe('user-xyz');
  });

  it('linkUser() can overwrite a previously set userId', () => {
    const t = Teacher.reconstruct({ ...validBase, id: Id.create(), userId: 'user-old' });
    t.linkUser('user-new');
    expect(t.userId).toBe('user-new');
  });
});
