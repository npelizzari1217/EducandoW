import { describe, it, expect } from 'vitest';
import { User } from '../../entities/user';
import { Id } from '../../../shared/value-objects/id';
import { Email } from '../../../shared/value-objects/email';
import { EducationalLevelCode } from '../../../shared/value-objects/educational-level';
import { EducationalModalityCode } from '../../../shared/value-objects/educational-modality';

// ── Persona fields (F1-T1, F1-T2) ────────────────────────────
describe('User — persona fields (UP-R1)', () => {
  const baseProps = {
    email: Email.reconstruct('ana@test.com'),
    name: 'Ana García',
    passwordHash: 'hashed',
    roles: ['TEACHER'],
    modules: [],
  };

  // F1-T1 / UP-S1: User con los 5 campos → todos devueltos en read
  it('exposes persona fields when set on create', () => {
    const user = User.create({
      ...baseProps,
      firstName: 'Ana',
      lastName: 'García',
      dni: '27123456',
      title: 'Lic.',
      phone: '351-555-1234',
    });
    expect(user.firstName).toBe('Ana');
    expect(user.lastName).toBe('García');
    expect(user.dni).toBe('27123456');
    expect(user.title).toBe('Lic.');
    expect(user.phone).toBe('351-555-1234');
  });

  // F1-T1 / UP-S1: reconstruct también expone los campos
  it('exposes persona fields when reconstructed', () => {
    const user = User.reconstruct({
      ...baseProps,
      id: Id.create(),
      createdAt: new Date(),
      updatedAt: new Date(),
      firstName: 'Ana',
      lastName: 'García',
      dni: '27123456',
      title: 'Lic.',
      phone: '351-555-1234',
    });
    expect(user.firstName).toBe('Ana');
    expect(user.lastName).toBe('García');
    expect(user.dni).toBe('27123456');
    expect(user.title).toBe('Lic.');
    expect(user.phone).toBe('351-555-1234');
  });

  // F1-T2 / UP-S2: User sin campos persona → todos undefined/null, sin error
  it('returns undefined for all persona fields when not set', () => {
    const user = User.create(baseProps);
    expect(user.firstName).toBeUndefined();
    expect(user.lastName).toBeUndefined();
    expect(user.dni).toBeUndefined();
    expect(user.title).toBeUndefined();
    expect(user.phone).toBeUndefined();
  });

  // UP-S2: reconstruct sin campos persona
  it('returns undefined for persona fields when reconstructed without them', () => {
    const user = User.reconstruct({
      ...baseProps,
      id: Id.create(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(user.firstName).toBeUndefined();
    expect(user.lastName).toBeUndefined();
    expect(user.dni).toBeUndefined();
    expect(user.title).toBeUndefined();
    expect(user.phone).toBeUndefined();
  });
});

describe('User', () => {
  const validProps = {
    email: Email.reconstruct('test@test.com'),
    name: 'Test User',
    passwordHash: 'hashed123',
    roles: ['TEACHER'],
    modules: [
      { moduleCode: 'GRADES', actions: ['CREATE', 'READ'] },
      { moduleCode: 'ATTENDANCE', actions: ['CREATE', 'READ'] },
    ],
  };

  it('creates a user with generated id', () => {
    const user = User.create(validProps);
    expect(user.id).toBeDefined();
    expect(user.id.get()).toBeTruthy();
    expect(user.email.get()).toBe('test@test.com');
    expect(user.name).toBe('Test User');
    expect(user.roles).toEqual(['TEACHER']);
    expect(user.role).toBe('TEACHER');
    expect(user.active).toBe(true);
    expect(user.failedAttempts).toBe(0);
    expect(user.isLocked).toBe(false);
  });

  it('creates a user with backward-compat role param', () => {
    const user = User.create({
      email: Email.reconstruct('test2@test.com'),
      name: 'Test User 2',
      passwordHash: 'hashed',
      role: 'ADMIN',
    });
    expect(user.roles).toEqual(['ADMIN']);
    expect(user.role).toBe('ADMIN');
  });

  it('hasRole checks role membership', () => {
    const user = User.create(validProps);
    expect(user.hasRole('TEACHER')).toBe(true);
    expect(user.hasRole('ADMIN')).toBe(false);
  });

  it('hasPermission checks module+action pairs', () => {
    const user = User.create(validProps);
    expect(user.hasPermission('GRADES', 'CREATE')).toBe(true);
    expect(user.hasPermission('GRADES', 'READ')).toBe(true);
    expect(user.hasPermission('USERS', 'CREATE')).toBe(false);
    expect(user.hasPermission('ATTENDANCE', 'READ')).toBe(true);
  });

  it('hasPermission legacy single-string format', () => {
    const user = User.create(validProps);
    expect(user.hasPermission('GRADES_CREATE')).toBe(true);
    expect(user.hasPermission('GRADES_READ')).toBe(true);
    expect(user.hasPermission('ATTENDANCE_CREATE')).toBe(true);
    expect(user.hasPermission('USERS_CREATE')).toBe(false);
    expect(user.hasPermission('ANY_PERMISSION')).toBe(false);
  });

  it('ROOT role grants all permissions', () => {
    const user = User.create({
      email: Email.reconstruct('root@test.com'),
      name: 'Root User',
      passwordHash: 'hashed',
      roles: ['ROOT'],
    });
    expect(user.hasPermission('GRADES', 'CREATE')).toBe(true);
    expect(user.hasPermission('ANY_MODULE', 'ANY_ACTION')).toBe(true);
    expect(user.hasPermission('ANY_PERMISSION')).toBe(true);
  });

  it('reconstruct returns a user with given id', () => {
    const id = Id.create();
    const user = User.reconstruct({ ...validProps, id, createdAt: new Date(), updatedAt: new Date() });
    expect(user.id.get()).toBe(id.get());
  });

  it('backward-compat role returns first role', () => {
    const user = User.reconstruct({
      ...validProps,
      roles: ['ADMIN', 'DIRECTOR'],
      id: Id.create(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(user.role).toBe('ADMIN');
  });

  it('role defaults to TEACHER when no roles', () => {
    const user = User.create({
      email: Email.reconstruct('norole@test.com'),
      name: 'No Role',
      passwordHash: 'hashed',
    });
    expect(user.role).toBe('TEACHER');
    expect(user.roles).toEqual([]);
  });

  it('setPasswordHash updates the hash', () => {
    const user = User.create(validProps);
    user.setPasswordHash('new-hash');
    expect(user.passwordHash).toBe('new-hash');
  });

  it('assignToInstitution sets institutionId', () => {
    const user = User.create(validProps);
    user.assignToInstitution('inst-123');
    expect(user.institutionId?.get()).toBe('inst-123');
  });

  it('addLevel adds educational level to user', () => {
    const user = User.create(validProps);
    user.addLevel(EducationalLevelCode.SECUNDARIO, EducationalModalityCode.COMUN);
    expect(user.levels).toHaveLength(1);
    expect(user.levels[0]).toEqual({
      level: EducationalLevelCode.SECUNDARIO,
      modality: EducationalModalityCode.COMUN,
    });
    expect(user.hasLevel({ level: EducationalLevelCode.SECUNDARIO, modality: EducationalModalityCode.COMUN })).toBe(true);
  });

  it('reconstruct preserves all props', () => {
    const id = Id.create();
    const createdAt = new Date('2024-01-01');
    const updatedAt = new Date('2024-06-01');
    const user = User.reconstruct({
      ...validProps,
      id,
      modules: [
        { moduleCode: 'STUDENTS', actions: ['READ'] },
        { moduleCode: 'GRADES', actions: ['READ', 'CREATE'] },
      ],
      institutionId: Id.reconstruct('inst-1'),
      levels: [
        { level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN },
      ],
      createdAt,
      updatedAt,
    });
    expect(user.id.get()).toBe(id.get());
    expect(user.roles).toEqual(['TEACHER']);
    expect(user.modules).toEqual([
      { moduleCode: 'STUDENTS', actions: ['READ'] },
      { moduleCode: 'GRADES', actions: ['READ', 'CREATE'] },
    ]);
    expect(user.hasPermission('STUDENTS', 'READ')).toBe(true);
    expect(user.hasPermission('GRADES', 'CREATE')).toBe(true);
    expect(user.institutionId?.get()).toBe('inst-1');
    expect(user.levels).toHaveLength(1);
    expect(user.levels[0]).toEqual({
      level: EducationalLevelCode.PRIMARIO,
      modality: EducationalModalityCode.COMUN,
    });
    expect(user.createdAt).toEqual(createdAt);
    expect(user.updatedAt).toEqual(updatedAt);
  });

  it('getModuleActions returns actions for a module', () => {
    const user = User.create(validProps);
    const actions = user.getModuleActions('GRADES');
    expect(actions).toContain('CREATE');
    expect(actions).toContain('READ');
    expect(user.getModuleActions('NONEXISTENT')).toEqual([]);
  });

  describe('security', () => {
    it('incrementFailedAttempts increases counter', () => {
      const user = User.create(validProps);
      user.incrementFailedAttempts();
      expect(user.failedAttempts).toBe(1);
      user.incrementFailedAttempts();
      expect(user.failedAttempts).toBe(2);
    });

    it('resetFailedAttempts clears counter and lock', () => {
      const user = User.create(validProps);
      user.incrementFailedAttempts();
      user.incrementFailedAttempts();
      user.lock(15);
      user.resetFailedAttempts();
      expect(user.failedAttempts).toBe(0);
      expect(user.lockedUntil).toBeUndefined();
      expect(user.isLocked).toBe(false);
    });

    it('lock sets lockedUntil in the future', () => {
      const user = User.create(validProps);
      user.lock(15);
      expect(user.lockedUntil).toBeDefined();
      expect(user.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
      expect(user.isLocked).toBe(true);
    });

    it('isLocked returns false when not locked', () => {
      const user = User.create(validProps);
      expect(user.isLocked).toBe(false);
    });

    it('isLocked returns false when lock expired', () => {
      const id = Id.create();
      const pastLock = new Date(Date.now() - 1000);
      const user = User.reconstruct({
        ...validProps,
        id,
        lockedUntil: pastLock,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(user.isLocked).toBe(false);
    });

    it('softDelete sets active to false and records deletedAt', () => {
      const user = User.create(validProps);
      user.softDelete();
      expect(user.active).toBe(false);
      expect(user.deletedAt).toBeDefined();
      expect(user.deletedAt).toBeInstanceOf(Date);
    });
  });
});
