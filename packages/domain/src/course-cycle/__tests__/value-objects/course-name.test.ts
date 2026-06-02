import { describe, it, expect } from 'vitest';
import { CourseName } from '../../value-objects/course-name';

describe('CourseName', () => {
  describe('create()', () => {
    it('creates a valid course name and normalizes to uppercase', () => {
      const r = CourseName.create('matemática');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('MATEMÁTICA');
    });

    it('returns already uppercase names unchanged', () => {
      const r = CourseName.create('HISTORIA');
      expect(r.unwrap().get()).toBe('HISTORIA');
    });

    it('trims leading and trailing whitespace before uppercasing', () => {
      const r = CourseName.create('  geografía  ');
      expect(r.unwrap().get()).toBe('GEOGRAFÍA');
    });

    it('rejects empty string', () => {
      const r = CourseName.create('');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('cannot be empty');
    });

    it('rejects whitespace-only string', () => {
      const r = CourseName.create('   ');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('cannot be empty');
    });
  });

  describe('equals()', () => {
    it('equals same name regardless of original casing', () => {
      const a = CourseName.create('matemática').unwrap();
      const b = CourseName.create('MATEMÁTICA').unwrap();
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different name', () => {
      const a = CourseName.create('HISTORIA').unwrap();
      const b = CourseName.create('GEOGRAFÍA').unwrap();
      expect(a.equals(b)).toBe(false);
    });
  });
});
