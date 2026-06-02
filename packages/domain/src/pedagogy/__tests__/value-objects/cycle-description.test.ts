import { describe, it, expect } from 'vitest';
import { CycleDescription } from '../../value-objects/cycle-description';

describe('CycleDescription', () => {
  it('accepts valid description', () => {
    const result = CycleDescription.create('Ciclo lectivo del año 2026');
    expect(result.isOk()).toBe(true);
    const desc = result.unwrap();
    expect(desc.get()).toBe('Ciclo lectivo del año 2026');
  });

  it('rejects empty string', () => {
    const result = CycleDescription.create('');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('cannot be empty');
  });

  it('rejects whitespace-only string', () => {
    const result = CycleDescription.create('   ');
    expect(result.isErr()).toBe(true);
  });

  it('trims leading and trailing whitespace', () => {
    const result = CycleDescription.create('  My cycle  ');
    expect(result.isOk()).toBe(true);
    const desc = result.unwrap();
    expect(desc.get()).toBe('My cycle');
  });

  it('reconstruct preserves value', () => {
    const desc = CycleDescription.reconstruct('Test description');
    expect(desc.get()).toBe('Test description');
  });

  it('equals returns true for same value', () => {
    const a = CycleDescription.reconstruct('Same text');
    const b = CycleDescription.reconstruct('Same text');
    expect(a.equals(b)).toBe(true);
  });

  it('equals returns false for different value', () => {
    const a = CycleDescription.reconstruct('Text A');
    const b = CycleDescription.reconstruct('Text B');
    expect(a.equals(b)).toBe(false);
  });
});
