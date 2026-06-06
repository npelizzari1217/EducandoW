import { describe, it, expect } from 'vitest';
import { ObservationType, ObservationTypeValue } from '../../value-objects/observation-type';

describe('ObservationType', () => {
  // ── Valid cases ──────────────────────────────────────────────────────────────

  it('creates PEDAGOGICAL type from exact string', () => {
    const result = ObservationType.create('PEDAGOGICAL');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().value).toBe(ObservationTypeValue.PEDAGOGICAL);
  });

  it('creates PSYCHOPEDAGOGICAL type from exact string', () => {
    const result = ObservationType.create('PSYCHOPEDAGOGICAL');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().value).toBe(ObservationTypeValue.PSYCHOPEDAGOGICAL);
  });

  it('accepts lowercase input (case-insensitive)', () => {
    const result = ObservationType.create('pedagogical');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().value).toBe(ObservationTypeValue.PEDAGOGICAL);
  });

  it('accepts mixed-case input', () => {
    const result = ObservationType.create('Psychopedagogical');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().value).toBe(ObservationTypeValue.PSYCHOPEDAGOGICAL);
  });

  // ── Invalid cases ────────────────────────────────────────────────────────────

  it('returns err for unknown type string', () => {
    const result = ObservationType.create('UNKNOWN');
    expect(result.isErr()).toBe(true);
  });

  it('returns err for empty string', () => {
    const result = ObservationType.create('');
    expect(result.isErr()).toBe(true);
  });

  it('returns err for numeric string', () => {
    const result = ObservationType.create('123');
    expect(result.isErr()).toBe(true);
  });

  // ── reconstruct ──────────────────────────────────────────────────────────────

  it('reconstruct restores the VO from a known enum value', () => {
    const vo = ObservationType.reconstruct(ObservationTypeValue.PSYCHOPEDAGOGICAL);
    expect(vo.value).toBe(ObservationTypeValue.PSYCHOPEDAGOGICAL);
  });
});
