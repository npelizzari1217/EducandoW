import { describe, it, expect } from 'vitest';
import { SlotCursadaTerciario } from '../../value-objects/slot-cursada-terciario';

describe('SlotCursadaTerciario', () => {
  describe('create()', () => {
    it.each(['PARCIAL_1', 'PARCIAL_2', 'RECUPERATORIO_PARCIAL_1', 'RECUPERATORIO_PARCIAL_2', 'TP'])(
      'creates %s without throwing',
      (value) => {
        const slot = SlotCursadaTerciario.create(value);
        expect(slot.get()).toBe(value);
      },
    );

    it('throws on invalid value', () => {
      expect(() => SlotCursadaTerciario.create('PARCIAL_3')).toThrow();
    });

    it('throws on empty string', () => {
      expect(() => SlotCursadaTerciario.create('')).toThrow();
    });
  });

  describe('esRecuperatorio()', () => {
    it('returns true for RECUPERATORIO_PARCIAL_1', () => {
      expect(SlotCursadaTerciario.create('RECUPERATORIO_PARCIAL_1').esRecuperatorio()).toBe(true);
    });

    it('returns true for RECUPERATORIO_PARCIAL_2', () => {
      expect(SlotCursadaTerciario.create('RECUPERATORIO_PARCIAL_2').esRecuperatorio()).toBe(true);
    });

    it('returns false for PARCIAL_1', () => {
      expect(SlotCursadaTerciario.create('PARCIAL_1').esRecuperatorio()).toBe(false);
    });

    it('returns false for TP', () => {
      expect(SlotCursadaTerciario.create('TP').esRecuperatorio()).toBe(false);
    });
  });

  describe('parcialBase()', () => {
    it('maps RECUPERATORIO_PARCIAL_1 to PARCIAL_1', () => {
      expect(SlotCursadaTerciario.create('RECUPERATORIO_PARCIAL_1').parcialBase()).toBe('PARCIAL_1');
    });

    it('maps RECUPERATORIO_PARCIAL_2 to PARCIAL_2', () => {
      expect(SlotCursadaTerciario.create('RECUPERATORIO_PARCIAL_2').parcialBase()).toBe('PARCIAL_2');
    });

    it('throws for non-recuperatorio slot', () => {
      expect(() => SlotCursadaTerciario.create('PARCIAL_1').parcialBase()).toThrow();
    });

    it('throws for TP slot', () => {
      expect(() => SlotCursadaTerciario.create('TP').parcialBase()).toThrow();
    });
  });
});
