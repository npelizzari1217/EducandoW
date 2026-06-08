import { describe, it, expect } from 'vitest';
import { internalStatusColor, internalStatusLabel } from '../components/grading-status';

// ── RED: failing tests for grading-status helper (2b-T1) ──────────────────────

describe('internalStatusColor', () => {
  it('returns var(--color-success) for APROBADO', () => {
    expect(internalStatusColor('APROBADO')).toBe('var(--color-success)');
  });

  it('returns var(--color-danger) for NO_APROBADO', () => {
    expect(internalStatusColor('NO_APROBADO')).toBe('var(--color-danger)');
  });

  it('returns var(--color-warning, #f59e0b) for EN_PROCESO', () => {
    expect(internalStatusColor('EN_PROCESO')).toBe('var(--color-warning, #f59e0b)');
  });

  it('returns var(--color-text-muted) for LIBRE', () => {
    expect(internalStatusColor('LIBRE')).toBe('var(--color-text-muted)');
  });

  it('returns undefined for null', () => {
    expect(internalStatusColor(null)).toBeUndefined();
  });

  it('returns undefined for unknown status', () => {
    expect(internalStatusColor('UNKNOWN')).toBeUndefined();
  });
});

describe('internalStatusLabel', () => {
  it('returns Aprobado for APROBADO', () => {
    expect(internalStatusLabel('APROBADO')).toBe('Aprobado');
  });

  it('returns No aprobado for NO_APROBADO', () => {
    expect(internalStatusLabel('NO_APROBADO')).toBe('No aprobado');
  });

  it('returns En proceso for EN_PROCESO', () => {
    expect(internalStatusLabel('EN_PROCESO')).toBe('En proceso');
  });

  it('returns Libre for LIBRE', () => {
    expect(internalStatusLabel('LIBRE')).toBe('Libre');
  });

  it('returns undefined for null', () => {
    expect(internalStatusLabel(null)).toBeUndefined();
  });
});
