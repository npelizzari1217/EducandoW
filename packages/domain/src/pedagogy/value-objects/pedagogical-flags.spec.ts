/**
 * PR1-T5 [RED] — PedagogicalFlags VO tests.
 * Specs: PPF-R1, PPF-R4, AD-3
 */
import { describe, it, expect } from 'vitest';
import { PedagogicalFlags } from './pedagogical-flags';

describe('PedagogicalFlags.none', () => {
  it('creates a flags VO with all three flags false', () => {
    const flags = PedagogicalFlags.none();

    expect(flags.pa).toBe(false);
    expect(flags.ppi).toBe(false);
    expect(flags.pp).toBe(false);
  });
});

describe('PedagogicalFlags.with', () => {
  it('with({pa:true}) → pa true, ppi and pp false', () => {
    const flags = PedagogicalFlags.with({ pa: true });

    expect(flags.pa).toBe(true);
    expect(flags.ppi).toBe(false);
    expect(flags.pp).toBe(false);
  });

  it('with({ppi:true}) → ppi true, pa and pp false', () => {
    const flags = PedagogicalFlags.with({ ppi: true });

    expect(flags.pa).toBe(false);
    expect(flags.ppi).toBe(true);
    expect(flags.pp).toBe(false);
  });

  it('with({pp:true}) → pp true, pa and ppi false', () => {
    const flags = PedagogicalFlags.with({ pp: true });

    expect(flags.pa).toBe(false);
    expect(flags.ppi).toBe(false);
    expect(flags.pp).toBe(true);
  });

  it('each field is independently toggleable', () => {
    const flags = PedagogicalFlags.with({ pa: true, ppi: true, pp: true });

    expect(flags.pa).toBe(true);
    expect(flags.ppi).toBe(true);
    expect(flags.pp).toBe(true);
  });

  it('omitted fields default to false', () => {
    const flags = PedagogicalFlags.with({ pp: true });

    expect(flags.pa).toBe(false);
    expect(flags.ppi).toBe(false);
    expect(flags.pp).toBe(true);
  });

  it('with({}) → all false (same as none)', () => {
    const flags = PedagogicalFlags.with({});

    expect(flags.pa).toBe(false);
    expect(flags.ppi).toBe(false);
    expect(flags.pp).toBe(false);
  });
});

describe('PedagogicalFlags value-object equality', () => {
  it('two none() instances are equal', () => {
    const a = PedagogicalFlags.none();
    const b = PedagogicalFlags.none();

    expect(a.equals(b)).toBe(true);
  });

  it('with({pa:true}) is NOT equal to none()', () => {
    const a = PedagogicalFlags.with({ pa: true });
    const b = PedagogicalFlags.none();

    expect(a.equals(b)).toBe(false);
  });

  it('with({pa:true,ppi:true}) is NOT equal to with({pa:true})', () => {
    const a = PedagogicalFlags.with({ pa: true, ppi: true });
    const b = PedagogicalFlags.with({ pa: true });

    expect(a.equals(b)).toBe(false);
  });
});
