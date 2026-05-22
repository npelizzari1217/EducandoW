import { describe, it, expect } from 'vitest';
import { LogoUrl } from '../../value-objects/logo-url';

describe('LogoUrl', () => {
  // ── Valid cases ──────────────────────────────────────────

  it('create() returns Ok for https png URL', () => {
    const result = LogoUrl.create('https://cdn.example.com/logo.png');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('https://cdn.example.com/logo.png');
  });

  it('create() returns Ok for https jpg URL', () => {
    const result = LogoUrl.create('https://example.com/images/logo.jpg');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('https://example.com/images/logo.jpg');
  });

  it('create() returns Ok for https jpeg URL', () => {
    const result = LogoUrl.create('https://example.com/photo.jpeg');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('https://example.com/photo.jpeg');
  });

  it('create() returns Ok for https svg URL', () => {
    const result = LogoUrl.create('https://example.com/icon.svg');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('https://example.com/icon.svg');
  });

  it('create() returns Ok for http URL with png', () => {
    const result = LogoUrl.create('http://cdn.example.com/logo.png');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('http://cdn.example.com/logo.png');
  });

  it('create() returns Ok for s3 URL with jpg', () => {
    const result = LogoUrl.create('s3://my-bucket/logos/school.jpg');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('s3://my-bucket/logos/school.jpg');
  });

  it('create() returns Ok for relative URL (development)', () => {
    const result = LogoUrl.create('/uploads/logo.png');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('/uploads/logo.png');
  });

  it('create() returns Ok for relative path without leading slash', () => {
    const result = LogoUrl.create('assets/logo.svg');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('assets/logo.svg');
  });

  it('create() returns Ok for URL with query params', () => {
    const result = LogoUrl.create('https://example.com/logo.png?v=2');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('https://example.com/logo.png?v=2');
  });

  it('create() returns Ok for uppercase extension', () => {
    const result = LogoUrl.create('https://example.com/LOGO.PNG');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().get()).toBe('https://example.com/LOGO.PNG');
  });

  // ── Invalid cases ────────────────────────────────────────

  it('create() returns Err for non-image format (pdf)', () => {
    const result = LogoUrl.create('https://example.com/doc.pdf');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('Invalid logo URL');
  });

  it('create() returns Err for non-image format (zip)', () => {
    const result = LogoUrl.create('https://example.com/file.zip');
    expect(result.isErr()).toBe(true);
  });

  it('create() returns Err for URL with no extension', () => {
    const result = LogoUrl.create('https://example.com/logo');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('Invalid logo URL');
  });

  it('create() returns Err for empty string', () => {
    const result = LogoUrl.create('');
    expect(result.isErr()).toBe(true);
  });

  it('create() returns Err for random text', () => {
    const result = LogoUrl.create('not-a-url');
    expect(result.isErr()).toBe(true);
  });

  it('create() returns Err for HTML file', () => {
    const result = LogoUrl.create('https://example.com/page.html');
    expect(result.isErr()).toBe(true);
  });

  // ── reconstruct ──────────────────────────────────────────

  it('reconstruct() creates without validation', () => {
    const logo = LogoUrl.reconstruct('https://example.com/logo.png');
    expect(logo.get()).toBe('https://example.com/logo.png');
  });

  it('reconstruct() accepts any string (validation bypass)', () => {
    const logo = LogoUrl.reconstruct('https://example.com/doc.pdf');
    expect(logo.get()).toBe('https://example.com/doc.pdf');
  });

  // ── getter ───────────────────────────────────────────────

  it('get() returns the stored URL value', () => {
    const logo = LogoUrl.reconstruct('https://example.com/logo.png');
    expect(logo.get()).toBe('https://example.com/logo.png');
  });

  // ── equals ───────────────────────────────────────────────

  it('equals() returns true for same URL', () => {
    const a = LogoUrl.reconstruct('https://example.com/logo.png');
    const b = LogoUrl.reconstruct('https://example.com/logo.png');
    expect(a.equals(b)).toBe(true);
  });

  it('equals() returns false for different URLs', () => {
    const a = LogoUrl.reconstruct('https://example.com/logo.png');
    const b = LogoUrl.reconstruct('https://other.com/logo.png');
    expect(a.equals(b)).toBe(false);
  });

  // ── toString ─────────────────────────────────────────────

  it('toString() returns the URL string', () => {
    const logo = LogoUrl.reconstruct('https://example.com/logo.png');
    expect(logo.toString()).toBe('https://example.com/logo.png');
    expect(String(logo)).toBe('https://example.com/logo.png');
  });
});
