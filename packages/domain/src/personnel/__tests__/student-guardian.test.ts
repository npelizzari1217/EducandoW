import { describe, it, expect } from 'vitest';
import { StudentGuardian } from '../entities/student-guardian';
import { Id } from '../../shared/value-objects/id';
import { Mobile } from '../../shared/value-objects/mobile';
import { Email } from '../../shared/value-objects/email';

describe('StudentGuardian', () => {
  describe('create() — returns Result (REQ-RYT-03, REQ-RYT-04)', () => {
    it('returns Ok for valid props — free-text relationship ≤15 chars', () => {
      const result = StudentGuardian.create({
        studentId: 's1',
        userId: 'u-tutor',
        relationship: 'mother',
      });

      expect(result.isOk()).toBe(true);
      const g = result.unwrap();
      expect(g.studentId).toBe('s1');
      expect(g.userId).toBe('u-tutor');
      expect(g.relationship).toBe('mother');
      expect(g.isFinancialResponsible).toBe(false);
      expect(g.isAuthorizedToPickUp).toBe(false);
      expect(g.active).toBe(true);
      expect(g.createdAt).toBeInstanceOf(Date);
      expect(g.updatedAt).toBeInstanceOf(Date);
      expect(g.id).toBeInstanceOf(Id);
    });

    it('accepts any free-text relationship value of 1–15 chars (REQ-RYT-04-A)', () => {
      const values = ['mother', 'father', 'legal_guardian', 'other', 'abuela', 'tutora', 'a'];
      for (const rel of values) {
        const result = StudentGuardian.create({ studentId: 's1', userId: 'u1', relationship: rel });
        expect(result.isOk()).toBe(true);
        expect(result.unwrap().relationship).toBe(rel);
      }
    });

    it('returns Err for relationship > 15 chars (REQ-RYT-04-B)', () => {
      const result = StudentGuardian.create({
        studentId: 's1',
        userId: 'u1',
        relationship: 'tutora_externa_x', // 16 chars
      });
      expect(result.isErr()).toBe(true);
    });

    it('returns Err for empty relationship (REQ-RYT-04-C)', () => {
      const result = StudentGuardian.create({
        studentId: 's1',
        userId: 'u1',
        relationship: '',
      });
      expect(result.isErr()).toBe(true);
    });

    it('returns Err for whitespace-only relationship', () => {
      const result = StudentGuardian.create({
        studentId: 's1',
        userId: 'u1',
        relationship: '   ',
      });
      expect(result.isErr()).toBe(true);
    });

    it('userId is optional — create() succeeds without it (REQ-RYT-03-A)', () => {
      const result = StudentGuardian.create({
        studentId: 's1',
        relationship: 'abuela',
      });
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().userId).toBeUndefined();
    });

    it('userId present is retained (REQ-RYT-03-B)', () => {
      const result = StudentGuardian.create({
        studentId: 's1',
        userId: 'u-tutor',
        relationship: 'father',
      });
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().userId).toBe('u-tutor');
    });

    it('active defaults to true when omitted (REQ-RYT-02)', () => {
      const result = StudentGuardian.create({ studentId: 's1', relationship: 'madre' });
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().active).toBe(true);
    });

    it('accepts fullName and mobile — optional at entity level (REQ-RYT-02)', () => {
      const mobileResult = Mobile.create('+5492215551234');
      expect(mobileResult.isOk()).toBe(true);

      const result = StudentGuardian.create({
        studentId: 's1',
        relationship: 'madre',
        fullName: 'Ana García',
        mobile: mobileResult.unwrap(),
      });
      expect(result.isOk()).toBe(true);
      const g = result.unwrap();
      expect(g.fullName).toBe('Ana García');
      expect(g.mobile?.get()).toBe('+5492215551234');
    });

    it('create() without fullName/mobile still succeeds — entity ADR', () => {
      const result = StudentGuardian.create({ studentId: 's1', relationship: 'padre' });
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().fullName).toBeUndefined();
      expect(result.unwrap().mobile).toBeUndefined();
    });

    it('accepts email optional (REQ-RYT-02)', () => {
      const emailResult = Email.create('test@example.com');
      expect(emailResult.isOk()).toBe(true);

      const result = StudentGuardian.create({
        studentId: 's1',
        relationship: 'padre',
        email: emailResult.unwrap(),
      });
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().email?.get()).toBe('test@example.com');
    });

    it('persists explicit boolean fields', () => {
      const result = StudentGuardian.create({
        studentId: 's1',
        relationship: 'father',
        isFinancialResponsible: true,
        isAuthorizedToPickUp: true,
      });
      expect(result.isOk()).toBe(true);
      const g = result.unwrap();
      expect(g.isFinancialResponsible).toBe(true);
      expect(g.isAuthorizedToPickUp).toBe(true);
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs with all fields', () => {
      const id = Id.create('existing-id');
      const createdAt = new Date('2024-01-15T10:00:00Z');
      const updatedAt = new Date('2024-01-20T10:00:00Z');

      const guardian = StudentGuardian.reconstruct({
        id,
        studentId: 's1',
        userId: 'u-tutor',
        relationship: 'father',
        fullName: 'Ana García',
        mobile: undefined,
        email: undefined,
        isFinancialResponsible: true,
        isAuthorizedToPickUp: false,
        active: true,
        createdAt,
        updatedAt,
      });

      expect(guardian.id.get()).toBe('existing-id');
      expect(guardian.userId).toBe('u-tutor');
      expect(guardian.fullName).toBe('Ana García');
      expect(guardian.active).toBe(true);
      expect(guardian.updatedAt).toEqual(updatedAt);
      expect(guardian.createdAt).toEqual(createdAt);
    });

    it('reconstructs with undefined userId (study tutor)', () => {
      const id = Id.create('sg-1');
      const now = new Date();
      const guardian = StudentGuardian.reconstruct({
        id,
        studentId: 's1',
        userId: undefined,
        relationship: 'abuela',
        fullName: 'Ana García',
        mobile: undefined,
        email: undefined,
        isFinancialResponsible: false,
        isAuthorizedToPickUp: false,
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      expect(guardian.userId).toBeUndefined();
      expect(guardian.fullName).toBe('Ana García');
    });
  });

  describe('update() mutation method (REQ-RYT-02, REQ-RYT-06)', () => {
    it('updates fullName and bumps updatedAt', () => {
      const result = StudentGuardian.create({
        studentId: 's1',
        relationship: 'padre',
        fullName: 'Old Name',
      });
      expect(result.isOk()).toBe(true);
      const guardian = result.unwrap();

      guardian.update({ fullName: 'New Name' });

      expect(guardian.fullName).toBe('New Name');
      expect(guardian.updatedAt).toBeInstanceOf(Date);
    });

    it('updates active status', () => {
      const result = StudentGuardian.create({ studentId: 's1', relationship: 'padre' });
      const guardian = result.unwrap();
      expect(guardian.active).toBe(true);

      guardian.update({ active: false });
      expect(guardian.active).toBe(false);
    });

    it('updates mobile', () => {
      const result = StudentGuardian.create({ studentId: 's1', relationship: 'padre' });
      const guardian = result.unwrap();

      const mobileResult = Mobile.create('+5492215554321');
      expect(mobileResult.isOk()).toBe(true);
      guardian.update({ mobile: mobileResult.unwrap() });

      expect(guardian.mobile?.get()).toBe('+5492215554321');
    });

    it('sets email to null when null passed', () => {
      const emailResult = Email.create('old@example.com');
      const result = StudentGuardian.create({
        studentId: 's1',
        relationship: 'padre',
        email: emailResult.unwrap(),
      });
      const guardian = result.unwrap();
      expect(guardian.email).toBeDefined();

      guardian.update({ email: null });
      expect(guardian.email).toBeUndefined();
    });
  });
});
