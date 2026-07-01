import { describe, it, expect } from 'vitest';
import { collapseToBaseLevels, deriveAvailableLevels } from '../attendance-types';

// ═══════════════════════════════════════════════════════════
// PR5 (T31) — pure logic unit tests, tipos-asistencia-nivel-e-impresion
// Covers ADD-1.1/1.2/1.3 (collapse) and ADD-2.1-2.4 (available levels branch),
// isolated from React rendering so they run fast and stay in sync with the
// backend's baseLevels formula (AccessScope.baseLevels, packages/domain).
// ═══════════════════════════════════════════════════════════

describe('collapseToBaseLevels', () => {
  it('ADD-1.1: two modalities of the same base level collapse to one base level', () => {
    expect(collapseToBaseLevels([{ level: 2, modality: 0 }, { level: 2, modality: 1 }])).toEqual([2]);
  });

  it('ADD-1.2: distinct base levels do not collapse (sorted ascending)', () => {
    expect(collapseToBaseLevels([{ level: 3, modality: 1 }, { level: 2, modality: 0 }])).toEqual([2, 3]);
  });

  it('ADD-1.3: no levels assigned returns an empty set', () => {
    expect(collapseToBaseLevels([])).toEqual([]);
    expect(collapseToBaseLevels(undefined)).toEqual([]);
  });
});

describe('deriveAvailableLevels', () => {
  it('ADD-2.1: exactly one base level → single option', () => {
    const result = deriveAvailableLevels(false, [2]);
    expect(result).toEqual([{ value: 2, label: 'Primario' }]);
  });

  it('ADD-2.2: more than one base level → only those, no extras', () => {
    const result = deriveAvailableLevels(false, [2, 3]);
    expect(result.map((o) => o.value)).toEqual([2, 3]);
    expect(result.map((o) => o.value)).not.toContain(1);
    expect(result.map((o) => o.value)).not.toContain(4);
  });

  it('ADD-2.3: ROOT/ADMIN (allLevels) → all 4 pedagogical base levels regardless of own userLevels', () => {
    const result = deriveAvailableLevels(true, []);
    expect(result.map((o) => o.value)).toEqual([1, 2, 3, 4]);
  });

  it('ADD-2.4: zero base levels, not allLevels → empty result (front renders explicit empty state)', () => {
    expect(deriveAvailableLevels(false, [])).toEqual([]);
  });
});
