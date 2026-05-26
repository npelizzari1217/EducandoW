import { describe, it, expect } from 'vitest';
import { StudentGuardian } from '../entities/student-guardian';
import { Id } from '../../shared/value-objects/id';

describe('StudentGuardian', () => {
  describe('create', () => {
    it('should create a valid guardian with all required fields', () => {
      const guardian = StudentGuardian.create({
        studentId: 's1',
        userId: 'u-tutor',
        relationship: 'mother',
      });

      expect(guardian).toBeDefined();
      expect(guardian.id).toBeInstanceOf(Id);
      expect(guardian.id.get()).toBeTruthy();
      expect(guardian.studentId).toBe('s1');
      expect(guardian.userId).toBe('u-tutor');
      expect(guardian.relationship).toBe('mother');
      expect(guardian.createdAt).toBeInstanceOf(Date);
    });

    it('should accept all valid relationship values', () => {
      const validRelationships = ['mother', 'father', 'legal_guardian', 'other'] as const;

      for (const rel of validRelationships) {
        const guardian = StudentGuardian.create({
          studentId: 's1',
          userId: 'u-tutor',
          relationship: rel,
        });
        expect(guardian.relationship).toBe(rel);
      }
    });

    it('should reject an invalid relationship value with ValidationError', () => {
      expect(() =>
        StudentGuardian.create({
          studentId: 's1',
          userId: 'u-tutor',
          relationship: 'invalid_relation' as any,
        }),
      ).toThrow();
    });
  });

  describe('reconstruct', () => {
    it('should reconstruct a guardian from persisted props', () => {
      const id = Id.create('existing-id');
      const createdAt = new Date('2024-01-15T10:00:00Z');

      const guardian = StudentGuardian.reconstruct({
        id,
        studentId: 's1',
        userId: 'u-tutor',
        relationship: 'father',
        createdAt,
      });

      expect(guardian.id.get()).toBe('existing-id');
      expect(guardian.studentId).toBe('s1');
      expect(guardian.userId).toBe('u-tutor');
      expect(guardian.relationship).toBe('father');
      expect(guardian.createdAt).toEqual(createdAt);
    });
  });

  describe('getters', () => {
    it('should expose all properties via getters', () => {
      const guardian = StudentGuardian.create({
        studentId: 's1',
        userId: 'u-tutor',
        relationship: 'legal_guardian',
      });

      expect(guardian.id.get()).toBeTruthy();
      expect(guardian.studentId).toBe('s1');
      expect(guardian.userId).toBe('u-tutor');
      expect(guardian.relationship).toBe('legal_guardian');
      expect(guardian.createdAt).toBeInstanceOf(Date);
    });
  });
});
