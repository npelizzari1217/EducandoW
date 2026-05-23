import { describe, it, expect } from 'vitest';
import { User } from '../../entities/user';
import { Id } from '../../../shared/value-objects/id';
import { Email } from '../../../shared/value-objects/email';
import { Level, LevelType } from '../../../institution/value-objects/level';

describe('User', () => {
  const validProps = {
    email: Email.reconstruct('test@test.com'),
    name: 'Test User',
    hashedPassword: 'hashed123',
    role: 'TEACHER' as const,
  };

  it('creates a user with generated id', () => {
    const user = User.create(validProps);
    expect(user.id).toBeDefined();
    expect(user.id.get()).toBeTruthy();
    expect(user.email.get()).toBe('test@test.com');
    expect(user.name).toBe('Test User');
    expect(user.role).toBe('TEACHER');
  });

  it('reconstruct returns a user with given id', () => {
    const id = Id.create();
    const user = User.reconstruct({ ...validProps, id, createdAt: new Date(), updatedAt: new Date() });
    expect(user.id.get()).toBe(id.get());
  });

  it('setHashedPassword updates the hash', () => {
    const user = User.create(validProps);
    user.setHashedPassword('new-hash');
    expect(user.hashedPassword).toBe('new-hash');
  });

  it('assignToInstitution sets institutionId', () => {
    const user = User.create(validProps);
    user.assignToInstitution('inst-123');
    expect(user.institutionId).toBe('inst-123');
  });

  it('assignLevel sets the level', () => {
    const user = User.create(validProps);
    user.assignLevel(Level.reconstruct(LevelType.SECUNDARIO));
    expect(user.level?.get()).toBe(LevelType.SECUNDARIO);
  });

  it('reconstruct preserves all props', () => {
    const id = Id.create();
    const createdAt = new Date('2024-01-01');
    const updatedAt = new Date('2024-06-01');
    const user = User.reconstruct({
      ...validProps,
      id,
      institutionId: 'inst-1',
      level: Level.reconstruct(LevelType.PRIMARIO),
      createdAt,
      updatedAt,
    });
    expect(user.id.get()).toBe(id.get());
    expect(user.institutionId).toBe('inst-1');
    expect(user.level?.get()).toBe(LevelType.PRIMARIO);
    expect(user.createdAt).toEqual(createdAt);
    expect(user.updatedAt).toEqual(updatedAt);
  });
});
