import { describe, it, expect } from 'vitest';
import { GradingPhase } from '../../value-objects/grading-phase';

describe('GradingPhase', () => {
  describe('create()', () => {
    it.each(['BIM_1', 'BIM_2', 'BIM_3', 'BIM_4', 'CIERRE'] as const)('accepts %s', (code) => {
      const r = GradingPhase.create(code);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().code).toBe(code);
    });

    it('rejects an unknown string', () => {
      const r = GradingPhase.create('BIM_5');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('BIM_5');
    });

    it('rejects an empty string', () => {
      const r = GradingPhase.create('');
      expect(r.isErr()).toBe(true);
    });

    it('rejects lowercase variants (case-sensitive catalog)', () => {
      const r = GradingPhase.create('bim_1');
      expect(r.isErr()).toBe(true);
    });
  });

  describe('isCierre()', () => {
    it('is true for CIERRE', () => {
      expect(GradingPhase.create('CIERRE').unwrap().isCierre()).toBe(true);
    });

    it('is false for any BIM_n', () => {
      expect(GradingPhase.create('BIM_1').unwrap().isCierre()).toBe(false);
    });
  });

  describe('isBimester()', () => {
    it.each(['BIM_1', 'BIM_2', 'BIM_3', 'BIM_4'] as const)('is true for %s', (code) => {
      expect(GradingPhase.create(code).unwrap().isBimester()).toBe(true);
    });

    it('is false for CIERRE', () => {
      expect(GradingPhase.create('CIERRE').unwrap().isBimester()).toBe(false);
    });
  });

  describe('bimesterOrdinal()', () => {
    it('returns 1..4 for BIM_1..BIM_4', () => {
      expect(GradingPhase.create('BIM_1').unwrap().bimesterOrdinal()).toBe(1);
      expect(GradingPhase.create('BIM_2').unwrap().bimesterOrdinal()).toBe(2);
      expect(GradingPhase.create('BIM_3').unwrap().bimesterOrdinal()).toBe(3);
      expect(GradingPhase.create('BIM_4').unwrap().bimesterOrdinal()).toBe(4);
    });

    it('returns null for CIERRE', () => {
      expect(GradingPhase.create('CIERRE').unwrap().bimesterOrdinal()).toBeNull();
    });
  });

  describe('equals()', () => {
    it('equals same phase', () => {
      const a = GradingPhase.create('BIM_2').unwrap();
      const b = GradingPhase.create('BIM_2').unwrap();
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal a different phase', () => {
      const a = GradingPhase.create('BIM_2').unwrap();
      const b = GradingPhase.create('CIERRE').unwrap();
      expect(a.equals(b)).toBe(false);
    });
  });
});
