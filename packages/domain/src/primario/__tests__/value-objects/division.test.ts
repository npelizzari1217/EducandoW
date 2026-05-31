import { describe, it, expect } from 'vitest';
import { Division } from '../../value-objects/division';

describe('Division', () => {
  describe('create()', () => {
    it.each(['A', 'B', 'C'])('creates division %s', (d) => {
      const r = Division.create(d);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().value).toBe(d);
    });

    it('normalizes lowercase to uppercase', () => {
      const r = Division.create('a');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().value).toBe('A');
    });

    it('trims whitespace', () => {
      const r = Division.create('  B  ');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().value).toBe('B');
    });

    it('rejects division D', () => {
      const r = Division.create('D');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('División inválida');
    });

    it('rejects empty string', () => {
      const r = Division.create('');
      expect(r.isErr()).toBe(true);
    });
  });

  describe('equals()', () => {
    it('equals same division', () => {
      const a = Division.create('A').unwrap();
      const b = Division.create('A').unwrap();
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different division', () => {
      const a = Division.create('A').unwrap();
      const b = Division.create('C').unwrap();
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString()', () => {
    it('returns string representation', () => {
      expect(Division.create('B').unwrap().toString()).toBe('B');
    });
  });
});
