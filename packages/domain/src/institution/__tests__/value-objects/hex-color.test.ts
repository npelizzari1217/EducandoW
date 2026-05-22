import { describe, it, expect } from 'vitest';
import { HexColor } from '../../value-objects/hex-color';

describe('HexColor', () => {
  it('create() returns Ok for valid lowercase hex', () => {
    const result = HexColor.create('#1a56db');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('#1a56db');
  });

  it('create() returns Ok for valid uppercase hex', () => {
    const result = HexColor.create('#FF00AA');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('#FF00AA');
  });

  it('create() returns Ok for valid mixed-case hex', () => {
    const result = HexColor.create('#aBcDeF');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('#aBcDeF');
  });

  it('create() returns Err for 3-digit hex (invalid)', () => {
    const result = HexColor.create('#abc');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('Invalid hex color');
  });

  it('create() returns Err for missing hash', () => {
    const result = HexColor.create('1a56db');
    expect(result.isErr()).toBe(true);
  });

  it('create() returns Err for non-hex characters', () => {
    const result = HexColor.create('#GG0000');
    expect(result.isErr()).toBe(true);
  });

  it('create() returns Err for color name (e.g. "red")', () => {
    const result = HexColor.create('red');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('Invalid hex color');
  });

  it('create() returns Err for 8-digit hex', () => {
    const result = HexColor.create('#1a56dbff');
    expect(result.isErr()).toBe(true);
  });

  it('create() returns Err for empty string', () => {
    const result = HexColor.create('');
    expect(result.isErr()).toBe(true);
  });

  it('reconstruct() creates without validation', () => {
    const color = HexColor.reconstruct('#1a56db');
    expect(color.get()).toBe('#1a56db');
  });

  it('equals() works correctly', () => {
    const a = HexColor.reconstruct('#1a56db');
    const b = HexColor.reconstruct('#1a56db');
    const c = HexColor.reconstruct('#ffffff');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('toString() returns the hex value', () => {
    const color = HexColor.reconstruct('#1a56db');
    expect(color.toString()).toBe('#1a56db');
    expect(String(color)).toBe('#1a56db');
  });
});
